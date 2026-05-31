'use server';

import { db } from '@/lib/db/client';
import { getPrivateUserChannel } from '@/lib/events/channels';
import { sendDataUpdate } from '@/lib/events/data-update';
import { searchCoreSignalJobsViaAPI } from '@/lib/job-searches/services/coresignal';
import { scrapeGoogleListings } from '@/lib/job-searches/services/serpapi';
import { searchIndeedJobsViaAPI } from '@/lib/job-searches/services/indeed-api';
import { searchTheirStackJobsViaAPI } from '@/lib/job-searches/services/theirstack';
import { searchUSAJobsViaAPI } from '@/lib/job-searches/services/usajobs';
import { triggerJobSearchCompletionNotification } from '@/lib/notifications/triggers';
import { getCurrentUser } from '@/lib/user/query';
import { DataEventType } from '@/types/events';
import { JobProvider, JobSearchStatus } from '@/generated/prisma/browser';
import { revalidateTag } from 'next/cache';
import { after } from 'next/server';

const JOB_FETCH_LOCATION_FILTER = 'United States';

export async function createJobSearch({
  location,
  pageDelay = 5000,
  jobProvider,
  remote = false,
  searchTerm,
  radius,
  jobType,
  postedWithin,
  fromage,
  sortBy,
  provider,
  saveSearch = false,
}: {
  jobProvider?: JobProvider;
  location?: string;
  pageDelay?: number;
  remote?: boolean;
  searchTerm: string;
  radius?: number;
  jobType?: string | null;
  postedWithin?: string;
  fromage?: number;
  sortBy?: string;
  provider?: string;
  saveSearch?: boolean;
}): Promise<{ success: boolean; jobSearchId?: string; error?: string }> {
  // 'use server' directive is now at the top of the file

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('[Job Search] User not authenticated');
      return { success: false, error: 'User not authenticated' };
    }

    const userChannel = getPrivateUserChannel(user.id);

    // Always fall back to Google/SerpAPI when no explicit provider is supplied
    const normalizedProvider: string | undefined = provider
      ? provider.trim().toUpperCase()
      : undefined;
    const resolvedProvider: JobProvider =
      normalizedProvider === 'INDEED'
        ? JobProvider.INDEED
        : normalizedProvider === 'CORESIGNAL'
          ? JobProvider.CORESIGNAL
          : normalizedProvider === 'THEIRSTACK'
            ? JobProvider.THEIRSTACK
            : normalizedProvider === 'USAJOBS'
              ? JobProvider.USAJOBS
              : (jobProvider ?? JobProvider.SERPAPI);

    console.log('[Job Search] Creating new job search:', {
      searchTerm,
      requestedLocation: location,
      enforcedLocation: JOB_FETCH_LOCATION_FILTER,
      jobProvider: resolvedProvider,
      provider,
      remote,
    });

    // Create the job search record with valid fields only
    // Store additional parameters in metadata
    const jobSearch = await db.jobSearch.create({
      data: {
        jobProvider: resolvedProvider,
        location: JOB_FETCH_LOCATION_FILTER,
        pageDelay,
        remote,
        saved: saveSearch,
        searchTerm,
        status: JobSearchStatus.QUEUED,
        metadata: {
          // Store additional fields that aren't in the schema
          radius,
          jobType,
          postedWithin,
          sortBy,
          provider: resolvedProvider as string,
        },
        user: {
          connect: {
            id: user.id,
          },
        },
      },
    });

    console.log('[Job Search] Created job search record:', {
      id: jobSearch.id,
      status: jobSearch.status,
    });

    revalidateTag(`user:${user.id}:report:job-searches`, 'max');
    revalidateTag(`user:${user.id}:job-searches`, 'max');
    revalidateTag(`user:${user.id}:job-searches:queue`, 'max');
    revalidateTag(`user:${user.id}:job-searches:count`, 'max');

    // Update the job search status to processing
    await db.jobSearch.update({
      where: { id: jobSearch.id },
      data: { status: JobSearchStatus.PROCESSING },
    });

    // Send update to client
    sendDataUpdate({
      channel: userChannel,
      payload: {
        data: {
          id: jobSearch.id,
          jobListingsCount: 0,
          progress: 10,
          searchTerm,
          status: JobSearchStatus.PROCESSING,
        },
        type: DataEventType.JOB_SEARCH_PROGRESS,
      },
    });

    after(async () => {
      console.log(
        '[Job Search] Starting background processing for:',
        jobSearch.id,
      );
      try {
        const postedWithinDays = postedWithin
          ? Number.parseInt(postedWithin, 10)
          : undefined;
        const normalizedPostedWithinDays =
          typeof postedWithinDays === 'number' &&
          Number.isFinite(postedWithinDays) &&
          postedWithinDays > 0
            ? postedWithinDays
            : undefined;

        switch (resolvedProvider) {
          case JobProvider.INDEED: {
            console.log('[Job Search] Using Indeed API provider');
            await searchIndeedJobsViaAPI({
              jobSearchId: jobSearch.id,
              searchTerm,
              location: JOB_FETCH_LOCATION_FILTER,
              radius: radius || 25,
              limit: 25,
              jobType: jobType || undefined,
              userId: user.id,
            });
            break;
          }
          case JobProvider.CORESIGNAL: {
            console.log('[Job Search] Using CoreSignal API provider');
            await searchCoreSignalJobsViaAPI({
              jobSearchId: jobSearch.id,
              searchTerm,
              location: JOB_FETCH_LOCATION_FILTER,
              limit: 25,
              jobType,
              postedWithinDays: normalizedPostedWithinDays,
              remote,
              userId: user.id,
            });
            break;
          }
          case JobProvider.THEIRSTACK: {
            console.log('[Job Search] Using TheirStack API provider');
            await searchTheirStackJobsViaAPI({
              jobSearchId: jobSearch.id,
              searchTerm,
              location: JOB_FETCH_LOCATION_FILTER,
              limit: 25,
              postedWithinDays: normalizedPostedWithinDays,
              remote,
              userId: user.id,
            });
            break;
          }
          case JobProvider.USAJOBS: {
            console.log('[Job Search] Using USAJobs API provider');
            await searchUSAJobsViaAPI({
              jobSearchId: jobSearch.id,
              searchTerm,
              location: JOB_FETCH_LOCATION_FILTER,
              limit: 25,
              postedWithinDays: normalizedPostedWithinDays,
              remote,
              userId: user.id,
            });
            break;
          }
          case JobProvider.SERPAPI: {
            console.log('[Job Search] Using Google/SERP API provider');
            await scrapeGoogleListings({
              jobSearchId: jobSearch.id,
              location: JOB_FETCH_LOCATION_FILTER,
              pageDelay,
              remote,
              searchTerm,
              userId: user.id,
            });
            break;
          }
          case JobProvider.CAREER_BUILDER: {
            // await scrapeCareerBuilderListings({
            //   jobSearchId: jobSearch.id,
            //   location,
            //   pageDelay,
            //   remote,
            //   searchTerm,
            // });
            break;
          }
          default: {
            const errorMessage = `Invalid job board or provider: ${resolvedProvider}`;
            await db.jobSearch.update({
              where: { id: jobSearch.id },
              data: {
                status: JobSearchStatus.FAILED,
                endedAt: new Date(),
                errorMessage,
              },
            });

            try {
              await triggerJobSearchCompletionNotification(
                user.id,
                jobSearch.id,
                searchTerm,
                resolvedProvider || 'Unknown',
                0,
                0,
                0,
                'failed',
                errorMessage,
              );
            } catch (notificationError) {
              console.error(
                '[Job Search] Failed to create failure notification:',
                notificationError,
              );
            }

            console.error(errorMessage);
          }
        }
      } catch (error) {
        console.error('[Job Search] Error processing job search:', {
          jobSearchId: jobSearch.id,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        // Log error information
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        // Update job search status to failed
        await db.jobSearch.update({
          where: { id: jobSearch.id },
          data: {
            status: JobSearchStatus.FAILED,
            endedAt: new Date(),
            errorMessage,
          },
        });

        console.error(`Job search failed: ${errorMessage}`);

        // Send failure notification
        try {
          await triggerJobSearchCompletionNotification(
            user.id,
            jobSearch.id,
            searchTerm,
            resolvedProvider || 'Unknown',
            0,
            0,
            0,
            'failed',
            errorMessage,
          );
        } catch (notificationError) {
          console.error(
            '[Job Search] Failed to create failure notification:',
            notificationError,
          );
        }

        // Send failure update to client
        sendDataUpdate({
          channel: userChannel,
          payload: {
            data: {
              id: jobSearch.id,
              jobListingsCount: 0,
              progress: 0,
              searchTerm,
              status: JobSearchStatus.FAILED,
            },
            type: DataEventType.JOB_SEARCH_PROGRESS,
          },
        });

        // Additionally log the error message for debugging
        console.error(
          `Job search ${jobSearch.id} failed with error: ${errorMessage}`,
        );
      }
    });

    console.log('[Job Search] Job search queued successfully:', jobSearch.id);
    return { success: true, jobSearchId: jobSearch.id };
  } catch (error) {
    console.error('[Job Search] Error creating job search:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to create job search',
    };
  }
}
