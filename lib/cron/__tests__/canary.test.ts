import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  RegressionComparison,
  RegressionFamilyResult,
} from '@/lib/evaluation/regression-reporter';
import type { RegressionRunResult } from '@/scripts/regression-run';

import {
  CANARY_DEDUP_PREFIX,
  CANARY_RETRAIN_JOB_TYPE,
  internals,
  runCanary,
} from '../canary';

vi.mock('@/lib/db/client', () => {
  const findFirst = vi.fn(async () => null);
  const create = vi.fn(async (args: { data: Record<string, unknown> }) => ({
    id: `job-${String(args.data.deduplicationKey)}`,
  }));
  return {
    db: {
      jobQueueItem: { create, findFirst },
    },
  };
});

const { db: mockedDb } = (await import('@/lib/db/client')) as unknown as {
  db: {
    jobQueueItem: {
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
  };
};

function familyResult(
  overrides: Partial<RegressionFamilyResult>,
): RegressionFamilyResult {
  return {
    confirmationMatched: true,
    family: 'greenhouse',
    fixturePassed: true,
    notes: [],
    passedChecks: 3,
    passRate: 100,
    replayVerdict: 'would_succeed',
    totalChecks: 3,
    ...overrides,
  };
}

function comparison(
  overrides: Partial<RegressionComparison>,
): RegressionComparison {
  return {
    currentPassRate: 100,
    delta: 0,
    family: 'greenhouse',
    previousPassRate: 100,
    regressed: false,
    thresholdPercentagePoints: 5,
    ...overrides,
  };
}

function mockRegression(
  overrides: Partial<RegressionRunResult>,
): RegressionRunResult {
  return {
    baselinePath: 'docs/canary-reports/baseline.md',
    comparisons: [],
    exitCode: 0,
    markdown: '# stub',
    reportPath: 'docs/canary-reports/canary-2026-04-23.md',
    results: [],
    ...overrides,
  };
}

beforeEach(() => {
  mockedDb.jobQueueItem.findFirst.mockClear();
  mockedDb.jobQueueItem.create.mockClear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('runCanary - all families healthy', () => {
  it('does not enqueue retrain jobs when every family passes with no regression', async () => {
    const results = [
      familyResult({ family: 'greenhouse' }),
      familyResult({ family: 'lever' }),
    ];
    const comparisons = results.map(r => comparison({ family: r.family }));
    const fake = vi
      .fn()
      .mockResolvedValue(mockRegression({ comparisons, results }));

    const result = await runCanary({}, { runRegression: fake });
    expect(result.enqueuedCount).toBe(0);
    expect(result.families).toHaveLength(2);
    for (const fam of result.families) {
      expect(fam.flaggedStale).toBe(false);
      expect(fam.reason).toBeNull();
      expect(fam.enqueuedJobId).toBeNull();
    }
    expect(mockedDb.jobQueueItem.create).not.toHaveBeenCalled();
  });
});

describe('runCanary - regressed family', () => {
  it('enqueues a RETRAIN_RECIPE_PACK job with reason=regression', async () => {
    const results = [
      familyResult({
        family: 'greenhouse',
        passedChecks: 2,
        passRate: 70,
        totalChecks: 3,
      }),
    ];
    const comparisons = [
      comparison({
        currentPassRate: 70,
        delta: -30,
        family: 'greenhouse',
        previousPassRate: 100,
        regressed: true,
      }),
    ];
    const fake = vi
      .fn()
      .mockResolvedValue(
        mockRegression({ comparisons, exitCode: 1, results }),
      );

    const result = await runCanary(
      {},
      { now: () => new Date('2026-04-23T12:00:00.000Z'), runRegression: fake },
    );
    expect(result.enqueuedCount).toBe(1);
    const outcome = result.families[0];
    expect(outcome.reason).toBe('regression');
    expect(outcome.delta).toBe(-30);
    expect(outcome.previousPassRate).toBe(100);
    expect(outcome.enqueuedJobId).toMatch(/^job-canary-retrain:greenhouse:/);

    expect(mockedDb.jobQueueItem.create).toHaveBeenCalledTimes(1);
    const createArgs = mockedDb.jobQueueItem.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(createArgs.data.type).toBe(CANARY_RETRAIN_JOB_TYPE);
    expect(createArgs.data.status).toBe('PENDING');
    expect(String(createArgs.data.deduplicationKey)).toContain(
      `${CANARY_DEDUP_PREFIX}greenhouse:`,
    );
    const payload = createArgs.data.payload as Record<string, unknown>;
    expect(payload.family).toBe('greenhouse');
    expect(payload.reason).toBe('regression');
    expect(payload.currentPassRate).toBe(70);
    expect(payload.previousPassRate).toBe(100);
  });
});

describe('runCanary - current failure (no baseline)', () => {
  it('enqueues with reason=current_failure when pass rate < 100 and no baseline exists', async () => {
    const results = [
      familyResult({
        family: 'lever',
        passedChecks: 2,
        passRate: 66.7,
        totalChecks: 3,
      }),
    ];
    const comparisons = [
      comparison({
        currentPassRate: 66.7,
        delta: null,
        family: 'lever',
        previousPassRate: null,
        regressed: false,
      }),
    ];
    const fake = vi
      .fn()
      .mockResolvedValue(mockRegression({ comparisons, results }));

    const result = await runCanary({}, { runRegression: fake });
    expect(result.enqueuedCount).toBe(1);
    expect(result.families[0].reason).toBe('current_failure');
  });
});

describe('runCanary - dedup', () => {
  it('returns the existing jobId without re-inserting when a retrain job already exists for this week', async () => {
    mockedDb.jobQueueItem.findFirst.mockResolvedValueOnce({
      id: 'existing-job-1',
    });
    const results = [
      familyResult({ family: 'ashby', passRate: 80 }),
    ];
    const comparisons = [
      comparison({
        currentPassRate: 80,
        delta: -20,
        family: 'ashby',
        previousPassRate: 100,
        regressed: true,
      }),
    ];
    const fake = vi
      .fn()
      .mockResolvedValue(mockRegression({ comparisons, results }));

    const result = await runCanary({}, { runRegression: fake });
    expect(result.families[0].enqueuedJobId).toBe('existing-job-1');
    expect(mockedDb.jobQueueItem.create).not.toHaveBeenCalled();
  });
});

describe('weekStampFor', () => {
  it('produces an ISO-style week label', () => {
    expect(internals.weekStampFor(new Date('2026-01-05T00:00:00Z'))).toMatch(
      /^2026-W0[12]$/,
    );
    expect(internals.weekStampFor(new Date('2026-04-23T12:00:00Z'))).toMatch(
      /^2026-W1[67]$/,
    );
  });
});
