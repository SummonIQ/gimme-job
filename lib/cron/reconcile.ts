import { db } from '@/lib/db/client';
import { ApplicationConfirmationState } from '@/generated/prisma/client';

export const PENDING_TIMEOUT_HOURS = 72;

/**
 * Timing helper, exported so unit tests can lock behavior without a DB.
 * Returns the cutoff timestamp: any submission whose `submittedAt` is
 * strictly earlier than this and which is still `PENDING` should be
 * transitioned to `PRESUMED_FAILED`.
 */
export function pendingTimeoutCutoff(now: Date): Date {
  return new Date(now.getTime() - PENDING_TIMEOUT_HOURS * 60 * 60 * 1000);
}

/**
 * Pure predicate used by the unit tests — separate from the DB call so the
 * timing boundaries can be exercised without fixtures.
 */
export function shouldAutoFailPending(
  submittedAt: Date | null,
  confirmationState: ApplicationConfirmationState,
  now: Date,
): boolean {
  if (confirmationState !== ApplicationConfirmationState.PENDING) return false;
  if (!submittedAt) return false;
  return submittedAt.getTime() < pendingTimeoutCutoff(now).getTime();
}

export interface ReconcilePendingResult {
  cutoff: Date;
  transitioned: number;
  transitionedIds: string[];
}

export async function reconcilePendingSubmissions(
  now: Date = new Date(),
): Promise<ReconcilePendingResult> {
  const cutoff = pendingTimeoutCutoff(now);

  const stale = await db.applicationSubmission.findMany({
    select: { id: true, userId: true },
    where: {
      confirmationState: ApplicationConfirmationState.PENDING,
      submittedAt: { lt: cutoff, not: null },
    },
  });

  if (stale.length === 0) {
    return { cutoff, transitioned: 0, transitionedIds: [] };
  }

  const transitionedAt = now;
  await db.$transaction([
    db.applicationSubmission.updateMany({
      data: {
        confirmationState: ApplicationConfirmationState.PRESUMED_FAILED,
      },
      where: { id: { in: stale.map(s => s.id) } },
    }),
    db.automationAuditLog.createMany({
      data: stale.map(s => ({
        action: 'AUTO_FAIL_STALE_PENDING',
        actionType: 'RECONCILE',
        applicationSubmissionId: s.id,
        metadata: {
          cutoff: cutoff.toISOString(),
          previousConfirmationState: 'PENDING',
          reason: `submittedAt older than ${PENDING_TIMEOUT_HOURS}h with no confirmation`,
          transitionedAt: transitionedAt.toISOString(),
        },
        userId: s.userId,
      })),
    }),
  ]);

  return {
    cutoff,
    transitioned: stale.length,
    transitionedIds: stale.map(s => s.id),
  };
}
