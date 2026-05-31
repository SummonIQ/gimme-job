import {
  ApplicationConfirmationState,
  SubmissionTier,
} from '@/generated/prisma/client';
import { describe, expect, it } from 'vitest';

import {
  FIRE_AND_FORGET_SUCCESS_THRESHOLD,
  GENERIC_TIER_SUCCESS_THRESHOLD,
  SCALE_WINDOW_DAYS,
  evaluateScalePolicy,
  signalsInWindow,
  type ScaleSignal,
} from '../scale-policy';

const NOW = new Date('2026-04-22T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function sig(
  tier: SubmissionTier,
  state: ApplicationConfirmationState,
  daysAgo: number,
): ScaleSignal {
  return {
    at: new Date(NOW.getTime() - daysAgo * DAY),
    confirmationState: state,
    tier,
  };
}

function manyConfirmed(
  tier: SubmissionTier,
  count: number,
  state: ApplicationConfirmationState = ApplicationConfirmationState.EMAIL_CONFIRMED,
  startDaysAgo = 10,
): ScaleSignal[] {
  return Array.from({ length: count }).map((_, i) =>
    sig(tier, state, startDaysAgo + i * 0.1),
  );
}

describe('constants', () => {
  it('GENERIC threshold is 10', () => {
    expect(GENERIC_TIER_SUCCESS_THRESHOLD).toBe(10);
  });
  it('FIRE_AND_FORGET threshold is 50', () => {
    expect(FIRE_AND_FORGET_SUCCESS_THRESHOLD).toBe(50);
  });
  it('window is 14 days', () => {
    expect(SCALE_WINDOW_DAYS).toBe(14);
  });
});

describe('signalsInWindow', () => {
  it('excludes signals outside the trailing window', () => {
    const signals: ScaleSignal[] = [
      sig(SubmissionTier.TARGETED, 'EMAIL_CONFIRMED', 3),
      sig(SubmissionTier.TARGETED, 'EMAIL_CONFIRMED', 13),
      sig(SubmissionTier.TARGETED, 'EMAIL_CONFIRMED', 20),
    ];
    const kept = signalsInWindow(signals, NOW, 14);
    expect(kept).toHaveLength(2);
  });
});

describe('evaluateScalePolicy - TARGETED boundary', () => {
  it('a fresh hostname with zero signals stays at TARGETED', () => {
    const result = evaluateScalePolicy([], { now: NOW });
    expect(result.eligibleTier).toBe(SubmissionTier.TARGETED);
    expect(result.counts.targetedSuccesses).toBe(0);
  });

  it('9 targeted successes is not enough for GENERIC', () => {
    const signals = manyConfirmed(SubmissionTier.TARGETED, 9);
    const result = evaluateScalePolicy(signals, { now: NOW });
    expect(result.eligibleTier).toBe(SubmissionTier.TARGETED);
  });

  it('10 targeted successes promotes to GENERIC (acceptance)', () => {
    const signals = manyConfirmed(SubmissionTier.TARGETED, 10);
    const result = evaluateScalePolicy(signals, { now: NOW });
    expect(result.eligibleTier).toBe(SubmissionTier.GENERIC);
    expect(result.counts.targetedSuccesses).toBe(10);
  });

  it('targeted successes outside the 14-day window do NOT count', () => {
    const inside = manyConfirmed(SubmissionTier.TARGETED, 5);
    const outside = Array.from({ length: 10 }).map((_, i) =>
      sig(SubmissionTier.TARGETED, 'EMAIL_CONFIRMED', 16 + i * 0.1),
    );
    const result = evaluateScalePolicy(
      [...inside, ...outside],
      { now: NOW },
    );
    expect(result.eligibleTier).toBe(SubmissionTier.TARGETED);
  });

  it('only SUCCESS confirmation states count as successes', () => {
    const pendings = Array.from({ length: 10 }).map((_, i) =>
      sig(SubmissionTier.TARGETED, 'PENDING', 2 + i * 0.1),
    );
    const result = evaluateScalePolicy(pendings, { now: NOW });
    expect(result.eligibleTier).toBe(SubmissionTier.TARGETED);
    expect(result.counts.targetedSuccesses).toBe(0);
  });

  it('ATS_CONFIRMED and DASHBOARD_CONFIRMED also count as successes', () => {
    const signals = [
      ...Array.from({ length: 5 }).map((_, i) =>
        sig(SubmissionTier.TARGETED, 'ATS_CONFIRMED', 2 + i * 0.1),
      ),
      ...Array.from({ length: 5 }).map((_, i) =>
        sig(SubmissionTier.TARGETED, 'DASHBOARD_CONFIRMED', 4 + i * 0.1),
      ),
    ];
    const result = evaluateScalePolicy(signals, { now: NOW });
    expect(result.eligibleTier).toBe(SubmissionTier.GENERIC);
  });
});

describe('evaluateScalePolicy - FIRE_AND_FORGET boundary', () => {
  it('49 total successes with zero failures stays at GENERIC', () => {
    const signals = [
      ...manyConfirmed(SubmissionTier.TARGETED, 10),
      ...manyConfirmed(SubmissionTier.GENERIC, 39, 'EMAIL_CONFIRMED', 3),
    ];
    const result = evaluateScalePolicy(signals, { now: NOW });
    expect(result.eligibleTier).toBe(SubmissionTier.GENERIC);
    expect(result.counts.totalSuccesses).toBe(49);
  });

  it('50 total successes + 0 failures promotes to FIRE_AND_FORGET', () => {
    const signals = [
      ...manyConfirmed(SubmissionTier.TARGETED, 10),
      ...manyConfirmed(SubmissionTier.GENERIC, 40, 'EMAIL_CONFIRMED', 3),
    ];
    const result = evaluateScalePolicy(signals, { now: NOW });
    expect(result.eligibleTier).toBe(SubmissionTier.FIRE_AND_FORGET);
    expect(result.counts.totalSuccesses).toBe(50);
  });

  it('50 total successes with any failure demotes to GENERIC', () => {
    const signals = [
      ...manyConfirmed(SubmissionTier.TARGETED, 10),
      ...manyConfirmed(SubmissionTier.GENERIC, 40, 'EMAIL_CONFIRMED', 3),
      sig(SubmissionTier.GENERIC, 'VERIFIED_FAILED', 1),
    ];
    const result = evaluateScalePolicy(signals, { now: NOW });
    expect(result.eligibleTier).toBe(SubmissionTier.GENERIC);
    expect(result.counts.failures).toBe(1);
  });

  it('a PRESUMED_FAILED in the window also counts as a failure', () => {
    const signals = [
      ...manyConfirmed(SubmissionTier.TARGETED, 10),
      ...manyConfirmed(SubmissionTier.GENERIC, 40, 'EMAIL_CONFIRMED', 3),
      sig(SubmissionTier.GENERIC, 'PRESUMED_FAILED', 2),
    ];
    const result = evaluateScalePolicy(signals, { now: NOW });
    expect(result.eligibleTier).toBe(SubmissionTier.GENERIC);
  });

  it('a failure outside the window does not block FIRE_AND_FORGET', () => {
    const signals = [
      ...manyConfirmed(SubmissionTier.TARGETED, 10),
      ...manyConfirmed(SubmissionTier.GENERIC, 40, 'EMAIL_CONFIRMED', 3),
      sig(SubmissionTier.GENERIC, 'VERIFIED_FAILED', 20),
    ];
    const result = evaluateScalePolicy(signals, { now: NOW });
    expect(result.eligibleTier).toBe(SubmissionTier.FIRE_AND_FORGET);
  });
});

describe('evaluateScalePolicy - returned metadata', () => {
  it('reports counts and windowStart', () => {
    const signals = manyConfirmed(SubmissionTier.TARGETED, 12);
    const result = evaluateScalePolicy(signals, { now: NOW });
    expect(result.counts.targetedSuccesses).toBe(12);
    expect(result.counts.totalSuccesses).toBe(12);
    expect(result.counts.failures).toBe(0);
    expect(NOW.getTime() - result.windowStart.getTime()).toBe(14 * DAY);
  });

  it('custom windowDays shrinks the trailing window', () => {
    // 10 successes at day -5: should be inside a 14-day window, outside
    // a 3-day window.
    const signals = Array.from({ length: 10 }).map((_, i) =>
      sig(SubmissionTier.TARGETED, 'EMAIL_CONFIRMED', 5 + i * 0.01),
    );
    const withDefault = evaluateScalePolicy(signals, { now: NOW });
    expect(withDefault.eligibleTier).toBe(SubmissionTier.GENERIC);

    const withShort = evaluateScalePolicy(signals, {
      now: NOW,
      windowDays: 3,
    });
    expect(withShort.eligibleTier).toBe(SubmissionTier.TARGETED);
  });
});
