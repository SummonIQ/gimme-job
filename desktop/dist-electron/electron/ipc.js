export const DESKTOP_IPC_CHANNELS = {
    getState: 'desktop:get-state',
    setAssistUrl: 'desktop:set-assist-url',
};
export function createDesktopShellState(overrides = {}) {
    return {
        appUrl: 'https://app.gimme-job.com',
        assistUrl: 'https://job-boards.greenhouse.io',
        ...overrides,
    };
}
export function registerDesktopIpc(ipcMain, state, actions = {}) {
    ipcMain.handle(DESKTOP_IPC_CHANNELS.getState, () => ({ ...state }));
    ipcMain.handle(DESKTOP_IPC_CHANNELS.setAssistUrl, async (_event, url) => {
        if (typeof url !== 'string' || !isHttpUrl(url)) {
            throw new Error('Assist URL must be an http(s) URL.');
        }
        state.assistUrl = url;
        await actions.loadAssistUrl?.(url);
        return { ...state };
    });
}
function isHttpUrl(value) {
    try {
        const parsedUrl = new URL(value);
        return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    }
    catch {
        return false;
    }
}
