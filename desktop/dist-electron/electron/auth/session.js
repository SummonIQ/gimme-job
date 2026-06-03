import os from 'node:os';
import { createDesktopTokenClient } from './client.js';
import { createDesktopTokenStore } from './keychain-store.js';
export class DesktopAuthSession {
    client;
    deviceLabel;
    deviceOs;
    store;
    // Cached userId from the most recent successful getState()/pairWithCode().
    // peekUserId() returns this without hitting the network — used by
    // scrape-ipc.startScrape to attribute the run to a real user.
    lastUserId = null;
    constructor(options) {
        this.client = options.client;
        this.deviceLabel = options.deviceLabel;
        this.deviceOs = options.deviceOs;
        this.store = options.store;
    }
    peekUserId() {
        return this.lastUserId;
    }
    async getState() {
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
    async pairWithCode(code) {
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
    async clearToken() {
        await this.store.clearToken();
        this.lastUserId = null;
        return {
            message: 'Desktop token cleared.',
            status: 'unpaired',
        };
    }
}
export function createDesktopAuthSession(input) {
    return new DesktopAuthSession({
        client: createDesktopTokenClient({ appUrl: input.appUrl }),
        deviceLabel: input.deviceLabel ?? 'Gimme Job Desktop',
        deviceOs: `${process.platform}-${os.release()}`,
        store: createDesktopTokenStore(),
    });
}
