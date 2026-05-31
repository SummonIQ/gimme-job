'use server';

import {
  JobProvider,
  JobSearchStatus,
  JobType,
  type Prisma,
} from '@/generated/prisma/browser';

import {
  collectCoreSignalJob,
  searchCoreSignalJobIds,
  type CoreSignalJobRecord,
} from '@/lib/api/coresignal-client';
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

const getJobUrl = (record: CoreSignalJobRecord): string | undefined => {
  if (record.external_url) {
    return record.external_url;
  }

  return record.job_sources?.find(source => source?.url)?.url;
};

const getSalaryText = (record: CoreSignalJobRecord): string | undefined =>
  record.salary?.find(salary => salary?.text)?.text ?? undefined;

const buildJobListing = (
  record: CoreSignalJobRecord,
  userId: string,
): Prisma.JobListingCreateManyInput => {
  const jobId = String(record.id);

  return {
    applyOptions: record.external_url
      ? { applyUrl: record.external_url }
      : undefined,
    benefits: record.benefits ?? [],
    company: record.company_name ?? undefined,
    companyLogoUrl: record.company_logo_url ?? undefined,
    description: record.description ?? undefined,
    jobProvider: JobProvider.CORESIGNAL,
    jobProviderUrl: getJobUrl(record),
    jobId,
    jobType: mapEmploymentType(record.employment_type),
    location: record.location ?? undefined,
    postedAt: record.date_posted ? new Date(record.date_posted) : undefined,
    remote: record.accepts_remote ?? undefined,
    salary: getSalaryText(record),
    title: record.title ?? 'Untitled role',
    userId,
    source: 'CoreSignal',
  };
};

export async function searchCoreSignalJobsViaAPI({
  jobSearchId,
  searchTerm,
  location,
  limit = 25,
  jobType,
  postedWithinDays,
  remote,
  userId,
}: {
  jobSearchId: string;
  searchTerm: string;
  location?: string;
  limit?: number;
  jobType?: string | null;
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

    const { jobIds } = await searchCoreSignalJobIds({
      searchTerm,
      location,
      limit,
      jobType,
      postedWithinDays,
      remote,
    });

    await db.jobSearch.update({
      where: { id: jobSearchId },
      data: { progress: 40 },
    });

    const jobListings: Prisma.JobListingCreateManyInput[] = [];
    for (const jobId of jobIds) {
      const record = await collectCoreSignalJob(jobId);
      jobListings.push(buildJobListing(record, resolvedUserId));
    }

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
      'CoreSignal',
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
      'CoreSignal',
      0,
      0,
      duration,
      'failed',
      errorMessage,
    );

    throw error;
  }
}
