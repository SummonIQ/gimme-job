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
      panelSizes: {
        assist: 60,
        main: 0,
        sidebar: 40,
      },
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

  it('updates the panel sizes and triggers a relayout callback', async () => {
    const ipcMain = new FakeIpcMain();
    const refreshLayout = vi.fn();
    registerDesktopIpc(ipcMain, createDesktopShellState(), {
      refreshLayout,
    });

    await expect(
      ipcMain.invoke(DESKTOP_IPC_CHANNELS.setPanelSizes, {
        assist: 24,
        main: 46,
        sidebar: 30,
      }),
    ).resolves.toMatchObject({
      panelSizes: {
        assist: 24,
        main: 46,
        sidebar: 30,
      },
    });
    expect(refreshLayout).toHaveBeenCalledTimes(1);
  });

  it('updates eye saver mode and triggers the style callback', async () => {
    const ipcMain = new FakeIpcMain();
    const setAssistEyeSaverMode = vi.fn();
    registerDesktopIpc(ipcMain, createDesktopShellState(), {
      setAssistEyeSaverMode,
    });

    await expect(
      ipcMain.invoke(DESKTOP_IPC_CHANNELS.setAssistEyeSaverMode, true),
    ).resolves.toMatchObject({
      isEyeSaverMode: true,
    });
    expect(setAssistEyeSaverMode).toHaveBeenCalledWith(true);
  });

  it('routes admin section and app URL changes through shell actions', async () => {
    const ipcMain = new FakeIpcMain();
    const loadAppUrl = vi.fn();
    const setActiveSection = vi.fn();
    registerDesktopIpc(ipcMain, createDesktopShellState(), {
      loadAppUrl,
      setActiveSection,
    });

    await expect(
      ipcMain.invoke(
        DESKTOP_IPC_CHANNELS.loadAppUrl,
        'https://app.gimme-job.com/admin/users',
      ),
    ).resolves.toBeUndefined();
    await expect(
      ipcMain.invoke(DESKTOP_IPC_CHANNELS.setActiveSection, 'admin'),
    ).resolves.toBeUndefined();
    await expect(
      ipcMain.invoke(DESKTOP_IPC_CHANNELS.setActiveSection, 'reports'),
    ).rejects.toThrow(
      'Active section must be "dashboard", "training", "scraper", "smoke-tests", or "admin".',
    );

    expect(loadAppUrl).toHaveBeenCalledWith(
      'https://app.gimme-job.com/admin/users',
    );
    expect(setActiveSection).toHaveBeenCalledWith('admin');
  });

  it('returns assist page context from the shell action', async () => {
    const ipcMain = new FakeIpcMain();
    registerDesktopIpc(ipcMain, createDesktopShellState(), {
      getAssistPageContext: () => ({
        capturedAt: '2026-05-02T14:27:15.000Z',
        fields: [],
        issues: [],
        lastSubmitResult: null,
        screenshotDataUrl: null,
        title: 'Example application',
        url: 'https://boards.greenhouse.io/example',
      }),
    });

    await expect(
      ipcMain.invoke(DESKTOP_IPC_CHANNELS.getAssistPageContext),
    ).resolves.toMatchObject({
      fields: [],
      title: 'Example application',
      url: 'https://boards.greenhouse.io/example',
    });
  });

  it('highlights an assist field through the shell action', async () => {
    const ipcMain = new FakeIpcMain();
    const highlightAssistField = vi.fn().mockResolvedValue(true);
    registerDesktopIpc(ipcMain, createDesktopShellState(), {
      highlightAssistField,
    });

    await expect(
      ipcMain.invoke(DESKTOP_IPC_CHANNELS.highlightAssistField, ' input#name '),
    ).resolves.toBe(true);
    expect(highlightAssistField).toHaveBeenCalledWith('input#name');
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

  it('rejects invalid panel size payloads', async () => {
    const ipcMain = new FakeIpcMain();
    registerDesktopIpc(ipcMain, createDesktopShellState());

    await expect(
      ipcMain.invoke(DESKTOP_IPC_CHANNELS.setPanelSizes, {
        assist: 24,
        main: 'wide',
        sidebar: 40,
      }),
    ).rejects.toThrow(
      'Panel sizes must include numeric sidebar, main, and assist values.',
    );
  });

  it('rejects invalid eye saver payloads', async () => {
    const ipcMain = new FakeIpcMain();
    registerDesktopIpc(ipcMain, createDesktopShellState());

    await expect(
      ipcMain.invoke(DESKTOP_IPC_CHANNELS.setAssistEyeSaverMode, 'yes'),
    ).rejects.toThrow('Eye saver mode must be a boolean.');
  });
});
