import { describe, expect, it } from 'vitest';

import {
  IDENTITY_KEYS,
  IDENTITY_SCHEMA,
  assertIdentityKey,
  isIdentityKey,
  keysByGroup,
  validateIdentityValue,
} from '../schema.js';

describe('IDENTITY_SCHEMA', () => {
  it('defines every key in IDENTITY_KEYS', () => {
    for (const key of IDENTITY_KEYS) {
      expect(IDENTITY_SCHEMA[key]).toBeDefined();
      expect(IDENTITY_SCHEMA[key].key).toBe(key);
    }
  });

  it('marks the obviously-required keys required', () => {
    for (const k of [
      'first_name',
      'last_name',
      'email',
      'phone',
      'resume_pdf_path',
      'work_authorization',
      'sponsorship_required',
    ]) {
      expect(IDENTITY_SCHEMA[k as never].required).toBe(true);
    }
  });

  it('marks the voluntary demographic keys as NOT required', () => {
    for (const k of ['gender', 'race_ethnicity', 'veteran_status', 'disability_status']) {
      expect(IDENTITY_SCHEMA[k as never].required).toBe(false);
    }
  });
});

describe('isIdentityKey / assertIdentityKey', () => {
  it('accepts known keys', () => {
    expect(isIdentityKey('first_name')).toBe(true);
    expect(assertIdentityKey('email')).toBe('email');
  });
  it('rejects unknown keys', () => {
    expect(isIdentityKey('nope')).toBe(false);
    expect(isIdentityKey(42)).toBe(false);
    expect(isIdentityKey(null)).toBe(false);
  });
  it('assertIdentityKey throws with a helpful message', () => {
    expect(() => assertIdentityKey('ssn')).toThrow(/unknown key "ssn"/);
  });
});

describe('validateIdentityValue', () => {
  it('rejects empty values for simple strings', () => {
    expect(validateIdentityValue('first_name', '')).toEqual({
      ok: false,
      reason: 'value is empty',
    });
    expect(validateIdentityValue('first_name', '   ')).toEqual({
      ok: false,
      reason: 'value is empty',
    });
  });

  it('accepts a reasonable first_name', () => {
    expect(validateIdentityValue('first_name', 'Steven')).toEqual({
      ok: true,
      reason: null,
    });
  });

  it('email validator rejects malformed', () => {
    expect(validateIdentityValue('email', 'not-an-email')).toEqual({
      ok: false,
      reason: 'must contain @ and a dot',
    });
    expect(validateIdentityValue('email', 'a@b').ok).toBe(false);
  });
  it('email validator accepts a plausible address', () => {
    expect(
      validateIdentityValue('email', 'steven@example.com'),
    ).toEqual({ ok: true, reason: null });
  });

  it('phone validator wants >=7 digits', () => {
    expect(validateIdentityValue('phone', '555').ok).toBe(false);
    expect(validateIdentityValue('phone', '415-555-0137').ok).toBe(true);
    expect(validateIdentityValue('phone', '+1 (415) 555-0137').ok).toBe(true);
  });

  it('URL validator demands http(s)', () => {
    expect(validateIdentityValue('github_url', 'not-a-url').ok).toBe(false);
    expect(
      validateIdentityValue('github_url', 'ftp://example.com/x'),
    ).toEqual({ ok: false, reason: 'must be http(s) URL' });
    expect(
      validateIdentityValue('github_url', 'https://github.com/steven'),
    ).toEqual({ ok: true, reason: null });
  });

  it('file-path validator demands a path separator', () => {
    expect(
      validateIdentityValue('resume_pdf_path', 'resume.pdf'),
    ).toEqual({
      ok: false,
      reason: 'must be an absolute or relative file path',
    });
    expect(
      validateIdentityValue('resume_pdf_path', '/home/steven/resume.pdf'),
    ).toEqual({ ok: true, reason: null });
  });
});

describe('keysByGroup', () => {
  it('partitions every key into exactly one group', () => {
    const groups = keysByGroup();
    const total =
      groups.core.length +
      groups.links.length +
      groups.files.length +
      groups.compliance.length +
      groups.voluntary.length;
    expect(total).toBe(IDENTITY_KEYS.length);
  });
});
