import type { DesktopIpcMain } from '../ipc.js';
import type { DesktopToolRegistry } from './registry.js';
import type { DesktopToolCallRequest, DesktopToolName } from './types.js';

export const DESKTOP_TOOL_RPC_CHANNEL = 'desktop:tool-call';

export function registerDesktopToolIpc(
  ipcMain: DesktopIpcMain,
  registry: DesktopToolRegistry,
) {
  ipcMain.handle(DESKTOP_TOOL_RPC_CHANNEL, (_event, request) => {
    return registry.call(parseToolRequest(request));
  });
}

function parseToolRequest(request: unknown): DesktopToolCallRequest {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new Error('Tool request must be an object.');
  }

  const record = request as Record<string, unknown>;

  if (typeof record.tool !== 'string') {
    throw new Error('Tool request requires a tool name.');
  }

  return {
    input: record.input,
    tool: record.tool as DesktopToolName,
  };
}
