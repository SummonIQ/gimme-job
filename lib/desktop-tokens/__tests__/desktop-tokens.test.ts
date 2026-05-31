import { describe, expect, it } from 'vitest';

import {
  __TESTING__,
  generatePairingCode,
  generateRawToken,
  hashToken,
} from '../index';

describe('hashToken', () => {
  it('is deterministic for the same input', () => {
    expect(hashToken('hello')).toBe(hashToken('hello'));
  });
  it('differs for different inputs', () => {
    expect(hashToken('a')).not.toBe(hashToken('b'));
  });
  it('is 64 hex chars (SHA-256)', () => {
    expect(hashToken('x')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('generateRawToken', () => {
  it(`starts with the well-known prefix ${__TESTING__.TOKEN_PREFIX}`, () => {
    expect(generateRawToken().startsWith(__TESTING__.TOKEN_PREFIX)).toBe(true);
  });
  it('produces a different token on each call', () => {
    expect(generateRawToken()).not.toBe(generateRawToken());
  });
  it('has at least 40 characters (prefix + base64 suffix)', () => {
    expect(generateRawToken().length).toBeGreaterThan(40);
  });
});

describe('generatePairingCode', () => {
  it('defaults to 6 digits', () => {
    const code = generatePairingCode();
    expect(code).toHaveLength(__TESTING__.PAIRING_CODE_DIGITS);
    expect(code).toMatch(/^[0-9]+$/);
  });
  it('respects a custom length', () => {
    expect(generatePairingCode(4)).toHaveLength(4);
  });
  it('differs across calls (probabilistically)', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 50; i += 1) codes.add(generatePairingCode());
    // 50 draws, 10^6 space - effectively guaranteed distinct.
    expect(codes.size).toBeGreaterThan(40);
  });
});

describe('constants', () => {
  it('TTL is 10 minutes', () => {
    expect(__TESTING__.PAIRING_CODE_TTL_MS).toBe(10 * 60 * 1000);
  });
  it('default scopes include desktop:runtime', () => {
    expect(__TESTING__.DEFAULT_SCOPES).toContain('desktop:runtime');
  });
});
