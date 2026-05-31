/**
 * P8.1: scoped trust ladder.
 *
 * Pure, DB-free implementation of the trust-escalation state machine from
 * FINAL_PLAN.md §8. Trust is keyed by the full scope tuple
 * `(atsFamily, hostname, node, transition, actionType)` so escalation
 * decisions in one node don't leak into sibling nodes.
 *
 * Callers load signals for a scope (from the runtime event log) and call
 * `evaluateScopedTrust({ scope, signals, context })`. The function is
 * intentionally pure so the required tests can drive it without fixtures.
 */

export type TrustLevel =
  | 'OBSERVE_ONLY'
  | 'SUGGEST_ONLY'
  | 'ACTION_WITH_CONFIRMATION'
  | 'AUTO_STEP_GUARDED'
  | 'FULL_AUTO';

const TRUST_LEVEL_ORDER: readonly TrustLevel[] = [
  'OBSERVE_ONLY',
  'SUGGEST_ONLY',
  'ACTION_WITH_CONFIRMATION',
  'AUTO_STEP_GUARDED',
  'FULL_AUTO',
];

export const TRUST_LEVEL_INDEX: Readonly<Record<TrustLevel, number>> =
  Object.freeze(
    Object.fromEntries(
      TRUST_LEVEL_ORDER.map((level, idx) => [level, idx]),
    ) as Record<TrustLevel, number>,
  );

/** Minimum trust level — nothing is below this. */
export const BASELINE_LEVEL: TrustLevel = 'OBSERVE_ONLY';

export interface TrustScope {
  readonly atsFamily: string;
  readonly hostname: string;
  /** Null keys the scope at the hostname level (across every node). */
  readonly node: string | null;
  /** Null keys the scope at the node level (across every transition). */
  readonly transition: string | null;
  /**
   * What the runtime wants trust for. Examples: `submit`, `fill-field`,
   * `click-next`. Separate action types escalate independently.
   */
  readonly actionType: string;
}

export type SignalKind =
  | 'OWNER_CONFIRMED_SUCCESS'
  | 'AUTONOMOUS_SUCCESS'
  | 'AUTONOMOUS_FAILURE'
  | 'OWNER_DEMOTED';

export interface ScopedSignal {
  readonly scope: TrustScope;
  readonly kind: SignalKind;
  readonly at: Date;
}

export interface ScopedTrustContext {
  /**
   * When the regression suite last passed for the ATS family of this scope.
   * Required for FULL_AUTO. Null means never.
   */
  readonly regressionPassingAt: Date | null;
  readonly now?: Date;
  /**
   * Hostname-level cap. If provided, node-scope results can never escalate
   * above this. When omitted the caller has not yet computed the hostname
   * level; the function will compute it recursively on the filtered
   * signals and enforce the same cap.
   */
  readonly hostnameCap?: TrustLevel;
}

export interface ScopedTrustInput {
  readonly scope: TrustScope;
  readonly signals: readonly ScopedSignal[];
  readonly context: ScopedTrustContext;
}

export interface ScopedTrustResult {
  readonly scope: TrustScope;
  readonly level: TrustLevel;
  readonly reasons: readonly string[];
  readonly hostnameCap: TrustLevel;
}

export function compareTrustLevel(
  a: TrustLevel,
  b: TrustLevel,
): number {
  return TRUST_LEVEL_INDEX[a] - TRUST_LEVEL_INDEX[b];
}

/** Returns the lower of two trust levels. */
export function minTrust(a: TrustLevel, b: TrustLevel): TrustLevel {
  return compareTrustLevel(a, b) <= 0 ? a : b;
}

/** Returns the level exactly one step below `level` (clamped at baseline). */
export function demoteTrust(level: TrustLevel): TrustLevel {
  const idx = TRUST_LEVEL_INDEX[level];
  if (idx <= 0) return BASELINE_LEVEL;
  return TRUST_LEVEL_ORDER[idx - 1];
}

function scopesMatch(a: TrustScope, b: TrustScope): boolean {
  if (a.atsFamily !== b.atsFamily) return false;
  if (a.hostname !== b.hostname) return false;
  if (a.actionType !== b.actionType) return false;
  if (a.node !== null && b.node !== null && a.node !== b.node) return false;
  if (
    a.transition !== null &&
    b.transition !== null &&
    a.transition !== b.transition
  ) {
    return false;
  }
  return true;
}

/**
 * Returns the signals that apply at or below the given scope, sorted by time
 * ascending so consecutive-success runs can be detected.
 */
export function signalsForScope(
  scope: TrustScope,
  signals: readonly ScopedSignal[],
): readonly ScopedSignal[] {
  return signals
    .filter(s => scopesMatch(scope, s.scope))
    .slice()
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000);
}

/** Pure scoring: returns what the scope *wants to* be at, ignoring caps. */
function rawLevelForSignals(
  signals: readonly ScopedSignal[],
  context: ScopedTrustContext,
): { level: TrustLevel; reasons: string[] } {
  const reasons: string[] = [];
  const now = context.now ?? new Date();

  if (signals.length === 0) {
    return { level: 'OBSERVE_ONLY', reasons: ['no-signals'] };
  }

  // Most recent 10 events drive the main ladder decisions; the 30-day
  // window drives FULL_AUTO eligibility.
  const recent = signals.slice(-10);

  // Rule 1: 3 owner-confirmed successes in a row on a transition promotes
  // to SUGGEST_ONLY. Read from the newest end.
  const tail3 = recent.slice(-3);
  const three = tail3.length === 3 && tail3.every(s => s.kind === 'OWNER_CONFIRMED_SUCCESS');

  // Rule 2: a single AUTONOMOUS_FAILURE demotes by one step from the level
  // we would otherwise have chosen. Anchor it on the most recent signal —
  // once owner-confirmed successes wash over the failure, it stops
  // suppressing.
  const lastFailureIdx = findLastIndex(recent, s => s.kind === 'AUTONOMOUS_FAILURE');
  const lastSuccessIdx = findLastIndex(recent, s => s.kind === 'OWNER_CONFIRMED_SUCCESS');
  const recentFailureActive = lastFailureIdx >= 0 && lastFailureIdx >= lastSuccessIdx;

  // Rule 3: OWNER_DEMOTED is always sticky until 3 subsequent owner-
  // confirmed successes clear it.
  const lastDemotedIdx = findLastIndex(recent, s => s.kind === 'OWNER_DEMOTED');
  let demotedSticky = false;
  if (lastDemotedIdx >= 0) {
    const successesAfter = recent
      .slice(lastDemotedIdx + 1)
      .filter(s => s.kind === 'OWNER_CONFIRMED_SUCCESS').length;
    demotedSticky = successesAfter < 3;
  }

  // Rule 4: AUTONOMOUS_SUCCESS counts, but cannot by itself push past
  // ACTION_WITH_CONFIRMATION unless combined with owner-confirmed evidence.

  let level: TrustLevel = 'OBSERVE_ONLY';

  if (three) {
    level = 'SUGGEST_ONLY';
    reasons.push('three-owner-confirmed-in-a-row');
  }

  // Count of owner-confirmed successes in the overall history.
  const ownerConfirmedCount = signals.filter(
    s => s.kind === 'OWNER_CONFIRMED_SUCCESS',
  ).length;

  if (
    level === 'SUGGEST_ONLY' &&
    ownerConfirmedCount >= 5 &&
    !recentFailureActive
  ) {
    level = 'ACTION_WITH_CONFIRMATION';
    reasons.push('>=5-owner-confirmed-and-no-recent-failure');
  }

  if (
    level === 'ACTION_WITH_CONFIRMATION' &&
    ownerConfirmedCount >= 8 &&
    !recentFailureActive
  ) {
    level = 'AUTO_STEP_GUARDED';
    reasons.push('>=8-owner-confirmed-and-no-recent-failure');
  }

  // FULL_AUTO requires:
  //   - regression suite passing (context.regressionPassingAt set)
  //   - at least 10 owner-confirmed successes
  //   - zero AUTONOMOUS_FAILURE events in the last 30 days
  const regressionFresh =
    !!context.regressionPassingAt &&
    daysBetween(now, context.regressionPassingAt) <= 30;

  const failuresLast30Days = signals.filter(
    s =>
      s.kind === 'AUTONOMOUS_FAILURE' &&
      daysBetween(now, s.at) <= 30,
  ).length;

  if (
    level === 'AUTO_STEP_GUARDED' &&
    regressionFresh &&
    ownerConfirmedCount >= 10 &&
    failuresLast30Days === 0
  ) {
    level = 'FULL_AUTO';
    reasons.push('full-auto-criteria-met');
  } else if (level === 'AUTO_STEP_GUARDED') {
    if (!regressionFresh) reasons.push('full-auto-gate:regression-stale');
    if (ownerConfirmedCount < 10) reasons.push('full-auto-gate:owner-confirmed<10');
    if (failuresLast30Days > 0) reasons.push('full-auto-gate:recent-failures');
  }

  if (recentFailureActive) {
    const demoted = demoteTrust(level);
    reasons.push('single-autonomous-failure-demotes');
    level = demoted;
  }

  if (demotedSticky) {
    level = minTrust(level, 'OBSERVE_ONLY');
    reasons.push('owner-demotion-sticky');
  }

  return { level, reasons };
}

function findLastIndex<T>(
  arr: readonly T[],
  predicate: (value: T) => boolean,
): number {
  for (let i = arr.length - 1; i >= 0; i -= 1) {
    if (predicate(arr[i])) return i;
  }
  return -1;
}

/**
 * Evaluate trust for a scope tuple. Enforces the invariant that node-level
 * trust cannot exceed hostname-level trust.
 */
export function evaluateScopedTrust(
  input: ScopedTrustInput,
): ScopedTrustResult {
  const { scope, signals, context } = input;
  const scoped = signalsForScope(scope, signals);

  const raw = rawLevelForSignals(scoped, context);

  // Compute hostname cap: roll up signals to the hostname scope (node +
  // transition = null) and run the same scoring. The node-level result
  // cannot exceed this.
  const hostnameScope: TrustScope = {
    actionType: scope.actionType,
    atsFamily: scope.atsFamily,
    hostname: scope.hostname,
    node: null,
    transition: null,
  };

  let hostnameCap: TrustLevel;
  if (context.hostnameCap) {
    hostnameCap = context.hostnameCap;
  } else if (scope.node === null && scope.transition === null) {
    // This call is already at hostname level.
    hostnameCap = raw.level;
  } else {
    const hostnameScoped = signals.filter(s =>
      scopesMatch(hostnameScope, s.scope),
    );
    hostnameCap = rawLevelForSignals(hostnameScoped, context).level;
  }

  const capped = minTrust(raw.level, hostnameCap);
  const reasons = [...raw.reasons];
  if (capped !== raw.level) {
    reasons.push(`capped-by-hostname:${hostnameCap}`);
  }

  return {
    hostnameCap,
    level: capped,
    reasons,
    scope,
  };
}
