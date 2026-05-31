import type { ReplayVerdict } from './replay-harness';

export interface RegressionFamilyResult {
  readonly family: string;
  readonly passedChecks: number;
  readonly totalChecks: number;
  readonly passRate: number;
  readonly replayVerdict: ReplayVerdict;
  readonly fixturePassed: boolean;
  readonly confirmationMatched: boolean;
  readonly notes: readonly string[];
}

export interface RegressionComparison {
  readonly family: string;
  readonly currentPassRate: number;
  readonly previousPassRate: number | null;
  readonly delta: number | null;
  readonly thresholdPercentagePoints: number;
  readonly regressed: boolean;
}

export interface RegressionReportInput {
  readonly generatedAt: Date;
  readonly results: readonly RegressionFamilyResult[];
  readonly comparisons?: readonly RegressionComparison[];
  readonly baselinePath?: string | null;
  readonly thresholdPercentagePoints?: number;
}

const SUMMARY_PREFIX = 'p7.3-regression-summary:';

export function calculatePassRate(passedChecks: number, totalChecks: number) {
  if (totalChecks <= 0) return 0;
  return roundPercent((passedChecks / totalChecks) * 100);
}

export function compareRegressionResults(
  results: readonly RegressionFamilyResult[],
  previousPassRates: Readonly<Record<string, number>> | null,
  thresholdPercentagePoints = 5,
): RegressionComparison[] {
  return results.map(result => {
    const previous = previousPassRates?.[result.family] ?? null;
    const delta = previous === null ? null : roundPercent(result.passRate - previous);
    return {
      currentPassRate: result.passRate,
      delta,
      family: result.family,
      previousPassRate: previous,
      regressed:
        previous !== null &&
        previous - result.passRate > thresholdPercentagePoints,
      thresholdPercentagePoints,
    };
  });
}

export function hasCurrentFailures(
  results: readonly RegressionFamilyResult[],
): boolean {
  return results.some(result => result.passRate < 100);
}

export function hasRegression(
  comparisons: readonly RegressionComparison[],
): boolean {
  return comparisons.some(comparison => comparison.regressed);
}

export function buildRegressionReport(input: RegressionReportInput): string {
  const threshold = input.thresholdPercentagePoints ?? 5;
  const comparisons =
    input.comparisons ??
    compareRegressionResults(input.results, null, threshold);
  const comparisonByFamily = new Map(
    comparisons.map(comparison => [comparison.family, comparison]),
  );
  const summary = Object.fromEntries(
    input.results.map(result => [result.family, result.passRate]),
  );
  const status = hasCurrentFailures(input.results) || hasRegression(comparisons)
    ? 'FAIL'
    : 'PASS';

  const lines: string[] = [
    `<!-- ${SUMMARY_PREFIX} ${JSON.stringify(summary)} -->`,
    '',
    `# Regression Report - ${formatDate(input.generatedAt)}`,
    '',
    `Status: ${status}`,
    `Baseline: ${input.baselinePath ?? 'none'}`,
    `Regression threshold: ${threshold} percentage points`,
    '',
    '| Family | Pass Rate | Previous | Delta | Status | Replay | Fixture | Confirmation | Notes |',
    '| --- | ---: | ---: | ---: | --- | --- | --- | --- | --- |',
  ];

  for (const result of input.results) {
    const comparison = comparisonByFamily.get(result.family);
    const rowStatus =
      result.passRate < 100 || comparison?.regressed ? 'FAIL' : 'PASS';
    const cells = [
        result.family,
        formatPercent(result.passRate),
        comparison?.previousPassRate === null ||
        comparison?.previousPassRate === undefined
          ? 'n/a'
          : formatPercent(comparison.previousPassRate),
        comparison?.delta === null || comparison?.delta === undefined
          ? 'n/a'
          : formatSignedPercent(comparison.delta),
        rowStatus,
        result.replayVerdict,
        result.fixturePassed ? 'pass' : 'fail',
        result.confirmationMatched ? 'pass' : 'fail',
        result.notes.length > 0 ? result.notes.join('; ') : '-',
      ];
    lines.push(`| ${cells.join(' | ')} |`);
  }

  lines.push('', '## Regression Details', '');
  for (const comparison of comparisons) {
    if (!comparison.regressed) continue;
    lines.push(
      `- ${comparison.family} dropped from ${formatPercent(
        comparison.previousPassRate ?? 0,
      )} to ${formatPercent(comparison.currentPassRate)}.`,
    );
  }
  if (!comparisons.some(comparison => comparison.regressed)) {
    lines.push('- No family dropped beyond the configured threshold.');
  }

  lines.push('');
  return `${lines.join('\n')}\n`;
}

export function parseRegressionSummary(
  markdown: string,
): Record<string, number> | null {
  const line = markdown
    .split('\n')
    .find(candidate => candidate.includes(SUMMARY_PREFIX));
  if (!line) return null;

  const jsonStart = line.indexOf(SUMMARY_PREFIX) + SUMMARY_PREFIX.length;
  const json = line
    .slice(jsonStart)
    .replace('-->', '')
    .trim();
  if (!json) return null;

  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const summary: Record<string, number> = {};
    for (const [family, value] of Object.entries(parsed)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        summary[family] = value;
      }
    }
    return summary;
  } catch {
    return null;
  }
}

function roundPercent(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatSignedPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatPercent(value)}`;
}
