import type { AcquireResult, BucketState } from './types';

export function nextUtcDayResetAt(now: Date): Date {
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
      0,
    ),
  );
  return next;
}

export function refillTokens(state: BucketState, now: Date): BucketState {
  const elapsedMs = now.getTime() - state.lastRefilledAt.getTime();
  if (elapsedMs <= 0) {
    return state;
  }
  const gained = (elapsedMs / 1000) * state.refillRatePerSec;
  return {
    ...state,
    lastRefilledAt: now,
    tokens: Math.min(state.capacity, state.tokens + gained),
  };
}

export function rolloverDayCounterIfNeeded(
  state: BucketState,
  now: Date,
): BucketState {
  if (now < state.dayResetAt) {
    return state;
  }
  return {
    ...state,
    dayCount: 0,
    dayResetAt: nextUtcDayResetAt(now),
  };
}

export function tryAcquire(
  state: BucketState,
  cost: number,
  now: Date,
): AcquireResult {
  if (cost <= 0) {
    throw new Error('cost must be > 0');
  }

  const refilled = refillTokens(state, now);
  const rolled = rolloverDayCounterIfNeeded(refilled, now);

  const dayRemaining =
    typeof rolled.dayLimit === 'number'
      ? Math.max(0, rolled.dayLimit - rolled.dayCount)
      : null;

  if (typeof rolled.dayLimit === 'number' && rolled.dayCount + cost > rolled.dayLimit) {
    return {
      dayRemaining,
      ok: false,
      reason: 'DAY_LIMIT_REACHED',
      retryAfterMs: rolled.dayResetAt.getTime() - now.getTime(),
      state: rolled,
      tokensRemaining: rolled.tokens,
    };
  }

  if (rolled.tokens < cost) {
    const shortfall = cost - rolled.tokens;
    const retryAfterMs =
      rolled.refillRatePerSec > 0
        ? Math.ceil((shortfall / rolled.refillRatePerSec) * 1000)
        : Number.POSITIVE_INFINITY;
    return {
      dayRemaining,
      ok: false,
      reason: 'INSUFFICIENT_TOKENS',
      retryAfterMs,
      state: rolled,
      tokensRemaining: rolled.tokens,
    };
  }

  const nextState: BucketState = {
    ...rolled,
    dayCount: rolled.dayCount + cost,
    tokens: rolled.tokens - cost,
  };

  return {
    dayRemaining: nextState.dayLimit !== null && nextState.dayLimit !== undefined
      ? Math.max(0, nextState.dayLimit - nextState.dayCount)
      : null,
    ok: true,
    state: nextState,
    tokensRemaining: nextState.tokens,
  };
}
