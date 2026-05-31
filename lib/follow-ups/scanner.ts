import { db } from '@/lib/db/client';
import {
  ApplicationConfirmationState,
  FollowUpDraftStatus,
} from '@/generated/prisma/client';

import { generateFollowUpDraft } from './draft-generator';

export const DEFAULT_FOLLOW_UP_DELAY_DAYS = 7;

export interface GenerateFollowUpsResult {
  readonly scanned: number;
  readonly eligible: number;
  readonly created: number;
  readonly skipped: number;
  readonly createdIds: readonly string[];
}

export interface GenerateFollowUpsOptions {
  readonly now?: Date;
  readonly delayDays?: number;
  readonly userId?: string;
}

/**
 * Pure helper exposed for unit tests. Returns the candidates from a set of
 * submissions that should get a follow-up draft right now.
 *
 * A submission is eligible when all of the following hold:
 *   - submittedAt is set and ≥ delayDays ago
 *   - confirmationState is PENDING or ATS_CONFIRMED (not email/dashboard-
 *     confirmed or already failed)
 *   - no existing FollowUpDraft yet (the DB wrapper enforces this via the
 *     @unique applicationSubmissionId constraint)
 */
export function isEligibleForFollowUp({
  submittedAt,
  confirmationState,
  now,
  delayDays,
}: {
  submittedAt: Date | null;
  confirmationState: ApplicationConfirmationState;
  now: Date;
  delayDays: number;
}): boolean {
  if (!submittedAt) return false;
  const ageDays =
    (now.getTime() - submittedAt.getTime()) / (24 * 60 * 60 * 1000);
  if (ageDays < delayDays) return false;

  if (
    confirmationState === ApplicationConfirmationState.EMAIL_CONFIRMED ||
    confirmationState === ApplicationConfirmationState.DASHBOARD_CONFIRMED ||
    confirmationState === ApplicationConfirmationState.VERIFIED_FAILED
  ) {
    return false;
  }
  return true;
}

export async function generateFollowUpDrafts(
  options: GenerateFollowUpsOptions = {},
): Promise<GenerateFollowUpsResult> {
  const now = options.now ?? new Date();
  const delayDays = options.delayDays ?? DEFAULT_FOLLOW_UP_DELAY_DAYS;
  const cutoff = new Date(now.getTime() - delayDays * 24 * 60 * 60 * 1000);

  const rows = await db.applicationSubmission.findMany({
    include: {
      jobLead: {
        include: {
          jobListing: { select: { company: true, title: true } },
        },
      },
      followUpDraft: { select: { id: true } },
      user: { select: { firstName: true } },
    },
    where: {
      confirmationState: {
        in: [
          ApplicationConfirmationState.PENDING,
          ApplicationConfirmationState.ATS_CONFIRMED,
          ApplicationConfirmationState.PRESUMED_FAILED,
        ],
      },
      followUpDraft: null,
      submittedAt: { lte: cutoff, not: null },
      ...(options.userId ? { userId: options.userId } : {}),
    },
  });

  const createdIds: string[] = [];
  let skipped = 0;
  for (const row of rows) {
    if (
      !isEligibleForFollowUp({
        confirmationState: row.confirmationState,
        delayDays,
        now,
        submittedAt: row.submittedAt,
      })
    ) {
      skipped += 1;
      continue;
    }
    const daysSinceSubmission = Math.floor(
      (now.getTime() - (row.submittedAt as Date).getTime()) /
        (24 * 60 * 60 * 1000),
    );
    const draft = generateFollowUpDraft({
      applicantFirstName: row.user.firstName,
      company: row.jobLead.jobListing.company,
      daysSinceSubmission,
      role: row.jobLead.jobListing.title,
      submittedAt: row.submittedAt as Date,
    });

    try {
      const created = await db.followUpDraft.create({
        data: {
          applicationSubmissionId: row.id,
          bodyMarkdown: draft.bodyMarkdown,
          daysSinceSubmission,
          generatedAt: now,
          status: FollowUpDraftStatus.DRAFT,
          subject: draft.subject,
          userId: row.userId,
        },
      });
      createdIds.push(created.id);
    } catch {
      // Unique-violation races (e.g. two cron runs colliding) — skip quietly.
      skipped += 1;
    }
  }

  return {
    created: createdIds.length,
    createdIds,
    eligible: rows.length,
    scanned: rows.length + skipped,
    skipped,
  };
}
