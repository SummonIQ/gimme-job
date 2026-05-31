// @vitest-environment node
import { db } from '@/lib/db/client';
import {
  ApplicationConfirmationState,
  FollowUpDraftStatus,
} from '@/generated/prisma/client';
import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/user/query', () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from '@/lib/user/query';

import {
  dismissFollowUpDraft,
  markFollowUpDraftSent,
  updateFollowUpDraftBody,
} from '../actions';

const HAS_DB = Boolean(process.env.DATABASE_URL);

let fixtureCounter = 0;
function nextSuffix() {
  fixtureCounter += 1;
  return `p12-3-act-${Date.now()}-${fixtureCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

const createdUserIds: string[] = [];

async function seedDraft() {
  const suffix = nextSuffix();
  const user = await db.user.create({
    data: {
      email: `actions-${suffix}@test.local`,
      firstName: 'Actions',
      lastName: 'Test',
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
      confirmationState: ApplicationConfirmationState.PENDING,
      jobLeadId: jobLead.id,
      submittedAt: new Date('2026-04-01T00:00:00Z'),
      userId: user.id,
    },
  });
  const draft = await db.followUpDraft.create({
    data: {
      applicationSubmissionId: submission.id,
      bodyMarkdown: 'original body',
      daysSinceSubmission: 10,
      subject: 'original subject',
      userId: user.id,
    },
  });
  return { draft, user };
}

describe.skipIf(!HAS_DB)('follow-up draft server actions', () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockReset();
  });

  afterAll(async () => {
    for (const userId of createdUserIds) {
      await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
  });

  it('updateFollowUpDraftBody rejects unauthenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null as never);
    await expect(
      updateFollowUpDraftBody('nope', 'body'),
    ).rejects.toThrow('Unauthorized');
  });

  it('updateFollowUpDraftBody rejects cross-user', async () => {
    const { draft } = await seedDraft();
    const intruder = await seedDraft();
    vi.mocked(getCurrentUser).mockResolvedValue(intruder.user as never);
    await expect(
      updateFollowUpDraftBody(draft.id, 'hack'),
    ).rejects.toThrow('Draft not found');
  });

  it('updateFollowUpDraftBody updates body and subject', async () => {
    const { draft, user } = await seedDraft();
    vi.mocked(getCurrentUser).mockResolvedValue(user as never);

    await updateFollowUpDraftBody(draft.id, 'new body', 'new subject');

    const after = await db.followUpDraft.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(after.bodyMarkdown).toBe('new body');
    expect(after.subject).toBe('new subject');
  });

  it('markFollowUpDraftSent sets SENT + sentAt + reviewedAt', async () => {
    const { draft, user } = await seedDraft();
    vi.mocked(getCurrentUser).mockResolvedValue(user as never);

    const now = new Date('2026-04-22T13:00:00Z');
    await markFollowUpDraftSent(draft.id, now);

    const after = await db.followUpDraft.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(after.status).toBe(FollowUpDraftStatus.SENT);
    expect(after.sentAt?.toISOString()).toBe(now.toISOString());
    expect(after.reviewedAt?.toISOString()).toBe(now.toISOString());
  });

  it('dismissFollowUpDraft sets DISMISSED + reviewedAt', async () => {
    const { draft, user } = await seedDraft();
    vi.mocked(getCurrentUser).mockResolvedValue(user as never);

    await dismissFollowUpDraft(draft.id);

    const after = await db.followUpDraft.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(after.status).toBe(FollowUpDraftStatus.DISMISSED);
    expect(after.reviewedAt).not.toBeNull();
  });
});
