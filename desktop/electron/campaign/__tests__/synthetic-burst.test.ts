import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  type StartedFixtureServer,
  startFixtureServer,
} from '../../../../lib/evaluation/fixture-server';
import {
  SYNTHETIC_FIXTURE_FAMILIES,
  runSyntheticBurst,
} from '../synthetic-burst.js';

let server: StartedFixtureServer;

describe('runSyntheticBurst', () => {
  beforeAll(async () => {
    server = await startFixtureServer({
      fixturesRoot: path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '../../../../fixtures/ats',
      ),
      latencyMs: 1,
    });
  });

  afterAll(async () => {
    await server.stop();
  });

  it('completes 500 fixture submissions in budget at >=95% success', async () => {
    const report = await runSyntheticBurst({
      concurrency: 50,
      costModel: {
        costPerThousandTokensUsd: 0.002,
        tokensPerSession: 100,
      },
      fixtureBaseUrl: server.baseUrl,
      sessionCount: 500,
    });

    expect(report.requested).toBe(500);
    expect(report.completed).toBe(500);
    expect(report.successRate).toBeGreaterThanOrEqual(0.95);
    expect(report.durationMs).toBeLessThanOrEqual(10 * 60 * 1000);
    expect(report.succeeded).toBe(500);
    expect(report.failed).toBe(0);
    expect(report.tokensSpent).toBe(50_000);
    expect(report.estimatedCostUsd).toBe(0.1);
    expect(report.stepLatencies.map(step => step.step)).toEqual([
      'load_manifest',
      'load_application',
      'submit',
    ]);
  });

  it('round-robins sessions across fixture families', async () => {
    const report = await runSyntheticBurst({
      concurrency: 4,
      fixtureBaseUrl: server.baseUrl,
      sessionCount: 8,
    });

    expect(report.outcomes.map(outcome => outcome.family)).toEqual([
      ...SYNTHETIC_FIXTURE_FAMILIES,
      ...SYNTHETIC_FIXTURE_FAMILIES,
    ]);
  });

  it('reports failed sessions without aborting the rest', async () => {
    const report = await runSyntheticBurst({
      concurrency: 2,
      families: ['greenhouse', 'lever'],
      fetchImpl: async (input, init) => {
        const url = String(input);
        if (url.includes('/fixtures/lever/submit')) {
          return new Response('blocked', { status: 503 });
        }
        return fetch(input, init);
      },
      fixtureBaseUrl: server.baseUrl,
      sessionCount: 4,
    });

    expect(report.completed).toBe(4);
    expect(report.succeeded).toBe(2);
    expect(report.failed).toBe(2);
    expect(report.outcomes.filter(outcome => outcome.status === 'failed')).toHaveLength(
      2,
    );
  });
});
