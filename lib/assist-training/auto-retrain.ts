import { maybeAutoEnqueueTraining } from '@/lib/assist-training/auto-enqueue';

interface CheckAndQueueRetrainingResult {
  readonly enqueued: boolean;
  readonly reason: string;
}

export async function checkAndQueueRetraining(
  hostname: string,
  userId: string,
): Promise<CheckAndQueueRetrainingResult> {
  const normalizedHostname = hostname.trim();
  if (!normalizedHostname || !userId.trim()) {
    return {
      enqueued: false,
      reason: 'Hostname and userId are required.',
    };
  }

  return maybeAutoEnqueueTraining({
    failureReason: 'Runtime rule confidence degraded.',
    hostname: normalizedHostname,
    targetUrl: `https://${normalizedHostname}`,
    userId,
  });
}
