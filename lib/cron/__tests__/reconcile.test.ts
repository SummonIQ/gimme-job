import { ApplicationConfirmationState } from '@/generated/prisma/client';
import { describe, expect, it } from 'vitest';
import {
  PENDING_TIMEOUT_HOURS,
  pendingTimeoutCutoff,
  shouldAutoFailPending,
} from '../reconcile';

const NOW = new Date('2026-04-22T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;

describe('pendingTimeoutCutoff', () => {
  it(`returns now minus ${PENDING_TIMEOUT_HOURS} hours`, () => {
    const cutoff = pendingTimeoutCutoff(NOW);
    expect(NOW.getTime() - cutoff.getTime()).toBe(PENDING_TIMEOUT_HOURS * HOUR);
  });

  it('is a pure function (same input -> same output, different Date instance)', () => {
    const a = pendingTimeoutCutoff(NOW);
    const b = pendingTimeoutCutoff(NOW);
    expect(a.getTime()).toBe(b.getTime());
    expect(a).not.toBe(b);
  });
});

describe('shouldAutoFailPending', () => {
  it('returns false for a submission that is not PENDING', () => {
    const oldSubmitted = new Date(NOW.getTime() - 100 * HOUR);
    for (const state of [
      ApplicationConfirmationState.ATS_CONFIRMED,
      ApplicationConfirmationState.EMAIL_CONFIRMED,
      ApplicationConfirmationState.DASHBOARD_CONFIRMED,
      ApplicationConfirmationState.PRESUMED_FAILED,
      ApplicationConfirmationState.VERIFIED_FAILED,
    ] as const) {
      expect(shouldAutoFailPending(oldSubmitted, state, NOW)).toBe(false);
    }
  });

  it('returns false when submittedAt is null (not yet submitted)', () => {
    expect(
      shouldAutoFailPending(null, ApplicationConfirmationState.PENDING, NOW),
    ).toBe(false);
  });

  it('returns false when PENDING but submittedAt is exactly at the cutoff (strict inequality)', () => {
    const atCutoff = pendingTimeoutCutoff(NOW);
    expect(
      shouldAutoFailPending(
        atCutoff,
        ApplicationConfirmationState.PENDING,
        NOW,
      ),
    ).toBe(false);
  });

  it('returns false when PENDING and submitted exactly 71h59m ago (under threshold)', () => {
    const submitted = new Date(NOW.getTime() - 71 * HOUR - 59 * 60 * 1000);
    expect(
      shouldAutoFailPending(
        submitted,
        ApplicationConfirmationState.PENDING,
        NOW,
      ),
    ).toBe(false);
  });

  it('returns true when PENDING and submitted 72h01m ago', () => {
    const submitted = new Date(NOW.getTime() - 72 * HOUR - 60 * 1000);
    expect(
      shouldAutoFailPending(
        submitted,
        ApplicationConfirmationState.PENDING,
        NOW,
      ),
    ).toBe(true);
  });

  it('returns true when PENDING and submitted well beyond the cutoff', () => {
    const submitted = new Date(NOW.getTime() - 30 * 24 * HOUR);
    expect(
      shouldAutoFailPending(
        submitted,
        ApplicationConfirmationState.PENDING,
        NOW,
      ),
    ).toBe(true);
  });
});
