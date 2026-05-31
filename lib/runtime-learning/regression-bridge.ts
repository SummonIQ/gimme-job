import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { parseRegressionSummary } from '@/lib/evaluation/regression-reporter';

import {
  type RegressionHarnessOutcome,
  registerRegressionHarnessRunner,
} from './promotion-gate';

export interface RegressionBridgeOptions {
  /** Directory containing regression-<date>.md reports. Defaults to docs/. */
  readonly reportDir?: string;
  /**
   * How fresh the regression report must be (ms) for the gate to consider its
   * verdict authoritative. Older reports are treated as missing — the gate
   * will block instead of approving on stale data. Defaults to 7 days.
   */
  readonly maxReportAgeMs?: number;
  /**
   * Pass rate (0-100) below which the family is considered failing. Defaults
   * to 95 (matches the synthetic-burst threshold from FINAL_PLAN §13.1).
   */
  readonly minPassRatePercent?: number;
  readonly now?: Date;
}

const DEFAULT_REPORT_DIR = 'docs';
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_MIN_PASS_RATE = 95;
const REPORT_FILENAME_PATTERN = /^regression-(\d{4}-\d{2}-\d{2})\.md$/;

/**
 * Reads the most recent regression report from disk and reports per-family
 * pass rates as the harness outcome the promotion gate wants. Designed to be
 * cheap (one fs read) so it can run inline on every promotion attempt.
 *
 * Returning `null` for a family means "no recent passing data" — the gate
 * treats that as a blocker.
 */
export async function readRegressionHarnessOutcome(
  family: string,
  options: RegressionBridgeOptions = {},
): Promise<RegressionHarnessOutcome | null> {
  const reportDir = path.resolve(options.reportDir ?? DEFAULT_REPORT_DIR);
  const minPassRate = options.minPassRatePercent ?? DEFAULT_MIN_PASS_RATE;
  const maxAgeMs = options.maxReportAgeMs ?? DEFAULT_MAX_AGE_MS;
  const now = options.now ?? new Date();

  let entries: readonly string[];
  try {
    entries = await readdir(reportDir);
  } catch {
    return null;
  }

  const reports = entries
    .map(entry => {
      const match = entry.match(REPORT_FILENAME_PATTERN);
      if (!match) return null;
      return { entry, dateStamp: match[1]! };
    })
    .filter((value): value is { entry: string; dateStamp: string } => !!value)
    .sort((a, b) => b.dateStamp.localeCompare(a.dateStamp));

  if (reports.length === 0) return null;

  const newest = reports[0]!;
  const reportDate = new Date(`${newest.dateStamp}T00:00:00.000Z`);
  if (now.getTime() - reportDate.getTime() > maxAgeMs) {
    return {
      passed: false,
      summary: `Most recent regression report (${newest.entry}) is older than the freshness window of ${Math.round(maxAgeMs / (24 * 60 * 60 * 1000))}d.`,
    };
  }

  let markdown: string;
  try {
    markdown = await readFile(path.join(reportDir, newest.entry), 'utf8');
  } catch {
    return null;
  }

  const summary = parseRegressionSummary(markdown);
  if (!summary) return null;

  const passRate = summary[family];
  if (typeof passRate !== 'number') {
    return {
      passed: false,
      summary: `${newest.entry} contains no row for family "${family}".`,
    };
  }

  return {
    passed: passRate >= minPassRate,
    summary: `${family} pass rate ${passRate.toFixed(1)}% (threshold ${minPassRate}%) per ${newest.entry}`,
  };
}

let registered = false;

/**
 * Registers the regression-report-backed harness runner with the promotion
 * gate. Call once during app/process startup. Idempotent.
 */
export function activateRegressionBridge(
  options: RegressionBridgeOptions = {},
): void {
  if (registered) return;
  registerRegressionHarnessRunner(family =>
    readRegressionHarnessOutcome(family, options),
  );
  registered = true;
}

/** Test-only: re-arm the bridge so it can be activated again. */
export function deactivateRegressionBridge(): void {
  registered = false;
}
