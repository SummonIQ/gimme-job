import { describe, expect, it } from 'vitest';

import {
  filterSmokeReportFilePaths,
  isSmokeReportFilePath,
} from '../smoke-report-paths';

describe('smoke report path validation', () => {
  it('accepts JSON reports inside the smoke-tests directory', () => {
    expect(
      isSmokeReportFilePath(
        '/Users/steven/Documents/Gimme Job/smoke-tests/lever-report.json',
      ),
    ).toBe(true);
  });

  it('rejects paths outside the smoke-tests directory', () => {
    expect(
      isSmokeReportFilePath(
        '/Users/steven/Documents/Gimme Job/run-logs/lever-report.jsonl',
      ),
    ).toBe(false);
    expect(isSmokeReportFilePath('/tmp/lever-report.json')).toBe(false);
  });

  it('filters unsafe listSmokeReports results before rendering', () => {
    const reports = filterSmokeReportFilePaths([
      {
        filePath:
          '/Users/steven/Documents/Gimme Job/smoke-tests/ashby-report.json',
      },
      {
        filePath: '/Users/steven/Documents/Gimme Job/run-logs/ashby.jsonl',
      },
    ]);

    expect(reports).toHaveLength(1);
    expect(reports[0]?.filePath).toContain('/smoke-tests/');
  });
});
