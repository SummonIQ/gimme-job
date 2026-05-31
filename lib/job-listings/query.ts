'use server';

import type { JobListingStatus, Prisma } from '@/generated/prisma/browser';
import { cacheTag } from '@/lib/cache/tag';

import { db } from '@/lib/db/client';

export async function getJobListing({
  id,
  userId,
  include = {
    lead: true,
  },
}: {
  id: string;
  include?: {
    lead: true;
  };
  userId: string;
}) {
  'use cache';

  cacheTag(`user:${userId}:job-listings:${id}`);

  const jobListing = await db.jobListing.findUnique({
    include,
    where: { id, userId },
  });

  return jobListing;
}

export async function getJobListings({
  filters = {
    jobSearchId: undefined,
    saved: undefined,
  },
  include = {
    lead: true,
  },
  sortBy = [
    {
      createdAt: 'desc',
    },
    {
      id: 'desc',
    },
  ],
  statuses,
  userId,
}: {
  filters?: {
    jobSearchId?: string;
    saved?: boolean;
  };
  include?: {
    lead?: boolean;
  };
  sortBy?: Array<Record<string, 'asc' | 'desc'>>;
  statuses?: Array<JobListingStatus>;
  userId: string;
}) {
  'use cache';

  cacheTag(`user:${userId}:job-listings`);

  const jobListings = await db.jobListing.findMany({
    include,
    orderBy: sortBy,
    where: {
      saved: filters.saved,
      status: statuses
        ? {
            in: statuses,
          }
        : undefined,
      userId,
      jobSearchListings: filters.jobSearchId
        ? {
            some: {
              jobSearchId: filters.jobSearchId,
            },
          }
        : undefined,
    } satisfies Prisma.JobListingWhereInput,
  });

  return jobListings;
}
