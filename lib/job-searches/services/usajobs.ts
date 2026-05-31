'use server';

import {
  JobProvider,
  JobSearchStatus,
  JobType,
  type Prisma,
} from '@/generated/prisma/browser';

import {
  searchUSAJobs,
  type USAJobsMatchedObject,
} from '@/lib/api/usajobs-client';
import { db } from '@/lib/db/client';
import { createJobSearchListings } from '@/lib/job-searches/services/job-search-listings';
import { triggerJobSearchCompletionNotification } from '@/lib/notifications/triggers';
import { getCurrentUser } from '@/lib/user/query';

const mapScheduleType = (scheduleCode?: string): JobType => {
  switch (scheduleCode) {
    case '1':
      return JobType.FULL_TIME;
    case '2':
      return JobType.PART_TIME;
    case '4':
      return JobType.CONTRACT; // Intermittent → closest match
    default:
      return JobType.UNKNOWN;
  }
};

const buildSalaryString = (
  remuneration: USAJobsMatchedObject['PositionRemuneration'],
): string | undefined => {
  if (!remuneration || remuneration.length === 0) return undefined;

  const primary = remuneration[0];
  const min = primary.MinimumRange;
  const max = primary.MaximumRange;
  const interval = primary.RateIntervalCode;

  if (!min && !max) return undefined;

  const intervalLabel =
    interval === 'PA'
      ? '/year'
      : interval === 'PH'
        ? '/hour'
        : interval === 'PD'
          ? '/day'
          : '';

  if (min && max && min !== max) {
    return `$${Number(min).toLocaleString()} - $${Number(max).toLocaleString()}${intervalLabel}`;
  }
  if (min) {
    return `$${Number(min).toLocaleString()}${intervalLabel}`;
  }
  return `$${Number(max).toLocaleString()}${intervalLabel}`;
};

const buildDescription = (matched: USAJobsMatchedObject): string => {
  const parts: string[] = [];

  if (matched.QualificationSummary) {
    parts.push(matched.QualificationSummary);
  }

  const details = matched.UserArea?.Details;
  if (details?.JobSummary) {
    parts.push(details.JobSummary);
  }
  if (details?.MajorDuties) {
    parts.push(details.MajorDuties);
  }

  return parts.join('\n\n') || 'No description available';
};

const buildJobListing = (
  matched: USAJobsMatchedObject,
  controlNumber: string,
  userId: string,
): Prisma.JobListingCreateManyInput => {
  const jobId = `usajobs-${controlNumber}`;
  const locationDisplay = matched.PositionLocationDisplay || undefined;
  const scheduleCode = matched.PositionSchedule?.[0]?.Code;
  const salary = buildSalaryString(matched.PositionRemuneration);
  const description = buildDescription(matched);

  const isRemote =
    locationDisplay?.toLowerCase().includes('anywhere') ||
    locationDisplay?.toLowerCase().includes('remote') ||
    false;

  const details = matched.UserArea?.Details;

  return {
    applyOptions: matched.ApplyURI?.[0]
      ? { applyUrl: matched.ApplyURI[0] }
      : undefined,
    benefits: details?.Benefits ? [details.Benefits] : [],
    company: matched.OrganizationName || matched.DepartmentName || undefined,
    description,
    jobProvider: JobProvider.USAJOBS,
    jobProviderUrl: matched.PositionURI || undefined,
    jobId,
    jobType: mapScheduleType(scheduleCode),
    location: locationDisplay,
    postedAt: matched.PublicationStartDate
      ? new Date(matched.PublicationStartDate)
      : undefined,
    qualifications: matched.QualificationSummary
      ? [matched.QualificationSummary]
      : [],
    remote: isRemote,
    requirements: details?.KeyRequirements ?? [],
    responsibilities: details?.MajorDuties ? [details.MajorDuties] : [],
    salary,
    source: 'USAJobs',
    title: matched.PositionTitle || 'Untitled position',
    userId,
  };
};

export async function searchUSAJobsViaAPI({
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

    console.log('[USAJobs] Starting job search:', {
      searchTerm,
      location,
      limit,
      postedWithinDays,
      remote,
    });

    const response = await searchUSAJobs({
      keyword: searchTerm,
      locationName: location,
      remote,
      datePosted:
        typeof postedWithinDays === 'number' && postedWithinDays > 0
          ? Math.min(postedWithinDays, 60)
          : undefined,
      resultsPerPage: limit,
    });

    await db.jobSearch.update({
      where: { id: jobSearchId },
      data: { progress: 50 },
    });

    const items = response.SearchResult.SearchResultItems ?? [];
    console.log(`[USAJobs] Received ${items.length} results`);

    const jobListings: Prisma.JobListingCreateManyInput[] = items.map(item =>
      buildJobListing(
        item.MatchedObjectDescriptor,
        item.MatchedObjectId,
        resolvedUserId,
      ),
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
      'USAJobs',
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

    console.error('[USAJobs] Search failed:', errorMessage);

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
      'USAJobs',
      0,
      0,
      duration,
      'failed',
      errorMessage,
    );

    throw error;
  }
}
