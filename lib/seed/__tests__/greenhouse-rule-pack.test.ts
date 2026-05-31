import { describe, expect, it } from 'vitest';

import {
  GREENHOUSE_BOOTSTRAP_CONFIDENCE,
  GREENHOUSE_BOOTSTRAP_SESSION_ID,
  GREENHOUSE_HOSTNAMES,
  buildGreenhouseRulePack,
  validateATSRuleInput,
} from '../greenhouse-rule-pack';

describe('buildGreenhouseRulePack', () => {
  const pack = buildGreenhouseRulePack();

  it('produces >= 30 rules across the default hostnames', () => {
    expect(pack.rules.length).toBeGreaterThanOrEqual(30);
  });

  it('covers every default Greenhouse hostname', () => {
    const hosts = new Set(pack.rules.map(r => r.hostname));
    for (const host of GREENHOUSE_HOSTNAMES) {
      expect(hosts.has(host)).toBe(true);
    }
  });

  it('pins every rule at confidence 0.9 and tags the bootstrap session', () => {
    for (const rule of pack.rules) {
      expect(rule.confidence).toBe(GREENHOUSE_BOOTSTRAP_CONFIDENCE);
      expect(rule.sourceTrainingSessionIds).toEqual([
        GREENHOUSE_BOOTSTRAP_SESSION_ID,
      ]);
    }
  });

  it('covers the P3.1-listed canonical fields (first_name, last_name, email, phone, resume, custom questions)', () => {
    const fieldNames = new Set(
      pack.rules.map(r => r.fieldName).filter((n): n is string => Boolean(n)),
    );
    for (const required of [
      'first_name',
      'last_name',
      'email',
      'phone',
      'resume',
    ]) {
      expect(fieldNames.has(required)).toBe(true);
    }
    // Custom questions should appear as question_* keys
    const customQuestionCount = [...fieldNames].filter(name =>
      name.startsWith('question_'),
    ).length;
    expect(customQuestionCount).toBeGreaterThanOrEqual(3);
  });

  it('routes resume upload to an upload rule AND an activate-click rule', () => {
    for (const host of GREENHOUSE_HOSTNAMES) {
      const hostRules = pack.rules.filter(r => r.hostname === host);
      const upload = hostRules.find(
        r => r.actionType === 'upload' && r.fieldName === 'resume',
      );
      expect(upload).toBeDefined();
      const attach = hostRules.find(
        r => r.actionType === 'click' && r.role === 'button' && /resume/i.test(r.stableSelector),
      );
      expect(attach).toBeDefined();
    }
  });

  it('every generated rule passes validateATSRuleInput', () => {
    for (const rule of pack.rules) {
      const errors = validateATSRuleInput(rule);
      expect(errors).toEqual([]);
    }
  });

  it('defines steps 0 through 3 for every hostname', () => {
    for (const host of GREENHOUSE_HOSTNAMES) {
      const hostSteps = pack.steps.filter(s => s.hostname === host);
      const idxs = new Set(hostSteps.map(s => s.stepIndex));
      expect(idxs).toEqual(new Set([0, 1, 2, 3]));
    }
  });

  it('is deterministic — calling twice produces equivalent rows', () => {
    const a = buildGreenhouseRulePack();
    const b = buildGreenhouseRulePack();
    expect(a.rules.length).toBe(b.rules.length);
    for (let i = 0; i < a.rules.length; i += 1) {
      expect(a.rules[i].stableSelector).toBe(b.rules[i].stableSelector);
      expect(a.rules[i].hostname).toBe(b.rules[i].hostname);
    }
  });
});

describe('validateATSRuleInput', () => {
  const baseRule = buildGreenhouseRulePack().rules[0];

  it('returns [] for a valid rule', () => {
    expect(validateATSRuleInput(baseRule)).toEqual([]);
  });

  it('catches empty hostname', () => {
    expect(
      validateATSRuleInput({ ...baseRule, hostname: '' }),
    ).toContain('hostname-missing');
  });

  it('catches bad confidence', () => {
    expect(
      validateATSRuleInput({ ...baseRule, confidence: 2 }),
    ).toContain('confidence-out-of-range');
    expect(
      validateATSRuleInput({ ...baseRule, confidence: -0.1 }),
    ).toContain('confidence-out-of-range');
  });

  it('catches negative stepIndex', () => {
    expect(
      validateATSRuleInput({ ...baseRule, stepIndex: -1 }),
    ).toContain('stepIndex-invalid');
  });

  it('catches empty sourceTrainingSessionIds', () => {
    expect(
      validateATSRuleInput({ ...baseRule, sourceTrainingSessionIds: [] }),
    ).toContain('sourceTrainingSessionIds-empty');
  });
});
