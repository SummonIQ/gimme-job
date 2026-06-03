import os from 'node:os';

import { createDesktopTokenClient } from './client.js';
import { createDesktopTokenStore } from './keychain-store.js';
import type {
  DesktopAuthState,
  DesktopTokenClient,
  DesktopTokenStore,
} from './types.js';

export interface DesktopAuthSessionOptions {
  readonly client: DesktopTokenClient;
  readonly deviceLabel: string;
  readonly deviceOs: string;
  readonly store: DesktopTokenStore;
}

export class DesktopAuthSession {
  private readonly client: DesktopTokenClient;
  private readonly deviceLabel: string;
  private readonly deviceOs: string;
  private readonly store: DesktopTokenStore;
  // Cached userId from the most recent successful getState()/pairWithCode().
  // peekUserId() returns this without hitting the network — used by
  // scrape-ipc.startScrape to attribute the run to a real user.
  private lastUserId: string | null = null;

  constructor(options: DesktopAuthSessionOptions) {
    this.client = options.client;
    this.deviceLabel = options.deviceLabel;
    this.deviceOs = options.deviceOs;
    this.store = options.store;
  }

  peekUserId(): string | null {
    return this.lastUserId;
  }

  async getState(): Promise<DesktopAuthState> {
    const token = await this.store.readToken();

    if (!token) {
      return {
        message: 'Pair this desktop from the web admin page.',
        status: 'unpaired',
      };
    }

    const result = await this.client.validateToken(token);

    if (!result.ok) {
      this.lastUserId = null;
      return {
        message: result.reason,
        status: 'invalid',
      };
    }

    this.lastUserId = result.userId;
    return {
      scopes: result.scopes,
      status: 'paired',
      tokenId: result.tokenId,
      userId: result.userId,
    };
  }

  async pairWithCode(code: string): Promise<DesktopAuthState> {
    const trimmedCode = code.trim();

    if (!trimmedCode) {
      return { message: 'Pairing code is required.', status: 'unpaired' };
    }

    const result = await this.client.exchangePairingCode({
      code: trimmedCode,
      deviceOs: this.deviceOs,
      label: this.deviceLabel,
    });

    if (!result.ok) {
      return { message: result.reason, status: 'invalid' };
    }

    await this.store.writeToken(result.token);

    this.lastUserId = result.userId;
    return {
      scopes: ['desktop:runtime'],
      status: 'paired',
      tokenId: result.tokenId,
      userId: result.userId,
    };
  }

  async clearToken(): Promise<DesktopAuthState> {
    await this.store.clearToken();
    this.lastUserId = null;
    return {
      message: 'Desktop token cleared.',
      status: 'unpaired',
    };
  }
}

export function createDesktopAuthSession(input: {
  readonly appUrl: string;
  readonly deviceLabel?: string;
}): DesktopAuthSession {
  return new DesktopAuthSession({
    client: createDesktopTokenClient({ appUrl: input.appUrl }),
    deviceLabel: input.deviceLabel ?? 'Gimme Job Desktop',
    deviceOs: `${process.platform}-${os.release()}`,
    store: createDesktopTokenStore(),
  });
}
