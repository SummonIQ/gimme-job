import { describe, expect, it } from 'vitest';

import {
  BASELINE_LEVEL,
  TRUST_LEVEL_INDEX,
  compareTrustLevel,
  demoteTrust,
  evaluateScopedTrust,
  minTrust,
  signalsForScope,
  type ScopedSignal,
  type TrustLevel,
  type TrustScope,
} from '../index';

const NOW = new Date('2026-04-22T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

function scope(partial: Partial<TrustScope> = {}): TrustScope {
  return {
    actionType: 'submit',
    atsFamily: 'greenhouse',
    hostname: 'job-boards.greenhouse.io',
    node: null,
    transition: null,
    ...partial,
  };
}

function signal(
  kind: ScopedSignal['kind'],
  daysAgo: number,
  scopeOverride: Partial<TrustScope> = {},
): ScopedSignal {
  return {
    at: new Date(NOW.getTime() - daysAgo * DAY),
    kind,
    scope: scope(scopeOverride),
  };
}

describe('TrustLevel helpers', () => {
  it('BASELINE_LEVEL is OBSERVE_ONLY', () => {
    expect(BASELINE_LEVEL).toBe('OBSERVE_ONLY');
  });

  it('TRUST_LEVEL_INDEX is monotonic', () => {
    expect(TRUST_LEVEL_INDEX.OBSERVE_ONLY).toBeLessThan(
      TRUST_LEVEL_INDEX.SUGGEST_ONLY,
    );
    expect(TRUST_LEVEL_INDEX.SUGGEST_ONLY).toBeLessThan(
      TRUST_LEVEL_INDEX.ACTION_WITH_CONFIRMATION,
    );
    expect(TRUST_LEVEL_INDEX.ACTION_WITH_CONFIRMATION).toBeLessThan(
      TRUST_LEVEL_INDEX.AUTO_STEP_GUARDED,
    );
    expect(TRUST_LEVEL_INDEX.AUTO_STEP_GUARDED).toBeLessThan(
      TRUST_LEVEL_INDEX.FULL_AUTO,
    );
  });

  it('minTrust returns the lower level', () => {
    expect(minTrust('OBSERVE_ONLY', 'FULL_AUTO')).toBe('OBSERVE_ONLY');
    expect(minTrust('ACTION_WITH_CONFIRMATION', 'AUTO_STEP_GUARDED')).toBe(
      'ACTION_WITH_CONFIRMATION',
    );
    expect(minTrust('FULL_AUTO', 'FULL_AUTO')).toBe('FULL_AUTO');
  });

  it('demoteTrust steps down one and clamps at baseline', () => {
    expect(demoteTrust('FULL_AUTO')).toBe('AUTO_STEP_GUARDED');
    expect(demoteTrust('AUTO_STEP_GUARDED')).toBe('ACTION_WITH_CONFIRMATION');
    expect(demoteTrust('OBSERVE_ONLY')).toBe('OBSERVE_ONLY');
  });

  it('compareTrustLevel gives the expected sign', () => {
    expect(compareTrustLevel('OBSERVE_ONLY', 'FULL_AUTO')).toBeLessThan(0);
    expect(compareTrustLevel('FULL_AUTO', 'OBSERVE_ONLY')).toBeGreaterThan(0);
    expect(compareTrustLevel('SUGGEST_ONLY', 'SUGGEST_ONLY')).toBe(0);
  });
});

describe('signalsForScope', () => {
  it('returns signals sorted ascending by time', () => {
    const s = scope();
    const signals: ScopedSignal[] = [
      { at: new Date(NOW.getTime() - 2 * DAY), kind: 'OWNER_CONFIRMED_SUCCESS', scope: s },
      { at: new Date(NOW.getTime() - 5 * DAY), kind: 'AUTONOMOUS_SUCCESS', scope: s },
      { at: new Date(NOW.getTime() - 1 * DAY), kind: 'AUTONOMOUS_FAILURE', scope: s },
    ];
    const filtered = signalsForScope(s, signals);
    expect(filtered.map(x => x.at.getTime())).toEqual(
      [...signals].map(x => x.at.getTime()).sort((a, b) => a - b),
    );
  });

  it('filters out signals for different action types', () => {
    const s = scope({ actionType: 'submit' });
    const signals: ScopedSignal[] = [
      { at: NOW, kind: 'OWNER_CONFIRMED_SUCCESS', scope: s },
      {
        at: NOW,
        kind: 'OWNER_CONFIRMED_SUCCESS',
        scope: scope({ actionType: 'fill-field' }),
      },
    ];
    expect(signalsForScope(s, signals)).toHaveLength(1);
  });
});

describe('evaluateScopedTrust — required acceptance cases', () => {
  it('1. a new hostname starts at OBSERVE_ONLY', () => {
    const result = evaluateScopedTrust({
      context: { now: NOW, regressionPassingAt: null },
      scope: scope(),
      signals: [],
    });
    expect(result.level).toBe('OBSERVE_ONLY');
  });

  it('2. 3 owner-confirmed successes in a row on a transition moves to SUGGEST_ONLY', () => {
    const s = scope({ node: 'contact-info', transition: 'next-click' });
    const signals: ScopedSignal[] = [
      { at: new Date(NOW.getTime() - 5 * DAY), kind: 'OWNER_CONFIRMED_SUCCESS', scope: s },
      { at: new Date(NOW.getTime() - 4 * DAY), kind: 'OWNER_CONFIRMED_SUCCESS', scope: s },
      { at: new Date(NOW.getTime() - 3 * DAY), kind: 'OWNER_CONFIRMED_SUCCESS', scope: s },
    ];
    const result = evaluateScopedTrust({
      context: { now: NOW, regressionPassingAt: null },
      scope: s,
      signals,
    });
    expect(result.level).toBe('SUGGEST_ONLY');
    expect(result.reasons).toContain('three-owner-confirmed-in-a-row');
  });

  it('3. 1 autonomous failure demotes to the prior level', () => {
    const s = scope({ node: 'contact-info', transition: 'next-click' });
    const signals: ScopedSignal[] = [
      { at: new Date(NOW.getTime() - 5 * DAY), kind: 'OWNER_CONFIRMED_SUCCESS', scope: s },
      { at: new Date(NOW.getTime() - 4 * DAY), kind: 'OWNER_CONFIRMED_SUCCESS', scope: s },
      { at: new Date(NOW.getTime() - 3 * DAY), kind: 'OWNER_CONFIRMED_SUCCESS', scope: s },
      { at: new Date(NOW.getTime() - 1 * DAY), kind: 'AUTONOMOUS_FAILURE', scope: s },
    ];
    const result = evaluateScopedTrust({
      context: { now: NOW, regressionPassingAt: null },
      scope: s,
      signals,
    });
    expect(result.level).toBe('OBSERVE_ONLY');
    expect(result.reasons).toContain('single-autonomous-failure-demotes');
  });

  it('4. trust at the node level cannot exceed trust at the hostname level', () => {
    const hostnameScope = scope();
    const nodeScope = scope({
      node: 'contact-info',
      transition: 'next-click',
    });

    // Strong node-level history.
    const nodeSignals: ScopedSignal[] = Array.from({ length: 5 }).map(
      (_, i) =>
        ({
          at: new Date(NOW.getTime() - (10 - i) * DAY),
          kind: 'OWNER_CONFIRMED_SUCCESS',
          scope: nodeScope,
        }) as const,
    );
    // Hostname-level history is weak: just one failure at the hostname
    // level (no node/transition).
    const hostnameSignals: ScopedSignal[] = [
      {
        at: new Date(NOW.getTime() - 2 * DAY),
        kind: 'AUTONOMOUS_FAILURE',
        scope: hostnameScope,
      },
    ];

    const nodeResult = evaluateScopedTrust({
      context: { now: NOW, regressionPassingAt: null },
      scope: nodeScope,
      signals: [...nodeSignals, ...hostnameSignals],
    });

    // Hostname cap computed from hostname-only signals (= OBSERVE_ONLY
    // because the only hostname-scope signal is a failure). Node must not
    // exceed it.
    expect(nodeResult.hostnameCap).toBe('OBSERVE_ONLY');
    expect(nodeResult.level).toBe('OBSERVE_ONLY');
  });

  it('5. FULL_AUTO requires regression + 10 owner-confirmed + 0 failures in 30 days', () => {
    const s = scope();
    // 10 owner-confirmed successes, spread over 20 days.
    const signals: ScopedSignal[] = Array.from({ length: 10 }).map(
      (_, i) =>
        ({
          at: new Date(NOW.getTime() - (20 - i) * DAY),
          kind: 'OWNER_CONFIRMED_SUCCESS',
          scope: s,
        }) as const,
    );

    // With regression fresh + no failures, we reach FULL_AUTO.
    const ok = evaluateScopedTrust({
      context: {
        now: NOW,
        regressionPassingAt: new Date(NOW.getTime() - 2 * DAY),
      },
      scope: s,
      signals,
    });
    expect(ok.level).toBe('FULL_AUTO');

    // Missing regression -> capped at AUTO_STEP_GUARDED with a reason.
    const noRegression = evaluateScopedTrust({
      context: { now: NOW, regressionPassingAt: null },
      scope: s,
      signals,
    });
    expect(noRegression.level).toBe('AUTO_STEP_GUARDED');
    expect(noRegression.reasons).toContain('full-auto-gate:regression-stale');

    // A single failure inside the 30-day window demotes.
    const withFailure: ScopedSignal[] = [
      ...signals,
      {
        at: new Date(NOW.getTime() - 15 * DAY),
        kind: 'AUTONOMOUS_FAILURE',
        scope: s,
      },
    ];
    const demoted = evaluateScopedTrust({
      context: {
        now: NOW,
        regressionPassingAt: new Date(NOW.getTime() - 2 * DAY),
      },
      scope: s,
      signals: withFailure,
    });
    expect(
      compareTrustLevel(demoted.level, 'FULL_AUTO'),
    ).toBeLessThan(0);

    // Regression older than 30 days is stale.
    const staleRegression = evaluateScopedTrust({
      context: {
        now: NOW,
        regressionPassingAt: new Date(NOW.getTime() - 45 * DAY),
      },
      scope: s,
      signals,
    });
    expect(staleRegression.level).toBe('AUTO_STEP_GUARDED');
    expect(staleRegression.reasons).toContain(
      'full-auto-gate:regression-stale',
    );
  });
});

describe('evaluateScopedTrust — auxiliary behavior', () => {
  it('OWNER_DEMOTED sticks until three subsequent owner-confirmed successes', () => {
    const s = scope();
    const base: ScopedSignal[] = Array.from({ length: 5 }).map(
      (_, i) =>
        ({
          at: new Date(NOW.getTime() - (20 - i) * DAY),
          kind: 'OWNER_CONFIRMED_SUCCESS',
          scope: s,
        }) as const,
    );
    const demoted: ScopedSignal = {
      at: new Date(NOW.getTime() - 5 * DAY),
      kind: 'OWNER_DEMOTED',
      scope: s,
    };

    // Only 2 successes after the demotion -> still sticky.
    const sticky = evaluateScopedTrust({
      context: { now: NOW, regressionPassingAt: null },
      scope: s,
      signals: [
        ...base,
        demoted,
        {
          at: new Date(NOW.getTime() - 3 * DAY),
          kind: 'OWNER_CONFIRMED_SUCCESS',
          scope: s,
        },
        {
          at: new Date(NOW.getTime() - 2 * DAY),
          kind: 'OWNER_CONFIRMED_SUCCESS',
          scope: s,
        },
      ],
    });
    expect(sticky.level).toBe('OBSERVE_ONLY');
    expect(sticky.reasons).toContain('owner-demotion-sticky');

    // 3 successes after demotion -> clears.
    const cleared = evaluateScopedTrust({
      context: { now: NOW, regressionPassingAt: null },
      scope: s,
      signals: [
        ...base,
        demoted,
        {
          at: new Date(NOW.getTime() - 3 * DAY),
          kind: 'OWNER_CONFIRMED_SUCCESS',
          scope: s,
        },
        {
          at: new Date(NOW.getTime() - 2 * DAY),
          kind: 'OWNER_CONFIRMED_SUCCESS',
          scope: s,
        },
        {
          at: new Date(NOW.getTime() - 1 * DAY),
          kind: 'OWNER_CONFIRMED_SUCCESS',
          scope: s,
        },
      ],
    });
    expect(compareTrustLevel(cleared.level, 'OBSERVE_ONLY')).toBeGreaterThan(
      0,
    );
  });

  it('different action types escalate independently', () => {
    const submitScope = scope({ actionType: 'submit' });
    const fillScope = scope({ actionType: 'fill-field' });
    const signals: ScopedSignal[] = Array.from({ length: 3 }).map(
      (_, i) =>
        ({
          at: new Date(NOW.getTime() - (5 - i) * DAY),
          kind: 'OWNER_CONFIRMED_SUCCESS',
          scope: submitScope,
        }) as const,
    );

    const submit = evaluateScopedTrust({
      context: { now: NOW, regressionPassingAt: null },
      scope: submitScope,
      signals,
    });
    expect(submit.level).toBe('SUGGEST_ONLY');

    const fill = evaluateScopedTrust({
      context: { now: NOW, regressionPassingAt: null },
      scope: fillScope,
      signals, // all submit-scope
    });
    expect(fill.level).toBe('OBSERVE_ONLY');
  });

  it('explicit hostnameCap overrides derived cap', () => {
    const s = scope({ node: 'n', transition: 't' });
    const signals: ScopedSignal[] = Array.from({ length: 10 }).map(
      (_, i) =>
        ({
          at: new Date(NOW.getTime() - (20 - i) * DAY),
          kind: 'OWNER_CONFIRMED_SUCCESS',
          scope: s,
        }) as const,
    );
    const result = evaluateScopedTrust({
      context: {
        hostnameCap: 'SUGGEST_ONLY',
        now: NOW,
        regressionPassingAt: new Date(NOW.getTime() - 2 * DAY),
      },
      scope: s,
      signals,
    });
    expect(result.level).toBe('SUGGEST_ONLY');
    expect(result.hostnameCap).toBe('SUGGEST_ONLY');
    expect(
      result.reasons.some(r => r.startsWith('capped-by-hostname:')),
    ).toBe(true);
  });
});
