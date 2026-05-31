import { db } from '@/lib/db/client';
import { enqueueJob, JobType } from '@/lib/pipeline/durable-queue';

/**
 * Auto-enqueue a training session for a hostname when assist-mode fails.
 * This closes the active-learning loop: a failure in production triggers
 * a training run that collects observations, which eventually promote
 * rules, which prevent future failures on the same hostname.
 *
 * Guards against spam:
 *  - At most 1 auto-enqueued run per hostname per 4 hours.
 *  - Skips if the hostname already has a running/pending training session.
 *  - Skips if the hostname has been trained successfully within the last
 *    24 hours (stale training isn't the problem, the ATS just changed).
 */
const AUTO_ENQUEUE_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours
const RECENT_SUCCESS_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function maybeAutoEnqueueTraining({
  hostname,
  targetUrl,
  userId,
  failureReason,
}: {
  hostname: string;
  targetUrl: string;
  userId: string;
  failureReason?: string;
}): Promise<{ enqueued: boolean; reason: string }> {
  try {
    // Guard: skip if there's already a running/pending session.
    const activeSession = await db.assistTrainingSession.findFirst({
      select: { id: true },
      where: {
        hostname,
        status: { in: ['running', 'pending'] },
      },
    });
    if (activeSession) {
      return {
        enqueued: false,
        reason: `Hostname ${hostname} already has an active training session.`,
      };
    }

    // Guard: skip if recently trained successfully.
    const recentSuccess = await db.assistTrainingSession.findFirst({
      select: { id: true },
      where: {
        hostname,
        status: 'completed',
        completedAt: {
          gte: new Date(Date.now() - RECENT_SUCCESS_THRESHOLD_MS),
        },
      },
    });
    if (recentSuccess) {
      return {
        enqueued: false,
        reason: `Hostname ${hostname} was trained successfully within the last 24h.`,
      };
    }

    // Guard: cooldown — no more than 1 auto-enqueue per hostname per 4 hours.
    const recentAutoRun = await db.assistTrainingSession.findFirst({
      select: { id: true },
      where: {
        hostname,
        startedAt: {
          gte: new Date(Date.now() - AUTO_ENQUEUE_COOLDOWN_MS),
        },
      },
    });
    if (recentAutoRun) {
      return {
        enqueued: false,
        reason: `Hostname ${hostname} was already auto-trained within the last 4h.`,
      };
    }

    // Create the training session.
    const session = await db.assistTrainingSession.create({
      data: {
        hostname,
        status: 'pending',
        targetUrl,
        totalSteps: 10,
        userId,
        error: failureReason
          ? `[auto-enqueued] Assist failure: ${failureReason}`
          : null,
      },
    });

    // Enqueue for durable processing.
    await enqueueJob({
      type: JobType.TRAIN_SESSION,
      payload: {
        sessionId: session.id,
        userId,
        targetUrl,
        hostname,
        maxSteps: 10,
        maxDurationMin: 3,
        dryRun: false,
        captureScreenshots: true,
        disableJavascript: false,
        mobileViewport: false,
      },
      deduplicationKey: `auto-train:${hostname}:${Date.now()}`,
      userId,
      priority: 3, // lower than user-initiated training
      maxRetries: 1,
    });

    console.info(
      `[ActiveLearning] Auto-enqueued training for ${hostname} (session ${session.id}) ` +
        `due to assist failure: ${failureReason ?? 'unspecified'}`,
    );

    return { enqueued: true, reason: `Training enqueued: ${session.id}` };
  } catch (error) {
    console.warn('[ActiveLearning] Failed to auto-enqueue training:', error);
    return { enqueued: false, reason: 'Internal error' };
  }
}
