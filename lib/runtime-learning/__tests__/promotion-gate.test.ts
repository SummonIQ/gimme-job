import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  checkRegressionGate,
  inferAtsFamily,
  registerRegressionHarnessRunner,
  resetRegressionHarnessRunner,
} from '../promotion-gate';

describe('inferAtsFamily', () => {
  it.each([
    ['boards.greenhouse.io', 'greenhouse'],
    ['job-boards.greenhouse.io', 'greenhouse'],
    ['jobs.lever.co', 'lever'],
    ['jobs.ashbyhq.com', 'ashby'],
    ['apply.workable.com', 'workable'],
    ['jobs.smartrecruiters.com', 'smartrecruiters'],
    ['acme.wd1.myworkdayjobs.com', 'workday'],
  ])('detects %s as %s', (hostname, expected) => {
    expect(inferAtsFamily(hostname)).toBe(expected);
  });

  it.each(['', '   ', 'example.com', 'random.host'])(
    'returns null for %s',
    hostname => {
      expect(inferAtsFamily(hostname)).toBe(null);
    },
  );
});

describe('checkRegressionGate', () => {
  const previousEnv = process.env.RULE_PROMOTION_GATE_ENABLED;

  afterEach(() => {
    if (previousEnv === undefined) {
      delete process.env.RULE_PROMOTION_GATE_ENABLED;
    } else {
      process.env.RULE_PROMOTION_GATE_ENABLED = previousEnv;
    }
    resetRegressionHarnessRunner();
  });

  it('allows promotion when gate is disabled (default)', async () => {
    delete process.env.RULE_PROMOTION_GATE_ENABLED;

    const result = await checkRegressionGate({
      hostname: 'boards.greenhouse.io',
    });

    expect(result.allowed).toBe(true);
    expect(result.mode).toBe('disabled');
    expect(result.atsFamily).toBe('greenhouse');
  });

  it('skips gate for hostnames outside known ATS families when enabled', async () => {
    process.env.RULE_PROMOTION_GATE_ENABLED = '1';

    const result = await checkRegressionGate({
      hostname: 'careers.example.com',
    });

    expect(result.allowed).toBe(true);
    expect(result.mode).toBe('no_family');
  });

  it('blocks promotion when no harness is registered for a known family', async () => {
    process.env.RULE_PROMOTION_GATE_ENABLED = '1';

    const result = await checkRegressionGate({
      hostname: 'boards.greenhouse.io',
    });

    expect(result.allowed).toBe(false);
    expect(result.mode).toBe('no_harness');
    expect(result.atsFamily).toBe('greenhouse');
  });

  it('blocks promotion when registered harness reports failure', async () => {
    process.env.RULE_PROMOTION_GATE_ENABLED = '1';
    registerRegressionHarnessRunner(async family => ({
      passed: false,
      summary: `2/10 ${family} fixtures failed`,
    }));

    const result = await checkRegressionGate({
      hostname: 'boards.greenhouse.io',
    });

    expect(result.allowed).toBe(false);
    expect(result.mode).toBe('failed');
    expect(result.reason).toContain('2/10');
  });

  it('allows promotion when registered harness reports success', async () => {
    process.env.RULE_PROMOTION_GATE_ENABLED = '1';
    registerRegressionHarnessRunner(async family => ({
      passed: true,
      summary: `10/10 ${family} fixtures passed`,
    }));

    const result = await checkRegressionGate({
      hostname: 'boards.greenhouse.io',
    });

    expect(result.allowed).toBe(true);
    expect(result.mode).toBe('passed');
    expect(result.reason).toContain('10/10');
  });
});
