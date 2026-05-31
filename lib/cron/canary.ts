import path from 'node:path';

import { db } from '@/lib/db/client';
import type {
  RegressionComparison,
  RegressionFamilyResult,
} from '@/lib/evaluation/regression-reporter';

import {
  type RegressionRunOptions,
  type RegressionRunResult,
  runRegression,
} from '@/scripts/regression-run';

/**
 * P14.1 - weekly canary.
 *
 * Runs the P7.3 regression suite across every supported ATS fixture
 * family, compares each family's current pass rate to the last saved
 * baseline, and - for any family that dropped more than the configured
 * threshold (default 5 percentage points) or still has current failures
 * - enqueues a `RETRAIN_RECIPE_PACK` `JobQueueItem`.
 *
 * The cron route is purely scheduling; submission and rule promotion
 * live elsewhere. Keeping this module DB-aware (it writes queue items)
 * but runtime-free (no desktop, no real submissions) makes it testable
 * from a vitest integration test with a plain Postgres connection.
 */

export const CANARY_DEFAULT_REPORT_DIR = 'docs/canary-reports';
export const CANARY_RETRAIN_JOB_TYPE = 'RETRAIN_RECIPE_PACK';
export const CANARY_DEDUP_PREFIX = 'canary-retrain:';
export const CANARY_STALE_HOURS = 24 * 8; // give the weekly cron 1 day of slack

type RunRegressionFn = (
  options: RegressionRunOptions,
) => Promise<RegressionRunResult>;

export interface CanaryDeps {
  readonly runRegression?: RunRegressionFn;
  readonly now?: () => Date;
}

export interface CanaryOptions {
  readonly thresholdPercentagePoints?: number;
  readonly reportDir?: string;
  readonly fixturesRoot?: string;
}

export interface CanaryFamilyOutcome {
  readonly family: string;
  readonly passRate: number;
  readonly previousPassRate: number | null;
  readonly delta: number | null;
  readonly flaggedStale: boolean;
  readonly reason: 'regression' | 'current_failure' | null;
  readonly enqueuedJobId: string | null;
}

export interface CanaryResult {
  readonly generatedAt: Date;
  readonly reportPath: string;
  readonly baselinePath: string | null;
  readonly families: readonly CanaryFamilyOutcome[];
  readonly enqueuedCount: number;
  readonly regressionExitCode: number;
}

export async function runCanary(
  options: CanaryOptions = {},
  deps: CanaryDeps = {},
): Promise<CanaryResult> {
  const now = deps.now ? deps.now() : new Date();
  const runner = deps.runRegression ?? runRegression;

  const regression = await runner({
    fixturesRoot: options.fixturesRoot,
    now,
    reportDir: options.reportDir ?? CANARY_DEFAULT_REPORT_DIR,
    thresholdPercentagePoints: options.thresholdPercentagePoints,
  });

  const comparisonByFamily = new Map<string, RegressionComparison>();
  for (const comparison of regression.comparisons) {
    comparisonByFamily.set(comparison.family, comparison);
  }

  const outcomes: CanaryFamilyOutcome[] = [];
  for (const result of regression.results) {
    const comparison = comparisonByFamily.get(result.family) ?? null;
    const reason = classifyReason(result, comparison);
    const enqueuedJobId = reason
      ? await enqueueRetrainJob({
          family: result.family,
          now,
          payload: buildPayload(result, comparison, reason),
        })
      : null;

    outcomes.push({
      delta: comparison?.delta ?? null,
      enqueuedJobId,
      family: result.family,
      flaggedStale: Boolean(reason),
      passRate: result.passRate,
      previousPassRate: comparison?.previousPassRate ?? null,
      reason,
    });
  }

  return {
    baselinePath: regression.baselinePath,
    enqueuedCount: outcomes.filter(o => o.enqueuedJobId).length,
    families: outcomes,
    generatedAt: now,
    regressionExitCode: regression.exitCode,
    reportPath: regression.reportPath,
  };
}

function classifyReason(
  result: RegressionFamilyResult,
  comparison: RegressionComparison | null,
): CanaryFamilyOutcome['reason'] {
  if (comparison?.regressed) return 'regression';
  if (result.passRate < 100) return 'current_failure';
  return null;
}

function buildPayload(
  result: RegressionFamilyResult,
  comparison: RegressionComparison | null,
  reason: NonNullable<CanaryFamilyOutcome['reason']>,
): Record<string, unknown> {
  return {
    confirmationMatched: result.confirmationMatched,
    currentPassRate: result.passRate,
    delta: comparison?.delta ?? null,
    family: result.family,
    fixturePassed: result.fixturePassed,
    notes: result.notes,
    previousPassRate: comparison?.previousPassRate ?? null,
    reason,
    replayVerdict: result.replayVerdict,
    thresholdPercentagePoints:
      comparison?.thresholdPercentagePoints ?? null,
  };
}

async function enqueueRetrainJob(input: {
  family: string;
  now: Date;
  payload: Record<string, unknown>;
}): Promise<string> {
  const isoWeek = weekStampFor(input.now);
  const deduplicationKey = `${CANARY_DEDUP_PREFIX}${input.family}:${isoWeek}`;

  // The weekly cron must not stack duplicate retrain jobs on re-runs.
  // Dedup is enforced by (type, deduplicationKey); we look up first
  // because the JobQueueItem schema does not declare a unique index on
  // that pair, and adding one is out of scope for P14.1.
  const existing = await db.jobQueueItem.findFirst({
    select: { id: true },
    where: {
      deduplicationKey,
      type: CANARY_RETRAIN_JOB_TYPE,
    },
  });
  if (existing) return existing.id;

  const created = await db.jobQueueItem.create({
    data: {
      deduplicationKey,
      payload: input.payload as object,
      priority: 10,
      processAfter: input.now,
      status: 'PENDING',
      type: CANARY_RETRAIN_JOB_TYPE,
    },
    select: { id: true },
  });
  return created.id;
}

function weekStampFor(date: Date): string {
  // ISO week string: "2026-W17". Lets the dedup key collapse multiple
  // runs within the same week without needing exact timestamps.
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNumber = (target.getUTCDay() + 6) % 7; // Monday = 0
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = target.getTime() - firstThursday.getTime();
  const weekNumber =
    1 + Math.round(diff / (7 * 24 * 3600 * 1000));
  return `${target.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

// Exported for tests.
export const internals = {
  buildPayload,
  classifyReason,
  weekStampFor,
  absReportDir: (dir: string) => path.resolve(dir),
};
