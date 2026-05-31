// @vitest-environment node
import { db } from '@/lib/db/client';
import { ApplicationConfirmationState } from '@/generated/prisma/client';
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/user/query', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/user/query';
import { manuallyTransitionConfirmationState } from '../actions';

const HAS_DB = Boolean(process.env.DATABASE_URL);

let fixtureCounter = 0;
function nextSuffix() {
  fixtureCounter += 1;
  return `p10-3-${Date.now()}-${fixtureCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

const createdUserIds: string[] = [];

async function seed() {
  const suffix = nextSuffix();
  const user = await db.user.create({
    data: {
      email: `reconcile-action-${suffix}@test.local`,
      firstName: 'Reconcile',
      lastName: 'Action',
    },
  });
  createdUserIds.push(user.id);

  const jobListing = await db.jobListing.create({
    data: { jobId: `jobid-${suffix}`, title: 'Engineer', userId: user.id },
  });
  const jobLead = await db.jobLead.create({
    data: {
      jobListingId: jobListing.id,
      title: jobListing.title,
      userId: user.id,
    },
  });
  const submission = await db.applicationSubmission.create({
    data: {
      jobLeadId: jobLead.id,
      submittedAt: new Date('2026-04-01T00:00:00Z'),
      userId: user.id,
    },
  });

  return { jobLead, jobListing, submission, user };
}

describe.skipIf(!HAS_DB)('manuallyTransitionConfirmationState', () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockReset();
  });

  afterEach(() => {
    vi.mocked(getCurrentUser).mockReset();
  });

  afterAll(async () => {
    for (const userId of createdUserIds) {
      await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
  });

  it('throws Unauthorized when no user is logged in', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null as never);

    await expect(
      manuallyTransitionConfirmationState({
        nextState: ApplicationConfirmationState.EMAIL_CONFIRMED,
        submissionId: 'does-not-matter',
      }),
    ).rejects.toThrow('Unauthorized');
  });

  it('throws Submission not found when acting on another user\'s submission', async () => {
    const { submission } = await seed();

    const otherUser = await db.user.create({
      data: {
        email: `reconcile-other-${nextSuffix()}@test.local`,
        firstName: 'Other',
        lastName: 'User',
      },
    });
    createdUserIds.push(otherUser.id);

    vi.mocked(getCurrentUser).mockResolvedValue(otherUser as never);

    await expect(
      manuallyTransitionConfirmationState({
        nextState: ApplicationConfirmationState.EMAIL_CONFIRMED,
        submissionId: submission.id,
      }),
    ).rejects.toThrow('Submission not found');
  });

  it('transitions PENDING -> EMAIL_CONFIRMED and sets verifiedAt', async () => {
    const { submission, user } = await seed();
    vi.mocked(getCurrentUser).mockResolvedValue(user as never);

    const now = new Date('2026-04-22T15:00:00Z');
    const result = await manuallyTransitionConfirmationState({
      nextState: ApplicationConfirmationState.EMAIL_CONFIRMED,
      now,
      submissionId: submission.id,
    });

    expect(result.previousState).toBe(ApplicationConfirmationState.PENDING);
    expect(result.nextState).toBe(
      ApplicationConfirmationState.EMAIL_CONFIRMED,
    );
    expect(result.verifiedAt?.toISOString()).toBe(now.toISOString());

    const after = await db.applicationSubmission.findUniqueOrThrow({
      where: { id: submission.id },
    });
    expect(after.confirmationState).toBe(
      ApplicationConfirmationState.EMAIL_CONFIRMED,
    );
    expect(after.verifiedAt?.toISOString()).toBe(now.toISOString());

    const audits = await db.automationAuditLog.findMany({
      where: {
        action: 'MANUAL_CONFIRMATION_TRANSITION',
        applicationSubmissionId: submission.id,
      },
    });
    expect(audits.length).toBe(1);
    expect(audits[0].actionType).toBe('RECONCILE');
    const meta = audits[0].metadata as Record<string, unknown> | null;
    expect(meta?.previousState).toBe('PENDING');
    expect(meta?.nextState).toBe('EMAIL_CONFIRMED');
  });

  it('preserves an earlier verifiedAt when transitioning between verified states', async () => {
    const { submission, user } = await seed();
    vi.mocked(getCurrentUser).mockResolvedValue(user as never);

    const firstVerified = new Date('2026-04-10T00:00:00Z');
    await db.applicationSubmission.update({
      data: {
        confirmationState: ApplicationConfirmationState.ATS_CONFIRMED,
        verifiedAt: firstVerified,
      },
      where: { id: submission.id },
    });

    const result = await manuallyTransitionConfirmationState({
      nextState: ApplicationConfirmationState.EMAIL_CONFIRMED,
      now: new Date('2026-04-22T00:00:00Z'),
      submissionId: submission.id,
    });
    expect(result.verifiedAt?.toISOString()).toBe(firstVerified.toISOString());
  });

  it('transitioning to a non-verified state does not clear a prior verifiedAt', async () => {
    const { submission, user } = await seed();
    vi.mocked(getCurrentUser).mockResolvedValue(user as never);

    const verified = new Date('2026-04-10T00:00:00Z');
    await db.applicationSubmission.update({
      data: {
        confirmationState: ApplicationConfirmationState.EMAIL_CONFIRMED,
        verifiedAt: verified,
      },
      where: { id: submission.id },
    });

    const result = await manuallyTransitionConfirmationState({
      nextState: ApplicationConfirmationState.VERIFIED_FAILED,
      submissionId: submission.id,
    });
    expect(result.nextState).toBe(
      ApplicationConfirmationState.VERIFIED_FAILED,
    );
    expect(result.verifiedAt?.toISOString()).toBe(verified.toISOString());
  });

  it('every manual transition writes a distinct audit row', async () => {
    const { submission, user } = await seed();
    vi.mocked(getCurrentUser).mockResolvedValue(user as never);

    await manuallyTransitionConfirmationState({
      nextState: ApplicationConfirmationState.ATS_CONFIRMED,
      submissionId: submission.id,
    });
    await manuallyTransitionConfirmationState({
      nextState: ApplicationConfirmationState.EMAIL_CONFIRMED,
      submissionId: submission.id,
    });
    await manuallyTransitionConfirmationState({
      nextState: ApplicationConfirmationState.PENDING,
      submissionId: submission.id,
    });

    const audits = await db.automationAuditLog.findMany({
      where: {
        action: 'MANUAL_CONFIRMATION_TRANSITION',
        applicationSubmissionId: submission.id,
      },
    });
    expect(audits.length).toBe(3);
  });
});
