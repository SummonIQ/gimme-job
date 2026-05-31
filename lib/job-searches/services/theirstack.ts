'use server';

import {
  JobProvider,
  JobSearchStatus,
  JobType,
  type Prisma,
} from '@/generated/prisma/browser';

import {
  searchTheirStackJobs,
  type TheirStackJob,
} from '@/lib/api/theirstack-client';
import { db } from '@/lib/db/client';
import { createJobSearchListings } from '@/lib/job-searches/services/job-search-listings';
import { triggerJobSearchCompletionNotification } from '@/lib/notifications/triggers';
import { getCurrentUser } from '@/lib/user/query';

const mapEmploymentType = (employmentType?: string): JobType => {
  if (!employmentType) {
    return JobType.UNKNOWN;
  }

  const normalized = employmentType.trim().toLowerCase();
  if (normalized.includes('full')) {
    return JobType.FULL_TIME;
  }
  if (normalized.includes('part')) {
    return JobType.PART_TIME;
  }
  if (normalized.includes('contract')) {
    return JobType.CONTRACT;
  }
  if (normalized.includes('intern')) {
    return JobType.INTERNSHIP;
  }

  return JobType.UNKNOWN;
};

const buildJobListing = (
  job: TheirStackJob,
  userId: string,
): Prisma.JobListingCreateManyInput => {
  const jobId =
    job.id ||
    job.job_id ||
    `theirstack-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Build location string from available fields
  const locationParts = [job.city, job.region, job.country].filter(Boolean);
  const locationString = job.location || locationParts.join(', ') || undefined;

  // Build salary string
  let salaryString: string | undefined;
  if (job.salary_string) {
    salaryString = job.salary_string;
  } else if (job.salary_min || job.salary_max) {
    const currency = job.salary_currency || 'USD';
    if (job.salary_min && job.salary_max) {
      salaryString = `${currency} ${job.salary_min.toLocaleString()} - ${job.salary_max.toLocaleString()}`;
    } else if (job.salary_min) {
      salaryString = `${currency} ${job.salary_min.toLocaleString()}+`;
    } else if (job.salary_max) {
      salaryString = `Up to ${currency} ${job.salary_max.toLocaleString()}`;
    }
  }

  return {
    applyOptions: job.apply_url ? { applyUrl: job.apply_url } : undefined,
    benefits: [],
    company: job.company_name ?? undefined,
    companyLogoUrl: job.company_logo_url ?? undefined,
    description: job.description ?? undefined,
    jobProvider: JobProvider.THEIRSTACK,
    jobProviderUrl: job.url || job.apply_url,
    jobId,
    jobType: mapEmploymentType(job.employment_type),
    location: locationString,
    postedAt: job.date_posted ? new Date(job.date_posted) : undefined,
    remote: job.is_remote ?? undefined,
    salary: salaryString,
    title: job.title ?? 'Untitled role',
    userId,
    source: 'TheirStack',
  };
};

export async function searchTheirStackJobsViaAPI({
  jobSearchId,
  searchTerm,
  location,
  limit = 25,
  postedWithinDays,
  remote,
  userId,
}: {
  jobSearchId: string;
  searchTerm: string;
  location?: string;
  limit?: number;
  postedWithinDays?: number | null;
  remote?: boolean;
  userId?: string;
}): Promise<number> {
  const resolvedUserId: string | undefined =
    userId ?? (await getCurrentUser())?.id;
  if (!resolvedUserId) {
    throw new Error('User not found');
  }

  const startTime = Date.now();

  try {
    await db.jobSearch.update({
      where: { id: jobSearchId },
      data: { status: JobSearchStatus.PROCESSING, progress: 10 },
    });

    console.log('[TheirStack] Starting job search:', {
      searchTerm,
      location,
      limit,
      postedWithinDays,
      remote,
    });

    const response = await searchTheirStackJobs({
      jobTitle: searchTerm,
      location,
      remote,
      postedWithinDays,
      limit,
    });

    await db.jobSearch.update({
      where: { id: jobSearchId },
      data: { progress: 50 },
    });

    console.log(
      `[TheirStack] Found ${response.data.length} jobs (total: ${response.total})`,
    );

    // Filter to US jobs only and enforce recency (TheirStack can return out-of-scope results)
    const US_COUNTRY_CODES = [
      'US',
      'USA',
      'United States',
      'United States of America',
    ];
    const UK_LOCATION_HINTS = [
      'united kingdom',
      'england',
      'scotland',
      'wales',
      'northern ireland',
      ', uk',
      ' uk',
    ];
    const now = Date.now();
    const maxAgeMs = postedWithinDays
      ? postedWithinDays * 24 * 60 * 60 * 1000
      : null;

    const filteredJobs = response.data.filter(job => {
      const countryCode = job.country_code?.toUpperCase();
      const country = job.country;
      const locationLower = (job.location || '').toLowerCase();

      // Exclude UK results even if country info is missing
      if (UK_LOCATION_HINTS.some(hint => locationLower.includes(hint))) {
        console.log(
          `[TheirStack] Filtering out UK job: ${job.title} at ${job.location}`,
        );
        return false;
      }

      // Exclude non-US if country code is known
      if (countryCode && !['US', 'USA'].includes(countryCode)) {
        console.log(
          `[TheirStack] Filtering out non-US job: ${job.title} at ${job.location} (${country})`,
        );
        return false;
      }

      // Exclude if country name is known and not US
      if (
        country &&
        !US_COUNTRY_CODES.some(c =>
          country.toLowerCase().includes(c.toLowerCase()),
        )
      ) {
        console.log(
          `[TheirStack] Filtering out non-US job: ${job.title} at ${job.location} (${country})`,
        );
        return false;
      }

      // Enforce recency locally to avoid old jobs slipping through
      if (maxAgeMs) {
        const postedAt = job.date_posted ? Date.parse(job.date_posted) : NaN;
        const discoveredAt = job.discovered_at
          ? Date.parse(job.discovered_at)
          : NaN;
        const effectiveTime = Number.isFinite(postedAt)
          ? postedAt
          : Number.isFinite(discoveredAt)
            ? discoveredAt
            : NaN;

        if (!Number.isFinite(effectiveTime)) {
          console.log(
            `[TheirStack] Filtering out job with missing date: ${job.title} at ${job.location}`,
          );
          return false;
        }

        if (now - effectiveTime > maxAgeMs) {
          console.log(
            `[TheirStack] Filtering out stale job: ${job.title} at ${job.location}`,
          );
          return false;
        }
      }

      return true;
    });

    console.log(`[TheirStack] After filters: ${filteredJobs.length} jobs`);

    const jobListings: Prisma.JobListingCreateManyInput[] = filteredJobs.map(
      job => buildJobListing(job, resolvedUserId),
    );

    await db.jobSearch.update({
      where: { id: jobSearchId },
      data: { progress: 70 },
    });

    let totalLinked = 0;
    if (jobListings.length > 0) {
      const batchSize = 25;
      for (let i = 0; i < jobListings.length; i += batchSize) {
        const batch = jobListings.slice(i, i + batchSize);
        const { linkedCount } = await createJobSearchListings({
          jobListings: batch,
          jobSearchId,
          userId: resolvedUserId,
        });
        totalLinked += linkedCount;
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    await db.jobSearch.update({
      where: { id: jobSearchId },
      data: {
        completedAt: new Date(),
        endedAt: new Date(),
        progress: 100,
        status: JobSearchStatus.COMPLETED,
        totalJobs: totalLinked,
      },
    });

    await triggerJobSearchCompletionNotification(
      resolvedUserId,
      jobSearchId,
      searchTerm,
      'TheirStack',
      totalLinked,
      totalLinked,
      duration,
      'completed',
    );

    return totalLinked;
  } catch (error) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    console.error('[TheirStack] Search failed:', errorMessage);

    await db.jobSearch.update({
      where: { id: jobSearchId },
      data: {
        status: JobSearchStatus.FAILED,
        endedAt: new Date(),
        errorMessage,
      },
    });

    await triggerJobSearchCompletionNotification(
      resolvedUserId,
      jobSearchId,
      searchTerm,
      'TheirStack',
      0,
      0,
      duration,
      'failed',
      errorMessage,
    );

    throw error;
  }
}
