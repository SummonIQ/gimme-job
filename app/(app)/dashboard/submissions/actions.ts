'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db/client';
import { ApplicationConfirmationState } from '@/generated/prisma/client';
import { getCurrentUser } from '@/lib/user/query';

const MANUAL_STATES = [
  ApplicationConfirmationState.ATS_CONFIRMED,
  ApplicationConfirmationState.EMAIL_CONFIRMED,
  ApplicationConfirmationState.DASHBOARD_CONFIRMED,
  ApplicationConfirmationState.PRESUMED_FAILED,
  ApplicationConfirmationState.VERIFIED_FAILED,
  ApplicationConfirmationState.PENDING,
] as const satisfies readonly ApplicationConfirmationState[];

export type ManualConfirmationState = (typeof MANUAL_STATES)[number];

function isManualConfirmationState(
  value: string,
): value is ManualConfirmationState {
  return (MANUAL_STATES as readonly string[]).includes(value);
}

interface TransitionInput {
  readonly submissionId: string;
  readonly nextState: ManualConfirmationState;
  readonly now?: Date;
}

export interface TransitionResult {
  readonly submissionId: string;
  readonly previousState: ApplicationConfirmationState;
  readonly nextState: ApplicationConfirmationState;
  readonly verifiedAt: Date | null;
}

const VERIFIED_STATES = new Set<ApplicationConfirmationState>([
  ApplicationConfirmationState.ATS_CONFIRMED,
  ApplicationConfirmationState.EMAIL_CONFIRMED,
  ApplicationConfirmationState.DASHBOARD_CONFIRMED,
]);

/**
 * Manually transition a submission's confirmationState. Only the owning
 * user can act. Writes an AutomationAuditLog row for every transition.
 * When the target state represents a verified submission, verifiedAt is
 * set to `now` (unless already set).
 */
export async function manuallyTransitionConfirmationState({
  submissionId,
  nextState,
  now = new Date(),
}: TransitionInput): Promise<TransitionResult> {
  const user = await getCurrentUser();
  if (!user?.id) {
    throw new Error('Unauthorized');
  }

  const submission = await db.applicationSubmission.findUnique({
    select: { confirmationState: true, userId: true, verifiedAt: true },
    where: { id: submissionId },
  });

  if (!submission || submission.userId !== user.id) {
    throw new Error('Submission not found');
  }

  const previousState = submission.confirmationState;

  const nextVerifiedAt = VERIFIED_STATES.has(nextState)
    ? (submission.verifiedAt ?? now)
    : submission.verifiedAt;

  const [updated] = await db.$transaction([
    db.applicationSubmission.update({
      data: {
        confirmationState: nextState,
        verifiedAt: nextVerifiedAt,
      },
      where: { id: submissionId },
    }),
    db.automationAuditLog.create({
      data: {
        action: 'MANUAL_CONFIRMATION_TRANSITION',
        actionType: 'RECONCILE',
        applicationSubmissionId: submissionId,
        metadata: {
          nextState,
          previousState,
          reason: 'Manually updated from reconciliation dashboard.',
          transitionedAt: now.toISOString(),
          verifiedAt: nextVerifiedAt?.toISOString() ?? null,
        },
        userId: user.id,
      },
    }),
  ]);

  revalidatePath('/dashboard/submissions');

  return {
    nextState: updated.confirmationState,
    previousState,
    submissionId: updated.id,
    verifiedAt: updated.verifiedAt,
  };
}
