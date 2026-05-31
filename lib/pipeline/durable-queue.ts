/**
 * Durable Job Queue — A database-backed job queue that replaces the fragile
 * `after()` pattern for long-running work in serverless environments.
 *
 * The core problem: Next.js `after()` runs fire-and-forget work that can be
 * dropped if the serverless function cold-starts or times out. This module
 * provides a durable alternative by:
 *
 * 1. Persisting jobs to the database with status tracking
 * 2. Claiming jobs with optimistic locking to prevent double-processing
 * 3. Supporting exponential backoff for retries
 * 4. Providing a poll-based processor that can be triggered by:
 *    - A cron endpoint (recommended for production)
 *    - An `after()` call (optimistic, best-effort)
 *    - A webhook from an external scheduler
 */

import { type JobQueueItem, type Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db/client';
import { logger } from '@/lib/logger';

export enum JobType {
  DESKTOP_SUBMIT_REQUEST = 'DESKTOP_SUBMIT_REQUEST',
  OPTIMIZE_JOB_LEAD = 'OPTIMIZE_JOB_LEAD',
  SUBMIT_APPLICATION = 'SUBMIT_APPLICATION',
  ANALYZE_FORM = 'ANALYZE_FORM',
  RUN_PIPELINE = 'RUN_PIPELINE',
  TRAIN_SESSION = 'TRAIN_SESSION',
}

export enum JobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  DEAD = 'DEAD',
  ARCHIVED = 'ARCHIVED',
}

export const JobQueueStatus = {
  ARCHIVED: JobStatus.ARCHIVED,
  COMPLETED: JobStatus.COMPLETED,
  DEAD: JobStatus.DEAD,
  FAILED: JobStatus.FAILED,
  PENDING: JobStatus.PENDING,
  PROCESSING: JobStatus.PROCESSING,
} as const;

export const DESKTOP_SUBMIT_REQUEST_TTL_DAYS = 14;

export function computeArchivalCutoff(
  now: Date,
  ttlDays: number = DESKTOP_SUBMIT_REQUEST_TTL_DAYS,
): Date {
  return new Date(now.getTime() - ttlDays * 24 * 60 * 60 * 1000);
}

export type JobQueueStatus =
  (typeof JobQueueStatus)[keyof typeof JobQueueStatus];

interface EnqueueOptions {
  type: JobType;
  payload: Prisma.InputJsonValue;
  deduplicationKey?: string;
  delayMs?: number;
  maxRetries?: number;
  priority?: number;
  userId?: string;
}

type JobHandler = (payload: Prisma.JsonValue) => Promise<void>;

const handlers = new Map<JobType, JobHandler>();

export function registerJobHandler(type: JobType, handler: JobHandler): void {
  handlers.set(type, handler);
}

export async function enqueueJob(
  options: EnqueueOptions,
): Promise<JobQueueItem> {
  const {
    type,
    payload,
    priority = 0,
    maxRetries = 3,
    delayMs = 0,
    deduplicationKey,
    userId,
  } = options;

  if (deduplicationKey) {
    const existing = await db.jobQueueItem.findFirst({
      orderBy: { createdAt: 'desc' },
      where: {
        deduplicationKey,
        status: { in: [JobStatus.PENDING, JobStatus.PROCESSING] },
      },
    });

    if (existing) {
      logger.info('[QUEUE] Duplicate job skipped', {
        deduplicationKey,
        existingId: existing.id,
        type,
      });
      return existing;
    }
  }

  const processAfter =
    delayMs > 0 ? new Date(Date.now() + delayMs) : new Date();

  const job = await db.jobQueueItem.create({
    data: {
      attempts: 0,
      deduplicationKey,
      maxRetries,
      payload,
      priority,
      processAfter,
      status: JobStatus.PENDING,
      type,
      userId,
    },
  });

  logger.info('[QUEUE] Job enqueued', {
    jobId: job.id,
    priority,
    processAfter: processAfter.toISOString(),
    type,
  });

  return job;
}

export async function processQueuedJobs(
  batchSize: number = 5,
): Promise<{
  failed: number;
  processed: number;
  remaining: number;
}> {
  const stats = { failed: 0, processed: 0, remaining: 0 };

  const pendingJobs = await db.jobQueueItem.findMany({
    where: {
      processAfter: { lte: new Date() },
      status: JobStatus.PENDING,
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    take: batchSize,
  });

  if (pendingJobs.length === 0) {
    return stats;
  }

  logger.info('[QUEUE] Processing batch', { count: pendingJobs.length });

  for (const job of pendingJobs) {
    const claimed = await db.jobQueueItem.updateMany({
      where: {
        id: job.id,
        status: JobStatus.PENDING,
      },
      data: {
        attempts: { increment: 1 },
        startedAt: new Date(),
        status: JobStatus.PROCESSING,
      },
    });

    if (claimed.count === 0) {
      continue;
    }

    const handler = handlers.get(job.type as JobType);
    if (!handler) {
      logger.error('[QUEUE] No handler for job type', { type: job.type });
      await markJobFailed(
        job.id,
        `No handler registered for type: ${job.type}`,
        job.attempts + 1,
        job.maxRetries,
      );
      stats.failed++;
      continue;
    }

    try {
      await handler(job.payload as Record<string, unknown>);

      await db.jobQueueItem.update({
        where: { id: job.id },
        data: {
          completedAt: new Date(),
          status: JobStatus.COMPLETED,
        },
      });

      stats.processed++;
      logger.info('[QUEUE] Job completed', { jobId: job.id, type: job.type });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await markJobFailed(job.id, errorMessage, job.attempts + 1, job.maxRetries);
      stats.failed++;
    }
  }

  stats.remaining = await db.jobQueueItem.count({
    where: {
      processAfter: { lte: new Date() },
      status: JobStatus.PENDING,
    },
  });

  return stats;
}

async function markJobFailed(
  jobId: string,
  errorMessage: string,
  attempts: number,
  maxRetries: number,
): Promise<void> {
  if (attempts >= maxRetries) {
    await db.jobQueueItem.update({
      where: { id: jobId },
      data: {
        completedAt: new Date(),
        lastError: errorMessage,
        status: JobStatus.DEAD,
      },
    });
    logger.error('[QUEUE] Job permanently failed (max retries)', {
      attempts,
      error: errorMessage,
      jobId,
    });
    return;
  }

  const backoffMs = Math.min(
    1000 * Math.pow(2, attempts) + Math.random() * 1000,
    300_000,
  );
  const processAfter = new Date(Date.now() + backoffMs);

  await db.jobQueueItem.update({
    where: { id: jobId },
    data: {
      lastError: errorMessage,
      processAfter,
      status: JobStatus.PENDING,
    },
  });

  logger.warn('[QUEUE] Job failed, scheduled retry', {
    attempt: attempts,
    backoffMs,
    jobId,
    maxRetries,
    nextRetryAt: processAfter.toISOString(),
  });
}

export async function cleanupOldJobs(
  olderThanDays: number = 7,
): Promise<number> {
  const cutoff = new Date(
    Date.now() - olderThanDays * 24 * 60 * 60 * 1000,
  );

  const result = await db.jobQueueItem.deleteMany({
    where: {
      status: { in: [JobStatus.COMPLETED, JobStatus.DEAD] },
      updatedAt: { lt: cutoff },
    },
  });

  logger.info('[QUEUE] Cleaned up old jobs', { deleted: result.count });
  return result.count;
}

export async function archiveStaleDesktopSubmitRequests(options: {
  readonly ttlDays?: number;
  readonly now?: Date;
} = {}): Promise<{ archived: number; cutoff: Date }> {
  const ttlDays = options.ttlDays ?? DESKTOP_SUBMIT_REQUEST_TTL_DAYS;
  const now = options.now ?? new Date();
  const cutoff = computeArchivalCutoff(now, ttlDays);

  const result = await db.jobQueueItem.updateMany({
    where: {
      createdAt: { lt: cutoff },
      status: JobStatus.PENDING,
      type: JobType.DESKTOP_SUBMIT_REQUEST,
    },
    data: {
      lastError: `Auto-archived: unconsumed for > ${ttlDays} days`,
      status: JobStatus.ARCHIVED,
    },
  });

  if (result.count > 0) {
    logger.info('[QUEUE] Archived stale desktop submit requests', {
      archived: result.count,
      cutoff: cutoff.toISOString(),
      ttlDays,
    });
  }

  return { archived: result.count, cutoff };
}

export async function restoreArchivedDesktopSubmitRequest(
  jobId: string,
): Promise<boolean> {
  const result = await db.jobQueueItem.updateMany({
    where: {
      id: jobId,
      status: JobStatus.ARCHIVED,
      type: JobType.DESKTOP_SUBMIT_REQUEST,
    },
    data: {
      attempts: 0,
      lastError: null,
      processAfter: new Date(),
      status: JobStatus.PENDING,
    },
  });

  return result.count > 0;
}

export async function recoverStuckJobs(
  stuckAfterMinutes: number = 15,
): Promise<number> {
  const cutoff = new Date(Date.now() - stuckAfterMinutes * 60 * 1000);

  const result = await db.jobQueueItem.updateMany({
    where: {
      startedAt: { lt: cutoff },
      status: JobStatus.PROCESSING,
    },
    data: {
      lastError: `Recovered: stuck in PROCESSING for > ${stuckAfterMinutes} minutes`,
      status: JobStatus.PENDING,
    },
  });

  if (result.count > 0) {
    logger.warn('[QUEUE] Recovered stuck jobs', { count: result.count });
  }

  return result.count;
}
