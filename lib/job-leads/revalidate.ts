'use server';

import { revalidateTag } from '@/lib/cache/revalidate';
import { getSessionUser } from '@/lib/user/query';

export async function revalidateJobLead(jobLeadId: string) {
  const user = await getSessionUser();
  if (!user?.id) return;

  revalidateTag(`user:${user.id}:job-leads:${jobLeadId}`);
  revalidateTag(`user:${user.id}:job-leads`);
  revalidateTag(`user:${user.id}:report:job-leads`);
}
