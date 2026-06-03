import type { DesktopIpcMain } from '../ipc.js';
import type { DesktopAuditWriter } from '../audit/writer.js';
import type { DesktopToolRegistry } from './registry.js';
import type { DesktopToolCallRequest, DesktopToolName } from './types.js';

export const DESKTOP_TOOL_RPC_CHANNEL = 'desktop:tool-call';

export function registerDesktopToolIpc(
  ipcMain: DesktopIpcMain,
  registry: DesktopToolRegistry,
  options: { readonly auditWriter?: DesktopAuditWriter } = {},
) {
  ipcMain.handle(DESKTOP_TOOL_RPC_CHANNEL, async (_event, request) => {
    const parsed = parseToolRequest(request);
    const startedAt = performance.now();
    const result = await registry.call(parsed);
    const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
    if (options.auditWriter) {
      const isIdentityRead = parsed.tool === 'identity_load';
      await options.auditWriter.write({
        action: isIdentityRead ? 'identity_read' : 'tool_call',
        durationMs,
        errorMessage: result.ok ? null : result.error?.message ?? null,
        outcome: result.ok ? 'ok' : 'error',
        payload: isIdentityRead
          ? identityReadPayload(parsed.input, result.ok ? result.data : null)
          : {
              input: parsed.input ?? {},
              result: result.ok ? result.data : result.error ?? {},
            },
        toolName: parsed.tool,
      });
    }
    return result;
  });
}

function identityReadPayload(input: unknown, data: unknown): Record<string, unknown> {
  const inputRecord =
    input && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const dataRecord =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  return {
    key: typeof inputRecord.key === 'string' ? inputRecord.key : dataRecord.key,
    value: dataRecord.value,
  };
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
