import { describe, expect, it } from 'vitest';

import {
  ATSAutomationPostureLevel,
  SubmissionTier,
} from '@/generated/prisma/client';
import type { ScopedSignal } from '@/lib/runtime-trust-ladder';

import {
  effectiveModeFor,
  evaluateLeadForBurst,
  type EligibleLeadCandidate,
} from '../confirm-burst';

const NOW = new Date('2026-04-22T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function candidate(
  partial: Partial<EligibleLeadCandidate> = {},
): EligibleLeadCandidate {
  return {
    atsFamily: 'greenhouse',
    confirmationState: 'PENDING',
    hostname: 'job-boards.greenhouse.io',
    leadId: 'lead_1',
    posture: ATSAutomationPostureLevel.ALLOWED,
    regressionPassingAt: new Date(NOW.getTime() - 1 * DAY),
    tier: SubmissionTier.FIRE_AND_FORGET,
    trustSignals: [],
    ...partial,
  };
}

function manyOwnerConfirmed(count: number): ScopedSignal[] {
  return Array.from({ length: count }).map((_, i) => ({
    at: new Date(NOW.getTime() - (count - i) * DAY),
    kind: 'OWNER_CONFIRMED_SUCCESS',
    scope: {
      actionType: 'submit',
      atsFamily: 'greenhouse',
      hostname: 'job-boards.greenhouse.io',
      node: null,
      transition: null,
    },
  }));
}

const alwaysBudget = { hasBudget: () => true };
const neverBudget = { hasBudget: () => false };

describe('effectiveModeFor', () => {
  it('returns the stricter of mode and tier', () => {
    expect(effectiveModeFor('FIRE_AND_FORGET', SubmissionTier.TARGETED)).toBe(
      'TARGETED',
    );
    expect(effectiveModeFor('GENERIC', SubmissionTier.FIRE_AND_FORGET)).toBe(
      'GENERIC',
    );
    expect(
      effectiveModeFor(SubmissionTier.GENERIC, SubmissionTier.GENERIC),
    ).toBe('GENERIC');
  });
});

describe('evaluateLeadForBurst', () => {
  it('allows a fresh TARGETED burst of any lead with resolvable hostname', () => {
    const verdict = evaluateLeadForBurst({
      candidate: candidate({ tier: SubmissionTier.TARGETED }),
      mode: 'TARGETED',
      now: NOW,
      rateBudget: alwaysBudget,
    });
    expect(verdict.ok).toBe(true);
  });

  it('denies when lead tier is stricter than requested mode', () => {
    const verdict = evaluateLeadForBurst({
      candidate: candidate({ tier: SubmissionTier.TARGETED }),
      mode: 'GENERIC',
      now: NOW,
      rateBudget: alwaysBudget,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toBe('TIER_BLOCKS_MODE');
    }
  });

  it('denies when posture blocks the effective mode', () => {
    const verdict = evaluateLeadForBurst({
      candidate: candidate({
        posture: ATSAutomationPostureLevel.FORBIDDEN,
        tier: SubmissionTier.GENERIC,
      }),
      mode: 'GENERIC',
      now: NOW,
      rateBudget: alwaysBudget,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toBe('POSTURE_BLOCKS_MODE');
    }
  });

  it('denies GRAY posture under GENERIC mode', () => {
    const verdict = evaluateLeadForBurst({
      candidate: candidate({
        posture: ATSAutomationPostureLevel.GRAY,
        tier: SubmissionTier.GENERIC,
        trustSignals: manyOwnerConfirmed(8),
      }),
      mode: 'GENERIC',
      now: NOW,
      rateBudget: alwaysBudget,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toBe('POSTURE_BLOCKS_MODE');
    }
  });

  it('denies GRAY posture under FIRE_AND_FORGET mode', () => {
    const verdict = evaluateLeadForBurst({
      candidate: candidate({
        posture: ATSAutomationPostureLevel.GRAY,
        tier: SubmissionTier.FIRE_AND_FORGET,
        trustSignals: manyOwnerConfirmed(12),
      }),
      mode: 'FIRE_AND_FORGET',
      now: NOW,
      rateBudget: alwaysBudget,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toBe('POSTURE_BLOCKS_MODE');
    }
  });

  it('denies when trust is below required minimum for the effective mode', () => {
    const verdict = evaluateLeadForBurst({
      candidate: candidate({
        tier: SubmissionTier.FIRE_AND_FORGET,
        trustSignals: [], // -> OBSERVE_ONLY
      }),
      mode: 'FIRE_AND_FORGET',
      now: NOW,
      rateBudget: alwaysBudget,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toBe('TRUST_BELOW_MINIMUM');
    }
  });

  it('allows FIRE_AND_FORGET when trust reaches FULL_AUTO', () => {
    const verdict = evaluateLeadForBurst({
      candidate: candidate({
        tier: SubmissionTier.FIRE_AND_FORGET,
        trustSignals: manyOwnerConfirmed(12),
      }),
      mode: 'FIRE_AND_FORGET',
      now: NOW,
      rateBudget: alwaysBudget,
    });
    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.trustLevel).toBe('FULL_AUTO');
      expect(verdict.effectiveMode).toBe('FIRE_AND_FORGET');
    }
  });

  it('denies when host rate budget is empty', () => {
    const verdict = evaluateLeadForBurst({
      candidate: candidate({ tier: SubmissionTier.TARGETED }),
      mode: 'TARGETED',
      now: NOW,
      rateBudget: neverBudget,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toBe('RATE_BUDGET_EMPTY');
    }
  });

  it('denies when the lead is already confirmed', () => {
    const verdict = evaluateLeadForBurst({
      candidate: candidate({ confirmationState: 'EMAIL_CONFIRMED' }),
      mode: 'TARGETED',
      now: NOW,
      rateBudget: alwaysBudget,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toBe('ALREADY_CONFIRMED');
    }
  });

  it('denies when hostname is unresolvable', () => {
    const verdict = evaluateLeadForBurst({
      candidate: candidate({ hostname: '' }),
      mode: 'TARGETED',
      now: NOW,
      rateBudget: alwaysBudget,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toBe('LEAD_HOSTNAME_UNRESOLVED');
    }
  });

  it('denies when ATS family is unresolvable', () => {
    const verdict = evaluateLeadForBurst({
      candidate: candidate({ atsFamily: '' }),
      mode: 'TARGETED',
      now: NOW,
      rateBudget: alwaysBudget,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toBe('LEAD_ATS_FAMILY_UNRESOLVED');
    }
  });

  it('effective mode uses the stricter of requested mode and lead tier', () => {
    const verdict = evaluateLeadForBurst({
      candidate: candidate({
        tier: SubmissionTier.GENERIC,
        trustSignals: manyOwnerConfirmed(8),
      }),
      mode: 'FIRE_AND_FORGET',
      now: NOW,
      rateBudget: alwaysBudget,
    });
    // Lead tier GENERIC is stricter than requested FIRE_AND_FORGET - but
    // tier check fails because GENERIC < FIRE_AND_FORGET in permissiveness.
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toBe('TIER_BLOCKS_MODE');
    }
  });
});
