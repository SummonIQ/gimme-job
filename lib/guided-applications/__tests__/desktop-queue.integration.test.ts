// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { getCurrentUser } from '@/lib/user/query';

vi.mock('@/lib/user/query', () => ({
  getCurrentUser: vi.fn(),
}));

import { GuidedApplicationStatus } from '@/generated/prisma/client';
import { db } from '@/lib/db/client';
import {
  enqueueDesktopSubmitRequest,
  getGuidedApplicationProgress,
} from '@/lib/guided-applications/session';
import { JobType } from '@/lib/pipeline/durable-queue';

const HAS_DB = Boolean(process.env.DATABASE_URL);

let fixtureCounter = 0;
const createdUserIds: string[] = [];

function nextSuffix() {
  fixtureCounter += 1;
  return `p2-3-${Date.now()}-${fixtureCounter}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

async function seedGuidedApplication() {
  const suffix = nextSuffix();
  const user = await db.user.create({
    data: {
      email: `desktop-queue-${suffix}@test.local`,
      firstName: 'Desktop',
      lastName: 'Queue',
    },
  });
  createdUserIds.push(user.id);

  const jobListing = await db.jobListing.create({
    data: {
      company: 'Example Co',
      jobId: `desktop-queue-${suffix}`,
      title: 'Software Engineer',
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

  const guidedApplication = await db.guidedApplication.create({
    data: {
      applicationUrl: `https://jobs.example.test/apply/${suffix}`,
      company: jobListing.company,
      jobLeadId: jobLead.id,
      jobTitle: jobListing.title,
      status: GuidedApplicationStatus.READY_TO_SUBMIT,
      userId: user.id,
    },
  });

  return { guidedApplication, jobLead, user };
}

describe.skipIf(!HAS_DB)('desktop submit queue requests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    for (const userId of createdUserIds) {
      await db.jobQueueItem
        .deleteMany({ where: { userId } })
        .catch(() => undefined);
      await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
  });

  it('creates a DESKTOP_SUBMIT_REQUEST queue item for the signed-in owner', async () => {
    const { guidedApplication, jobLead, user } = await seedGuidedApplication();
    vi.mocked(getCurrentUser).mockResolvedValue(user);

    const result = await enqueueDesktopSubmitRequest(guidedApplication.id);

    expect(result.success).toBe(true);
    expect(result.queueItemId).toEqual(expect.any(String));

    const queueItem = await db.jobQueueItem.findUniqueOrThrow({
      where: { id: result.queueItemId },
    });

    expect(queueItem.type).toBe(JobType.DESKTOP_SUBMIT_REQUEST);
    expect(queueItem.userId).toBe(user.id);
    expect(queueItem.status).toBe('PENDING');
    expect(queueItem.payload).toMatchObject({
      guidedApplicationId: guidedApplication.id,
      jobLeadId: jobLead.id,
      source: 'web-preview',
      version: 1,
    });

    const progress = await getGuidedApplicationProgress(guidedApplication.id);
    expect(progress?.desktopQueueItemId).toBe(queueItem.id);
  });

  it('deduplicates repeated button clicks for the same guided application', async () => {
    const { guidedApplication, user } = await seedGuidedApplication();
    vi.mocked(getCurrentUser).mockResolvedValue(user);

    const first = await enqueueDesktopSubmitRequest(guidedApplication.id);
    const second = await enqueueDesktopSubmitRequest(guidedApplication.id);

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(second.queueItemId).toBe(first.queueItemId);

    const count = await db.jobQueueItem.count({
      where: {
        deduplicationKey: `desktop-submit:${guidedApplication.id}`,
        type: JobType.DESKTOP_SUBMIT_REQUEST,
      },
    });
    expect(count).toBe(1);
  });
});
