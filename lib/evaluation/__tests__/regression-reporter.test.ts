import { describe, expect, it } from 'vitest';

import {
  buildRegressionReport,
  calculatePassRate,
  compareRegressionResults,
  hasCurrentFailures,
  hasRegression,
  parseRegressionSummary,
  type RegressionFamilyResult,
} from '../regression-reporter.js';

const baseResult: RegressionFamilyResult = {
  confirmationMatched: true,
  family: 'greenhouse',
  fixturePassed: true,
  notes: [],
  passRate: 100,
  passedChecks: 3,
  replayVerdict: 'would_succeed',
  totalChecks: 3,
};

describe('calculatePassRate', () => {
  it('returns a rounded percentage', () => {
    expect(calculatePassRate(2, 3)).toBe(66.7);
  });

  it('returns zero when no checks exist', () => {
    expect(calculatePassRate(0, 0)).toBe(0);
  });
});

describe('compareRegressionResults', () => {
  it('flags drops greater than the configured threshold', () => {
    const [comparison] = compareRegressionResults(
      [{ ...baseResult, passRate: 94.9 }],
      { greenhouse: 100 },
      5,
    );
    expect(comparison.regressed).toBe(true);
    expect(comparison.delta).toBe(-5.1);
  });

  it('does not flag an exact threshold drop', () => {
    const [comparison] = compareRegressionResults(
      [{ ...baseResult, passRate: 95 }],
      { greenhouse: 100 },
      5,
    );
    expect(comparison.regressed).toBe(false);
  });
});

describe('buildRegressionReport', () => {
  it('embeds a parseable summary and status table', () => {
    const comparisons = compareRegressionResults([baseResult], null);
    const report = buildRegressionReport({
      comparisons,
      generatedAt: new Date('2026-04-23T00:00:00.000Z'),
      results: [baseResult],
    });

    expect(report).toContain('# Regression Report - 2026-04-23');
    expect(report).toContain('Status: PASS');
    expect(report).toContain('greenhouse');
    expect(parseRegressionSummary(report)).toEqual({ greenhouse: 100 });
  });

  it('marks current failures as report failure even without baseline', () => {
    const failing = {
      ...baseResult,
      confirmationMatched: false,
      passRate: 66.7,
      passedChecks: 2,
    };
    const report = buildRegressionReport({
      generatedAt: new Date('2026-04-23T00:00:00.000Z'),
      results: [failing],
    });

    expect(hasCurrentFailures([failing])).toBe(true);
    expect(hasRegression(compareRegressionResults([failing], null))).toBe(
      false,
    );
    expect(report).toContain('Status: FAIL');
  });
});

describe('parseRegressionSummary', () => {
  it('returns null for reports without summary metadata', () => {
    expect(parseRegressionSummary('# report')).toBeNull();
  });
});
