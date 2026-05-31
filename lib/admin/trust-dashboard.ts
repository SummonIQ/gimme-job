import { db } from '@/lib/db/client';

import {
  BASELINE_LEVEL,
  evaluateScopedTrust,
  minTrust,
  type ScopedSignal,
  type TrustLevel,
  type TrustScope,
} from '@/lib/runtime-trust-ladder';

export type { TrustLevel, TrustScope };

export interface DashboardRow {
  readonly scope: TrustScope;
  readonly computedLevel: TrustLevel;
  readonly effectiveLevel: TrustLevel;
  readonly lastChangeReason: string;
  readonly lastChangeAt: Date | null;
  readonly overriddenTo: TrustLevel | null;
  readonly overrideReason: string | null;
  readonly overrideId: string | null;
}

interface RuntimeTrustOverrideRow {
  readonly id: string;
  readonly atsFamily: string;
  readonly hostname: string;
  readonly node: string | null;
  readonly transition: string | null;
  readonly actionType: string;
  readonly demotedTo: string;
  readonly reason: string;
  readonly createdAt: Date;
  readonly expiresAt: Date | null;
  readonly clearedAt: Date | null;
}

/**
 * Matches an override row to a computed scope. Null fields on the override
 * act as wildcards — a row with `node=null` overrides every node under the
 * same (atsFamily, hostname, actionType).
 */
export function overrideMatchesScope(
  override: RuntimeTrustOverrideRow,
  scope: TrustScope,
): boolean {
  if (override.atsFamily !== scope.atsFamily) return false;
  if (override.hostname !== scope.hostname) return false;
  if (override.actionType !== scope.actionType) return false;
  if (override.node !== null && override.node !== scope.node) return false;
  if (
    override.transition !== null &&
    override.transition !== scope.transition
  ) {
    return false;
  }
  return true;
}

export function isOverrideActive(
  override: RuntimeTrustOverrideRow,
  now: Date,
): boolean {
  if (override.clearedAt) return false;
  if (override.expiresAt && override.expiresAt.getTime() <= now.getTime()) {
    return false;
  }
  return true;
}

export interface BuildRowsInput {
  readonly scopesWithSignals: ReadonlyArray<{
    readonly scope: TrustScope;
    readonly signals: readonly ScopedSignal[];
    readonly regressionPassingAt: Date | null;
    readonly lastChangeAt: Date | null;
    readonly lastChangeReason: string;
  }>;
  readonly overrides: readonly RuntimeTrustOverrideRow[];
  readonly now: Date;
}

/**
 * Pure — exposed for unit tests. Given a pre-loaded set of scopes with their
 * signals and the user's active overrides, produce dashboard rows.
 */
export function buildDashboardRows(input: BuildRowsInput): DashboardRow[] {
  const activeOverrides = input.overrides.filter(o =>
    isOverrideActive(o, input.now),
  );

  return input.scopesWithSignals.map(({ scope, signals, regressionPassingAt, lastChangeAt, lastChangeReason }) => {
    const evaluation = evaluateScopedTrust({
      context: { now: input.now, regressionPassingAt },
      scope,
      signals,
    });

    const match = activeOverrides.find(o => overrideMatchesScope(o, scope));

    let effectiveLevel: TrustLevel = evaluation.level;
    let overriddenTo: TrustLevel | null = null;
    let overrideReason: string | null = null;
    let overrideId: string | null = null;

    if (match) {
      const demotedTo = match.demotedTo as TrustLevel;
      effectiveLevel = minTrust(evaluation.level, demotedTo);
      overriddenTo = demotedTo;
      overrideReason = match.reason;
      overrideId = match.id;
    }

    return {
      computedLevel: evaluation.level,
      effectiveLevel,
      lastChangeAt,
      lastChangeReason: match
        ? `manual override: ${match.reason}`
        : lastChangeReason,
      overriddenTo,
      overrideId,
      overrideReason,
      scope,
    };
  });
}

/**
 * Load the dashboard rows for a given user. This is a DB-touching wrapper
 * around `buildDashboardRows` that pulls runtime events + overrides. The
 * current implementation scans a bounded window of ApplicationRuntimeEvent
 * rows and derives scope tuples from them.
 *
 * NOTE: The exact mapping from ApplicationRuntimeEvent to
 * `(atsFamily, hostname, node, transition, actionType, kind)` requires the
 * P1.3 provenance columns that are on origin/main. This loader is kept
 * separate from the pure `buildDashboardRows` so scope discovery can evolve
 * without requiring every test to hit the DB.
 */
export async function loadTrustDashboardRows(
  userId: string,
  opts: { now?: Date } = {},
): Promise<DashboardRow[]> {
  const now = opts.now ?? new Date();

  const overrides = await db.runtimeTrustOverride.findMany({
    where: {
      clearedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      userId,
    },
  });

  // Scope discovery from ApplicationRuntimeEvent is left for the P8.2
  // follow-up that wires the concrete event-to-scope mapping. This keeps
  // the loader contract stable so the page + manual-demote flow can land
  // now. Until then, scopes only appear on the dashboard once the manual
  // override touches them.
  const scopesWithSignals = overrides.map(o => ({
    lastChangeAt: o.createdAt,
    lastChangeReason: `manual override: ${o.reason}`,
    regressionPassingAt: null as Date | null,
    scope: {
      actionType: o.actionType,
      atsFamily: o.atsFamily,
      hostname: o.hostname,
      node: o.node,
      transition: o.transition,
    } satisfies TrustScope,
    signals: [] as ScopedSignal[],
  }));

  return buildDashboardRows({
    now,
    overrides,
    scopesWithSignals,
  });
}

export const BASELINE = BASELINE_LEVEL;
