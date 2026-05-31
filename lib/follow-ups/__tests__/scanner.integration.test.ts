// @vitest-environment node
import { db } from '@/lib/db/client';
import {
  ApplicationConfirmationState,
  FollowUpDraftStatus,
} from '@/generated/prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_FOLLOW_UP_DELAY_DAYS,
  generateFollowUpDrafts,
  isEligibleForFollowUp,
} from '../scanner';

const HAS_DB = Boolean(process.env.DATABASE_URL);
const HOUR = 60 * 60 * 1000;
const NOW = new Date('2026-04-22T12:00:00Z');

let fixtureCounter = 0;
function nextSuffix() {
  fixtureCounter += 1;
  return `p12-3-${Date.now()}-${fixtureCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

const createdUserIds: string[] = [];

async function seed(opts: {
  hoursSinceSubmit: number | null;
  confirmationState?: ApplicationConfirmationState;
}) {
  const suffix = nextSuffix();
  const user = await db.user.create({
    data: {
      email: `follow-up-${suffix}@test.local`,
      firstName: 'Follow',
      lastName: 'Up',
    },
  });
  createdUserIds.push(user.id);

  const jobListing = await db.jobListing.create({
    data: {
      company: 'Fixture Co',
      jobId: `jobid-${suffix}`,
      title: 'Engineer',
      userId: user.id,
    },
  });
  const jobLead = await db.jobLead.create({
    data: {
      jobListingId: jobListing.id,
      title: jobListing.title,
      userId: user.id,
    },
  });
  const submittedAt =
    opts.hoursSinceSubmit === null
      ? null
      : new Date(NOW.getTime() - opts.hoursSinceSubmit * HOUR);
  const submission = await db.applicationSubmission.create({
    data: {
      confirmationState:
        opts.confirmationState ?? ApplicationConfirmationState.PENDING,
      jobLeadId: jobLead.id,
      submittedAt,
      userId: user.id,
    },
  });
  return { submission, user };
}

describe('isEligibleForFollowUp (unit)', () => {
  it('returns false when submittedAt is null', () => {
    expect(
      isEligibleForFollowUp({
        confirmationState: ApplicationConfirmationState.PENDING,
        delayDays: 7,
        now: NOW,
        submittedAt: null,
      }),
    ).toBe(false);
  });

  it('returns false when submitted less than delayDays ago', () => {
    const recent = new Date(NOW.getTime() - 3 * 24 * HOUR);
    expect(
      isEligibleForFollowUp({
        confirmationState: ApplicationConfirmationState.PENDING,
        delayDays: 7,
        now: NOW,
        submittedAt: recent,
      }),
    ).toBe(false);
  });

  it('returns true for PENDING at delayDays + 1', () => {
    const old = new Date(NOW.getTime() - 8 * 24 * HOUR);
    expect(
      isEligibleForFollowUp({
        confirmationState: ApplicationConfirmationState.PENDING,
        delayDays: 7,
        now: NOW,
        submittedAt: old,
      }),
    ).toBe(true);
  });

  it('returns false once EMAIL_CONFIRMED', () => {
    const old = new Date(NOW.getTime() - 10 * 24 * HOUR);
    expect(
      isEligibleForFollowUp({
        confirmationState: ApplicationConfirmationState.EMAIL_CONFIRMED,
        delayDays: 7,
        now: NOW,
        submittedAt: old,
      }),
    ).toBe(false);
  });

  it('returns false once VERIFIED_FAILED', () => {
    const old = new Date(NOW.getTime() - 10 * 24 * HOUR);
    expect(
      isEligibleForFollowUp({
        confirmationState: ApplicationConfirmationState.VERIFIED_FAILED,
        delayDays: 7,
        now: NOW,
        submittedAt: old,
      }),
    ).toBe(false);
  });

  it(`DEFAULT_FOLLOW_UP_DELAY_DAYS is 7`, () => {
    expect(DEFAULT_FOLLOW_UP_DELAY_DAYS).toBe(7);
  });
});

describe.skipIf(!HAS_DB)('generateFollowUpDrafts (integration)', () => {
  beforeEach(async () => {
    await db.followUpDraft.deleteMany({
      where: { userId: { in: createdUserIds } },
    });
  });

  afterAll(async () => {
    for (const userId of createdUserIds) {
      await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
  });

  it('creates a draft for a submission that has been PENDING ≥7 days', async () => {
    const { submission, user } = await seed({ hoursSinceSubmit: 8 * 24 });

    const result = await generateFollowUpDrafts({
      now: NOW,
      userId: user.id,
    });

    expect(result.created).toBe(1);

    const draft = await db.followUpDraft.findUniqueOrThrow({
      where: { applicationSubmissionId: submission.id },
    });
    expect(draft.status).toBe(FollowUpDraftStatus.DRAFT);
    expect(draft.daysSinceSubmission).toBeGreaterThanOrEqual(7);
    expect(draft.subject).toMatch(/Following up/);
  });

  it('does not create a draft when submitted <7 days ago', async () => {
    const { submission, user } = await seed({ hoursSinceSubmit: 3 * 24 });

    const result = await generateFollowUpDrafts({
      now: NOW,
      userId: user.id,
    });

    expect(result.created).toBe(0);
    expect(
      await db.followUpDraft.findUnique({
        where: { applicationSubmissionId: submission.id },
      }),
    ).toBeNull();
  });

  it('does not duplicate drafts on a repeat run', async () => {
    const { user } = await seed({ hoursSinceSubmit: 10 * 24 });

    await generateFollowUpDrafts({ now: NOW, userId: user.id });
    const second = await generateFollowUpDrafts({ now: NOW, userId: user.id });
    expect(second.created).toBe(0);

    const count = await db.followUpDraft.count({ where: { userId: user.id } });
    expect(count).toBe(1);
  });

  it('skips already EMAIL_CONFIRMED submissions', async () => {
    const { user } = await seed({
      confirmationState: ApplicationConfirmationState.EMAIL_CONFIRMED,
      hoursSinceSubmit: 30 * 24,
    });

    const result = await generateFollowUpDrafts({
      now: NOW,
      userId: user.id,
    });
    expect(result.created).toBe(0);
  });
});
