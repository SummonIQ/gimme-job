import { randomUUID } from 'node:crypto';
import { mkdir, open } from 'node:fs/promises';
import path from 'node:path';

import type { DesktopAgentMode } from '../agent/types.js';
import type { DesktopToolRegistry } from '../tools/registry.js';
import type { DesktopToolCallRequest } from '../tools/types.js';

export interface RunLogHeader {
  readonly applicationUrl: string;
  readonly baseDir: string;
  readonly mode: DesktopAgentMode;
  readonly runtimeProviderId: string;
  readonly runtimeReadiness: string;
}

export interface RunLogStep {
  readonly elapsedMs: number;
  readonly error?: string;
  readonly input: unknown;
  readonly ok: boolean;
  readonly tool: string;
}

export interface RunLogSummary {
  readonly errorTool?: string;
  readonly errorToolMessage?: string;
  readonly status: string;
  readonly totalElapsedMs: number;
}

export interface RunLog {
  readonly appendStep: (step: RunLogStep) => Promise<void>;
  readonly appendSummary: (summary: RunLogSummary) => Promise<void>;
  readonly close: () => Promise<void>;
  readonly filePath: string;
  readonly runId: string;
}

interface StepRecord {
  readonly applicationUrl: string;
  readonly elapsedMs: number;
  readonly error?: string;
  readonly hostname: string | null;
  readonly input: unknown;
  readonly mode: DesktopAgentMode;
  readonly ok: boolean;
  readonly runId: string;
  readonly runtimeProviderId: string;
  readonly runtimeReadiness: string;
  readonly step: number;
  readonly tool: string;
  readonly ts: string;
}

interface SummaryRecord {
  readonly errorTool?: string;
  readonly errorToolMessage?: string;
  readonly runId: string;
  readonly status: string;
  readonly summary: true;
  readonly totalElapsedMs: number;
  readonly totalSteps: number;
  readonly ts: string;
}

export async function openRunLog(
  runIdInput: string,
  header: RunLogHeader,
): Promise<RunLog> {
  const runId = sanitizeRunId(runIdInput);
  await mkdir(header.baseDir, { recursive: true });
  const filePath = path.join(header.baseDir, `${runId}.jsonl`);
  const file = await open(filePath, 'a');
  const hostname = readHostname(header.applicationUrl);
  let closed = false;
  let stepCount = 0;
  let writeQueue = Promise.resolve();

  const appendRecord = (record: StepRecord | SummaryRecord): Promise<void> => {
    writeQueue = writeQueue.then(async () => {
      if (closed) return;
      await file.writeFile(`${JSON.stringify(record)}\n`, 'utf8');
      await file.sync();
    });
    return writeQueue;
  };

  return {
    async appendStep(step) {
      stepCount += 1;
      await appendRecord({
        applicationUrl: header.applicationUrl,
        elapsedMs: step.elapsedMs,
        error: step.error,
        hostname,
        input: step.input,
        mode: header.mode,
        ok: step.ok,
        runId,
        runtimeProviderId: header.runtimeProviderId,
        runtimeReadiness: header.runtimeReadiness,
        step: stepCount,
        tool: step.tool,
        ts: new Date().toISOString(),
      });
    },
    async appendSummary(summary) {
      await appendRecord({
        errorTool: summary.errorTool,
        errorToolMessage: summary.errorToolMessage,
        runId,
        status: summary.status,
        summary: true,
        totalElapsedMs: summary.totalElapsedMs,
        totalSteps: stepCount,
        ts: new Date().toISOString(),
      });
    },
    async close() {
      await writeQueue;
      if (closed) return;
      closed = true;
      await file.close();
    },
    filePath,
    runId,
  };
}

export function createRunJsonlToolRegistry(
  registry: DesktopToolRegistry,
  log: RunLog,
): DesktopToolRegistry {
  return {
    async call(request) {
      const startedAt = Date.now();
      try {
        const result = await registry.call(request);
        await log
          .appendStep({
            elapsedMs: Date.now() - startedAt,
            error: result.error?.message,
            input: request.input ?? null,
            ok: result.ok,
            tool: request.tool,
          })
          .catch(error =>
            console.warn('[run-jsonl-log] step write failed:', error),
          );
        return result;
      } catch (error) {
        await log
          .appendStep({
            elapsedMs: Date.now() - startedAt,
            error: getErrorMessage(error),
            input: request.input ?? null,
            ok: false,
            tool: request.tool,
          })
          .catch(logError =>
            console.warn('[run-jsonl-log] step error write failed:', logError),
          );
        throw error;
      }
    },
    listTools() {
      return registry.listTools();
    },
  };
}

export function createRunId(): string {
  return randomUUID();
}

function readHostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function sanitizeRunId(value: string): string {
  const sanitized = value.trim().replace(/[^a-zA-Z0-9._-]/g, '-');
  return sanitized || randomUUID();
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
