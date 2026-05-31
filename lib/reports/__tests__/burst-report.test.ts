import { describe, expect, it } from 'vitest';

import {
  computeBurstMetrics,
  renderBurstReport,
  reportFilename,
  type BurstItem,
  type BurstRunLog,
} from '../burst-report';

function item(partial: Partial<BurstItem>): BurstItem {
  return {
    family: 'greenhouse',
    finishedAt: '2026-04-23T12:00:10.000Z',
    hostname: 'job-boards.greenhouse.io',
    leadId: 'lead-x',
    outcome: 'SUBMITTED',
    startedAt: '2026-04-23T12:00:00.000Z',
    ...partial,
  };
}

function log(partial: Partial<BurstRunLog>): BurstRunLog {
  return {
    finishedAt: '2026-04-23T12:05:00.000Z',
    items: [],
    mode: 'TARGETED',
    runId: 'burst-2026-04-23-a',
    startedAt: '2026-04-23T12:00:00.000Z',
    ...partial,
  };
}

// Canned 5-minute run log: 20 items with a realistic mix.
const CANNED_LOG: BurstRunLog = log({
  items: [
    // 12 submitted greenhouse leads with varying latency
    ...Array.from({ length: 12 }).map((_, i) =>
      item({
        finishedAt: new Date(
          new Date('2026-04-23T12:00:00.000Z').getTime() + (10 + i) * 1000,
        ).toISOString(),
        leadId: `gh-${i}`,
        startedAt: new Date(
          new Date('2026-04-23T12:00:00.000Z').getTime() + i * 500,
        ).toISOString(),
        dollarsSpent: 0.05,
        tokensSpent: 4000,
      }),
    ),
    // 3 failed lever leads with known reason codes
    item({
      errorCode: 'CAPTCHA',
      errorMessage: 'captcha_challenged',
      family: 'lever',
      finishedAt: '2026-04-23T12:02:30.000Z',
      hostname: 'jobs.lever.co',
      leadId: 'lv-1',
      outcome: 'FAILED',
      startedAt: '2026-04-23T12:02:00.000Z',
      dollarsSpent: 0.03,
      tokensSpent: 2500,
    }),
    item({
      errorCode: 'CAPTCHA',
      family: 'lever',
      finishedAt: '2026-04-23T12:03:00.000Z',
      hostname: 'jobs.lever.co',
      leadId: 'lv-2',
      outcome: 'FAILED',
      startedAt: '2026-04-23T12:02:30.000Z',
      dollarsSpent: 0.03,
      tokensSpent: 2500,
    }),
    item({
      errorCode: 'HTTP_5XX',
      family: 'lever',
      finishedAt: '2026-04-23T12:03:30.000Z',
      hostname: 'jobs.lever.co',
      leadId: 'lv-3',
      outcome: 'FAILED',
      startedAt: '2026-04-23T12:03:10.000Z',
      dollarsSpent: 0.02,
      tokensSpent: 1500,
    }),
    // 5 skipped ashby leads (rate budget)
    ...Array.from({ length: 5 }).map((_, i) =>
      item({
        errorCode: 'RATE_BUDGET_EMPTY',
        family: 'ashby',
        finishedAt: '2026-04-23T12:04:10.000Z',
        hostname: 'jobs.ashbyhq.com',
        leadId: `ab-${i}`,
        outcome: 'SKIPPED',
        startedAt: '2026-04-23T12:04:00.000Z',
      }),
    ),
  ],
  metadata: {
    burstName: 'synthetic-warmup-1',
    operator: 'steven',
  },
});

describe('computeBurstMetrics', () => {
  const metrics = computeBurstMetrics(CANNED_LOG);

  it('counts totals correctly', () => {
    expect(metrics.total).toBe(20);
    expect(metrics.submitted).toBe(12);
    expect(metrics.failed).toBe(3);
    expect(metrics.skipped).toBe(5);
  });

  it('computes throughput over the run duration (5 minutes)', () => {
    // 12 submits over 5 minutes = 2.4 submits/min
    expect(metrics.submitsPerMinute).toBeCloseTo(2.4, 2);
  });

  it('reports P50 and P95 latency', () => {
    expect(metrics.p50LatencyMs).not.toBeNull();
    expect(metrics.p95LatencyMs).not.toBeNull();
    expect(metrics.p50LatencyMs as number).toBeLessThan(
      metrics.p95LatencyMs as number,
    );
  });

  it('sums tokens and dollars across all items', () => {
    // 12 * 4000 + 2500 + 2500 + 1500 = 54,500 tokens
    expect(metrics.tokensSpent).toBe(54500);
    // 12 * 0.05 + 0.03 + 0.03 + 0.02 = 0.68
    expect(metrics.dollarsSpent).toBeCloseTo(0.68, 2);
  });

  it('breaks down failures by reason code', () => {
    expect(metrics.failureReasons.CAPTCHA).toBe(2);
    expect(metrics.failureReasons.HTTP_5XX).toBe(1);
    expect(metrics.failureReasons.RATE_BUDGET_EMPTY).toBe(5);
  });

  it('rolls up counts per family', () => {
    expect(metrics.perFamily.greenhouse).toEqual({
      failed: 0,
      skipped: 0,
      submitted: 12,
    });
    expect(metrics.perFamily.lever).toEqual({
      failed: 3,
      skipped: 0,
      submitted: 0,
    });
    expect(metrics.perFamily.ashby).toEqual({
      failed: 0,
      skipped: 5,
      submitted: 0,
    });
  });
});

describe('computeBurstMetrics — edge cases', () => {
  it('empty log returns zeros without throwing', () => {
    const metrics = computeBurstMetrics(log({ items: [] }));
    expect(metrics.total).toBe(0);
    expect(metrics.submitted).toBe(0);
    expect(metrics.submitsPerMinute).toBe(0);
    expect(metrics.p50LatencyMs).toBeNull();
  });

  it('zero-duration run reports 0 throughput rather than dividing by zero', () => {
    const metrics = computeBurstMetrics(
      log({
        finishedAt: '2026-04-23T12:00:00.000Z',
        startedAt: '2026-04-23T12:00:00.000Z',
      }),
    );
    expect(metrics.submitsPerMinute).toBe(0);
  });

  it('missing family falls back to "unknown"', () => {
    const metrics = computeBurstMetrics(
      log({
        items: [item({ family: null })],
      }),
    );
    expect(metrics.perFamily.unknown?.submitted).toBe(1);
  });

  it('missing errorCode on a failed item falls back to UNKNOWN', () => {
    const metrics = computeBurstMetrics(
      log({
        items: [item({ errorCode: null, outcome: 'FAILED' })],
      }),
    );
    expect(metrics.failureReasons.UNKNOWN).toBe(1);
  });

  it('invalid date strings throw loudly so reporter runs are not silent', () => {
    expect(() =>
      computeBurstMetrics(log({ startedAt: 'not-a-date' })),
    ).toThrow(/Invalid date/);
  });
});

describe('renderBurstReport', () => {
  const md = renderBurstReport(CANNED_LOG);

  it('starts with a # heading for the run', () => {
    expect(md.split('\n')[0]).toBe('# Burst report — burst-2026-04-23-a');
  });

  it('surfaces headline numbers', () => {
    expect(md).toMatch(/Submitted\*\*: 12 \/ 20 \(60\.0%\)/);
    expect(md).toMatch(/Failed\*\*: 3/);
    expect(md).toMatch(/Skipped\*\*: 5/);
  });

  it('includes the per-family table with an ASCII bar', () => {
    expect(md).toMatch(/\| greenhouse \| 12 \| 0 \| 0 \|/);
    expect(md).toMatch(/█+░*/);
  });

  it('includes the failure-reason breakdown', () => {
    expect(md).toMatch(/`CAPTCHA`/);
    expect(md).toMatch(/`RATE_BUDGET_EMPTY`/);
  });

  it('includes metadata when present', () => {
    expect(md).toMatch(/\*\*burstName\*\*: synthetic-warmup-1/);
  });

  it('reports "_No failures._" when outcomes are all SUBMITTED', () => {
    const clean = renderBurstReport(
      log({
        items: [item({ leadId: 'only', outcome: 'SUBMITTED' })],
      }),
    );
    expect(clean).toMatch(/_No failures._/);
  });
});

describe('reportFilename', () => {
  it('derives docs/synthetic-burst-<UTC date>.md', () => {
    expect(reportFilename(CANNED_LOG)).toBe('docs/synthetic-burst-2026-04-23.md');
  });
});
