import { describe, expect, it } from 'vitest';

import {
  checkSubmitGuard,
  familyFromHostname,
  isInboxReachable,
  parseBlocklist,
} from '../checks';

describe('familyFromHostname', () => {
  it('maps known ATS hostnames', () => {
    expect(familyFromHostname('job-boards.greenhouse.io')).toBe('greenhouse');
    expect(familyFromHostname('jobs.lever.co')).toBe('lever');
    expect(familyFromHostname('jobs.ashbyhq.com')).toBe('ashby');
    expect(familyFromHostname('acme.wd1.myworkdayjobs.com')).toBe('workday');
    expect(familyFromHostname('uhg.taleo.net')).toBe('taleo');
  });
  it('returns null on unknown hostnames', () => {
    expect(familyFromHostname('unknown.example.com')).toBeNull();
  });
});

describe('parseBlocklist', () => {
  it('extracts bullet entries under the Entries heading', () => {
    const md = `# Blocklist\n\n## Entries\n\n- foo.example.com\n- bar.example.com\n`;
    const set = parseBlocklist(md);
    expect(set.has('foo.example.com')).toBe(true);
    expect(set.has('bar.example.com')).toBe(true);
    expect(set.size).toBe(2);
  });
  it('ignores content outside the Entries heading', () => {
    const md = `# Blocklist\n\n## Format\n\n- ignored.example\n\n## Entries\n\n- kept.example\n`;
    const set = parseBlocklist(md);
    expect(set.has('kept.example')).toBe(true);
    expect(set.has('ignored.example')).toBe(false);
  });
  it('lowercases and trims entries', () => {
    const md = `## Entries\n\n-   UPPER.Example.COM   \n`;
    const set = parseBlocklist(md);
    expect(set.has('upper.example.com')).toBe(true);
  });
  it('strips trailing HTML-comment metadata from a bullet', () => {
    const md = `## Entries\n\n- host.example <!-- added 2026-04-22 by steven -->\n`;
    const set = parseBlocklist(md);
    expect(set.has('host.example')).toBe(true);
  });
});

describe('isInboxReachable', () => {
  const now = new Date('2026-04-22T12:00:00Z');

  it('false when inactive', () => {
    expect(
      isInboxReachable(
        {
          isActive: false,
          lastPolledAt: now,
          pollingCadenceSeconds: 300,
        },
        now,
      ),
    ).toBe(false);
  });

  it('true when isActive + never polled', () => {
    expect(
      isInboxReachable(
        { isActive: true, lastPolledAt: null, pollingCadenceSeconds: 300 },
        now,
      ),
    ).toBe(true);
  });

  it('true when polled within 3x cadence', () => {
    const lastPolledAt = new Date(now.getTime() - 800 * 1000); // 800s ago
    expect(
      isInboxReachable(
        { isActive: true, lastPolledAt, pollingCadenceSeconds: 300 },
        now,
      ),
    ).toBe(true);
  });

  it('false when polled outside 3x cadence', () => {
    const lastPolledAt = new Date(now.getTime() - 1000 * 1000); // 1000s > 900
    expect(
      isInboxReachable(
        { isActive: true, lastPolledAt, pollingCadenceSeconds: 300 },
        now,
      ),
    ).toBe(false);
  });
});

describe('checkSubmitGuard', () => {
  const originalFlags = [
    ['SUBMIT_GUARD', process.env.SUBMIT_GUARD],
    ['APP_SUBMIT_GUARD', process.env.APP_SUBMIT_GUARD],
  ] as const;

  function clear() {
    delete process.env.SUBMIT_GUARD;
    delete process.env.APP_SUBMIT_GUARD;
  }
  function restore() {
    for (const [key, value] of originalFlags) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }

  it('defaults to ok when neither flag is set', () => {
    clear();
    try {
      expect(checkSubmitGuard().ok).toBe(true);
    } finally {
      restore();
    }
  });

  it('fails when explicitly off', () => {
    clear();
    process.env.SUBMIT_GUARD = 'false';
    try {
      const result = checkSubmitGuard();
      expect(result.ok).toBe(false);
      expect(result.reasonCode).toBe('GUARD_OFF');
    } finally {
      restore();
    }
  });

  it('accepts "0", "off", "no" as off', () => {
    clear();
    for (const value of ['0', 'off', 'no', 'OFF']) {
      process.env.SUBMIT_GUARD = value;
      expect(checkSubmitGuard().ok).toBe(false);
    }
    restore();
  });
});
