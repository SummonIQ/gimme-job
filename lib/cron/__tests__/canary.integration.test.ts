// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  GET as canaryGET,
  POST as canaryPOST,
} from '@/app/api/cron/canary/route';
import { db } from '@/lib/db/client';

import {
  CANARY_DEDUP_PREFIX,
  CANARY_RETRAIN_JOB_TYPE,
  runCanary,
} from '../canary';

const HAS_DB = Boolean(process.env.DATABASE_URL);
const CRON_SECRET = 'canary-test-secret';
const FIXTURES_ROOT = path.resolve(process.cwd(), 'fixtures/ats');

let tmpReportDir: string;

function makeRegressionStub(
  result: Parameters<typeof import('@/scripts/regression-run')['runRegression']>[0] extends
    | infer U
    | undefined
    ? U
    : never,
): unknown {
  return result;
}
void makeRegressionStub;

async function cleanupCanaryJobs() {
  await db.jobQueueItem
    .deleteMany({
      where: { type: CANARY_RETRAIN_JOB_TYPE },
    })
    .catch(() => undefined);
}

describe.skipIf(!HAS_DB)('canary cron (integration)', () => {
  beforeAll(() => {
    tmpReportDir = mkdtempSync(path.join(tmpdir(), 'p14-1-canary-'));
    process.env.CRON_SECRET = CRON_SECRET;
  });
  afterAll(() => {
    rmSync(tmpReportDir, { force: true, recursive: true });
    delete process.env.CRON_SECRET;
  });
  afterEach(async () => {
    await cleanupCanaryJobs();
  });

  it('runs the full regression suite against the fixture families and returns per-family outcomes', async () => {
    const result = await runCanary({
      fixturesRoot: FIXTURES_ROOT,
      reportDir: tmpReportDir,
    });

    expect(result.families.length).toBeGreaterThan(0);
    const families = result.families.map(f => f.family).sort();
    expect(families).toEqual(['ashby', 'greenhouse', 'lever', 'smartrecruiters']);
    for (const fam of result.families) {
      expect(fam.passRate).toBeGreaterThanOrEqual(0);
      expect(fam.passRate).toBeLessThanOrEqual(100);
    }
  });

  it('POST /api/cron/canary rejects requests without the bearer secret', async () => {
    const response = await canaryPOST(
      new Request('http://localhost/api/cron/canary', {
        method: 'POST',
      }),
    );
    expect(response.status).toBe(401);
  });

  it('GET /api/cron/canary rejects scheduled requests without the bearer secret', async () => {
    const response = await canaryGET(
      new Request('http://localhost/api/cron/canary', {
        method: 'GET',
      }),
    );
    expect(response.status).toBe(401);
  });

  it('enqueues exactly one RETRAIN_RECIPE_PACK job per regressed family and survives a second run (dedup)', async () => {
    // Force a regression for one family by seeding the baseline with a
    // pass rate well above what the fixture currently achieves. We use
    // the P7.3 baseline mechanism: a prior report file that the
    // comparison loader can parse.
    const baselinePath = path.join(tmpReportDir, 'regression-2026-04-20.md');
    await import('node:fs/promises').then(fs =>
      fs.writeFile(
        baselinePath,
        '<!-- p7.3-regression-summary: {"greenhouse":200,"lever":200,"ashby":200,"smartrecruiters":200} -->\n',
        'utf8',
      ),
    );

    const first = await runCanary({
      fixturesRoot: FIXTURES_ROOT,
      reportDir: tmpReportDir,
    });
    expect(first.enqueuedCount).toBe(first.families.length);

    const enqueued = await db.jobQueueItem.findMany({
      where: {
        deduplicationKey: { startsWith: CANARY_DEDUP_PREFIX },
        type: CANARY_RETRAIN_JOB_TYPE,
      },
    });
    expect(enqueued.length).toBe(first.families.length);
    for (const row of enqueued) {
      expect(row.status).toBe('PENDING');
      expect(row.deduplicationKey).toMatch(
        new RegExp(`^${CANARY_DEDUP_PREFIX}[a-z]+:\\d{4}-W\\d{2}$`),
      );
      const payload = row.payload as { reason?: string };
      expect(['regression', 'current_failure']).toContain(payload.reason);
    }

    const second = await runCanary({
      fixturesRoot: FIXTURES_ROOT,
      reportDir: tmpReportDir,
    });
    expect(second.enqueuedCount).toBe(second.families.length);

    const afterSecond = await db.jobQueueItem.findMany({
      where: { type: CANARY_RETRAIN_JOB_TYPE },
    });
    expect(afterSecond.length).toBe(enqueued.length);
    expect(afterSecond.map(r => r.id).sort()).toEqual(
      enqueued.map(r => r.id).sort(),
    );
  });
});
