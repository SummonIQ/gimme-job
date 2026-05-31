'use cache';

import { JobSearchStatus, Prisma } from '@/generated/prisma/browser';
import { cacheTag } from '@/lib/cache/tag';

import { db } from '@/lib/db/client';

export async function getJobSearches({
  include,
  sortBy = {
    updatedAt: 'desc',
  },
  statuses,
  userId,
}: {
  include?: {
    jobSearchListings?: boolean;
    jobSearchListingsCount?: boolean;
  };
  sortBy?: Record<string, 'asc' | 'desc'>;
  statuses?: Array<JobSearchStatus>;
  userId: string;
}) {
  'use cache';

  cacheTag(`user:${userId}:job-searches`);

  const searches = await db.jobSearch.findMany({
    include: include
      ? {
          _count: include.jobSearchListingsCount
            ? {
                select: {
                  jobSearchListings: true,
                },
              }
            : undefined,
          jobSearchListings: include.jobSearchListings ? true : undefined,
        }
      : undefined,
    orderBy: sortBy,
    where: {
      status: statuses ? { in: statuses } : undefined,
      userId: userId,
    },
  });

  return searches;
}

export async function getJobSearch({
  id,
  include,
  userId,
}: {
  id: string;
  include?: Prisma.JobSearchInclude;
  userId: string;
}) {
  // 'use cache' directive is now at the top of the file

  cacheTag(`user:${userId}:job-searches:${id}`);

  const jobSearch = await db.jobSearch.findUnique({
    include: {
      ...include,
      _count: {
        select: {
          jobSearchListings: true,
        },
      },
    },
    where: {
      id,
      userId,
    },
  });

  return jobSearch;
}
