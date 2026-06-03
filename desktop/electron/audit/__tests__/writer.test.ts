import { describe, expect, it, vi } from 'vitest';

import { createMemoryTokenStore } from '../../auth/keychain-store.js';
import { createDesktopAuditWriter } from '../writer.js';

function response(payload: unknown, init: { status?: number } = {}) {
  return new Response(JSON.stringify(payload), {
    headers: { 'content-type': 'application/json' },
    status: init.status ?? 200,
  });
}

describe('createDesktopAuditWriter', () => {
  it('posts audit rows with the paired desktop token', async () => {
    const fetchImpl = vi.fn(async () =>
      response({ created: 1, ids: ['audit-1'] }),
    );
    const writer = createDesktopAuditWriter({
      appUrl: 'https://app.example.test/',
      desktopSessionId: 'desktop-session-1',
      fetchImpl,
      tokenStore: createMemoryTokenStore('raw-token'),
    });

    const result = await writer.write({
      action: 'tool_call',
      payload: { selector: '#first_name' },
      toolName: 'fill',
    });

    expect(result).toEqual({ created: 1, ids: ['audit-1'] });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://app.example.test/api/desktop-audit/ingest',
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer raw-token',
        }),
        method: 'POST',
      }),
    );

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body as string);
    expect(body.rows[0]).toMatchObject({
      action: 'tool_call',
      desktopSessionId: 'desktop-session-1',
      toolName: 'fill',
    });
  });

  it('redacts identity-read values before leaving the desktop process', async () => {
    const fetchImpl = vi.fn(async () =>
      response({ created: 1, ids: ['audit-1'] }),
    );
    const writer = createDesktopAuditWriter({
      appUrl: 'https://app.example.test',
      desktopSessionId: 'desktop-session-1',
      fetchImpl,
      tokenStore: createMemoryTokenStore('raw-token'),
    });

    await writer.write({
      action: 'identity_read',
      payload: { key: 'first_name', value: 'SecretNameAlpha' },
      toolName: 'identity_load',
    });

    const serialized = fetchImpl.mock.calls[0][1].body as string;
    expect(serialized).not.toContain('SecretNameAlpha');
    expect(JSON.parse(serialized).rows[0].payload).toEqual({
      key: 'first_name',
      value: '[REDACTED]',
    });
  });

  it('redacts sensitive keys in regular tool payloads', async () => {
    const fetchImpl = vi.fn(async () =>
      response({ created: 1, ids: ['audit-1'] }),
    );
    const writer = createDesktopAuditWriter({
      appUrl: 'https://app.example.test',
      fetchImpl,
      tokenStore: createMemoryTokenStore('raw-token'),
    });

    await writer.write({
      action: 'tool_call',
      payload: { input: { email: 'steven@example.test', role: 'engineer' } },
      toolName: 'fill',
    });

    const payload = JSON.parse(fetchImpl.mock.calls[0][1].body as string)
      .rows[0].payload;
    expect(payload.input.email).toBe('[REDACTED]');
    expect(payload.input.role).toBe('engineer');
  });

  it('redacts generic value fields before tool payloads leave the desktop', async () => {
    const fetchImpl = vi.fn(async () =>
      response({ created: 1, ids: ['audit-1'] }),
    );
    const writer = createDesktopAuditWriter({
      appUrl: 'https://app.example.test',
      fetchImpl,
      tokenStore: createMemoryTokenStore('raw-token'),
    });

    await writer.write({
      action: 'tool_call',
      payload: {
        input: { selector: '#first_name', value: 'SecretNameAlpha' },
      },
      toolName: 'fill',
    });

    const serialized = fetchImpl.mock.calls[0][1].body as string;
    expect(serialized).not.toContain('SecretNameAlpha');
    expect(JSON.parse(serialized).rows[0].payload.input.value).toBe(
      '[REDACTED]',
    );
  });


  it('fails loudly when no paired token is available', async () => {
    const writer = createDesktopAuditWriter({
      appUrl: 'https://app.example.test',
      fetchImpl: vi.fn(),
      tokenStore: createMemoryTokenStore(null),
    });

    await expect(
      writer.write({ action: 'tool_call', payload: {}, toolName: 'fill' }),
    ).rejects.toThrow(/paired desktop token is required/);
  });
});
