export const DESKTOP_TOOL_RPC_CHANNEL = 'desktop:tool-call';
export function registerDesktopToolIpc(ipcMain, registry) {
    ipcMain.handle(DESKTOP_TOOL_RPC_CHANNEL, (_event, request) => {
        return registry.call(parseToolRequest(request));
    });
}
function parseToolRequest(request) {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
        throw new Error('Tool request must be an object.');
    }
    const record = request;
    if (typeof record.tool !== 'string') {
        throw new Error('Tool request requires a tool name.');
    }
    return {
        input: record.input,
        tool: record.tool,
    };
}
