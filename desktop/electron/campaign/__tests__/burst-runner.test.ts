import { describe, expect, it, vi } from 'vitest';

import {
  DESKTOP_BURST_QUEUE_TYPE,
  EMAIL_CONFIRMED_STATE,
  createWebSocketBurstProgressPublisher,
  runDesktopBurst,
  type DesktopBurstProgressEvent,
  type DesktopBurstQueueItem,
  type DesktopBurstQueueStore,
} from '../burst-runner.js';

interface StoredQueueItem extends DesktopBurstQueueItem {
  completedAt?: Date;
  lastError?: string;
  processAfter?: Date;
  status: 'COMPLETED' | 'FAILED' | 'PENDING' | 'PROCESSING';
}

function makeQueueItem(index: number): StoredQueueItem {
  return {
    attempts: 0,
    id: `queue-${index}`,
    maxRetries: 3,
    payload: {
      applicationUrl: `https://job-boards.greenhouse.io/company/jobs/${index}`,
      company: 'Fixture Co',
      jobLeadId: `lead-${index}`,
      jobTitle: `Engineer ${index}`,
    },
    status: 'PENDING',
    userId: 'user-1',
  };
}

function createMemoryQueue(
  items: StoredQueueItem[],
): DesktopBurstQueueStore {
  return {
    async claimPending(input) {
      expect(input.type).toBe(DESKTOP_BURST_QUEUE_TYPE);
      const claimed = items
        .filter(
          item =>
            item.status === 'PENDING' &&
            (!item.processAfter || item.processAfter <= input.now),
        )
        .slice(0, input.limit);

      for (const item of claimed) {
        item.status = 'PROCESSING';
        item.attempts += 1;
      }

      return claimed;
    },
    async defer(input) {
      const item = findItem(items, input.queueItemId);
      item.status = 'PENDING';
      item.lastError = input.error;
      item.processAfter = input.processAfter;
    },
    async markCompleted(input) {
      const item = findItem(items, input.queueItemId);
      item.status = 'COMPLETED';
      item.completedAt = input.completedAt;
      item.lastError = undefined;
    },
    async markFailed(input) {
      const item = findItem(items, input.queueItemId);
      item.status = 'FAILED';
      item.completedAt = input.failedAt;
      item.lastError = input.error;
    },
  };
}

function findItem(
  items: readonly StoredQueueItem[],
  id: string,
): StoredQueueItem {
  const item = items.find(candidate => candidate.id === id);
  if (!item) throw new Error(`Missing queue item: ${id}`);
  return item;
}

describe('runDesktopBurst', () => {
  it('dispatches 20 fixture submissions to EMAIL_CONFIRMED and publishes live progress', async () => {
    const items = Array.from({ length: 20 }).map((_, index) =>
      makeQueueItem(index),
    );
    const events: DesktopBurstProgressEvent[] = [];
    const rateLimiter = {
      acquire: vi.fn().mockResolvedValue({
        ok: true,
        tokensRemaining: 19,
      }),
    };
    const submitter = {
      submit: vi.fn(async ({ queueItem }: { queueItem: DesktopBurstQueueItem }) => ({
        confirmationState: EMAIL_CONFIRMED_STATE,
        submissionId: `submission-${queueItem.id}`,
      })),
    };

    const result = await runDesktopBurst({
      burstId: 'burst-fixture',
      concurrency: 5,
      maxItems: 20,
      now: () => new Date('2026-04-23T12:00:00.000Z'),
      progress: { publish: event => events.push(event) },
      queue: createMemoryQueue(items),
      rateLimiter,
      submitter,
    });

    expect(result).toMatchObject({
      burstId: 'burst-fixture',
      claimed: 20,
      completed: 20,
      deferred: 0,
      failed: 0,
    });
    expect(items.every(item => item.status === 'COMPLETED')).toBe(true);
    expect(rateLimiter.acquire).toHaveBeenCalledTimes(20);
    expect(submitter.submit).toHaveBeenCalledTimes(20);
    expect(events.filter(event => event.type === 'item_confirmed')).toHaveLength(
      20,
    );
    expect(events.at(-1)).toMatchObject({
      completed: 20,
      total: 20,
      type: 'burst_completed',
    });
  });

  it('defers a queue item when the host token bucket denies dispatch', async () => {
    const items = [makeQueueItem(1)];
    const events: DesktopBurstProgressEvent[] = [];
    const submitter = {
      submit: vi.fn(),
    };

    const result = await runDesktopBurst({
      burstId: 'burst-rate-limited',
      maxItems: 1,
      now: () => new Date('2026-04-23T12:00:00.000Z'),
      progress: { publish: event => events.push(event) },
      queue: createMemoryQueue(items),
      rateLimiter: {
        acquire: vi.fn().mockResolvedValue({
          ok: false,
          reason: 'INSUFFICIENT_TOKENS',
          retryAfterMs: 5_000,
          tokensRemaining: 0,
        }),
      },
      submitter,
    });

    expect(result.deferred).toBe(1);
    expect(result.completed).toBe(0);
    expect(submitter.submit).not.toHaveBeenCalled();
    expect(items[0].status).toBe('PENDING');
    expect(items[0].processAfter?.toISOString()).toBe(
      '2026-04-23T12:00:05.000Z',
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        reason: 'INSUFFICIENT_TOKENS',
        type: 'item_rate_limited',
      }),
    );
  });

  it('fails malformed queue payloads before acquiring a rate token', async () => {
    const items = [
      {
        ...makeQueueItem(1),
        payload: { applicationUrl: '', jobLeadId: 'lead-1' },
      },
    ];
    const rateLimiter = { acquire: vi.fn() };

    const result = await runDesktopBurst({
      burstId: 'burst-malformed',
      queue: createMemoryQueue(items),
      rateLimiter,
      submitter: { submit: vi.fn() },
    });

    expect(result.failed).toBe(1);
    expect(rateLimiter.acquire).not.toHaveBeenCalled();
    expect(items[0].status).toBe('FAILED');
    expect(items[0].lastError).toContain('applicationUrl');
  });
});

describe('createWebSocketBurstProgressPublisher', () => {
  it('serializes progress events onto an open WebSocket', () => {
    const socket = {
      readyState: 1,
      send: vi.fn(),
    };
    const publisher = createWebSocketBurstProgressPublisher(socket);

    publisher.publish({
      burstId: 'burst-fixture',
      timestamp: '2026-04-23T12:00:00.000Z',
      total: 20,
      type: 'burst_started',
    });

    expect(socket.send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(socket.send.mock.calls[0][0])).toEqual({
      burstId: 'burst-fixture',
      timestamp: '2026-04-23T12:00:00.000Z',
      total: 20,
      type: 'burst_started',
    });
  });
});
