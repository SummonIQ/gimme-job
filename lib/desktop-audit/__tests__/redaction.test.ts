import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SENSITIVE_KEYS,
  redactIdentityReadPayload,
  redactSensitivePayload,
} from '../redaction';

describe('redactSensitivePayload', () => {
  it('redacts top-level identity keys', () => {
    const result = redactSensitivePayload({
      email: 'steven@example.com',
      firstName: 'Steven',
      jobTitle: 'Senior Engineer', // not sensitive
    });
    const payload = result.payload as Record<string, unknown>;
    expect(payload.firstName).toBe('[REDACTED]');
    expect(payload.email).toBe('[REDACTED]');
    expect(payload.jobTitle).toBe('Senior Engineer');
    expect(result.redactedKeys).toContain('firstName');
    expect(result.redactedKeys).toContain('email');
  });

  it('redacts nested keys with dot-path reporting', () => {
    const result = redactSensitivePayload({
      action: 'tool_call',
      arguments: {
        phone: '555-0100',
        preference: 'remote',
      },
    });
    const payload = result.payload as Record<string, Record<string, unknown>>;
    expect(payload.arguments.phone).toBe('[REDACTED]');
    expect(payload.arguments.preference).toBe('remote');
    expect(result.redactedKeys).toContain('arguments.phone');
  });

  it('walks through arrays', () => {
    const result = redactSensitivePayload({
      contacts: [
        { email: 'a@b.com', label: 'work' },
        { email: 'c@d.com', label: 'personal' },
      ],
    });
    const payload = result.payload as {
      contacts: Array<Record<string, unknown>>;
    };
    expect(payload.contacts[0].email).toBe('[REDACTED]');
    expect(payload.contacts[0].label).toBe('work');
    expect(result.redactedKeys).toContain('contacts[0].email');
    expect(result.redactedKeys).toContain('contacts[1].email');
  });

  it('is case-insensitive on keys', () => {
    const result = redactSensitivePayload({
      Email: 'x@y.com',
      SSN: '000-00-0000',
    });
    const payload = result.payload as Record<string, unknown>;
    expect(payload.Email).toBe('[REDACTED]');
    expect(payload.SSN).toBe('[REDACTED]');
  });

  it('handles primitives, null, and arrays at root', () => {
    expect(redactSensitivePayload('hello').payload).toBe('hello');
    expect(redactSensitivePayload(42).payload).toBe(42);
    expect(redactSensitivePayload(null).payload).toBeNull();
    expect(redactSensitivePayload([1, 2, 3]).payload).toEqual([1, 2, 3]);
  });

  it('accepts a custom sensitive-key set', () => {
    const custom = new Set(['inscrutable']);
    const result = redactSensitivePayload(
      { email: 'x@y.com', inscrutable: 'x' },
      custom,
    );
    const payload = result.payload as Record<string, unknown>;
    // email passes through because it's not in the custom set
    expect(payload.email).toBe('x@y.com');
    expect(payload.inscrutable).toBe('[REDACTED]');
  });

  it('DEFAULT_SENSITIVE_KEYS includes the obvious ones', () => {
    for (const k of ['email', 'phone', 'ssn', 'password', 'token', 'value']) {
      expect(DEFAULT_SENSITIVE_KEYS.has(k)).toBe(true);
    }
  });

  it('redacts generic value fields because fill/select tool payloads can contain PII', () => {
    const result = redactSensitivePayload({
      input: {
        selector: '#first_name',
        value: 'Steven',
      },
    });
    const payload = result.payload as { input: Record<string, unknown> };
    expect(payload.input.value).toBe('[REDACTED]');
    expect(payload.input.selector).toBe('#first_name');
    expect(result.redactedKeys).toContain('input.value');
  });
});

describe('redactIdentityReadPayload', () => {
  it('keeps the key but redacts the value', () => {
    const result = redactIdentityReadPayload({
      key: 'first_name',
      value: 'Steven',
    });
    expect(result.payload).toEqual({
      key: 'first_name',
      value: '[REDACTED]',
    });
    expect(result.redactedKeys).toContain('value');
  });

  it('redacts even when no key is given', () => {
    const result = redactIdentityReadPayload({ value: 'Steven' });
    expect(result.payload).toEqual({ value: '[REDACTED]' });
  });

  it('handles non-object payloads defensively', () => {
    expect(redactIdentityReadPayload(null).payload).toEqual({
      redactedValue: '[REDACTED]',
    });
    expect(redactIdentityReadPayload('raw').payload).toEqual({
      redactedValue: '[REDACTED]',
    });
  });

  it('never surfaces the original value in the output for identity reads', () => {
    const result = redactIdentityReadPayload({
      key: 'first_name',
      value: 'SecretNameAlpha',
    });
    expect(JSON.stringify(result.payload)).not.toContain('SecretNameAlpha');
  });
});
