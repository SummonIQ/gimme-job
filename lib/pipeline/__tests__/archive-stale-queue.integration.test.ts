// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/lib/db/client';
import {
  archiveStaleDesktopSubmitRequests,
  JobStatus,
  JobType,
  restoreArchivedDesktopSubmitRequest,
} from '@/lib/pipeline/durable-queue';

const HAS_DB = Boolean(process.env.DATABASE_URL);

let fixtureCounter = 0;
const createdUserIds: string[] = [];
const createdJobIds: string[] = [];

function nextSuffix() {
  fixtureCounter += 1;
  return `p2-4-${Date.now()}-${fixtureCounter}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

async function seedUser() {
  const suffix = nextSuffix();
  const user = await db.user.create({
    data: {
      email: `archive-queue-${suffix}@test.local`,
      firstName: 'Archive',
      lastName: 'Queue',
    },
  });
  createdUserIds.push(user.id);
  return user;
}

async function seedJob(options: {
  userId: string;
  status?: string;
  type?: JobType;
  createdAt: Date;
}) {
  const job = await db.jobQueueItem.create({
    data: {
      createdAt: options.createdAt,
      payload: { source: 'test' },
      status: options.status ?? JobStatus.PENDING,
      type: options.type ?? JobType.DESKTOP_SUBMIT_REQUEST,
      userId: options.userId,
    },
  });
  createdJobIds.push(job.id);
  return job;
}

describe.skipIf(!HAS_DB)(
  'archiveStaleDesktopSubmitRequests + restore',
  () => {
    beforeEach(() => {
      // Clean fixture state — nothing to clear because we use unique users
    });

    afterAll(async () => {
      for (const jobId of createdJobIds) {
        await db.jobQueueItem
          .delete({ where: { id: jobId } })
          .catch(() => undefined);
      }
      for (const userId of createdUserIds) {
        await db.jobQueueItem
          .deleteMany({ where: { userId } })
          .catch(() => undefined);
        await db.user.delete({ where: { id: userId } }).catch(() => undefined);
      }
    });

    it('archives only PENDING DESKTOP_SUBMIT_REQUEST items older than 14 days', async () => {
      const user = await seedUser();
      const now = new Date('2026-05-01T00:00:00.000Z');

      const stalePending = await seedJob({
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        userId: user.id,
      });
      const recentPending = await seedJob({
        createdAt: new Date('2026-04-25T00:00:00.000Z'),
        userId: user.id,
      });
      const staleProcessing = await seedJob({
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        status: JobStatus.PROCESSING,
        userId: user.id,
      });
      const staleOtherType = await seedJob({
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        type: JobType.OPTIMIZE_JOB_LEAD,
        userId: user.id,
      });

      const result = await archiveStaleDesktopSubmitRequests({ now });

      expect(result.archived).toBeGreaterThanOrEqual(1);

      const updatedStale = await db.jobQueueItem.findUniqueOrThrow({
        where: { id: stalePending.id },
      });
      expect(updatedStale.status).toBe(JobStatus.ARCHIVED);
      expect(updatedStale.lastError).toContain('Auto-archived');

      const untouchedRecent = await db.jobQueueItem.findUniqueOrThrow({
        where: { id: recentPending.id },
      });
      expect(untouchedRecent.status).toBe(JobStatus.PENDING);

      const untouchedProcessing = await db.jobQueueItem.findUniqueOrThrow({
        where: { id: staleProcessing.id },
      });
      expect(untouchedProcessing.status).toBe(JobStatus.PROCESSING);

      const untouchedOtherType = await db.jobQueueItem.findUniqueOrThrow({
        where: { id: staleOtherType.id },
      });
      expect(untouchedOtherType.status).toBe(JobStatus.PENDING);
    });

    it('restores an archived item back to PENDING', async () => {
      const user = await seedUser();
      const archived = await seedJob({
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        status: JobStatus.ARCHIVED,
        userId: user.id,
      });

      const success = await restoreArchivedDesktopSubmitRequest(archived.id);
      expect(success).toBe(true);

      const after = await db.jobQueueItem.findUniqueOrThrow({
        where: { id: archived.id },
      });
      expect(after.status).toBe(JobStatus.PENDING);
      expect(after.lastError).toBeNull();
      expect(after.attempts).toBe(0);
    });

    it('returns false when restoring a non-archived item', async () => {
      const user = await seedUser();
      const pending = await seedJob({
        createdAt: new Date('2026-04-25T00:00:00.000Z'),
        userId: user.id,
      });

      const success = await restoreArchivedDesktopSubmitRequest(pending.id);
      expect(success).toBe(false);
    });
  },
);
