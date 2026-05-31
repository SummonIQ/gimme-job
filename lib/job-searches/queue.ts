'use cache';

import { JobSearchStatus } from '@/generated/prisma/browser';

import { cacheTag } from '@/lib/cache/tag';
import { cacheLife } from '@/lib/cache/life';
import { db } from '@/lib/db/client';

export async function getQueuedJobSearches({
  include,
  sortBy = {
    updatedAt: 'desc',
  },
  userId,
}: {
  include?: {
    jobSearchListings?: boolean;
    jobSearchListingsCount?: boolean;
  };
  sortBy?: Record<string, 'asc' | 'desc'>;
  userId: string;
}) {
  // 'use cache' directive is now at the top of the file

  cacheTag(`user:${userId}:job-searches:queue`);
  cacheLife('seconds');

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
      status: { in: [JobSearchStatus.PROCESSING] },
      userId: userId,
    },
  });

  return searches.map(search => ({
    ...search,
    jobListingsCount: search._count?.jobSearchListings ?? 0,
  }));
}
