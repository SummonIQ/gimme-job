// Training worker — NO PLAYWRIGHT. The worker initializes the session
// (status → running, ATS detection). The actual field analysis is driven
// by the CLIENT via /api/assist-training/[id]/analyze-step, because the
// client already has the rendered HTML in the embedded browser view.

import { db } from '@/lib/db/client';
import { getPrivateUserChannel } from '@/lib/events/channels';
import { sendEvent } from '@/lib/events/send';
import { DataEventType, EventType } from '@/types/events';

import type { TrainingSessionConfig } from './types';

const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Initialize a training session. Sets status to 'running', detects the
 * ATS system, and returns. The actual analysis is client-driven via the
 * analyze-step endpoint.
 */
export async function runTrainingSession(
  config: TrainingSessionConfig,
): Promise<void> {
  const { sessionId, userId, hostname } = config;

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`Training session timed out after ${SESSION_TIMEOUT_MS / 1000}s`)),
      SESSION_TIMEOUT_MS,
    ),
  );

  try {
    await Promise.race([initializeSession(config), timeoutPromise]);
  } catch (error) {
    console.error(`[Training:${sessionId}] Top-level failure:`, error);
    await updateSession(sessionId, userId, hostname, {
      status: 'failed',
      completedAt: new Date(),
      error: error instanceof Error ? error.message : String(error),
    }).catch(() => {});
  }
}

async function initializeSession(
  config: TrainingSessionConfig,
): Promise<void> {
  const { sessionId, userId, hostname } = config;

  await updateSession(sessionId, userId, hostname, { status: 'running' });

  // Detect ATS system
  const atsInfo = await detectAtsSystem(hostname);
  if (atsInfo) {
    await updateSession(sessionId, userId, hostname, {
      atsSystemName: atsInfo.name,
      atsSystemId: atsInfo.id,
    });
  }

  console.log(
    `[Training:${sessionId}] Session initialized for ${hostname}. ` +
      `Waiting for client-driven analysis via analyze-step endpoint.`,
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function detectAtsSystem(
  hostname: string,
): Promise<{ id: string; name: string } | null> {
  return db.aTSSystem.findFirst({
    where: {
      OR: [{ detectedDomain: hostname }, { domainPatterns: { has: hostname } }],
    },
    select: { id: true, name: true },
  });
}

async function updateSession(
  sessionId: string,
  userId: string,
  hostname: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const updated = await db.assistTrainingSession.update({
      where: { id: sessionId },
      data,
      select: {
        id: true,
        status: true,
        hostname: true,
        completedSteps: true,
        totalSteps: true,
        progress: true,
        observationsCreated: true,
        rulesPromoted: true,
        error: true,
        completedAt: true,
        stepLogs: true,
      },
    });

    await sendEvent({
      channel: getPrivateUserChannel(userId),
      type: EventType.DataUpdate,
      payload: {
        type: DataEventType.ASSIST_TRAINING_PROGRESS,
        data: {
          sessionId: updated.id,
          status: updated.status,
          hostname: updated.hostname,
          completedSteps: updated.completedSteps,
          totalSteps: updated.totalSteps,
          progress: updated.progress,
          observationsCreated: updated.observationsCreated,
          rulesPromoted: updated.rulesPromoted,
          error: updated.error,
          completedAt: updated.completedAt?.toISOString() ?? null,
          stepLogs: (updated.stepLogs as Record<string, unknown>[]) ?? [],
        },
      },
    }).catch(err => console.warn(`[Training] Pusher broadcast failed:`, err));
  } catch (error) {
    console.error(`[Training] Failed to update session ${sessionId}:`, error);
  }
}
