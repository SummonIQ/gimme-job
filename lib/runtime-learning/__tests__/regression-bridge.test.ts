import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readRegressionHarnessOutcome } from '../regression-bridge';

let reportDir: string;

beforeEach(async () => {
  reportDir = await mkdtemp(path.join(tmpdir(), 'regression-bridge-'));
});

afterEach(async () => {
  await rm(reportDir, { force: true, recursive: true });
});

async function writeReport(date: string, summary: Record<string, number>) {
  const markdown = [
    `# Regression report ${date}`,
    '',
    `<!-- p7.3-regression-summary:${JSON.stringify(summary)} -->`,
    '',
  ].join('\n');
  await writeFile(path.join(reportDir, `regression-${date}.md`), markdown, 'utf8');
}

describe('readRegressionHarnessOutcome', () => {
  const now = new Date('2026-05-02T12:00:00Z');

  it('returns null when no report directory exists', async () => {
    const result = await readRegressionHarnessOutcome('greenhouse', {
      now,
      reportDir: path.join(reportDir, 'does-not-exist'),
    });
    expect(result).toBe(null);
  });

  it('returns null when no regression-*.md report is present', async () => {
    await writeFile(path.join(reportDir, 'README.md'), '# nothing', 'utf8');
    const result = await readRegressionHarnessOutcome('greenhouse', {
      now,
      reportDir,
    });
    expect(result).toBe(null);
  });

  it('reports passed=true when family meets the threshold in the newest report', async () => {
    await writeReport('2026-04-25', { greenhouse: 90 });
    await writeReport('2026-05-01', { greenhouse: 100, lever: 92 });

    const result = await readRegressionHarnessOutcome('greenhouse', {
      now,
      reportDir,
    });

    expect(result?.passed).toBe(true);
    expect(result?.summary).toContain('100.0%');
    expect(result?.summary).toContain('regression-2026-05-01.md');
  });

  it('reports passed=false when family is below the configured threshold', async () => {
    await writeReport('2026-05-01', { greenhouse: 80 });

    const result = await readRegressionHarnessOutcome('greenhouse', {
      minPassRatePercent: 95,
      now,
      reportDir,
    });

    expect(result?.passed).toBe(false);
    expect(result?.summary).toContain('80.0%');
  });

  it('reports passed=false when the family is missing from the report', async () => {
    await writeReport('2026-05-01', { lever: 100 });

    const result = await readRegressionHarnessOutcome('greenhouse', {
      now,
      reportDir,
    });

    expect(result?.passed).toBe(false);
    expect(result?.summary).toContain('no row for family "greenhouse"');
  });

  it('reports passed=false when the newest report is older than the freshness window', async () => {
    await writeReport('2026-04-01', { greenhouse: 100 });

    const result = await readRegressionHarnessOutcome('greenhouse', {
      maxReportAgeMs: 7 * 24 * 60 * 60 * 1000,
      now,
      reportDir,
    });

    expect(result?.passed).toBe(false);
    expect(result?.summary).toContain('older than');
  });
});
