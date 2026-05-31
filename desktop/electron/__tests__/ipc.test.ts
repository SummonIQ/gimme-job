import { describe, expect, it, vi } from 'vitest';

import {
  createDesktopShellState,
  DESKTOP_IPC_CHANNELS,
  type DesktopIpcHandler,
  type DesktopIpcMain,
  registerDesktopIpc,
} from '../ipc';

class FakeIpcMain implements DesktopIpcMain {
  readonly handlers = new Map<string, DesktopIpcHandler>();

  handle(channel: string, handler: DesktopIpcHandler) {
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

describe('desktop IPC registration', () => {
  it('registers state and assist URL handlers', async () => {
    const ipcMain = new FakeIpcMain();
    const loadAssistUrl = vi.fn();
    const state = createDesktopShellState({
      appUrl: 'https://app.gimme-job.com',
      assistUrl: 'https://job-boards.greenhouse.io',
    });

    registerDesktopIpc(ipcMain, state, { loadAssistUrl });

    await expect(
      ipcMain.invoke(DESKTOP_IPC_CHANNELS.getState),
    ).resolves.toMatchObject({
      appUrl: 'https://app.gimme-job.com',
      assistUrl: 'https://job-boards.greenhouse.io',
    });

    await expect(
      ipcMain.invoke(
        DESKTOP_IPC_CHANNELS.setAssistUrl,
        'https://boards.greenhouse.io/example',
      ),
    ).resolves.toMatchObject({
      assistUrl: 'https://boards.greenhouse.io/example',
    });
    expect(loadAssistUrl).toHaveBeenCalledWith(
      'https://boards.greenhouse.io/example',
    );
  });

  it('rejects non-http assist URLs', async () => {
    const ipcMain = new FakeIpcMain();
    registerDesktopIpc(ipcMain, createDesktopShellState());

    await expect(
      ipcMain.invoke(
        DESKTOP_IPC_CHANNELS.setAssistUrl,
        'file:///tmp/form.html',
      ),
    ).rejects.toThrow('Assist URL must be an http(s) URL.');
  });
});
