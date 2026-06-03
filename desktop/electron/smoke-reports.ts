import fs from 'node:fs/promises';
import path from 'node:path';

import type { DesktopRuntimeProviderInfo } from './ipc.js';
import type {
  DesktopSmokeTestRequest,
  DesktopSmokeTestRun,
} from './submit/ipc.js';

export interface DesktopSmokeReportSummary {
  readonly filePath: string;
  readonly runtimeProviderId: string;
  readonly runtimeProviderLabel: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly totalDurationMs: number;
  readonly requested: number;
  readonly completed: number;
  readonly failed: number;
  readonly skipped: number;
}

export interface DesktopSmokeReportFull extends DesktopSmokeReportSummary {
  readonly request: DesktopSmokeTestRequest;
  readonly runLogsDirectory: string;
  readonly runtimeProvider: DesktopRuntimeProviderInfo;
  readonly runs: readonly DesktopSmokeTestRun[];
}

interface SmokeReportFile {
  readonly endedAt?: unknown;
  readonly request?: unknown;
  readonly runs?: unknown;
  readonly runtimeProvider?: unknown;
  readonly startedAt?: unknown;
  readonly summary?: unknown;
}

export async function listSmokeReports(input: {
  readonly smokeReportsDir: string;
}): Promise<readonly DesktopSmokeReportSummary[]> {
  let entries;
  try {
    entries = await fs.readdir(input.smokeReportsDir, {
      withFileTypes: true,
    });
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return [];
    throw error;
  }

  const summaries = await Promise.all(
    entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
      .map(async entry => {
        const filePath = path.join(input.smokeReportsDir, entry.name);
        try {
          return normalizeSmokeReport(filePath, await readJsonFile(filePath));
        } catch {
          return null;
        }
      }),
  );

  return summaries
    .filter((summary): summary is DesktopSmokeReportFull => Boolean(summary))
    .map(toSmokeReportSummary)
    .sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
}

export async function readSmokeReport(input: {
  readonly filePath: string;
  readonly runLogsDir: string;
  readonly smokeReportsDir: string;
}): Promise<DesktopSmokeReportFull> {
  if (!isPathInsideDirectory(input.smokeReportsDir, input.filePath)) {
    throw new Error('Smoke report path must live inside the smoke-tests directory.');
  }

  const report = normalizeSmokeReport(
    input.filePath,
    await readJsonFile(input.filePath),
  );
  if (!report) {
    throw new Error('Smoke report is not a valid report JSON file.');
  }

  return {
    ...report,
    runLogsDirectory: input.runLogsDir,
  };
}

export function isPathInsideDirectory(baseDir: string, filePath: string) {
  const resolvedBase = path.resolve(baseDir);
  const resolvedFile = path.resolve(filePath);
  const relative = path.relative(resolvedBase, resolvedFile);
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function readJsonFile(filePath: string): Promise<SmokeReportFile> {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as SmokeReportFile;
}

function normalizeSmokeReport(
  filePath: string,
  value: SmokeReportFile,
): DesktopSmokeReportFull | null {
  const runtimeProvider = normalizeRuntimeProvider(value.runtimeProvider);
  const summary = normalizeSummary(value.summary);
  const request = normalizeRequest(value.request);
  const runs = normalizeRuns(value.runs);
  const startedAt = stringValue(value.startedAt);
  const endedAt = stringValue(value.endedAt);

  if (!runtimeProvider || !summary || !request || !startedAt || !endedAt) {
    return null;
  }

  return {
    completed: summary.completed,
    endedAt,
    failed: summary.failed,
    filePath,
    requested: summary.requested,
    request,
    runLogsDirectory: '',
    runs,
    runtimeProvider,
    runtimeProviderId: runtimeProvider.id,
    runtimeProviderLabel: runtimeProvider.label,
    skipped: summary.skipped,
    startedAt,
    totalDurationMs: summary.totalDurationMs,
  };
}

function normalizeRuntimeProvider(
  value: unknown,
): DesktopRuntimeProviderInfo | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const label = stringValue(value.label);
  const readiness = stringValue(value.readiness);
  if (!id || !label || !isRuntimeReadiness(readiness)) return null;
  return {
    id,
    label,
    readiness,
    runner: stringValue(value.runner),
  };
}

function normalizeSummary(value: unknown) {
  if (!isRecord(value)) return null;
  const completed = numberValue(value.completed);
  const failed = numberValue(value.failed);
  const requested = numberValue(value.requested);
  const skipped = numberValue(value.skipped);
  const totalDurationMs = numberValue(value.totalDurationMs);
  if (
    completed === null ||
    failed === null ||
    requested === null ||
    skipped === null ||
    totalDurationMs === null
  ) {
    return null;
  }
  return { completed, failed, requested, skipped, totalDurationMs };
}

function normalizeRequest(value: unknown): DesktopSmokeTestRequest | null {
  if (!isRecord(value)) return null;
  const runtimeProviderId = stringValue(value.runtimeProviderId);
  const count = numberValue(value.count);
  if (!runtimeProviderId || count === null) return null;
  return {
    count,
    excludeCompanies: stringArrayValue(value.excludeCompanies),
    excludeListingIds: stringArrayValue(value.excludeListingIds),
    runtimeProviderId,
  };
}

function normalizeRuns(value: unknown): readonly DesktopSmokeTestRun[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((run, index) => ({
    applicationUrl: stringValue(run.applicationUrl) ?? '',
    company: stringValue(run.company),
    durationMs: numberValue(run.durationMs) ?? 0,
    errorTool: stringValue(run.errorTool) ?? undefined,
    errorToolMessage: stringValue(run.errorToolMessage) ?? undefined,
    index: numberValue(run.index) ?? index,
    message: stringValue(run.message) ?? undefined,
    status: stringValue(run.status) as DesktopSmokeTestRun['status'],
    title: stringValue(run.title),
    toolCallCount: numberValue(run.toolCallCount),
  }));
}

function toSmokeReportSummary(
  report: DesktopSmokeReportFull,
): DesktopSmokeReportSummary {
  return {
    completed: report.completed,
    endedAt: report.endedAt,
    failed: report.failed,
    filePath: report.filePath,
    requested: report.requested,
    runtimeProviderId: report.runtimeProviderId,
    runtimeProviderLabel: report.runtimeProviderLabel,
    skipped: report.skipped,
    startedAt: report.startedAt,
    totalDurationMs: report.totalDurationMs,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringArrayValue(value: unknown): readonly string[] | undefined {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : undefined;
}

function isRuntimeReadiness(
  value: string | null,
): value is DesktopRuntimeProviderInfo['readiness'] {
  return (
    value === 'production' ||
    value === 'beta' ||
    value === 'manual_review' ||
    value === 'unsupported'
  );
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
