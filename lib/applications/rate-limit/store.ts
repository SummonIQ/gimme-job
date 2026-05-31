import 'server-only';

import { db } from '@/lib/db/client';

import { nextUtcDayResetAt, tryAcquire } from './bucket';
import type {
  AcquireInput,
  AcquireResult,
  BucketConfig,
  BucketState,
} from './types';

const DEFAULT_COST = 1;

export async function acquireHostToken(
  input: AcquireInput,
): Promise<AcquireResult> {
  const now = input.now ?? new Date();
  const cost = input.cost ?? DEFAULT_COST;

  return db.$transaction(async tx => {
    const row = await tx.hostRateLimitState.findUnique({
      where: {
        hostname_actionType: {
          actionType: input.actionType,
          hostname: input.hostname,
        },
      },
    });

    const config = resolveConfig(row, input.config);
    if (!config) {
      throw new Error(
        `No BucketConfig for (${input.hostname}, ${input.actionType}); pass config on first acquire`,
      );
    }

    const state: BucketState = row
      ? {
          capacity: row.capacity,
          dayCount: row.dayCount,
          dayLimit: row.dayLimit,
          dayResetAt: row.dayResetAt,
          lastRefilledAt: row.lastRefilledAt,
          refillRatePerSec: row.refillRatePerSec,
          tokens: row.tokens,
        }
      : {
          capacity: config.capacity,
          dayCount: 0,
          dayLimit: config.dayLimit ?? null,
          dayResetAt: nextUtcDayResetAt(now),
          lastRefilledAt: now,
          refillRatePerSec: config.refillRatePerSec,
          tokens: config.capacity,
        };

    const result = tryAcquire(state, cost, now);

    await tx.hostRateLimitState.upsert({
      create: {
        actionType: input.actionType,
        capacity: result.state.capacity,
        dayCount: result.state.dayCount,
        dayLimit: result.state.dayLimit ?? null,
        dayResetAt: result.state.dayResetAt,
        hostname: input.hostname,
        lastRefilledAt: result.state.lastRefilledAt,
        refillRatePerSec: result.state.refillRatePerSec,
        tokens: result.state.tokens,
      },
      update: {
        capacity: result.state.capacity,
        dayCount: result.state.dayCount,
        dayLimit: result.state.dayLimit ?? null,
        dayResetAt: result.state.dayResetAt,
        lastRefilledAt: result.state.lastRefilledAt,
        refillRatePerSec: result.state.refillRatePerSec,
        tokens: result.state.tokens,
      },
      where: {
        hostname_actionType: {
          actionType: input.actionType,
          hostname: input.hostname,
        },
      },
    });

    return result;
  });
}

export async function getHostRateLimitState(
  hostname: string,
  actionType: string,
): Promise<BucketState | null> {
  const row = await db.hostRateLimitState.findUnique({
    where: { hostname_actionType: { actionType, hostname } },
  });
  if (!row) return null;
  return {
    capacity: row.capacity,
    dayCount: row.dayCount,
    dayLimit: row.dayLimit,
    dayResetAt: row.dayResetAt,
    lastRefilledAt: row.lastRefilledAt,
    refillRatePerSec: row.refillRatePerSec,
    tokens: row.tokens,
  };
}

export async function resetHostRateLimitState(
  hostname: string,
  actionType: string,
): Promise<void> {
  await db.hostRateLimitState.deleteMany({
    where: { actionType, hostname },
  });
}

function resolveConfig(
  row:
    | { capacity: number; dayLimit: number | null; refillRatePerSec: number }
    | null,
  override?: BucketConfig,
): BucketConfig | null {
  if (override) {
    return {
      capacity: override.capacity,
      dayLimit: override.dayLimit ?? null,
      refillRatePerSec: override.refillRatePerSec,
    };
  }
  if (!row) return null;
  return {
    capacity: row.capacity,
    dayLimit: row.dayLimit,
    refillRatePerSec: row.refillRatePerSec,
  };
}
