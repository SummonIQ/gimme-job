import { describe, expect, it } from 'vitest';

import type { ScopedSignal, TrustScope } from '@/lib/runtime-trust-ladder';

import {
  buildDashboardRows,
  isOverrideActive,
  overrideMatchesScope,
} from '../trust-dashboard';

const NOW = new Date('2026-04-22T12:00:00.000Z');
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

function override(
  partial: Partial<Parameters<typeof overrideMatchesScope>[0]> = {},
) {
  return {
    actionType: 'submit',
    atsFamily: 'greenhouse',
    clearedAt: null,
    createdAt: new Date(NOW.getTime() - 1 * DAY),
    demotedTo: 'OBSERVE_ONLY',
    expiresAt: null,
    hostname: 'job-boards.greenhouse.io',
    id: 'ov_1',
    node: null,
    reason: 'captcha spike',
    transition: null,
    ...partial,
  };
}

describe('overrideMatchesScope', () => {
  it('matches on exact tuple', () => {
    expect(overrideMatchesScope(override(), scope())).toBe(true);
  });

  it('null override fields act as wildcards', () => {
    const ov = override({ node: null, transition: null });
    expect(
      overrideMatchesScope(
        ov,
        scope({ node: 'contact-info', transition: 'next-click' }),
      ),
    ).toBe(true);
  });

  it('mismatched actionType does not match', () => {
    expect(
      overrideMatchesScope(
        override({ actionType: 'fill-field' }),
        scope({ actionType: 'submit' }),
      ),
    ).toBe(false);
  });

  it('non-null override fields must match exactly', () => {
    expect(
      overrideMatchesScope(
        override({ node: 'contact-info' }),
        scope({ node: 'review' }),
      ),
    ).toBe(false);
  });
});

describe('isOverrideActive', () => {
  it('is true when clearedAt is null and no expiresAt', () => {
    expect(isOverrideActive(override(), NOW)).toBe(true);
  });

  it('is false when clearedAt is set', () => {
    expect(
      isOverrideActive(override({ clearedAt: new Date(NOW.getTime() - 60_000) }), NOW),
    ).toBe(false);
  });

  it('is false when expiresAt is in the past', () => {
    expect(
      isOverrideActive(
        override({ expiresAt: new Date(NOW.getTime() - 60_000) }),
        NOW,
      ),
    ).toBe(false);
  });

  it('is true when expiresAt is in the future', () => {
    expect(
      isOverrideActive(
        override({ expiresAt: new Date(NOW.getTime() + 60_000) }),
        NOW,
      ),
    ).toBe(true);
  });
});

describe('buildDashboardRows', () => {
  it('returns computed + effective equal when no override matches', () => {
    const s = scope();
    const signals: ScopedSignal[] = [
      signal('OWNER_CONFIRMED_SUCCESS', 5),
      signal('OWNER_CONFIRMED_SUCCESS', 4),
      signal('OWNER_CONFIRMED_SUCCESS', 3),
    ];
    const [row] = buildDashboardRows({
      now: NOW,
      overrides: [],
      scopesWithSignals: [
        {
          lastChangeAt: new Date(NOW.getTime() - 3 * DAY),
          lastChangeReason: 'promoted to SUGGEST_ONLY',
          regressionPassingAt: null,
          scope: s,
          signals,
        },
      ],
    });
    expect(row.computedLevel).toBe('SUGGEST_ONLY');
    expect(row.effectiveLevel).toBe('SUGGEST_ONLY');
    expect(row.overriddenTo).toBeNull();
  });

  it('caps effective level when an active override is present', () => {
    const s = scope();
    const signals: ScopedSignal[] = [
      signal('OWNER_CONFIRMED_SUCCESS', 5),
      signal('OWNER_CONFIRMED_SUCCESS', 4),
      signal('OWNER_CONFIRMED_SUCCESS', 3),
    ];
    const [row] = buildDashboardRows({
      now: NOW,
      overrides: [override({ demotedTo: 'OBSERVE_ONLY' })],
      scopesWithSignals: [
        {
          lastChangeAt: null,
          lastChangeReason: '',
          regressionPassingAt: null,
          scope: s,
          signals,
        },
      ],
    });
    expect(row.computedLevel).toBe('SUGGEST_ONLY');
    expect(row.effectiveLevel).toBe('OBSERVE_ONLY');
    expect(row.overriddenTo).toBe('OBSERVE_ONLY');
    expect(row.lastChangeReason).toContain('manual override');
    expect(row.overrideId).toBe('ov_1');
  });

  it('ignores a cleared override', () => {
    const s = scope();
    const [row] = buildDashboardRows({
      now: NOW,
      overrides: [
        override({
          clearedAt: new Date(NOW.getTime() - 60_000),
          demotedTo: 'OBSERVE_ONLY',
        }),
      ],
      scopesWithSignals: [
        {
          lastChangeAt: null,
          lastChangeReason: 'live',
          regressionPassingAt: null,
          scope: s,
          signals: [
            signal('OWNER_CONFIRMED_SUCCESS', 5),
            signal('OWNER_CONFIRMED_SUCCESS', 4),
            signal('OWNER_CONFIRMED_SUCCESS', 3),
          ],
        },
      ],
    });
    expect(row.effectiveLevel).toBe('SUGGEST_ONLY');
    expect(row.overriddenTo).toBeNull();
  });

  it('override demotedTo cannot raise effective above computed', () => {
    // Computed is OBSERVE_ONLY; override sets demotedTo=FULL_AUTO (would be
    // an invalid promote). minTrust clamps to OBSERVE_ONLY.
    const s = scope();
    const [row] = buildDashboardRows({
      now: NOW,
      overrides: [override({ demotedTo: 'FULL_AUTO' })],
      scopesWithSignals: [
        {
          lastChangeAt: null,
          lastChangeReason: '',
          regressionPassingAt: null,
          scope: s,
          signals: [],
        },
      ],
    });
    expect(row.computedLevel).toBe('OBSERVE_ONLY');
    expect(row.effectiveLevel).toBe('OBSERVE_ONLY');
  });
});
