export const DESKTOP_IPC_CHANNELS = {
  getState: 'desktop:get-state',
  setAssistUrl: 'desktop:set-assist-url',
} as const;

export interface DesktopShellState {
  assistUrl: string;
  appUrl: string;
}

export interface DesktopIpcActions {
  loadAssistUrl?: (url: string) => Promise<void> | void;
}

export type DesktopIpcHandler = (
  event: unknown,
  ...args: unknown[]
) => Promise<unknown> | unknown;

export interface DesktopIpcMain {
  handle: (channel: string, handler: DesktopIpcHandler) => void;
}

export function createDesktopShellState(
  overrides: Partial<DesktopShellState> = {},
): DesktopShellState {
  return {
    appUrl: 'https://app.gimme-job.com',
    assistUrl: 'https://job-boards.greenhouse.io',
    ...overrides,
  };
}

export function registerDesktopIpc(
  ipcMain: DesktopIpcMain,
  state: DesktopShellState,
  actions: DesktopIpcActions = {},
) {
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

function isHttpUrl(value: string) {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
}
