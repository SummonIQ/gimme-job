import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __TESTING__,
  decryptCredential,
  encryptCredential,
} from '../auth';

const originalKey = process.env[__TESTING__.ENV_VAR];

describe('encryptCredential / decryptCredential', () => {
  beforeEach(() => {
    process.env[__TESTING__.ENV_VAR] =
      'test-key-DO-NOT-USE-IN-PROD-p10-5-unit-tests';
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env[__TESTING__.ENV_VAR];
    } else {
      process.env[__TESTING__.ENV_VAR] = originalKey;
    }
  });

  it('round-trips a short plaintext', () => {
    const plaintext = 'app-password-abc123';
    const encrypted = encryptCredential(plaintext);
    expect(encrypted).toMatch(/^v1:/);
    expect(decryptCredential(encrypted)).toBe(plaintext);
  });

  it('round-trips multi-line plaintext (access_token\\nrefresh_token)', () => {
    const plaintext = 'ya29.access-token-part\n1//refresh-token-part';
    const encrypted = encryptCredential(plaintext);
    expect(decryptCredential(encrypted)).toBe(plaintext);
  });

  it('produces a different ciphertext each call (non-deterministic IV)', () => {
    const plaintext = 'abc';
    const a = encryptCredential(plaintext);
    const b = encryptCredential(plaintext);
    expect(a).not.toBe(b);
    expect(decryptCredential(a)).toBe(plaintext);
    expect(decryptCredential(b)).toBe(plaintext);
  });

  it('rejects an empty plaintext', () => {
    expect(() => encryptCredential('')).toThrow(/must not be empty/);
  });

  it('rejects a tampered ciphertext (GCM auth-tag validation)', () => {
    const encrypted = encryptCredential('hello');
    const parts = encrypted.split(':');
    const bad = Buffer.from(parts[3], 'base64');
    bad[0] ^= 0xff;
    const tampered = [parts[0], parts[1], parts[2], bad.toString('base64')].join(':');
    expect(() => decryptCredential(tampered)).toThrow();
  });

  it('rejects a payload with the wrong version tag', () => {
    const encrypted = encryptCredential('hello');
    const parts = encrypted.split(':');
    const wrongVersion = ['v99', parts[1], parts[2], parts[3]].join(':');
    expect(() => decryptCredential(wrongVersion)).toThrow(
      /unsupported key version/,
    );
  });

  it('rejects a malformed payload', () => {
    expect(() => decryptCredential('not:a:payload')).toThrow(
      /malformed payload/,
    );
  });

  it('encryption requires the env var to be set', () => {
    delete process.env[__TESTING__.ENV_VAR];
    expect(() => encryptCredential('x')).toThrow(
      new RegExp(`${__TESTING__.ENV_VAR} is required`),
    );
  });

  it('round-trip survives a long random binary-safe string', () => {
    const long = Array.from({ length: 512 })
      .map(() => Math.random().toString(36))
      .join('');
    const encrypted = encryptCredential(long);
    expect(decryptCredential(encrypted)).toBe(long);
  });
});
