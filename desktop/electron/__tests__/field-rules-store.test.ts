import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => process.env.FIELD_RULES_TEST_USER_DATA ?? '/tmp'),
  },
}));

const tempDirs: string[] = [];

describe('field-rules-store promotion', () => {
  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map(dir => rm(dir, { force: true, recursive: true })),
    );
    delete process.env.FIELD_RULES_TEST_USER_DATA;
  });

  it('promotes three same-answer hostnames to one global rule', async () => {
    const store = await loadStore();

    store.addFieldRule({
      answer: 'Yes',
      hostname: 'jobs.one.test',
      question: 'Are you authorized to work in the US?',
      source: 'state-tab',
    });
    store.addFieldRule({
      answer: 'Yes',
      hostname: 'jobs.two.test',
      question: 'Are you authorized to work in the US?',
      source: 'state-tab',
    });
    store.addFieldRule({
      answer: 'Yes',
      hostname: 'jobs.three.test',
      question: 'Are you authorized to work in the US?',
      source: 'state-tab',
    });

    const rules = store.getAllFieldRules();
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      answer: 'Yes',
      hostname: null,
      question: 'Are you authorized to work in the US?',
    });
  });

  it('does not promote fewer than three hostnames', async () => {
    const store = await loadStore();

    store.addFieldRule({
      answer: 'No',
      hostname: 'jobs.one.test',
      question: 'Do you need sponsorship?',
    });
    store.addFieldRule({
      answer: 'No',
      hostname: 'jobs.two.test',
      question: 'Do you need sponsorship?',
    });

    const rules = store.getAllFieldRules();
    expect(rules).toHaveLength(2);
    expect(rules.every(rule => rule.hostname)).toBe(true);
  });

  it('does not promote conflicting answers across hostnames', async () => {
    const store = await loadStore();

    store.addFieldRule({
      answer: 'Yes',
      hostname: 'jobs.one.test',
      question: 'Are you willing to relocate?',
    });
    store.addFieldRule({
      answer: 'No',
      hostname: 'jobs.two.test',
      question: 'Are you willing to relocate?',
    });
    store.addFieldRule({
      answer: 'Yes',
      hostname: 'jobs.three.test',
      question: 'Are you willing to relocate?',
    });

    const rules = store.getAllFieldRules();
    expect(rules).toHaveLength(3);
    expect(rules.some(rule => rule.hostname === null)).toBe(false);
  });
});

async function loadStore() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'field-rules-store-'));
  tempDirs.push(dir);
  process.env.FIELD_RULES_TEST_USER_DATA = dir;
  const store = await import('../field-rules-store');
  store.configureFieldRuleSync(null);
  for (const rule of [...store.getAllFieldRules()]) {
    store.removeFieldRule(rule.id);
  }
  return store;
}
