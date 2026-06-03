import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { DesktopToolRegistry } from '../../tools/registry';
import {
  createRunJsonlToolRegistry,
  openRunLog,
} from '../run-jsonl-log';

const tempDirs: string[] = [];

describe('run JSONL log', () => {
  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map(dir => rm(dir, { force: true, recursive: true })),
    );
  });

  it('writes parseable tool-call records and a final summary', async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), 'run-jsonl-log-'));
    tempDirs.push(baseDir);
    const log = await openRunLog('test-run', {
      applicationUrl: 'https://jobs.lever.co/acme/abc123/apply',
      baseDir,
      mode: 'training',
      runtimeProviderId: 'lever',
      runtimeReadiness: 'production',
    });
    const registry = createRunJsonlToolRegistry(createFakeRegistry(), log);

    await registry.call({
      input: { url: 'https://jobs.lever.co/acme/abc123/apply' },
      tool: 'navigate',
    });
    const firstFlush = (await readFile(log.filePath, 'utf8')).trim();
    expect(JSON.parse(firstFlush)).toMatchObject({
      ok: true,
      step: 1,
      tool: 'navigate',
    });

    await registry.call({
      input: { selector: '#missing', timeoutMs: 10 },
      tool: 'wait_for',
    });
    await log.appendSummary({
      errorTool: 'wait_for',
      errorToolMessage: 'timed out',
      status: 'failed',
      totalElapsedMs: 42,
    });
    await log.close();

    const lines = (await readFile(log.filePath, 'utf8'))
      .trim()
      .split('\n')
      .map(line => JSON.parse(line) as Record<string, unknown>);

    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({
      applicationUrl: 'https://jobs.lever.co/acme/abc123/apply',
      hostname: 'jobs.lever.co',
      mode: 'training',
      ok: true,
      runId: 'test-run',
      runtimeProviderId: 'lever',
      runtimeReadiness: 'production',
      step: 1,
      tool: 'navigate',
    });
    expect(lines[1]).toMatchObject({
      error: 'timed out',
      ok: false,
      step: 2,
      tool: 'wait_for',
    });
    expect(lines[2]).toMatchObject({
      errorTool: 'wait_for',
      errorToolMessage: 'timed out',
      runId: 'test-run',
      summary: true,
      status: 'failed',
      totalElapsedMs: 42,
      totalSteps: 2,
    });
    expect(typeof lines[0].ts).toBe('string');
    expect(typeof lines[0].elapsedMs).toBe('number');
    expect(typeof lines[2].ts).toBe('string');
  });
});

function createFakeRegistry(): DesktopToolRegistry {
  return {
    async call(request) {
      if (request.tool === 'wait_for') {
        return {
          error: { code: 'TIMEOUT', message: 'timed out' },
          ok: false,
          tool: request.tool,
        };
      }
      return {
        data: { ok: true },
        ok: true,
        tool: request.tool,
      };
    },
    listTools() {
      return ['navigate', 'wait_for'];
    },
  };
}
