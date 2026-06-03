import { describe, expect, it, vi } from 'vitest';

import { createMemoryTokenStore } from '../keychain-store';
import { DesktopAuthSession } from '../session';
import type { DesktopTokenClient } from '../types';

function createClient(
  overrides: Partial<DesktopTokenClient> = {},
): DesktopTokenClient {
  return {
    exchangePairingCode: vi.fn(async () => ({
      ok: true,
      token: 'gj_desk_test',
      tokenId: 'token_1',
      userId: 'user_1',
    })),
    validateToken: vi.fn(async () => ({
      ok: true,
      scopes: ['desktop:runtime'],
      tokenId: 'token_1',
      userId: 'user_1',
    })),
    ...overrides,
  };
}

function createSession(
  opts: {
    readonly client?: DesktopTokenClient;
    readonly initialToken?: string | null;
  } = {},
) {
  return new DesktopAuthSession({
    client: opts.client ?? createClient(),
    deviceLabel: 'Test Desktop',
    deviceOs: 'darwin-test',
    store: createMemoryTokenStore(opts.initialToken ?? null),
  });
}

describe('DesktopAuthSession', () => {
  it('starts unpaired when no token is stored', async () => {
    await expect(createSession().getState()).resolves.toMatchObject({
      status: 'unpaired',
    });
  });

  it('exchanges a pairing code and stores the raw token', async () => {
    const client = createClient();
    const session = createSession({ client });

    await expect(session.pairWithCode('123456')).resolves.toMatchObject({
      status: 'paired',
      tokenId: 'token_1',
    });
    await expect(session.getState()).resolves.toMatchObject({
      status: 'paired',
      userId: 'user_1',
    });
    expect(client.exchangePairingCode).toHaveBeenCalledWith({
      code: '123456',
      deviceOs: 'darwin-test',
      label: 'Test Desktop',
    });
  });

  it('loads a stored token on restart and validates it', async () => {
    const client = createClient();
    const session = createSession({ client, initialToken: 'gj_desk_stored' });

    await expect(session.getState()).resolves.toMatchObject({
      status: 'paired',
      tokenId: 'token_1',
    });
    expect(client.validateToken).toHaveBeenCalledWith('gj_desk_stored');
  });

  it('reports invalid state when the web admin revoked the token', async () => {
    const session = createSession({
      client: createClient({
        validateToken: vi.fn(async () => ({
          ok: false,
          reason: 'TOKEN_REVOKED',
        })),
      }),
      initialToken: 'gj_desk_revoked',
    });

    await expect(session.getState()).resolves.toMatchObject({
      message: 'TOKEN_REVOKED',
      status: 'invalid',
    });
  });
});
