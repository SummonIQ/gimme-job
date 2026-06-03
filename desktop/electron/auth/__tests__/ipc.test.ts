import { describe, expect, it, vi } from 'vitest';

import {
  DESKTOP_AUTH_IPC_CHANNELS,
  type DesktopAuthIpcHandler,
  type DesktopAuthIpcMain,
  registerDesktopAuthIpc,
} from '../ipc';
import { createMemoryTokenStore } from '../keychain-store';
import { DesktopAuthSession } from '../session';
import type { DesktopTokenClient } from '../types';

class FakeIpcMain implements DesktopAuthIpcMain {
  readonly handlers = new Map<string, DesktopAuthIpcHandler>();

  handle(channel: string, handler: DesktopAuthIpcHandler) {
    this.handlers.set(channel, handler);
  }

  async invoke(channel: string, ...args: unknown[]) {
    const handler = this.handlers.get(channel);

    if (!handler) {
      throw new Error(`Missing handler for ${channel}`);
    }

    return handler({}, ...args);
  }
}

const client: DesktopTokenClient = {
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
};

describe('registerDesktopAuthIpc', () => {
  it('registers auth state and pairing handlers', async () => {
    const ipcMain = new FakeIpcMain();
    const session = new DesktopAuthSession({
      client,
      deviceLabel: 'Test Desktop',
      deviceOs: 'darwin-test',
      store: createMemoryTokenStore(),
    });

    registerDesktopAuthIpc(ipcMain, session);

    await expect(
      ipcMain.invoke(DESKTOP_AUTH_IPC_CHANNELS.getState),
    ).resolves.toMatchObject({ status: 'unpaired' });
    await expect(
      ipcMain.invoke(DESKTOP_AUTH_IPC_CHANNELS.pairWithCode, '123456'),
    ).resolves.toMatchObject({ status: 'paired' });
    await expect(
      ipcMain.invoke(DESKTOP_AUTH_IPC_CHANNELS.clearToken),
    ).resolves.toMatchObject({ status: 'unpaired' });
  });

  it('rejects non-string pairing codes', async () => {
    const ipcMain = new FakeIpcMain();
    const session = new DesktopAuthSession({
      client,
      deviceLabel: 'Test Desktop',
      deviceOs: 'darwin-test',
      store: createMemoryTokenStore(),
    });

    registerDesktopAuthIpc(ipcMain, session);

    await expect(
      ipcMain.invoke(DESKTOP_AUTH_IPC_CHANNELS.pairWithCode, 123456),
    ).rejects.toThrow('Pairing code must be a string.');
  });
});
