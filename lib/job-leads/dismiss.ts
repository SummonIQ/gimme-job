'use server';

import { JobLeadStatus } from '@/generated/prisma/browser';
import { revalidateTag } from '@/lib/cache/revalidate';

import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';

export async function dismissJobLead(id: string) {
  const user = await getCurrentUser();

  const jobLead = await db.jobLead.update({
    data: {
      status: JobLeadStatus.REMOVED,
    },
    where: {
      id,
      userId: user.id,
    },
  });

  revalidateTag(`user:${user.id}:report:job-leads`);
  revalidateTag(`user:${user.id}:job-leads`);
  revalidateTag(`user:${user.id}:job-leads:${id}`);
  revalidateTag(`user:${user.id}:job-leads:count`);
  revalidateTag(`user:${user.id}:job-leads:removed`);
  revalidateTag(`user:${user.id}:job-leads:removed:count`);

  return jobLead;
}

export async function dismissJobLeads(ids: Array<string>) {
  const user = await getCurrentUser();

  const jobLeads = await db.jobLead.updateMany({
    data: {
      status: JobLeadStatus.REMOVED,
    },
    where: {
      id: { in: ids },
      userId: user.id,
    },
  });

  revalidateTag(`user:${user.id}:report:job-leads`);
  revalidateTag(`user:${user.id}:job-leads`);
  revalidateTag(`user:${user.id}:job-leads:count`);
  revalidateTag(`user:${user.id}:job-leads:removed`);
  revalidateTag(`user:${user.id}:job-leads:removed:count`);

  return jobLeads;
}
