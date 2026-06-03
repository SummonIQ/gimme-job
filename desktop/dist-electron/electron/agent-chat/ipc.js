export const DESKTOP_AGENT_CHAT_IPC_CHANNELS = {
    sendMessage: 'desktop-agent-chat:send-message',
};
export function registerDesktopAgentChatIpc(ipcMain, runner) {
    ipcMain.handle(DESKTOP_AGENT_CHAT_IPC_CHANNELS.sendMessage, (_event, request) => runner.sendMessage(parseAgentChatRequest(request)));
}
function parseAgentChatRequest(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Agent chat request must be an object.');
    }
    const record = value;
    const messages = readMessages(record.messages);
    if (messages.length === 0) {
        throw new Error('Agent chat request requires at least one message.');
    }
    const aiProvider = record.aiProvider === 'openai' || record.aiProvider === 'ollama'
        ? record.aiProvider
        : undefined;
    return {
        aiProvider,
        allowTrainingWrite: record.allowTrainingWrite === true,
        messages,
    };
}
function readMessages(value) {
    if (!Array.isArray(value)) {
        throw new Error('Agent chat messages must be an array.');
    }
    return value.slice(-20).map((message) => {
        if (!message || typeof message !== 'object' || Array.isArray(message)) {
            throw new Error('Agent chat messages must contain objects.');
        }
        const record = message;
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
