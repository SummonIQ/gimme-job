'use server';

import type { JobLead, JobLeadStatus, Prisma } from '@/generated/prisma/browser';

import { cacheTag } from '@/lib/cache/tag';
import { db } from '@/lib/db/client';

export async function getJobLead({
  id,
  userId,
  include,
}: {
  id: string;
  include?: Prisma.JobLeadInclude;
  userId: string;
}): Promise<JobLead | null> {
  'use cache';

  cacheTag(`user:${userId}:job-leads:${id}`);

  const lead = await db.jobLead.findUnique({
    include,
    where: { id, userId },
  });

  return lead;
}

export async function getJobLeads({
  filters = {
    saved: undefined,
  },
  include,
  sortBy = [
    {
      createdAt: 'desc',
    },
  ],
  statuses,
  userId,
}: {
  filters?: {
    saved?: boolean;
  };
  include?: Prisma.JobLeadInclude;
  sortBy?: Array<Record<string, 'asc' | 'desc'>>;
  statuses?: Array<JobLeadStatus>;
  userId: string;
}) {
  'use cache';

  cacheTag(`user:${userId}:job-leads`);

  const leads = await db.jobLead.findMany({
    include,
    orderBy: sortBy,
    where: {
      ...filters,
      status: statuses
        ? {
            in: statuses,
          }
        : undefined,
      userId,
    },
  });

  return leads;
}
