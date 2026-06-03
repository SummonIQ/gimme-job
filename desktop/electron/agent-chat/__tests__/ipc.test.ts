import { describe, expect, it, vi } from 'vitest';

import type { DesktopIpcHandler, DesktopIpcMain } from '../../ipc';
import {
  DESKTOP_AGENT_CHAT_IPC_CHANNELS,
  registerDesktopAgentChatIpc,
} from '../ipc';

class FakeIpcMain implements DesktopIpcMain {
  readonly handlers = new Map<string, DesktopIpcHandler>();

  handle(channel: string, handler: DesktopIpcHandler) {
    this.handlers.set(channel, handler);
  }

  async invoke(channel: string, ...args: unknown[]) {
    const handler = this.handlers.get(channel);
    if (!handler) throw new Error(`Missing handler for ${channel}`);
    return handler({}, ...args);
  }
}

describe('desktop agent chat IPC', () => {
  it('validates and forwards chat requests', async () => {
    const ipcMain = new FakeIpcMain();
    const sendMessage = vi.fn(async () => ({
      content: 'The email field is empty.',
      context: {
        capturedAt: new Date().toISOString(),
        fields: [],
        issues: [],
        lastSubmitResult: null,
        screenshotDataUrl: null,
        title: 'Application',
        url: 'https://job-boards.greenhouse.io/example/jobs/123',
      },
      mutations: [],
    }));
    registerDesktopAgentChatIpc(ipcMain, { sendMessage });

    await expect(
      ipcMain.invoke(DESKTOP_AGENT_CHAT_IPC_CHANNELS.sendMessage, {
        allowTrainingWrite: true,
        messages: [{ content: 'What went wrong?', role: 'user' }],
      }),
    ).resolves.toMatchObject({ content: 'The email field is empty.' });

    expect(sendMessage).toHaveBeenCalledWith({
      allowTrainingWrite: true,
      messages: [{ content: 'What went wrong?', role: 'user' }],
    });
  });

  it('rejects empty chat messages', async () => {
    const ipcMain = new FakeIpcMain();
    const sendMessage = vi.fn();
    registerDesktopAgentChatIpc(ipcMain, { sendMessage });

    await expect(
      ipcMain.invoke(DESKTOP_AGENT_CHAT_IPC_CHANNELS.sendMessage, {
        messages: [],
      }),
    ).rejects.toThrow('Agent chat request requires at least one message.');
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
