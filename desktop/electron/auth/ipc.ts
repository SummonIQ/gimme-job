import type { DesktopAuthSession } from './session.js';

export const DESKTOP_AUTH_IPC_CHANNELS = {
  clearToken: 'desktop-auth:clear-token',
  getState: 'desktop-auth:get-state',
  pairWithCode: 'desktop-auth:pair-with-code',
} as const;

export type DesktopAuthIpcHandler = (
  event: unknown,
  ...args: unknown[]
) => Promise<unknown> | unknown;

export interface DesktopAuthIpcMain {
  handle: (channel: string, handler: DesktopAuthIpcHandler) => void;
}

export function registerDesktopAuthIpc(
  ipcMain: DesktopAuthIpcMain,
  session: DesktopAuthSession,
) {
  ipcMain.handle(DESKTOP_AUTH_IPC_CHANNELS.getState, () => session.getState());
  ipcMain.handle(DESKTOP_AUTH_IPC_CHANNELS.clearToken, () =>
    session.clearToken(),
  );
  ipcMain.handle(DESKTOP_AUTH_IPC_CHANNELS.pairWithCode, (_event, code) => {
    if (typeof code !== 'string') {
      throw new Error('Pairing code must be a string.');
    }

    return session.pairWithCode(code);
  });
}
