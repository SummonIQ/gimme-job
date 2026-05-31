'use server';

import type { JobLeadStatus } from '@/generated/prisma/browser';

import { cacheTag } from '@/lib/cache/tag';
import { db } from '@/lib/db/client';

export async function getJobLeadsCount({
  statuses,
  userId,
}: {
  statuses?: Array<JobLeadStatus>;
  userId: string;
}) {
  'use cache';

  cacheTag(`user:${userId}:job-leads:count`);

  const leadsCount = await db.jobLead.count({
    where: {
      status:
        statuses && statuses.length > 0
          ? {
              in: statuses,
            }
          : undefined,
      userId,
    },
  });

  return leadsCount;
}
