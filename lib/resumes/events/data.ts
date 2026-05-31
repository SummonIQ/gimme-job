import { ResumeAnalysisStatus, ResumeOptimizationStatus } from '@/generated/prisma/browser';

import { getPrivateUserChannel } from '@/lib/events/channels';
import { sendDataUpdate } from '@/lib/events/data-update';
import { getCurrentUser } from '@/lib/user/query';
import { DataEventType } from '@/types/events';

export async function sendResumeAnalysisProgress({
  emittedAt,
  id,
  name,
  progress,
  sequence,
  status,
  userId,
}: {
  emittedAt?: string;
  id: string;
  name: string;
  progress: number;
  sequence?: number;
  status: ResumeAnalysisStatus;
  userId?: string;
}) {
  const resolvedUserId = userId ?? (await getCurrentUser())?.id;
  if (!resolvedUserId) return;
  const userChannel = getPrivateUserChannel(resolvedUserId);

  await sendDataUpdate({
    channel: userChannel,
    payload: {
      data: {
        emittedAt,
        id,
        name,
        progress,
        sequence,
        status,
      },
      type: DataEventType.RESUME_ANALYSIS_PROGRESS,
    },
  });
}

export async function sendResumeOptimizationProgress({
  emittedAt,
  id,
  name,
  progress,
  sequence,
  status,
  userId,
}: {
  emittedAt?: string;
  id: string;
  name: string;
  progress: number;
  sequence?: number;
  status: ResumeOptimizationStatus;
  userId?: string;
}) {
  const resolvedUserId = userId ?? (await getCurrentUser())?.id;
  if (!resolvedUserId) return;
  const userChannel = getPrivateUserChannel(resolvedUserId);

  await sendDataUpdate({
    channel: userChannel,
    payload: {
      data: {
        emittedAt,
        id,
        name,
        progress,
        sequence,
        status,
      },
      type: DataEventType.RESUME_OPTIMIZATION_PROGRESS,
    },
  });
}
