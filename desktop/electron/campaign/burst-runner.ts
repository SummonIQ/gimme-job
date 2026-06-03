export const DESKTOP_BURST_QUEUE_TYPE = 'DESKTOP_SUBMIT_REQUEST';
export const DESKTOP_BURST_ACTION_TYPE = 'submit';
export const EMAIL_CONFIRMED_STATE = 'EMAIL_CONFIRMED';

const DEFAULT_MAX_ITEMS = 20;
const DEFAULT_CONCURRENCY = 2;
const DEFAULT_RATE_LIMIT_RETRY_MS = 15 * 60 * 1000;
const WEBSOCKET_OPEN_STATE = 1;

export interface DesktopBurstRateLimitConfig {
  capacity: number;
  dayLimit?: number | null;
  refillRatePerSec: number;
}

export interface DesktopBurstRateLimitRequest {
  actionType: string;
  config: DesktopBurstRateLimitConfig;
  cost: number;
  hostname: string;
  now: Date;
}

export interface DesktopBurstRateLimitResult {
  ok: boolean;
  reason?: 'INSUFFICIENT_TOKENS' | 'DAY_LIMIT_REACHED';
  retryAfterMs?: number;
  tokensRemaining: number;
}

export interface DesktopBurstRateLimiter {
  acquire: (
    input: DesktopBurstRateLimitRequest,
  ) => Promise<DesktopBurstRateLimitResult>;
}

export interface DesktopBurstQueueItem {
  attempts: number;
  id: string;
  maxRetries: number;
  payload: unknown;
  userId?: string | null;
}

export interface DesktopBurstQueueClaimInput {
  limit: number;
  now: Date;
  type: typeof DESKTOP_BURST_QUEUE_TYPE;
}

export interface DesktopBurstQueueStore {
  claimPending: (
    input: DesktopBurstQueueClaimInput,
  ) => Promise<readonly DesktopBurstQueueItem[]>;
  defer: (input: DesktopBurstQueueDeferInput) => Promise<void>;
  markCompleted: (input: DesktopBurstQueueCompleteInput) => Promise<void>;
  markFailed: (input: DesktopBurstQueueFailureInput) => Promise<void>;
}

export interface DesktopBurstQueueCompleteInput {
  completedAt: Date;
  confirmationState: typeof EMAIL_CONFIRMED_STATE;
  queueItemId: string;
  submissionId?: string | null;
}

export interface DesktopBurstQueueFailureInput {
  error: string;
  failedAt: Date;
  queueItemId: string;
}

export interface DesktopBurstQueueDeferInput {
  error: string;
  processAfter: Date;
  queueItemId: string;
}

export interface DesktopSubmitQueuePayload {
  applicationUrl: string;
  company?: string | null;
  effectiveMode?: string | null;
  guidedApplicationId?: string | null;
  jobLeadId: string;
  jobTitle?: string | null;
  requestedMode?: string | null;
  resumeId?: string | null;
  trustLevel?: string | null;
}

export type DesktopBurstConfirmationState =
  | 'ATS_CONFIRMED'
  | 'DASHBOARD_CONFIRMED'
  | 'EMAIL_CONFIRMED'
  | 'PENDING'
  | 'PRESUMED_FAILED'
  | 'VERIFIED_FAILED';

export interface DesktopBurstSubmitInput {
  burstId: string;
  hostname: string;
  payload: DesktopSubmitQueuePayload;
  queueItem: DesktopBurstQueueItem;
}

export interface DesktopBurstSubmitResult {
  confirmationState: DesktopBurstConfirmationState;
  message?: string;
  submissionId?: string | null;
}

export interface DesktopBurstSubmitter {
  submit: (input: DesktopBurstSubmitInput) => Promise<DesktopBurstSubmitResult>;
}

export type DesktopBurstProgressEvent =
  | {
      burstId: string;
      timestamp: string;
      total: number;
      type: 'burst_started';
    }
  | {
      burstId: string;
      completed: number;
      deferred: number;
      failed: number;
      timestamp: string;
      total: number;
      type: 'burst_completed';
    }
  | {
      burstId: string;
      hostname: string;
      jobLeadId: string;
      queueItemId: string;
      timestamp: string;
      type: 'item_claimed' | 'item_started';
    }
  | {
      burstId: string;
      confirmationState: typeof EMAIL_CONFIRMED_STATE;
      hostname: string;
      jobLeadId: string;
      queueItemId: string;
      submissionId?: string | null;
      timestamp: string;
      type: 'item_confirmed';
    }
  | {
      burstId: string;
      error: string;
      hostname?: string;
      jobLeadId?: string;
      queueItemId: string;
      timestamp: string;
      type: 'item_failed';
    }
  | {
      burstId: string;
      hostname: string;
      jobLeadId: string;
      queueItemId: string;
      reason: string;
      retryAt: string;
      timestamp: string;
      type: 'item_rate_limited';
    };

export interface DesktopBurstProgressPublisher {
  publish: (event: DesktopBurstProgressEvent) => Promise<void> | void;
}

export interface DesktopBurstRunnerInput {
  burstId?: string;
  concurrency?: number;
  maxItems?: number;
  now?: () => Date;
  progress?: DesktopBurstProgressPublisher;
  queue: DesktopBurstQueueStore;
  rateLimitConfig?: DesktopBurstRateLimitConfig;
  rateLimiter: DesktopBurstRateLimiter;
  submitter: DesktopBurstSubmitter;
}

export interface DesktopBurstItemOutcome {
  confirmationState?: DesktopBurstConfirmationState;
  error?: string;
  hostname?: string;
  jobLeadId?: string;
  queueItemId: string;
  retryAt?: Date;
  status: 'completed' | 'deferred' | 'failed';
  submissionId?: string | null;
}

export interface DesktopBurstRunResult {
  burstId: string;
  claimed: number;
  completed: number;
  completedAt: Date;
  deferred: number;
  failed: number;
  outcomes: readonly DesktopBurstItemOutcome[];
  startedAt: Date;
}

export interface WebSocketLike {
  readyState: number;
  send: (data: string) => void;
}

export interface PrismaDesktopBurstQueueClient {
  jobQueueItem: {
    findMany: (args: unknown) => Promise<DesktopBurstQueueItem[]>;
    update: (args: unknown) => Promise<unknown>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
  };
}

export const DEFAULT_DESKTOP_BURST_RATE_LIMIT: DesktopBurstRateLimitConfig = {
  capacity: 20,
  dayLimit: 50,
  refillRatePerSec: 1 / 300,
};

export async function runDesktopBurst(
  input: DesktopBurstRunnerInput,
): Promise<DesktopBurstRunResult> {
  const now = input.now ?? (() => new Date());
  const startedAt = now();
  const burstId = input.burstId ?? `desktop-burst-${startedAt.getTime()}`;
  const maxItems = positiveIntegerOrDefault(input.maxItems, DEFAULT_MAX_ITEMS);
  const concurrency = positiveIntegerOrDefault(
    input.concurrency,
    DEFAULT_CONCURRENCY,
  );
  const progress = input.progress ?? NOOP_PROGRESS;
  const rateLimitConfig =
    input.rateLimitConfig ?? DEFAULT_DESKTOP_BURST_RATE_LIMIT;
  const items = await input.queue.claimPending({
    limit: maxItems,
    now: startedAt,
    type: DESKTOP_BURST_QUEUE_TYPE,
  });

  await progress.publish({
    burstId,
    timestamp: startedAt.toISOString(),
    total: items.length,
    type: 'burst_started',
  });

  const outcomes = await mapWithConcurrency(items, concurrency, item =>
    runDesktopBurstItem({
      burstId,
      item,
      now,
      progress,
      queue: input.queue,
      rateLimitConfig,
      rateLimiter: input.rateLimiter,
      submitter: input.submitter,
    }),
  );
  const completedAt = now();
  const completed = outcomes.filter(
    outcome => outcome.status === 'completed',
  ).length;
  const deferred = outcomes.filter(
    outcome => outcome.status === 'deferred',
  ).length;
  const failed = outcomes.filter(outcome => outcome.status === 'failed').length;

  await progress.publish({
    burstId,
    completed,
    deferred,
    failed,
    timestamp: completedAt.toISOString(),
    total: items.length,
    type: 'burst_completed',
  });

  return {
    burstId,
    claimed: items.length,
    completed,
    completedAt,
    deferred,
    failed,
    outcomes,
    startedAt,
  };
}

export function createWebSocketBurstProgressPublisher(
  socket: WebSocketLike,
): DesktopBurstProgressPublisher {
  return {
    publish(event) {
      if (socket.readyState !== WEBSOCKET_OPEN_STATE) {
        return;
      }

      socket.send(JSON.stringify(event));
    },
  };
}

export function createPrismaDesktopBurstQueueStore(
  db: PrismaDesktopBurstQueueClient,
): DesktopBurstQueueStore {
  return {
    async claimPending(input) {
      const rows = await db.jobQueueItem.findMany({
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        take: input.limit,
        where: {
          processAfter: { lte: input.now },
          status: 'PENDING',
          type: input.type,
        },
      });
      const claimed: DesktopBurstQueueItem[] = [];

      for (const row of rows) {
        const result = await db.jobQueueItem.updateMany({
          data: {
            attempts: { increment: 1 },
            startedAt: input.now,
            status: 'PROCESSING',
          },
          where: { id: row.id, status: 'PENDING' },
        });

        if (result.count === 1) {
          claimed.push(row);
        }
      }

      return claimed;
    },
    async defer(input) {
      await db.jobQueueItem.update({
        data: {
          lastError: input.error,
          processAfter: input.processAfter,
          status: 'PENDING',
        },
        where: { id: input.queueItemId },
      });
    },
    async markCompleted(input) {
      await db.jobQueueItem.update({
        data: {
          completedAt: input.completedAt,
          lastError: null,
          status: 'COMPLETED',
        },
        where: { id: input.queueItemId },
      });
    },
    async markFailed(input) {
      await db.jobQueueItem.update({
        data: {
          completedAt: input.failedAt,
          lastError: input.error,
          status: 'FAILED',
        },
        where: { id: input.queueItemId },
      });
    },
  };
}

interface RunDesktopBurstItemInput {
  burstId: string;
  item: DesktopBurstQueueItem;
  now: () => Date;
  progress: DesktopBurstProgressPublisher;
  queue: DesktopBurstQueueStore;
  rateLimitConfig: DesktopBurstRateLimitConfig;
  rateLimiter: DesktopBurstRateLimiter;
  submitter: DesktopBurstSubmitter;
}

async function runDesktopBurstItem(
  input: RunDesktopBurstItemInput,
): Promise<DesktopBurstItemOutcome> {
  let payload: DesktopSubmitQueuePayload;
  let hostname: string;

  try {
    payload = parseDesktopSubmitQueuePayload(input.item.payload);
    hostname = hostnameFromUrl(payload.applicationUrl);
  } catch (error) {
    const message = errorMessage(error);
    await input.queue.markFailed({
      error: message,
      failedAt: input.now(),
      queueItemId: input.item.id,
    });
    await input.progress.publish({
      burstId: input.burstId,
      error: message,
      queueItemId: input.item.id,
      timestamp: input.now().toISOString(),
      type: 'item_failed',
    });
    return {
      error: message,
      queueItemId: input.item.id,
      status: 'failed',
    };
  }

  await input.progress.publish({
    burstId: input.burstId,
    hostname,
    jobLeadId: payload.jobLeadId,
    queueItemId: input.item.id,
    timestamp: input.now().toISOString(),
    type: 'item_claimed',
  });

  const rate = await input.rateLimiter.acquire({
    actionType: DESKTOP_BURST_ACTION_TYPE,
    config: input.rateLimitConfig,
    cost: 1,
    hostname,
    now: input.now(),
  });

  if (!rate.ok) {
    const retryAt = new Date(
      input.now().getTime() + retryDelayMs(rate.retryAfterMs),
    );
    const reason = rate.reason ?? 'RATE_LIMITED';
    await input.queue.defer({
      error: reason,
      processAfter: retryAt,
      queueItemId: input.item.id,
    });
    await input.progress.publish({
      burstId: input.burstId,
      hostname,
      jobLeadId: payload.jobLeadId,
      queueItemId: input.item.id,
      reason,
      retryAt: retryAt.toISOString(),
      timestamp: input.now().toISOString(),
      type: 'item_rate_limited',
    });
    return {
      error: reason,
      hostname,
      jobLeadId: payload.jobLeadId,
      queueItemId: input.item.id,
      retryAt,
      status: 'deferred',
    };
  }

  await input.progress.publish({
    burstId: input.burstId,
    hostname,
    jobLeadId: payload.jobLeadId,
    queueItemId: input.item.id,
    timestamp: input.now().toISOString(),
    type: 'item_started',
  });

  try {
    const result = await input.submitter.submit({
      burstId: input.burstId,
      hostname,
      payload,
      queueItem: input.item,
    });

    if (result.confirmationState !== EMAIL_CONFIRMED_STATE) {
      throw new Error(
        `Submission did not reach ${EMAIL_CONFIRMED_STATE}: ${result.confirmationState}`,
      );
    }

    await input.queue.markCompleted({
      completedAt: input.now(),
      confirmationState: EMAIL_CONFIRMED_STATE,
      queueItemId: input.item.id,
      submissionId: result.submissionId,
    });
    await input.progress.publish({
      burstId: input.burstId,
      confirmationState: EMAIL_CONFIRMED_STATE,
      hostname,
      jobLeadId: payload.jobLeadId,
      queueItemId: input.item.id,
      submissionId: result.submissionId,
      timestamp: input.now().toISOString(),
      type: 'item_confirmed',
    });

    return {
      confirmationState: result.confirmationState,
      hostname,
      jobLeadId: payload.jobLeadId,
      queueItemId: input.item.id,
      status: 'completed',
      submissionId: result.submissionId,
    };
  } catch (error) {
    const message = errorMessage(error);
    await input.queue.markFailed({
      error: message,
      failedAt: input.now(),
      queueItemId: input.item.id,
    });
    await input.progress.publish({
      burstId: input.burstId,
      error: message,
      hostname,
      jobLeadId: payload.jobLeadId,
      queueItemId: input.item.id,
      timestamp: input.now().toISOString(),
      type: 'item_failed',
    });
    return {
      error: message,
      hostname,
      jobLeadId: payload.jobLeadId,
      queueItemId: input.item.id,
      status: 'failed',
    };
  }
}

function parseDesktopSubmitQueuePayload(
  payload: unknown,
): DesktopSubmitQueuePayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Desktop submit queue payload must be an object.');
  }

  const record = payload as Record<string, unknown>;
  const applicationUrl = requiredString(record.applicationUrl, 'applicationUrl');
  const jobLeadId = requiredString(record.jobLeadId, 'jobLeadId');

  return {
    applicationUrl,
    company: optionalString(record.company),
    effectiveMode: optionalString(record.effectiveMode),
    guidedApplicationId: optionalString(record.guidedApplicationId),
    jobLeadId,
    jobTitle: optionalString(record.jobTitle),
    requestedMode: optionalString(record.requestedMode),
    resumeId: optionalString(record.resumeId),
    trustLevel: optionalString(record.trustLevel),
  };
}

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    throw new Error(`Invalid desktop submit applicationUrl: ${url}`);
  }
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Desktop submit payload requires ${field}.`);
  }

  return value;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function retryDelayMs(retryAfterMs: number | undefined): number {
  if (
    retryAfterMs !== undefined &&
    Number.isFinite(retryAfterMs) &&
    retryAfterMs > 0
  ) {
    return retryAfterMs;
  }

  return DEFAULT_RATE_LIMIT_RETRY_MS;
}

function positiveIntegerOrDefault(
  value: number | undefined,
  defaultValue: number,
): number {
  if (Number.isInteger(value) && value !== undefined && value > 0) {
    return value;
  }

  return defaultValue;
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(
    Array.from({ length: workerCount }).map(() => worker()),
  );
  return results;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Desktop burst item failed.';
}

const NOOP_PROGRESS: DesktopBurstProgressPublisher = {
  publish() {
    return undefined;
  },
};
