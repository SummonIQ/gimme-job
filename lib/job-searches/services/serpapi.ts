import {
  JobProvider,
  JobSearchStatus,
  JobType,
  type Prisma,
} from '@/generated/prisma/browser';
import { revalidateTag } from 'next/cache';

import { db } from '@/lib/db/client';
import { getPrivateUserChannel } from '@/lib/events/channels';
import { sendDataUpdate } from '@/lib/events/data-update';
import { createJobSearchListings } from '@/lib/job-searches/services/job-search-listings';
import { rateLimitServerAction } from '@/lib/rate-limit/server-actions';
import { parseRelativeTimeToDate } from '@/lib/time';
import { getCurrentUser } from '@/lib/user/query';
import type { SerpApiJobSearchResultsResponse } from '@/types/api/serp-api';
import { DataEventType } from '@/types/events/data-update';
import { getJson } from 'serpapi';

const getJobType = (scheduleType?: string) => {
  switch (scheduleType) {
    case 'Full-time':
      return JobType.FULL_TIME;
    case 'Part-time':
      return JobType.PART_TIME;
    case 'Full-time and Part-time':
      return JobType.FULL_TIME_AND_PART_TIME;
    default:
      return JobType.UNKNOWN;
  }
};
const SERPAPI_DEFAULT_LOCATION = 'United States';

// Helper: update job search progress with more detailed information
async function updateJobSearch({
  jobSearchId,
  progress = undefined,
  userId,
  statusMessage,
  jobsFound,
}: {
  jobSearchId: string;
  progress?: number;
  userId: string;
  statusMessage?: string;
  jobsFound?: number;
}) {
  try {
    // Using a raw query for minimal overhead to update basic progress
    if (progress !== undefined) {
      await db.$executeRaw`UPDATE "JobSearch" SET progress = ${progress} WHERE id = ${jobSearchId}`;
    }

    // Update status message and jobs found count if provided
    // This uses the Prisma client for more complex updates
    if (statusMessage || jobsFound !== undefined) {
      const updateData: any = {};

      if (statusMessage) {
        // Store the status message in the metadata field as JSON
        const jobSearch = await db.jobSearch.findUnique({
          where: { id: jobSearchId },
          select: { metadata: true },
        });

        // Parse metadata if it's a string, otherwise use as object
        let metadata: any;
        const rawMetadata = jobSearch?.metadata;

        if (typeof rawMetadata === 'string') {
          try {
            metadata = JSON.parse(rawMetadata);
          } catch {
            metadata = {};
          }
        } else {
          metadata = rawMetadata || {};
        }

        metadata.statusMessage = statusMessage;
        metadata.lastUpdated = new Date().toISOString();

        if (jobsFound !== undefined) {
          metadata.jobsFound = jobsFound;
        }

        // Prisma Json type expects an object, not a stringified JSON
        updateData.metadata = metadata;
      }

      await db.jobSearch.update({
        where: { id: jobSearchId },
        data: updateData,
      });
    }

    // Revalidate cache tags to refresh UI
    revalidateTag(`user:${userId}:job-searches:queue`, 'max');
    revalidateTag(`job-search:${jobSearchId}`, 'max');

    // For real-time updates, use direct cache revalidation instead of event system
    // This avoids type compatibility issues between different event systems
    try {
      // Additional cache tags for immediate UI updates
      revalidateTag(`job-search-progress:${jobSearchId}`, 'max');
      revalidateTag(`job-search-status:${jobSearchId}`, 'max');

      // Update UI with the current jobs found count
      if (jobsFound !== undefined) {
        revalidateTag(`job-search-results:${jobSearchId}`, 'max');
      }
    } catch (eventError) {
      console.log('Failed to revalidate cache tags:', eventError);
      // Silent catch to avoid blocking the search process
    }
  } catch (error) {
    // Log error but don't throw to avoid stopping the search process
    console.error('Failed to update job search progress:', error);
  }
}

async function addJobListings({
  jobSearchId,
  jobListings,
  userId,
}: {
  jobSearchId: string;
  jobListings: Array<Prisma.JobListingCreateManyInput>;
  userId: string;
}): Promise<{ createdCount: number; linkedCount: number }> {
  const { createdCount, linkedCount } = await createJobSearchListings({
    jobListings,
    jobSearchId,
    userId,
  });

  console.log(
    `[Job Search] createMany result: ${createdCount} jobs inserted, ${linkedCount} linked to search`,
  );

  revalidateTag(`user:${userId}:job-listings`, 'max');
  revalidateTag(`user:${userId}:job-listings:count`, 'max');

  return { createdCount, linkedCount };
}

// In-memory cache for job search results
const searchCache = new Map<
  string,
  {
    timestamp: number;
    results: Array<Prisma.JobListingCreateManyInput>;
    nextPageToken?: string;
  }
>();

// Cache expiration time - 15 minutes
const CACHE_EXPIRY_MS = 15 * 60 * 1000;

/**
 * Generate a cache key for a job search based on search parameters
 * This ensures similar searches use the same cache entry
 */
function generateCacheKey(params: {
  searchTerm: string;
  location?: string;
  remote?: boolean;
  page?: number;
}): string {
  // Normalize search term by trimming, converting to lowercase, and removing extra spaces
  const normalizedTerm = params.searchTerm
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

  // Include location if present, normalize it as well
  const locationPart = params.location
    ? `-${params.location.trim().toLowerCase().replace(/\s+/g, ' ')}`
    : '';

  // Include remote preference
  const remotePart = params.remote ? '-remote' : '';

  // Include page number if specified
  const pagePart = params.page ? `-page${params.page}` : '';

  return `google-jobs-${normalizedTerm}${locationPart}${remotePart}${pagePart}`;
}

/**
 * Check if cache entry is valid (exists and not expired)
 */
function isCacheValid(cacheKey: string): boolean {
  if (!searchCache.has(cacheKey)) return false;

  const cacheEntry = searchCache.get(cacheKey)!;
  const now = Date.now();

  // Check if entry has expired
  return now - cacheEntry.timestamp < CACHE_EXPIRY_MS;
}

/**
 * Scrape job listings from Google Jobs using SerpAPI
 * Includes caching, retry mechanism, and detailed metadata extraction
 */
export async function scrapeGoogleListings({
  location,
  pageDelay = 5000,
  remote = false,
  jobSearchId,
  searchTerm,
  totalPages = 50,
  userId,
}: {
  jobSearchId: string;
  location?: string;
  pageDelay?: number;
  remote?: boolean;
  searchTerm: string;
  totalPages?: number;
  userId?: string;
}) {
  const resolvedUserId: string | undefined =
    userId ?? (await getCurrentUser())?.id;
  if (!resolvedUserId) {
    throw new Error('User not authenticated');
  }

  // Rate limit the scraping function to prevent infinite loops
  // This protects against logic errors that might call this function repeatedly
  try {
    await rateLimitServerAction({
      preset: 'serpApiSearch',
      identifier: resolvedUserId,
    });
  } catch (error) {
    // If rate limited, fail the job search with a clear message
    await db.jobSearch.update({
      data: {
        completedAt: new Date(),
        endedAt: new Date(),
        status: JobSearchStatus.FAILED,
        errorMessage:
          'Rate limit exceeded. Too many job searches in a short time. Please try again later.',
      },
      where: {
        id: jobSearchId,
      },
    });
    throw new Error(
      'Rate limit exceeded for job searches. Please try again in a few minutes.',
    );
  }

  const serpApiKey = process.env.SERP_API_SECRET;

  if (!serpApiKey) {
    throw new Error('SERP_API_KEY is not defined in environment variables.');
  }

  const userChannel = getPrivateUserChannel(resolvedUserId);

  let nextPageToken: string | undefined = undefined;
  let retryCount = 0;
  const maxRetries = 3;
  const initialBackoffDelay = 1000; // 1 second initial delay

  // Generate base cache key for this search
  const baseCacheKey = generateCacheKey({ searchTerm, location, remote });

  // Build search query - handle "all" or empty search term
  const finalQuery =
    searchTerm.trim().toLowerCase() === 'all' || !searchTerm.trim()
      ? 'jobs'
      : searchTerm;

  // Helper function to build params for getJson with Google Jobs engine
  const buildSearchParams = (
    baseParams: Record<string, string | number | undefined>,
  ): Record<string, string> => {
    const params: Record<string, string> = {
      engine: 'google_jobs',
      api_key: serpApiKey!,
      q: finalQuery,
      location: location || SERPAPI_DEFAULT_LOCATION,
      google_domain: 'google.com',
      hl: 'en',
    };

    // Pagination token
    if (baseParams.next_page_token) {
      params.next_page_token = String(baseParams.next_page_token);
    }

    // Remote/Work from home filter using SerpAPI's ltype parameter
    if (remote) {
      params.ltype = '1';
    }

    // Optional filters
    if (baseParams.chips_date_posted) {
      params.chips_date_posted = String(baseParams.chips_date_posted);
    }
    if (baseParams.chips_job_type) {
      params.chips_job_type = String(baseParams.chips_job_type);
    }
    if (baseParams.chips_experience) {
      params.chips_experience = String(baseParams.chips_experience);
    }

    return params;
  };

  // Function to handle retries with exponential backoff using serpapi package
  const fetchWithRetry = async (
    params: Record<string, string>,
  ): Promise<SerpApiJobSearchResultsResponse | null> => {
    try {
      const data = (await getJson(params)) as SerpApiJobSearchResultsResponse;

      // Check if the API returned an error
      if (data.error) {
        const rawError = String(data.error);
        if (
          rawError.toLowerCase().includes("google hasn't returned any results")
        ) {
          return null;
        }
        throw new Error(`SerpAPI error: ${rawError}`);
      }

      return data;
    } catch (error) {
      // Only retry if we haven't exceeded max retries
      if (retryCount < maxRetries) {
        retryCount++;

        // Calculate backoff delay with exponential increase
        const backoffDelay = initialBackoffDelay * Math.pow(2, retryCount - 1);
        console.log(
          `Retrying SerpAPI request attempt ${retryCount} of ${maxRetries} after ${backoffDelay}ms delay`,
        );

        // Wait for the backoff period
        await new Promise(resolve => setTimeout(resolve, backoffDelay));

        // Retry the request
        return fetchWithRetry(params);
      }

      // If we've exhausted retries, throw the error
      throw error;
    }
  };

  let totalJobListings = 0;

  // Update initial status message
  await updateJobSearch({
    jobSearchId,
    progress: 5,
    statusMessage: `Starting job search for "${searchTerm}"...`,
    userId: resolvedUserId,
  });

  for (let page = 1; page <= totalPages; page++) {
    // Reset retry count for each page
    retryCount = 0;

    // Generate cache key for this specific page
    const pageCacheKey = generateCacheKey({
      searchTerm,
      location,
      remote,
      page,
    });

    // Check if we have valid cached results for this page
    let data: SerpApiJobSearchResultsResponse | undefined;
    let useCache = false;
    let pagedJobListings: Array<Prisma.JobListingCreateManyInput> = [];

    if (isCacheValid(pageCacheKey)) {
      // Use cached results if available
      const cachedData = searchCache.get(pageCacheKey)!;
      pagedJobListings = cachedData.results;
      nextPageToken = cachedData.nextPageToken;
      useCache = true;

      console.log(`Using cached results for "${searchTerm}" page ${page}`);

      // Update status to show we're using cached data
      await updateJobSearch({
        jobSearchId,
        statusMessage: `Using cached results for page ${page}...`,
        userId: resolvedUserId,
      });
    } else {
      // Build params for Google Jobs engine via serpapi package
      const searchParams = buildSearchParams({
        next_page_token: nextPageToken,
        location: location,
      });

      // Update status message for fresh fetch
      await updateJobSearch({
        jobSearchId,
        statusMessage: `Fetching jobs page ${page}...`,
        userId: resolvedUserId,
      });

      // Fetch data with retry mechanism
      try {
        const pageData = await fetchWithRetry(searchParams);

        if (!pageData) {
          console.log(
            `[SERP API] Page ${page}: no results returned (treating as end of results)`,
          );
          break;
        }

        data = pageData;

        if (!data.jobs_results?.length) {
          console.log(
            `[SERP API] Page ${page}: 0 jobs returned (treating as end of results)`,
          );
          break;
        }

        // Log the API response for debugging
        console.log(`[SERP API] Page ${page} response:`, {
          jobsCount: data.jobs_results?.length || 0,
          hasNextPage: !!data.serpapi_pagination?.next_page_token,
        });

        // Process the data and build job listings
        if (data.jobs_results && Array.isArray(data.jobs_results)) {
          pagedJobListings = [];
          for (const job of data.jobs_results) {
            const {
              apply_options,
              thumbnail,
              company_name,
              description,
              detected_extensions,
              extensions,
              job_highlights,
              job_id,
              location: jobLocation,
              share_link,
              title,
              via,
            } = job;

            const {
              posted_at,
              salary,
              schedule_type,
              paid_time_off,
              dental_coverage,
              health_insurance,
              work_from_home,
            } = detected_extensions;

            let qualifications: Array<string> = [];
            let requirements: Array<string> = [];
            let benefits: Array<string> = [];
            let responsibilities: Array<string> = [];
            let skills: Array<string> = [];

            // Extract detailed job highlights with better categorization
            if (job_highlights && Array.isArray(job_highlights)) {
              for (const highlight of job_highlights) {
                const title = highlight.title?.toLowerCase() || '';
                const items = highlight.items || [];

                if (title.includes('qualif') || title.includes('skill')) {
                  qualifications = [...qualifications, ...items];

                  // Extract skills from qualifications
                  items.forEach((item: string) => {
                    const lowercaseItem = item.toLowerCase();
                    if (
                      lowercaseItem.includes('experience with') ||
                      lowercaseItem.includes('knowledge of')
                    ) {
                      skills.push(item);
                    }
                  });
                } else if (title.includes('requir')) {
                  requirements = [...requirements, ...items];
                } else if (title.includes('benefit')) {
                  benefits = [...benefits, ...items];
                } else if (title.includes('respons')) {
                  responsibilities = [...responsibilities, ...items];
                }
              }
            }

            const postedAt = posted_at
              ? parseRelativeTimeToDate(posted_at)?.toISOString()
              : undefined;

            const rawJobId =
              typeof job_id === 'string' && job_id.trim()
                ? job_id.trim()
                : null;
            const rawShareLink =
              typeof share_link === 'string' && share_link.trim()
                ? share_link.trim()
                : null;
            const stableFallbackJobId = rawShareLink
              ? rawShareLink
              : `${String(title ?? '').trim()}|${String(company_name ?? '').trim()}|${String(jobLocation ?? '').trim()}|${searchTerm}|${remote ? 'remote' : 'local'}`;

            pagedJobListings.push({
              applyOptions:
                (apply_options as unknown as Prisma.JsonArray) ?? [],
              benefits: benefits.length > 0 ? benefits : [],
              company: company_name,
              companyLogoUrl: thumbnail ?? undefined,
              dentalCoverage: dental_coverage ?? undefined,
              description: description ?? 'No description provided',
              detectedExtensions: (detected_extensions ??
                {}) as unknown as Prisma.JsonObject,
              extensions,
              healthInsurance: health_insurance ?? undefined,
              jobProvider: JobProvider.SERPAPI,
              jobProviderUrl: share_link,
              jobId: rawJobId ?? stableFallbackJobId,
              jobType: getJobType(schedule_type),
              location: jobLocation,
              paidTimeOff: paid_time_off ?? undefined,
              postedAt: postedAt ? new Date(postedAt) : null,
              qualifications:
                qualifications.length > 0 ? qualifications : undefined,
              remote: work_from_home ?? remote,
              requirements: requirements.length > 0 ? requirements : undefined,
              responsibilities:
                responsibilities.length > 0 ? responsibilities : undefined,
              salary,
              scheduleType: schedule_type,
              source: via,
              title: title,
              userId: resolvedUserId,
              workFromHome: work_from_home ?? undefined,
            } as Prisma.JobListingCreateManyInput);
          }
        }

        // Log processed job listings
        console.log(
          `[SERP API] Page ${page} processed ${pagedJobListings.length} job listings`,
        );

        // Store successful results in cache with current timestamp
        searchCache.set(pageCacheKey, {
          timestamp: Date.now(),
          results: pagedJobListings,
          nextPageToken: data?.serpapi_pagination?.next_page_token,
        });

        // Get next page token from current results
        nextPageToken = data?.serpapi_pagination?.next_page_token;
      } catch (error) {
        console.error(
          `[SERP API] Failed to fetch data after ${maxRetries} attempts:`,
          {
            error: error instanceof Error ? error.message : String(error),
            page,
            params: { ...searchParams, api_key: 'REDACTED' },
          },
        );

        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        // Update search with error status
        await updateJobSearch({
          jobSearchId,
          progress: 100,
          statusMessage: `Error fetching results: ${errorMessage}`,
          userId: resolvedUserId,
        });

        // Update job search status to failed
        await db.jobSearch.update({
          data: {
            completedAt: new Date(),
            endedAt: new Date(),
            status: JobSearchStatus.FAILED,
            errorMessage,
          },
          where: {
            id: jobSearchId,
          },
        });

        // Revalidate to show error status
        revalidateTag(`job-search-error:${jobSearchId}`, 'max');
        return;
      }
    }

    // Process job listings - add to database
    const { linkedCount } = await addJobListings({
      jobSearchId,
      jobListings: pagedJobListings,
      userId: resolvedUserId,
    });
    totalJobListings += linkedCount;
    console.log(
      `[Job Search] Added ${linkedCount} listings to search. Total so far: ${totalJobListings}`,
    );

    // Calculate and update progress
    const pageProgress = Math.floor((page / totalPages) * 100);
    await updateJobSearch({
      jobSearchId,
      progress: pageProgress,
      userId: resolvedUserId,
    });

    // Calculate adjusted progress for UI (more weight to initial progress)
    // Update nextPageToken from the response if not using cache
    if (!useCache && data) {
      nextPageToken = data.serpapi_pagination?.next_page_token;
    }

    // Calculate adjusted progress for UI display (more weight to initial progress)
    const adjustedProgress = Math.floor((page / totalPages) * 90) + 10;

    updateJobSearch({
      jobSearchId,
      progress: adjustedProgress,
      userId: resolvedUserId,
    });

    sendDataUpdate({
      channel: userChannel,
      payload: {
        data: {
          id: jobSearchId,
          jobListingsCount: totalJobListings,
          progress: adjustedProgress,
          searchTerm,
          status: JobSearchStatus.PROCESSING,
        },
        type: DataEventType.JOB_SEARCH_PROGRESS,
      },
    });

    if (!nextPageToken) {
      break;
    }

    await new Promise(resolve => setTimeout(resolve, pageDelay));
  }

  // Finalize the job search record
  console.log(
    `[Job Search] Completing search ${jobSearchId}. Total listings found: ${totalJobListings}`,
  );

  const finalJobSearch = await db.jobSearch.update({
    data: {
      completedAt: new Date(),
      endedAt: new Date(),
      progress: 100,
      status: JobSearchStatus.COMPLETED,
    },
    include: {
      _count: {
        select: {
          jobSearchListings: true,
        },
      },
    },
    where: {
      id: jobSearchId,
    },
  });

  revalidateTag(`user:${resolvedUserId}:report:job-searches`, 'max');
  revalidateTag(`user:${resolvedUserId}:job-searches`, 'max');
  revalidateTag(`user:${resolvedUserId}:job-searches:queue`, 'max');
  revalidateTag(`user:${resolvedUserId}:job-searches:count`, 'max');
  revalidateTag(`user:${resolvedUserId}:job-listings`, 'max');
  revalidateTag(`user:${resolvedUserId}:job-listings:count`, 'max');

  // await new Promise(resolve => setTimeout(resolve, 2500));
  // await new Promise(resolve => setTimeout(resolve, 2500));

  // Update final job search status through direct revalidation
  revalidateTag(`job-search-complete:${jobSearchId}`, 'max');

  /*
  // Legacy notification code - removed to fix TypeScript errors
  // sendNotification({
    channel: userChannel,
    payload: {
      // actionText: 'View results',
      // actionUrl: `/a/job-search/${jobSearchId}`,
      id: 'job-search-complete',
      message: `Found ${totalJobListings} jobs matching your search.`,
      title: 'Job search complete',
      type: 'success',
    },
    userId: user.id,
  });
  */
  sendDataUpdate({
    channel: userChannel,
    payload: {
      data: {
        id: jobSearchId,
        jobListingsCount: finalJobSearch._count.jobSearchListings,
        progress: 100,
        searchTerm,
        status: JobSearchStatus.COMPLETED,
      },
      type: DataEventType.JOB_SEARCH_PROGRESS,
    },
  });
}
