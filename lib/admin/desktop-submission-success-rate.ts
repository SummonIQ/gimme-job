import type { Prisma } from '@/generated/prisma/client';
import {
  getRuntimeProviderForUrl,
  type RuntimeProviderReadiness,
} from '@/lib/runtime-provider/registry';

export interface DesktopSubmissionSuccessRateRow {
  readonly createdAt: Date;
  readonly failureReason: string | null;
  readonly id: string;
  readonly metadata: Prisma.JsonValue | null;
  readonly status: string;
  readonly submissionUrl: string | null;
}

export interface DesktopSubmissionProviderSummary {
  readonly failureCount: number;
  readonly providerId: string;
  readonly providerLabel: string;
  readonly readiness: RuntimeProviderReadiness;
  readonly runCount: number;
  readonly successCount: number;
  readonly successRate: number;
  readonly topFailureReason: string | null;
}

export interface DesktopSubmissionFailureGroup {
  readonly failureReason: string;
  readonly providerId: string;
  readonly providerLabel: string;
  readonly readiness: RuntimeProviderReadiness;
  readonly runCount: number;
  readonly runMode: string;
}

export interface DesktopSubmissionReadinessSummary {
  readonly failureCount: number;
  readonly readiness: RuntimeProviderReadiness;
  readonly runCount: number;
  readonly successCount: number;
  readonly successRate: number;
}

export interface DesktopSubmissionSuccessRateReport {
  readonly failureGroups: readonly DesktopSubmissionFailureGroup[];
  readonly generatedAt: Date;
  readonly providerSummaries: readonly DesktopSubmissionProviderSummary[];
  readonly readinessSummaries: readonly DesktopSubmissionReadinessSummary[];
  readonly totals: DesktopSubmissionReadinessSummary;
  readonly windowDays: number;
}

interface MutableSummary {
  failureCount: number;
  failuresByReason: Map<string, number>;
  providerId: string;
  providerLabel: string;
  readiness: RuntimeProviderReadiness;
  runCount: number;
  successCount: number;
}

export function buildDesktopSubmissionSuccessRateReport(input: {
  readonly generatedAt?: Date;
  readonly rows: readonly DesktopSubmissionSuccessRateRow[];
  readonly windowDays: number;
}): DesktopSubmissionSuccessRateReport {
  const generatedAt = input.generatedAt ?? new Date();
  const providers = new Map<string, MutableSummary>();
  const readiness = new Map<RuntimeProviderReadiness, MutableSummary>();
  const failureGroups = new Map<string, DesktopSubmissionFailureGroup>();
  const totals = createMutableSummary({
    providerId: 'all',
    providerLabel: 'All providers',
    readiness: 'production',
  });

  for (const row of input.rows) {
    const provider = getRuntimeProviderForUrl(row.submissionUrl ?? '');
    const providerSummary =
      providers.get(provider.id) ??
      createMutableSummary({
        providerId: provider.id,
        providerLabel: provider.label,
        readiness: provider.readiness,
      });
    providers.set(provider.id, providerSummary);

    const readinessSummary =
      readiness.get(provider.readiness) ??
      createMutableSummary({
        providerId: provider.readiness,
        providerLabel: provider.readiness,
        readiness: provider.readiness,
      });
    readiness.set(provider.readiness, readinessSummary);

    const runMode = readDesktopRunMode(row.metadata);
    const success = isSuccessfulSubmission(row);
    const failureReason = success ? null : readFailureReason(row);

    addRun(providerSummary, success, failureReason);
    addRun(readinessSummary, success, failureReason);
    addRun(totals, success, failureReason);

    if (failureReason) {
      const key = `${provider.id}\u0000${runMode}\u0000${failureReason}`;
      const existing = failureGroups.get(key);
      failureGroups.set(key, {
        failureReason,
        providerId: provider.id,
        providerLabel: provider.label,
        readiness: provider.readiness,
        runCount: (existing?.runCount ?? 0) + 1,
        runMode,
      });
    }
  }

  return {
    failureGroups: [...failureGroups.values()].sort(compareFailureGroups),
    generatedAt,
    providerSummaries: [...providers.values()]
      .map(toProviderSummary)
      .sort(compareProviderSummaries),
    readinessSummaries: [...readiness.values()]
      .map(toReadinessSummary)
      .sort(compareReadinessSummaries),
    totals: toReadinessSummary(totals),
    windowDays: input.windowDays,
  };
}

function createMutableSummary(input: {
  readonly providerId: string;
  readonly providerLabel: string;
  readonly readiness: RuntimeProviderReadiness;
}): MutableSummary {
  return {
    failureCount: 0,
    failuresByReason: new Map(),
    providerId: input.providerId,
    providerLabel: input.providerLabel,
    readiness: input.readiness,
    runCount: 0,
    successCount: 0,
  };
}

function addRun(
  summary: MutableSummary,
  success: boolean,
  failureReason: string | null,
): void {
  summary.runCount += 1;
  if (success) {
    summary.successCount += 1;
    return;
  }

  summary.failureCount += 1;
  const reason = failureReason ?? 'unknown';
  summary.failuresByReason.set(
    reason,
    (summary.failuresByReason.get(reason) ?? 0) + 1,
  );
}

function toProviderSummary(
  summary: MutableSummary,
): DesktopSubmissionProviderSummary {
  return {
    failureCount: summary.failureCount,
    providerId: summary.providerId,
    providerLabel: summary.providerLabel,
    readiness: summary.readiness,
    runCount: summary.runCount,
    successCount: summary.successCount,
    successRate: calculateRate(summary.successCount, summary.runCount),
    topFailureReason: readTopFailureReason(summary.failuresByReason),
  };
}

function toReadinessSummary(
  summary: MutableSummary,
): DesktopSubmissionReadinessSummary {
  return {
    failureCount: summary.failureCount,
    readiness: summary.readiness,
    runCount: summary.runCount,
    successCount: summary.successCount,
    successRate: calculateRate(summary.successCount, summary.runCount),
  };
}

function isSuccessfulSubmission(row: DesktopSubmissionSuccessRateRow): boolean {
  return (
    row.status === 'SUBMITTED' || readDesktopStatus(row.metadata) === 'completed'
  );
}

function readFailureReason(row: DesktopSubmissionSuccessRateRow): string {
  return (
    row.failureReason ??
    readDesktopStatus(row.metadata) ??
    (row.status === 'FAILED' ? 'failed' : row.status.toLowerCase())
  );
}

function readDesktopRunMode(metadata: Prisma.JsonValue | null): string {
  const desktop = readDesktopMetadata(metadata);
  return typeof desktop?.mode === 'string' ? desktop.mode : 'unknown';
}

function readDesktopStatus(metadata: Prisma.JsonValue | null): string | null {
  const desktop = readDesktopMetadata(metadata);
  return typeof desktop?.status === 'string' ? desktop.status : null;
}

function readDesktopMetadata(
  metadata: Prisma.JsonValue | null,
): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }
  const desktop = (metadata as Record<string, unknown>).desktop;
  return desktop && typeof desktop === 'object' && !Array.isArray(desktop)
    ? (desktop as Record<string, unknown>)
    : null;
}

function calculateRate(successCount: number, runCount: number): number {
  return runCount === 0 ? 0 : successCount / runCount;
}

function readTopFailureReason(
  failures: ReadonlyMap<string, number>,
): string | null {
  let top: { count: number; reason: string } | null = null;
  for (const [reason, count] of failures) {
    if (
      !top ||
      count > top.count ||
      (count === top.count && reason < top.reason)
    ) {
      top = { count, reason };
    }
  }
  return top?.reason ?? null;
}

function compareProviderSummaries(
  first: DesktopSubmissionProviderSummary,
  second: DesktopSubmissionProviderSummary,
): number {
  return (
    readinessRank(first.readiness) - readinessRank(second.readiness) ||
    second.runCount - first.runCount ||
    first.providerLabel.localeCompare(second.providerLabel)
  );
}

function compareReadinessSummaries(
  first: DesktopSubmissionReadinessSummary,
  second: DesktopSubmissionReadinessSummary,
): number {
  return readinessRank(first.readiness) - readinessRank(second.readiness);
}

function compareFailureGroups(
  first: DesktopSubmissionFailureGroup,
  second: DesktopSubmissionFailureGroup,
): number {
  return (
    readinessRank(first.readiness) - readinessRank(second.readiness) ||
    second.runCount - first.runCount ||
    first.providerLabel.localeCompare(second.providerLabel) ||
    first.runMode.localeCompare(second.runMode) ||
    first.failureReason.localeCompare(second.failureReason)
  );
}

function readinessRank(readiness: RuntimeProviderReadiness): number {
  switch (readiness) {
    case 'production':
      return 0;
    case 'beta':
      return 1;
    case 'manual_review':
      return 2;
    case 'unsupported':
      return 3;
  }
}
