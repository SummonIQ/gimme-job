import { describe, expect, it, vi } from 'vitest';

import type { DesktopIpcHandler, DesktopIpcMain } from '../../ipc';
import {
  DESKTOP_SUBMIT_IPC_CHANNELS,
  registerDesktopSubmitIpc,
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

describe('desktop submit IPC', () => {
  it('returns a random Greenhouse lead through the desktop submit bridge', async () => {
    const ipcMain = new FakeIpcMain();
    const pickRandomGreenhouseLead = vi.fn(async () => ({
      applicationUrl: 'https://job-boards.greenhouse.io/example/jobs/789',
      company: 'Fixture Co',
      jobLeadId: 'lead-789',
      jobListingId: 'listing-789',
      source: 'Google Jobs',
      title: 'Software Engineer',
    }));
    registerDesktopSubmitIpc(ipcMain, {
      pickRandomGreenhouseLead,
      runLead: vi.fn(),
    });

    await expect(
      ipcMain.invoke(DESKTOP_SUBMIT_IPC_CHANNELS.pickRandomGreenhouseLead, {
        location: ' Remote ',
        provider: 'any',
        remote: true,
        search: ' engineer ',
      }),
    ).resolves.toMatchObject({
      applicationUrl: 'https://job-boards.greenhouse.io/example/jobs/789',
      jobLeadId: 'lead-789',
    });

    expect(pickRandomGreenhouseLead).toHaveBeenCalledWith({
      location: 'Remote',
      provider: 'any',
      remote: true,
      search: 'engineer',
    });
  });

  it('validates and forwards submit lead requests', async () => {
    const ipcMain = new FakeIpcMain();
    const pickRandomGreenhouseLead = vi.fn();
    const runLead = vi.fn(async () => ({
      applicationUrl: 'https://job-boards.greenhouse.io/example/jobs/123',
      executionEnvironment: 'DESKTOP_CDP' as const,
      message: 'ok',
      mode: 'training' as const,
      status: 'blocked_by_submit_guard' as const,
      toolCalls: [],
    }));
    registerDesktopSubmitIpc(ipcMain, {
      pickRandomGreenhouseLead,
      runLead,
    });

    await expect(
      ipcMain.invoke(DESKTOP_SUBMIT_IPC_CHANNELS.runLead, {
        applicationUrl: 'https://job-boards.greenhouse.io/example/jobs/123',
        jobLeadId: ' lead-1 ',
        mode: 'training',
      }),
    ).resolves.toMatchObject({ executionEnvironment: 'DESKTOP_CDP' });

    expect(runLead).toHaveBeenCalledWith({
      applicationUrl: 'https://job-boards.greenhouse.io/example/jobs/123',
      continueFromCurrentPage: false,
      jobLeadId: 'lead-1',
      mode: 'training',
    });
  });

  it('rejects invalid URLs before the runner starts', async () => {
    const ipcMain = new FakeIpcMain();
    const pickRandomGreenhouseLead = vi.fn();
    const runLead = vi.fn();
    registerDesktopSubmitIpc(ipcMain, {
      pickRandomGreenhouseLead,
      runLead,
    });

    await expect(
      ipcMain.invoke(DESKTOP_SUBMIT_IPC_CHANNELS.runLead, {
        applicationUrl: 'file:///tmp/form.html',
        mode: 'training',
      }),
    ).rejects.toThrow('Application URL must be an http(s) URL.');
    expect(runLead).not.toHaveBeenCalled();
  });

  it('uses empty filters when picking a random Greenhouse lead without a request', async () => {
    const ipcMain = new FakeIpcMain();
    const pickRandomGreenhouseLead = vi.fn(async () => ({
      applicationUrl: 'https://job-boards.greenhouse.io/example/jobs/789',
      company: 'Fixture Co',
      jobListingId: 'listing-789',
      location: 'Remote',
      source: 'Greenhouse',
      title: 'Software Engineer',
    }));

    registerDesktopSubmitIpc(ipcMain, {
      pickRandomGreenhouseLead,
      runLead: vi.fn(),
    });

    await expect(
      ipcMain.invoke(DESKTOP_SUBMIT_IPC_CHANNELS.pickRandomGreenhouseLead),
    ).resolves.toMatchObject({
      applicationUrl: 'https://job-boards.greenhouse.io/example/jobs/789',
    });

    expect(pickRandomGreenhouseLead).toHaveBeenCalledWith({});
  });
});
