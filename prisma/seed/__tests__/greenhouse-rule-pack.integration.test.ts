// @vitest-environment node
import { db } from '@/lib/db/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  GREENHOUSE_BOOTSTRAP_CONFIDENCE,
  GREENHOUSE_BOOTSTRAP_SESSION_ID,
  GREENHOUSE_HOSTNAMES,
  buildGreenhouseRulePack,
} from '@/lib/seed/greenhouse-rule-pack';
import { applyGreenhouseRulePack } from '../greenhouse-rule-pack';

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * Use an isolated pair of hostnames so parallel test runs / real data
 * on `job-boards.greenhouse.io` aren't touched.
 */
const TEST_HOSTNAMES: readonly string[] = [
  'p3-1-test-a.greenhouse.local',
  'p3-1-test-b.greenhouse.local',
];

async function cleanupTestRules() {
  await db.applicationFlowStepDefinition.deleteMany({
    where: { flowDefinition: { hostname: { in: [...TEST_HOSTNAMES] } } },
  });
  await db.applicationFlowDefinition.deleteMany({
    where: { hostname: { in: [...TEST_HOSTNAMES] } },
  });
  await db.aTSRule.deleteMany({
    where: { hostname: { in: [...TEST_HOSTNAMES] } },
  });
}

describe.skipIf(!HAS_DB)('applyGreenhouseRulePack (integration)', () => {
  beforeAll(async () => {
    await cleanupTestRules();
  });

  afterAll(async () => {
    await cleanupTestRules();
  });

  it('seeds ≥ 30 ATSRule rows on first apply', async () => {
    const result = await applyGreenhouseRulePack(TEST_HOSTNAMES);
    expect(result.ruleStats.created + result.ruleStats.unchanged).toBeGreaterThanOrEqual(
      30,
    );
    expect(result.ruleStats.created).toBeGreaterThanOrEqual(30);

    const count = await db.aTSRule.count({
      where: { hostname: { in: [...TEST_HOSTNAMES] } },
    });
    expect(count).toBeGreaterThanOrEqual(30);
  });

  it('every seeded row is confidence 0.9 and tagged with the bootstrap session id', async () => {
    const rows = await db.aTSRule.findMany({
      where: { hostname: { in: [...TEST_HOSTNAMES] } },
    });
    for (const row of rows) {
      expect(row.confidence).toBeCloseTo(GREENHOUSE_BOOTSTRAP_CONFIDENCE, 5);
      expect(row.sourceTrainingSessionIds).toContain(
        GREENHOUSE_BOOTSTRAP_SESSION_ID,
      );
    }
  });

  it('compiles an ApplicationFlowDefinition for every hostname', async () => {
    const defs = await db.applicationFlowDefinition.findMany({
      where: { hostname: { in: [...TEST_HOSTNAMES] } },
    });
    expect(defs.length).toBe(TEST_HOSTNAMES.length);
    for (const def of defs) {
      expect(def.status).toBe('ACTIVE');
      expect(def.compiledFromRuleCount).toBeGreaterThan(0);
    }
  });

  it('compiles step definitions for every hostname', async () => {
    const steps = await db.applicationFlowStepDefinition.findMany({
      where: {
        flowDefinition: { hostname: { in: [...TEST_HOSTNAMES] } },
      },
    });
    // pack.steps yields 4 per hostname
    expect(steps.length).toBe(TEST_HOSTNAMES.length * 4);
  });

  it('is idempotent: a second apply creates 0 rules and leaves counts stable', async () => {
    const beforeCount = await db.aTSRule.count({
      where: { hostname: { in: [...TEST_HOSTNAMES] } },
    });

    const second = await applyGreenhouseRulePack(TEST_HOSTNAMES);
    expect(second.ruleStats.created).toBe(0);

    const afterCount = await db.aTSRule.count({
      where: { hostname: { in: [...TEST_HOSTNAMES] } },
    });
    expect(afterCount).toBe(beforeCount);
  });

  it('does not accidentally touch rules on a sibling hostname', async () => {
    // Seed a rule on a hostname that isn't in the input list and make sure
    // it survives the seed.
    const existing = await db.aTSRule.create({
      data: {
        action: 'continue',
        actionType: 'fill',
        ariaLabel: 'First Name',
        confidence: 0.5,
        enabled: true,
        fieldLabel: 'First Name',
        fieldName: 'first_name',
        hostname: 'p3-1-sibling.greenhouse.local',
        reason: 'sibling, should not be touched',
        role: null,
        sourceTrainingSessionIds: ['test-sibling'],
        stableSelector: 'input#first_name',
        stepIndex: 0,
        tagName: 'input',
      },
    });

    await applyGreenhouseRulePack(TEST_HOSTNAMES);

    const after = await db.aTSRule.findUniqueOrThrow({
      where: { id: existing.id },
    });
    expect(after.confidence).toBe(0.5);
    expect(after.sourceTrainingSessionIds).toEqual(['test-sibling']);

    await db.aTSRule.delete({ where: { id: existing.id } });
  });

  it('built pack size matches the DB row count after apply', async () => {
    const pack = buildGreenhouseRulePack(TEST_HOSTNAMES);
    const count = await db.aTSRule.count({
      where: { hostname: { in: [...TEST_HOSTNAMES] } },
    });
    expect(count).toBe(pack.rules.length);
  });

  it(`also works with the real default hostnames (covers ${GREENHOUSE_HOSTNAMES.length})`, () => {
    const pack = buildGreenhouseRulePack(GREENHOUSE_HOSTNAMES);
    expect(pack.rules.length).toBeGreaterThanOrEqual(30);
  });
});
