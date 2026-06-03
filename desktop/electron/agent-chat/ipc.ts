import type { DesktopIpcMain } from '../ipc.js';
import type {
  DesktopAgentChatMessage,
  DesktopAgentChatRequest,
  DesktopAgentChatResult,
} from './types.js';

export const DESKTOP_AGENT_CHAT_IPC_CHANNELS = {
  sendMessage: 'desktop-agent-chat:send-message',
} as const;

export interface DesktopAgentChatRunner {
  readonly sendMessage: (
    request: DesktopAgentChatRequest,
  ) => Promise<DesktopAgentChatResult>;
}

export function registerDesktopAgentChatIpc(
  ipcMain: DesktopIpcMain,
  runner: DesktopAgentChatRunner,
) {
  ipcMain.handle(DESKTOP_AGENT_CHAT_IPC_CHANNELS.sendMessage, (_event, request) =>
    runner.sendMessage(parseAgentChatRequest(request)),
  );
}

function parseAgentChatRequest(value: unknown): DesktopAgentChatRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Agent chat request must be an object.');
  }

  const record = value as Record<string, unknown>;
  const messages = readMessages(record.messages);

  if (messages.length === 0) {
    throw new Error('Agent chat request requires at least one message.');
  }

  const aiProvider =
    record.aiProvider === 'openai' || record.aiProvider === 'ollama'
      ? record.aiProvider
      : undefined;

  return {
    aiProvider,
    allowTrainingWrite: record.allowTrainingWrite === true,
    messages,
  };
}

function readMessages(value: unknown): readonly DesktopAgentChatMessage[] {
  if (!Array.isArray(value)) {
    throw new Error('Agent chat messages must be an array.');
  }

  return value.slice(-20).map((message): DesktopAgentChatMessage => {
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      throw new Error('Agent chat messages must contain objects.');
    }

    const record = message as Record<string, unknown>;
    if (record.role !== 'assistant' && record.role !== 'user') {
      throw new Error('Agent chat message role must be assistant or user.');
    }
    if (typeof record.content !== 'string' || !record.content.trim()) {
      throw new Error('Agent chat message content is required.');
    }

    return {
      content: record.content.trim().slice(0, 8_000),
      role: record.role,
    };
  });
}
