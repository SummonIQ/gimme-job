// @vitest-environment node
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const HAS_DB = Boolean(process.env.DATABASE_URL);

const TEST_HOST = 'rate-limit-test.example';
const TEST_ACTION = 'submit';

interface Store {
  acquireHostToken: typeof import('../store').acquireHostToken;
  getHostRateLimitState: typeof import('../store').getHostRateLimitState;
  resetHostRateLimitState: typeof import('../store').resetHostRateLimitState;
}

let store: Store;

describe.skipIf(!HAS_DB)('rate-limit store (integration)', () => {
  beforeAll(async () => {
    store = await import('../store');
    await store.resetHostRateLimitState(TEST_HOST, TEST_ACTION);
  });

  afterEach(async () => {
    await store.resetHostRateLimitState(TEST_HOST, TEST_ACTION);
  });

  it('persists bucket state across acquire calls', async () => {
    const now = new Date('2026-04-22T12:00:00Z');
    const config = { capacity: 5, refillRatePerSec: 0, dayLimit: null };

    const first = await store.acquireHostToken({
      actionType: TEST_ACTION,
      config,
      cost: 2,
      hostname: TEST_HOST,
      now,
    });
    expect(first.ok).toBe(true);
    expect(first.tokensRemaining).toBeCloseTo(3, 6);

    const second = await store.acquireHostToken({
      actionType: TEST_ACTION,
      config,
      cost: 2,
      hostname: TEST_HOST,
      now,
    });
    expect(second.ok).toBe(true);
    expect(second.tokensRemaining).toBeCloseTo(1, 6);
  });

  it('survives a simulated restart (state read back by second process)', async () => {
    const now = new Date('2026-04-22T12:00:00Z');
    const config = { capacity: 10, refillRatePerSec: 0, dayLimit: null };

    const before = await store.acquireHostToken({
      actionType: TEST_ACTION,
      config,
      cost: 3,
      hostname: TEST_HOST,
      now,
    });
    expect(before.ok).toBe(true);
    expect(before.tokensRemaining).toBeCloseTo(7, 6);

    const recovered = await store.getHostRateLimitState(
      TEST_HOST,
      TEST_ACTION,
    );
    expect(recovered).not.toBeNull();
    expect(recovered?.tokens).toBeCloseTo(7, 6);

    const after = await store.acquireHostToken({
      actionType: TEST_ACTION,
      cost: 5,
      hostname: TEST_HOST,
      now,
    });
    expect(after.ok).toBe(true);
    expect(after.tokensRemaining).toBeCloseTo(2, 6);
  });

  it('enforces per-day limit across calls', async () => {
    const now = new Date('2026-04-22T12:00:00Z');
    const config = { capacity: 100, refillRatePerSec: 10, dayLimit: 2 };

    const a = await store.acquireHostToken({
      actionType: TEST_ACTION,
      config,
      hostname: TEST_HOST,
      now,
    });
    const b = await store.acquireHostToken({
      actionType: TEST_ACTION,
      config,
      hostname: TEST_HOST,
      now,
    });
    const c = await store.acquireHostToken({
      actionType: TEST_ACTION,
      config,
      hostname: TEST_HOST,
      now,
    });

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(c.ok).toBe(false);
    expect(c.reason).toBe('DAY_LIMIT_REACHED');
  });
});
