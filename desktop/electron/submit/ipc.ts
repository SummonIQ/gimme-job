import type { DesktopAgentMode } from '../agent/types.js';
import type { DesktopIpcMain } from '../ipc.js';
import type {
  DesktopGreenhouseLeadSearchQuery,
  DesktopRandomGreenhouseLead,
} from './client.js';
import type {
  DesktopSubmitLeadRequest,
  DesktopSubmitLeadResult,
} from './greenhouse-submit.js';

export const DESKTOP_SUBMIT_IPC_CHANNELS = {
  cancelRun: 'desktop-submit:cancel-run',
  pickRandomGreenhouseLead: 'desktop-submit:pick-random-greenhouse-lead',
  recordManualSubmit: 'desktop-submit:record-manual-submit',
  runLead: 'desktop-submit:run-lead',
  runSmokeTest: 'desktop-submit:run-smoke-test',
  cancelSmokeTest: 'desktop-submit:cancel-smoke-test',
  swapAssistResumeFile: 'desktop-submit:swap-assist-resume-file',
  tailorResumeForLead: 'desktop-submit:tailor-resume-for-lead',
} as const;

export const DESKTOP_SUBMIT_IPC_EVENTS = {
  smokeProgress: 'desktop-submit-event:smoke-progress',
} as const;

export interface DesktopSmokeTestRequest {
  readonly runtimeProviderId: string;
  /** 1–20. Capped server-side to avoid runaway test loops. */
  readonly count: number;
  /** Honor recent-exclusion lists so leads don't repeat across consecutive calls. */
  readonly excludeListingIds?: readonly string[];
  readonly excludeCompanies?: readonly string[];
}

export interface DesktopSmokeTestRun {
  readonly index: number;
  readonly applicationUrl: string;
  readonly company: string | null;
  readonly title: string | null;
  readonly status: DesktopSubmitLeadResult['status'] | 'skipped';
  readonly durationMs: number;
  readonly toolCallCount: number | null;
  readonly errorTool?: string;
  readonly errorToolMessage?: string;
  readonly message?: string;
}

export interface DesktopSmokeTestResult {
  readonly runtimeProviderId: string;
  readonly runtimeProviderLabel: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly totalDurationMs: number;
  readonly requested: number;
  readonly completed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly runs: readonly DesktopSmokeTestRun[];
  readonly reportPath: string;
}

export interface DesktopSmokeTestProgressEvent {
  readonly phase: 'picking' | 'running' | 'complete' | 'cancelled' | 'error';
  readonly runtimeProviderId: string;
  readonly index: number;
  readonly total: number;
  readonly applicationUrl?: string;
  readonly message?: string;
}

export interface DesktopTailorResumeRequest {
  readonly leadId: string;
}

export interface DesktopTailorResumeResult {
  readonly diffSummary: unknown;
  readonly emphasizedKeywords: readonly string[];
  readonly formats: {
    readonly docx: string;
    readonly html: string;
    readonly pdf: string;
    readonly txt: string;
  };
  readonly revisionId: string;
  readonly summary: string;
}

export interface DesktopSwapAssistResumeFileRequest {
  readonly fileName: string;
  readonly pdfUrl: string;
}

export interface DesktopSwapAssistResumeFileResult {
  readonly injected: boolean;
  readonly reason?: string;
}

export interface DesktopRecordManualSubmitRequest {
  readonly applicationUrl: string;
  readonly jobLeadId?: string;
  readonly message?: string;
  readonly toolCallCount?: number;
}

export interface DesktopRecordManualSubmitResult {
  readonly jobLeadId: string | null;
  readonly outcome: 'applied' | 'tracked' | 'skipped';
  readonly submissionId: string | null;
}

export interface DesktopSubmitRunner {
  readonly cancelRun: () => Promise<{ readonly cancelled: boolean }>;
  readonly pickRandomGreenhouseLead: (
    request: DesktopGreenhouseLeadSearchQuery,
  ) => Promise<DesktopRandomGreenhouseLead>;
  readonly recordManualSubmit: (
    request: DesktopRecordManualSubmitRequest,
  ) => Promise<DesktopRecordManualSubmitResult>;
  readonly runLead: (
    request: DesktopSubmitLeadRequest,
  ) => Promise<DesktopSubmitLeadResult>;
  readonly runSmokeTest?: (
    request: DesktopSmokeTestRequest,
  ) => Promise<DesktopSmokeTestResult>;
  readonly cancelSmokeTest?: () => Promise<{ readonly cancelled: boolean }>;
  readonly swapAssistResumeFile?: (
    request: DesktopSwapAssistResumeFileRequest,
  ) => Promise<DesktopSwapAssistResumeFileResult>;
  readonly tailorResumeForLead?: (
    request: DesktopTailorResumeRequest,
  ) => Promise<DesktopTailorResumeResult>;
}

export function registerDesktopSubmitIpc(
  ipcMain: DesktopIpcMain,
  runner: DesktopSubmitRunner,
) {
  ipcMain.handle(
    DESKTOP_SUBMIT_IPC_CHANNELS.pickRandomGreenhouseLead,
    (_event, request) =>
      runner.pickRandomGreenhouseLead(
        parseGreenhouseLeadFilterRequest(request),
      ),
  );
  ipcMain.handle(DESKTOP_SUBMIT_IPC_CHANNELS.runLead, (_event, request) =>
    runner.runLead(parseSubmitLeadRequest(request)),
  );
  ipcMain.handle(DESKTOP_SUBMIT_IPC_CHANNELS.cancelRun, () =>
    runner.cancelRun(),
  );
  ipcMain.handle(
    DESKTOP_SUBMIT_IPC_CHANNELS.recordManualSubmit,
    (_event, request) =>
      runner.recordManualSubmit(parseRecordManualSubmitRequest(request)),
  );
  ipcMain.handle(
    DESKTOP_SUBMIT_IPC_CHANNELS.tailorResumeForLead,
    async (_event, request) => {
      if (!runner.tailorResumeForLead) {
        throw new Error('Resume tailoring is not supported in this runtime.');
      }
      return runner.tailorResumeForLead(parseTailorResumeRequest(request));
    },
  );
  ipcMain.handle(
    DESKTOP_SUBMIT_IPC_CHANNELS.swapAssistResumeFile,
    async (_event, request) => {
      if (!runner.swapAssistResumeFile) {
        throw new Error('Resume swap is not supported in this runtime.');
      }
      return runner.swapAssistResumeFile(
        parseSwapAssistResumeFileRequest(request),
      );
    },
  );
  ipcMain.handle(
    DESKTOP_SUBMIT_IPC_CHANNELS.runSmokeTest,
    async (_event, request) => {
      if (!runner.runSmokeTest) {
        throw new Error('Smoke testing is not supported in this runtime.');
      }
      return runner.runSmokeTest(parseSmokeTestRequest(request));
    },
  );
  ipcMain.handle(DESKTOP_SUBMIT_IPC_CHANNELS.cancelSmokeTest, async () => {
    if (!runner.cancelSmokeTest) return { cancelled: false };
    return runner.cancelSmokeTest();
  });
}

function parseSmokeTestRequest(value: unknown): DesktopSmokeTestRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Smoke test request must be an object.');
  }
  const record = value as Record<string, unknown>;
  if (typeof record.runtimeProviderId !== 'string' ||
      !record.runtimeProviderId.trim()) {
    throw new Error('runtimeProviderId is required.');
  }
  const rawCount = record.count;
  const count =
    typeof rawCount === 'number' && Number.isFinite(rawCount)
      ? Math.max(1, Math.min(20, Math.floor(rawCount)))
      : 5;
  const excludeListingIds = Array.isArray(record.excludeListingIds)
    ? record.excludeListingIds
        .filter((id): id is string => typeof id === 'string')
        .map(id => id.trim())
        .filter(Boolean)
    : undefined;
  const excludeCompanies = Array.isArray(record.excludeCompanies)
    ? record.excludeCompanies
        .filter((c): c is string => typeof c === 'string')
        .map(c => c.trim())
        .filter(Boolean)
    : undefined;
  return {
    count,
    excludeCompanies,
    excludeListingIds,
    runtimeProviderId: record.runtimeProviderId.trim().toLowerCase(),
  };
}

function parseTailorResumeRequest(value: unknown): DesktopTailorResumeRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Tailor resume request must be an object.');
  }
  const record = value as Record<string, unknown>;
  if (typeof record.leadId !== 'string' || !record.leadId.trim()) {
    throw new Error('leadId is required.');
  }
  return { leadId: record.leadId.trim() };
}

function parseSwapAssistResumeFileRequest(
  value: unknown,
): DesktopSwapAssistResumeFileRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Swap resume file request must be an object.');
  }
  const record = value as Record<string, unknown>;
  const pdfUrl = readRequiredHttpUrl(record.pdfUrl);
  const fileName =
    typeof record.fileName === 'string' && record.fileName.trim()
      ? record.fileName.trim()
      : 'tailored-resume.pdf';
  return { fileName, pdfUrl };
}

function parseRecordManualSubmitRequest(
  value: unknown,
): DesktopRecordManualSubmitRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Manual submit record request must be an object.');
  }
  const record = value as Record<string, unknown>;
  const applicationUrl = readRequiredHttpUrl(record.applicationUrl);
  const jobLeadId =
    typeof record.jobLeadId === 'string' && record.jobLeadId.trim()
      ? record.jobLeadId.trim()
      : undefined;
  const message =
    typeof record.message === 'string' ? record.message : undefined;
  const toolCallCount =
    typeof record.toolCallCount === 'number' &&
    Number.isFinite(record.toolCallCount) &&
    record.toolCallCount >= 0
      ? Math.floor(record.toolCallCount)
      : undefined;

  return { applicationUrl, jobLeadId, message, toolCallCount };
}

function parseSubmitLeadRequest(value: unknown): DesktopSubmitLeadRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Submit lead request must be an object.');
  }

  const record = value as Record<string, unknown>;
  const applicationUrl = readRequiredHttpUrl(record.applicationUrl);
  const mode = readMode(record.mode);
  const jobLeadId =
    typeof record.jobLeadId === 'string' && record.jobLeadId.trim()
      ? record.jobLeadId.trim()
      : undefined;
  const jobListingId =
    typeof record.jobListingId === 'string' && record.jobListingId.trim()
      ? record.jobListingId.trim()
      : undefined;
  const continueFromCurrentPage = record.continueFromCurrentPage === true;
  const aiProvider =
    record.aiProvider === 'ollama' || record.aiProvider === 'openai'
      ? record.aiProvider
      : undefined;

  return {
    aiProvider,
    applicationUrl,
    continueFromCurrentPage,
    jobLeadId,
    jobListingId,
    mode,
  };
}

function readRequiredHttpUrl(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Application URL is required.');
  }
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Application URL must be an http(s) URL.');
    }
    return url.toString();
  } catch (error) {
    if (error instanceof Error && error.message.includes('http(s)')) {
      throw error;
    }
    throw new Error('Application URL must be a valid URL.');
  }
}

function readMode(value: unknown): DesktopAgentMode {
  if (value === 'training' || value === 'submit') return value;
  throw new Error('Submit mode must be training or submit.');
}

function parseGreenhouseLeadFilterRequest(
  value: unknown,
): DesktopGreenhouseLeadSearchQuery {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;
  return {
    location:
      typeof record.location === 'string' ? record.location.trim() : undefined,
    provider:
      record.provider === 'any' || record.provider === 'greenhouse'
        ? record.provider
        : undefined,
    providers: Array.isArray(record.providers)
      ? record.providers
          .filter(
            (provider): provider is string => typeof provider === 'string',
          )
          .map(provider => provider.trim())
          .filter(Boolean)
      : undefined,
    runtimeProviders: Array.isArray(record.runtimeProviders)
      ? record.runtimeProviders
          .filter((id): id is string => typeof id === 'string')
          .map(id => id.trim().toLowerCase())
          .filter(Boolean)
      : undefined,
    remote: record.remote === true,
    search:
      typeof record.search === 'string' ? record.search.trim() : undefined,
  };
}
