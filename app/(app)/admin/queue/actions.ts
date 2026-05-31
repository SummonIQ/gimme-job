'use server';

import { revalidatePath } from 'next/cache';

import { restoreArchivedDesktopSubmitRequest } from '@/lib/pipeline/durable-queue';

import { requireAdminUser } from '../require-admin-user';

export async function restoreArchivedQueueItemAction(
  jobId: string,
): Promise<{ success: boolean }> {
  await requireAdminUser();
  const restored = await restoreArchivedDesktopSubmitRequest(jobId);
  if (restored) {
    revalidatePath('/admin/queue');
  }
  return { success: restored };
}
