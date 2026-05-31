import { describe, expect, it } from 'vitest';

import {
  nextUtcDayResetAt,
  refillTokens,
  rolloverDayCounterIfNeeded,
  tryAcquire,
} from '../bucket';
import type { BucketState } from '../types';

function makeState(overrides: Partial<BucketState> = {}): BucketState {
  const lastRefilledAt = new Date('2026-04-22T12:00:00Z');
  return {
    capacity: 10,
    dayCount: 0,
    dayLimit: null,
    dayResetAt: new Date('2026-04-23T00:00:00Z'),
    lastRefilledAt,
    refillRatePerSec: 1,
    tokens: 10,
    ...overrides,
  };
}

describe('nextUtcDayResetAt', () => {
  it('returns the following UTC midnight', () => {
    const now = new Date('2026-04-22T23:45:00Z');
    const reset = nextUtcDayResetAt(now);
    expect(reset.toISOString()).toBe('2026-04-23T00:00:00.000Z');
  });

  it('works across month boundaries', () => {
    const now = new Date('2026-04-30T15:00:00Z');
    const reset = nextUtcDayResetAt(now);
    expect(reset.toISOString()).toBe('2026-05-01T00:00:00.000Z');
  });

  it('works across year boundaries', () => {
    const now = new Date('2026-12-31T22:00:00Z');
    const reset = nextUtcDayResetAt(now);
    expect(reset.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});

describe('refillTokens', () => {
  it('adds tokens proportional to elapsed time', () => {
    const state = makeState({ tokens: 5 });
    const now = new Date(state.lastRefilledAt.getTime() + 3_000);
    const refilled = refillTokens(state, now);
    expect(refilled.tokens).toBeCloseTo(8, 6);
    expect(refilled.lastRefilledAt).toEqual(now);
  });

  it('caps tokens at capacity', () => {
    const state = makeState({ capacity: 10, tokens: 8 });
    const now = new Date(state.lastRefilledAt.getTime() + 60_000);
    const refilled = refillTokens(state, now);
    expect(refilled.tokens).toBe(10);
  });

  it('no-op when now equals lastRefilledAt', () => {
    const state = makeState({ tokens: 4 });
    const refilled = refillTokens(state, state.lastRefilledAt);
    expect(refilled).toBe(state);
  });

  it('no-op when clock skews backward', () => {
    const state = makeState({ tokens: 4 });
    const now = new Date(state.lastRefilledAt.getTime() - 1_000);
    const refilled = refillTokens(state, now);
    expect(refilled).toBe(state);
  });
});

describe('rolloverDayCounterIfNeeded', () => {
  it('resets dayCount and advances dayResetAt once the boundary passes', () => {
    const state = makeState({
      dayCount: 42,
      dayResetAt: new Date('2026-04-22T00:00:00Z'),
    });
    const now = new Date('2026-04-22T00:00:01Z');
    const rolled = rolloverDayCounterIfNeeded(state, now);
    expect(rolled.dayCount).toBe(0);
    expect(rolled.dayResetAt.toISOString()).toBe('2026-04-23T00:00:00.000Z');
  });

  it('leaves state untouched before the boundary', () => {
    const state = makeState({
      dayCount: 5,
      dayResetAt: new Date('2026-04-23T00:00:00Z'),
    });
    const now = new Date('2026-04-22T23:00:00Z');
    const rolled = rolloverDayCounterIfNeeded(state, now);
    expect(rolled).toBe(state);
  });
});

describe('tryAcquire', () => {
  it('deducts tokens and returns ok when sufficient', () => {
    const state = makeState({ tokens: 5 });
    const now = new Date(state.lastRefilledAt.getTime() + 1_000);
    const result = tryAcquire(state, 2, now);
    expect(result.ok).toBe(true);
    expect(result.tokensRemaining).toBeCloseTo(4, 6);
    expect(result.state.tokens).toBeCloseTo(4, 6);
  });

  it('denies with retryAfterMs when tokens are insufficient', () => {
    const state = makeState({ tokens: 0, refillRatePerSec: 2 });
    const now = new Date(state.lastRefilledAt.getTime());
    const result = tryAcquire(state, 4, now);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('INSUFFICIENT_TOKENS');
    expect(result.retryAfterMs).toBe(2000);
  });

  it('denies when day limit would be exceeded', () => {
    const state = makeState({
      dayCount: 99,
      dayLimit: 100,
      tokens: 50,
    });
    const now = new Date(state.lastRefilledAt.getTime());
    const result = tryAcquire(state, 2, now);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('DAY_LIMIT_REACHED');
    expect(result.dayRemaining).toBe(1);
  });

  it('increments dayCount on success', () => {
    const state = makeState({ dayCount: 3, dayLimit: 10 });
    const now = new Date(state.lastRefilledAt.getTime());
    const result = tryAcquire(state, 2, now);
    expect(result.ok).toBe(true);
    expect(result.state.dayCount).toBe(5);
    expect(result.dayRemaining).toBe(5);
  });

  it('resets dayCount when the boundary passes', () => {
    const state = makeState({
      dayCount: 50,
      dayLimit: 50,
      dayResetAt: new Date('2026-04-22T00:00:00Z'),
      lastRefilledAt: new Date('2026-04-22T00:00:00Z'),
      tokens: 10,
    });
    const now = new Date('2026-04-22T00:00:05Z');
    const result = tryAcquire(state, 1, now);
    expect(result.ok).toBe(true);
    expect(result.state.dayCount).toBe(1);
  });

  it('returns Infinity retryAfterMs when refill rate is zero', () => {
    const state = makeState({ refillRatePerSec: 0, tokens: 0 });
    const now = new Date(state.lastRefilledAt.getTime());
    const result = tryAcquire(state, 1, now);
    expect(result.ok).toBe(false);
    expect(result.retryAfterMs).toBe(Number.POSITIVE_INFINITY);
  });

  it('throws on non-positive cost', () => {
    const state = makeState();
    const now = new Date(state.lastRefilledAt.getTime());
    expect(() => tryAcquire(state, 0, now)).toThrow();
    expect(() => tryAcquire(state, -1, now)).toThrow();
  });

  it('null dayLimit means unlimited', () => {
    const state = makeState({ dayCount: 999_999, dayLimit: null, tokens: 5 });
    const now = new Date(state.lastRefilledAt.getTime());
    const result = tryAcquire(state, 1, now);
    expect(result.ok).toBe(true);
    expect(result.dayRemaining).toBeNull();
  });
});
