import { describe, expect, it } from 'vitest';

import {
  IDENTITY_PLACEHOLDER,
  redactIdentityInObject,
  redactIdentityInValue,
} from '../redaction.js';
import { createMemoryIdentityStore } from '../store.js';

const SNAPSHOT = {
  email: 'steven@example.com',
  first_name: 'Steven',
  phone: '4155550137',
};

describe('redactIdentityInValue', () => {
  it('replaces exact-match strings', () => {
    const result = redactIdentityInValue('Steven', SNAPSHOT);
    expect(result.value).toBe(IDENTITY_PLACEHOLDER);
    expect(result.redactionCount).toBe(1);
  });

  it('replaces embedded matches', () => {
    const result = redactIdentityInValue(
      'Dear Steven, thanks for your application.',
      SNAPSHOT,
    );
    expect(result.value).toBe(
      `Dear ${IDENTITY_PLACEHOLDER}, thanks for your application.`,
    );
  });

  it('walks arrays', () => {
    const result = redactIdentityInValue(
      ['Steven', 'hello', 'steven@example.com'],
      SNAPSHOT,
    );
    expect(result.value).toEqual([
      IDENTITY_PLACEHOLDER,
      'hello',
      IDENTITY_PLACEHOLDER,
    ]);
    expect(result.redactionCount).toBe(2);
  });

  it('walks objects and preserves non-identity strings', () => {
    const result = redactIdentityInValue(
      {
        messages: [
          { author: 'Steven', content: 'Please review.' },
          { author: 'Recruiter', content: 'Reach me at 4155550137.' },
        ],
        role: 'Senior Engineer',
      },
      SNAPSHOT,
    );
    const v = result.value as {
      messages: Array<{ author: string; content: string }>;
      role: string;
    };
    expect(v.messages[0].author).toBe(IDENTITY_PLACEHOLDER);
    expect(v.messages[0].content).toBe('Please review.');
    expect(v.messages[1].author).toBe('Recruiter');
    expect(v.messages[1].content).toBe(
      `Reach me at ${IDENTITY_PLACEHOLDER}.`,
    );
    expect(v.role).toBe('Senior Engineer');
  });

  it('empty snapshot leaves the value untouched', () => {
    const result = redactIdentityInValue(
      { name: 'Steven', email: 'steven@example.com' },
      {},
    );
    expect(result.value).toEqual({
      email: 'steven@example.com',
      name: 'Steven',
    });
    expect(result.redactionCount).toBe(0);
  });

  it('ignores empty string values in the snapshot', () => {
    const result = redactIdentityInValue('', { some_key: '' });
    expect(result.value).toBe('');
    expect(result.redactionCount).toBe(0);
  });

  it('handles nested deeply', () => {
    const result = redactIdentityInValue(
      { outer: { middle: { inner: ['Steven', 42, null] } } },
      SNAPSHOT,
    );
    const v = result.value as {
      outer: { middle: { inner: unknown[] } };
    };
    expect(v.outer.middle.inner[0]).toBe(IDENTITY_PLACEHOLDER);
    expect(v.outer.middle.inner[1]).toBe(42);
    expect(v.outer.middle.inner[2]).toBeNull();
  });
});

describe('redactIdentityInObject (async wrapper)', () => {
  it('prompt-trace assertion: a populated identity never appears in a serialized prompt', async () => {
    const store = createMemoryIdentityStore({
      email: 'steven@example.com',
      first_name: 'Steven',
      phone: '4155550137',
    });

    // Simulated Agent SDK prompt trace object - the shape the agent SDK
    // would emit for tool traces. Intentionally carries raw identity
    // values in several places.
    const trace = {
      messages: [
        { content: 'You are a helpful agent.', role: 'system' },
        {
          content: 'Please fill out the form for Steven.',
          role: 'user',
        },
        {
          content: null,
          role: 'assistant',
          tool_calls: [
            {
              args: {
                selector: '#first_name',
                value: 'Steven',
              },
              name: 'fill',
            },
            {
              args: { selector: '#email', value: 'steven@example.com' },
              name: 'fill',
            },
          ],
        },
      ],
      metadata: {
        sessionId: 'abc-123',
      },
    };

    const result = await redactIdentityInObject(trace, store);
    const serialized = JSON.stringify(result.value);

    // No identity value string may appear in the serialized trace.
    expect(serialized).not.toContain('Steven');
    expect(serialized).not.toContain('steven@example.com');
    expect(serialized).not.toContain('4155550137');
    // Placeholder does appear.
    expect(serialized).toContain(IDENTITY_PLACEHOLDER);
    // Non-identity metadata is preserved.
    expect(serialized).toContain('abc-123');
    expect(serialized).toContain('fill');
  });

  it('redactIdentityInObject against an empty store is a no-op', async () => {
    const store = createMemoryIdentityStore();
    const input = { role: 'Senior Engineer' };
    const result = await redactIdentityInObject(input, store);
    expect(result.value).toEqual(input);
    expect(result.redactionCount).toBe(0);
  });
});
