// @vitest-environment node
import { db } from '@/lib/db/client';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ATS_AUTOMATION_POSTURE_SEEDS,
  seedAtsAutomationPostures,
} from '../ats-automation-posture';

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)('ATSAutomationPosture seed', () => {
  beforeAll(async () => {
    await seedAtsAutomationPostures();
  });

  it('populates ≥10 rows with non-null tosUrl and reviewedAt', async () => {
    const rows = await db.aTSAutomationPosture.findMany();
    expect(rows.length).toBeGreaterThanOrEqual(10);
    for (const row of rows) {
      expect(row.tosUrl).toBeTruthy();
      expect(row.reviewedAt).toBeInstanceOf(Date);
    }
  });

  it('is idempotent (re-running produces zero creates and zero drift-updates)', async () => {
    const first = await seedAtsAutomationPostures();
    expect(first.created).toBe(0);
    expect(first.updated).toBe(0);
    expect(first.unchanged).toBe(ATS_AUTOMATION_POSTURE_SEEDS.length);

    const second = await seedAtsAutomationPostures();
    expect(second.created).toBe(0);
    expect(second.updated).toBe(0);
    expect(second.unchanged).toBe(ATS_AUTOMATION_POSTURE_SEEDS.length);
  });

  it('does not duplicate rows by family on repeat runs', async () => {
    await seedAtsAutomationPostures();
    const before = await db.aTSAutomationPosture.count();
    await seedAtsAutomationPostures();
    await seedAtsAutomationPostures();
    const after = await db.aTSAutomationPosture.count();
    expect(after).toBe(before);
  });

  it('updates a drifted row back to the seed value on next run', async () => {
    const family = ATS_AUTOMATION_POSTURE_SEEDS[0].family;

    await db.aTSAutomationPosture.update({
      data: { notes: '__drifted__' },
      where: { family },
    });

    const result = await seedAtsAutomationPostures();
    expect(result.updated).toBeGreaterThanOrEqual(1);

    const restored = await db.aTSAutomationPosture.findUniqueOrThrow({
      where: { family },
    });
    expect(restored.notes).toBe(ATS_AUTOMATION_POSTURE_SEEDS[0].notes);
  });
});
