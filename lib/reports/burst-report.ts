/**
 * P13.2 — burst report generator.
 *
 * Pure: takes a run log produced by the P13.1 burst runner (desktop) and
 * renders a per-run markdown dashboard covering throughput, failure
 * breakdown, per-step latency, and cost total. Callers write the
 * returned string to `docs/synthetic-burst-<date>.md`.
 *
 * The log shape is defined here so the desktop runner (Phase 13.1) has a
 * concrete contract to hit. Keep additive — new optional fields only.
 */

export type BurstItemOutcome = 'SUBMITTED' | 'FAILED' | 'SKIPPED';

export interface BurstItem {
  readonly leadId: string;
  readonly hostname: string;
  readonly family?: string | null;
  readonly outcome: BurstItemOutcome;
  readonly startedAt: string;
  readonly finishedAt: string;
  /** Per-step latency breakdown. Optional — omit if the runner didn't collect. */
  readonly steps?: ReadonlyArray<{
    readonly label: string;
    readonly durationMs: number;
  }>;
  /** Failure reason code when outcome is FAILED or SKIPPED. */
  readonly errorCode?: string | null;
  readonly errorMessage?: string | null;
  /** Token + dollar spend attributable to this lead. Both optional. */
  readonly tokensSpent?: number;
  readonly dollarsSpent?: number;
}

export interface BurstRunLog {
  readonly runId: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly mode: 'TARGETED' | 'GENERIC' | 'FIRE_AND_FORGET';
  readonly items: readonly BurstItem[];
  /** Optional free-form context (e.g. burst name, operator). */
  readonly metadata?: Record<string, unknown>;
}

export interface BurstReportMetrics {
  readonly total: number;
  readonly submitted: number;
  readonly failed: number;
  readonly skipped: number;
  readonly durationMs: number;
  readonly submitsPerMinute: number;
  readonly p50LatencyMs: number | null;
  readonly p95LatencyMs: number | null;
  readonly tokensSpent: number;
  readonly dollarsSpent: number;
  readonly failureReasons: Readonly<Record<string, number>>;
  readonly perFamily: Readonly<
    Record<string, { submitted: number; failed: number; skipped: number }>
  >;
}

function parseDate(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date string in run log: ${value}`);
  }
  return d;
}

function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );
  return sorted[Math.max(0, rank)];
}

/**
 * Pure — compute rollup metrics from a run log. Exposed separately from
 * `renderBurstReport` so callers who want JSON can skip markdown.
 */
export function computeBurstMetrics(log: BurstRunLog): BurstReportMetrics {
  const started = parseDate(log.startedAt);
  const finished = parseDate(log.finishedAt);
  const durationMs = Math.max(0, finished.getTime() - started.getTime());

  const submitted = log.items.filter(i => i.outcome === 'SUBMITTED').length;
  const failed = log.items.filter(i => i.outcome === 'FAILED').length;
  const skipped = log.items.filter(i => i.outcome === 'SKIPPED').length;
  const total = log.items.length;

  const submitsPerMinute =
    durationMs > 0 ? (submitted / durationMs) * 60_000 : 0;

  const latencies = log.items
    .map(i => parseDate(i.finishedAt).getTime() - parseDate(i.startedAt).getTime())
    .filter(d => d > 0);

  const p50LatencyMs = percentile(latencies, 50);
  const p95LatencyMs = percentile(latencies, 95);

  const tokensSpent = log.items.reduce(
    (sum, i) => sum + (i.tokensSpent ?? 0),
    0,
  );
  const dollarsSpent = log.items.reduce(
    (sum, i) => sum + (i.dollarsSpent ?? 0),
    0,
  );

  const failureReasons: Record<string, number> = {};
  for (const item of log.items) {
    if (item.outcome === 'FAILED' || item.outcome === 'SKIPPED') {
      const key = item.errorCode ?? 'UNKNOWN';
      failureReasons[key] = (failureReasons[key] ?? 0) + 1;
    }
  }

  const perFamily: Record<
    string,
    { submitted: number; failed: number; skipped: number }
  > = {};
  for (const item of log.items) {
    const key = item.family ?? 'unknown';
    const bucket =
      perFamily[key] ?? { failed: 0, skipped: 0, submitted: 0 };
    if (item.outcome === 'SUBMITTED') bucket.submitted += 1;
    if (item.outcome === 'FAILED') bucket.failed += 1;
    if (item.outcome === 'SKIPPED') bucket.skipped += 1;
    perFamily[key] = bucket;
  }

  return {
    dollarsSpent,
    durationMs,
    failed,
    failureReasons,
    p50LatencyMs,
    p95LatencyMs,
    perFamily,
    skipped,
    submitsPerMinute,
    submitted,
    tokensSpent,
    total,
  };
}

function formatNumber(value: number, decimals = 0): string {
  return value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes.toFixed(1)}m`;
  const hours = minutes / 60;
  return `${hours.toFixed(2)}h`;
}

function formatDollars(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function asciiBar(value: number, max: number, width = 20): string {
  if (max <= 0) return '─'.repeat(width);
  const filled = Math.round((value / max) * width);
  return '█'.repeat(Math.max(0, Math.min(width, filled))) +
    '░'.repeat(Math.max(0, width - filled));
}

export function renderBurstReport(log: BurstRunLog): string {
  const metrics = computeBurstMetrics(log);
  const successRate =
    metrics.total > 0 ? (metrics.submitted / metrics.total) * 100 : 0;

  const familyRows = Object.entries(metrics.perFamily)
    .sort((a, b) => (b[1].submitted + b[1].failed) - (a[1].submitted + a[1].failed))
    .map(([family, counts]) => {
      const totalForFamily = counts.submitted + counts.failed + counts.skipped;
      const bar = asciiBar(counts.submitted, metrics.total);
      return `| ${family} | ${counts.submitted} | ${counts.failed} | ${counts.skipped} | ${totalForFamily} | \`${bar}\` |`;
    });

  const failureRows = Object.entries(metrics.failureReasons)
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => `| \`${code}\` | ${count} |`);

  const metadata = log.metadata
    ? Object.entries(log.metadata)
        .map(([k, v]) => `- **${k}**: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
        .join('\n')
    : '';

  return [
    `# Burst report — ${log.runId}`,
    '',
    `- **Mode**: \`${log.mode}\``,
    `- **Started**: ${log.startedAt}`,
    `- **Finished**: ${log.finishedAt}`,
    `- **Duration**: ${formatDuration(metrics.durationMs)}`,
    metadata ? `\n${metadata}` : '',
    '',
    '## Headline',
    '',
    `- **Submitted**: ${formatNumber(metrics.submitted)} / ${formatNumber(metrics.total)} (${successRate.toFixed(1)}%)`,
    `- **Failed**: ${formatNumber(metrics.failed)}`,
    `- **Skipped**: ${formatNumber(metrics.skipped)}`,
    `- **Throughput**: ${metrics.submitsPerMinute.toFixed(2)} submits/min`,
    metrics.p50LatencyMs !== null
      ? `- **Latency**: p50 ${formatDuration(metrics.p50LatencyMs)} · p95 ${formatDuration(metrics.p95LatencyMs ?? 0)}`
      : `- **Latency**: n/a (no timings recorded)`,
    `- **Cost**: ${formatNumber(metrics.tokensSpent)} tokens · ${formatDollars(metrics.dollarsSpent)}`,
    '',
    '## Per-ATS family',
    '',
    '| Family | Submitted | Failed | Skipped | Total | Throughput |',
    '|---|---:|---:|---:|---:|:---|',
    ...(familyRows.length > 0
      ? familyRows
      : ['| _none_ | 0 | 0 | 0 | 0 | |']),
    '',
    '## Failure breakdown',
    '',
    failureRows.length > 0
      ? '| Reason code | Count |\n|---|---:|\n' + failureRows.join('\n')
      : '_No failures._',
    '',
  ].join('\n');
}

/**
 * Derive the `docs/synthetic-burst-<date>.md` filename from a run log's
 * startedAt. Uses UTC so filenames are stable across agents.
 */
export function reportFilename(log: BurstRunLog): string {
  const d = parseDate(log.startedAt);
  const iso = d.toISOString().slice(0, 10); // YYYY-MM-DD
  return `docs/synthetic-burst-${iso}.md`;
}
