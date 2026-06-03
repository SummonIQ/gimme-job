import { describe, expect, it } from 'vitest';

import type { DesktopAuditWriter } from '../../audit/writer';
import type { DesktopIpcHandler, DesktopIpcMain } from '../../ipc';
import { DESKTOP_TOOL_RPC_CHANNEL, registerDesktopToolIpc } from '../ipc';
import type { DesktopToolRegistry } from '../registry';

class FakeIpcMain implements DesktopIpcMain {
  readonly handlers = new Map<string, DesktopIpcHandler>();

  handle(channel: string, handler: DesktopIpcHandler) {
    this.handlers.set(channel, handler);
  }

  async invoke(channel: string, request: unknown) {
    const handler = this.handlers.get(channel);

    if (!handler) {
      throw new Error(`Missing handler for ${channel}`);
    }

    return handler({}, request);
  }
}

describe('registerDesktopToolIpc', () => {
  it('routes desktop tool calls through the registry', async () => {
    const ipcMain = new FakeIpcMain();
    const registry: DesktopToolRegistry = {
      async call(request) {
        return {
          data: { received: request.input },
          ok: true,
          tool: request.tool,
        };
      },
      listTools() {
        return ['navigate'];
      },
    };

    registerDesktopToolIpc(ipcMain, registry);

    await expect(
      ipcMain.invoke(DESKTOP_TOOL_RPC_CHANNEL, {
        input: { url: 'https://jobs.ashbyhq.com/example' },
        tool: 'navigate',
      }),
    ).resolves.toMatchObject({
      data: {
        received: { url: 'https://jobs.ashbyhq.com/example' },
      },
      ok: true,
      tool: 'navigate',
    });
  });

  it('writes an audit row for each desktop tool call when configured', async () => {
    const ipcMain = new FakeIpcMain();
    const auditRows: unknown[] = [];
    const auditWriter: DesktopAuditWriter = {
      async write(row) {
        auditRows.push(row);
        return { created: 1, ids: ['audit-1'] };
      },
      async writeBatch(rows) {
        auditRows.push(...rows);
        return { created: rows.length, ids: rows.map((_, i) => `audit-${i}`) };
      },
    };
    const registry: DesktopToolRegistry = {
      async call(request) {
        return {
          data: { value: 'SecretNameAlpha' },
          ok: true,
          tool: request.tool,
        };
      },
      listTools() {
        return ['identity_load'];
      },
    };

    registerDesktopToolIpc(ipcMain, registry, { auditWriter });

    await ipcMain.invoke(DESKTOP_TOOL_RPC_CHANNEL, {
      input: { key: 'first_name' },
      tool: 'identity_load',
    });

    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      action: 'identity_read',
      outcome: 'ok',
      toolName: 'identity_load',
    });
  });
});
