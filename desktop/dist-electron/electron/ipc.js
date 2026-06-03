import { DEFAULT_DESKTOP_PANEL_SIZES, } from './window-layout.js';
export const DESKTOP_IPC_CHANNELS = {
    assistGoBack: 'desktop:assist-go-back',
    assistGoForward: 'desktop:assist-go-forward',
    getAssistFieldOptions: 'desktop:get-assist-field-options',
    getAssistNavState: 'desktop:get-assist-nav-state',
    getAssistPageContext: 'desktop:get-assist-page-context',
    getAssistTitle: 'desktop:get-assist-title',
    getSetting: 'desktop:settings-get',
    getState: 'desktop:get-state',
    highlightAssistField: 'desktop:highlight-assist-field',
    listSmokeReports: 'desktop:smoke-reports-list',
    loadAppUrl: 'desktop:load-app-url',
    readSmokeReport: 'desktop:smoke-reports-read',
    setAssistEyeSaverMode: 'desktop:set-assist-eye-saver-mode',
    setAutofillPaused: 'desktop:set-autofill-paused',
    listFieldRules: 'desktop:field-rules-list',
    removeFieldRule: 'desktop:field-rules-remove',
    addFieldRule: 'desktop:field-rules-add',
    setAssistField: 'desktop:set-assist-field',
    setActiveSection: 'desktop:set-active-section',
    setAssistOverlayActive: 'desktop:set-assist-overlay-active',
    setRendererOverlayActive: 'desktop:set-renderer-overlay-active',
    setAssistUrl: 'desktop:set-assist-url',
    setPanelSizes: 'desktop:set-panel-sizes',
    setSetting: 'desktop:settings-set',
    listRuntimeProviders: 'desktop:runtime-providers-list',
    detectRuntimeProvider: 'desktop:runtime-providers-detect',
};
export const DESKTOP_IPC_EVENTS = {
    assistNavState: 'desktop:assist-nav-state',
};
export function createDesktopShellState(overrides = {}) {
    return {
        appUrl: 'https://app.gimme-job.com',
        assistUrl: 'https://job-boards.greenhouse.io',
        isEyeSaverMode: true,
        ...overrides,
        panelSizes: {
            ...DEFAULT_DESKTOP_PANEL_SIZES,
            ...overrides.panelSizes,
        },
    };
}
export function registerDesktopIpc(ipcMain, state, actions = {}) {
    ipcMain.handle(DESKTOP_IPC_CHANNELS.getState, () => cloneDesktopShellState(state));
    ipcMain.handle(DESKTOP_IPC_CHANNELS.getAssistTitle, async () => {
        const title = await actions.getAssistTitle?.();
        return typeof title === 'string' ? title : '';
    });
    ipcMain.handle(DESKTOP_IPC_CHANNELS.loadAppUrl, async (_event, url) => {
        if (typeof url !== 'string' || !url.trim()) {
            throw new Error('App URL must be a non-empty string.');
        }
        await actions.loadAppUrl?.(url.trim());
    });
    ipcMain.handle(DESKTOP_IPC_CHANNELS.getAssistNavState, async () => {
        const navState = await actions.getAssistNavState?.();
        return navState ?? { canGoBack: false, canGoForward: false };
    });
    ipcMain.handle(DESKTOP_IPC_CHANNELS.getAssistPageContext, async () => {
        const pageContext = await actions.getAssistPageContext?.();
        return pageContext ?? null;
    });
    ipcMain.handle(DESKTOP_IPC_CHANNELS.highlightAssistField, async (_event, selector) => {
        if (typeof selector !== 'string' || !selector.trim()) {
            throw new Error('Assist field selector is required.');
        }
        return Boolean(await actions.highlightAssistField?.(selector.trim()));
    });
    ipcMain.handle(DESKTOP_IPC_CHANNELS.setAssistField, async (_event, input) => {
        if (!isSetAssistFieldInput(input)) {
            throw new Error('setAssistField requires { selector, value, kind: fill|select }.');
        }
        const result = await actions.setAssistField?.(input);
        return result ?? { ok: false, error: 'No handler registered.' };
    });
    ipcMain.handle(DESKTOP_IPC_CHANNELS.getAssistFieldOptions, async (_event, selector, options) => {
        if (typeof selector !== 'string' || !selector.trim()) {
            throw new Error('Assist field selector is required.');
        }
        const optionArg = options && typeof options === 'object'
            ? {
                query: typeof options.query === 'string'
                    ? options.query
                    : undefined,
            }
            : undefined;
        const result = await actions.getAssistFieldOptions?.(selector.trim(), optionArg);
        return result ?? { ok: false, error: 'No handler registered.' };
    });
    ipcMain.handle(DESKTOP_IPC_CHANNELS.assistGoBack, async () => {
        const navState = await actions.assistGoBack?.();
        return navState ?? { canGoBack: false, canGoForward: false };
    });
    ipcMain.handle(DESKTOP_IPC_CHANNELS.assistGoForward, async () => {
        const navState = await actions.assistGoForward?.();
        return navState ?? { canGoBack: false, canGoForward: false };
    });
    ipcMain.handle(DESKTOP_IPC_CHANNELS.listFieldRules, async () => {
        return (await actions.listFieldRules?.()) ?? [];
    });
    ipcMain.handle(DESKTOP_IPC_CHANNELS.removeFieldRule, async (_event, id) => {
        if (typeof id !== 'string' || !id.trim()) {
            throw new Error('Field-rule id must be a non-empty string.');
        }
        return Boolean(await actions.removeFieldRule?.(id));
    });
    ipcMain.handle(DESKTOP_IPC_CHANNELS.addFieldRule, async (_event, input) => {
        if (!input ||
            typeof input !== 'object' ||
            typeof input.question !== 'string' ||
            typeof input.answer !== 'string') {
            throw new Error('Field-rule input requires question + answer strings.');
        }
        const candidate = input;
        return actions.addFieldRule?.({
            question: candidate.question,
            answer: candidate.answer,
            hostname: typeof candidate.hostname === 'string' ? candidate.hostname : null,
        });
    });
    ipcMain.handle(DESKTOP_IPC_CHANNELS.setAutofillPaused, async (_event, paused) => {
        if (typeof paused !== 'boolean') {
            throw new Error('Autofill pause flag must be a boolean.');
        }
        await actions.setAutofillPaused?.(paused);
    });
    ipcMain.handle(DESKTOP_IPC_CHANNELS.setAssistEyeSaverMode, async (_event, enabled) => {
        if (typeof enabled !== 'boolean') {
            throw new Error('Eye saver mode must be a boolean.');
        }
        state.isEyeSaverMode = enabled;
        await actions.setAssistEyeSaverMode?.(enabled);
        return cloneDesktopShellState(state);
    });
    ipcMain.handle(DESKTOP_IPC_CHANNELS.setActiveSection, async (_event, section) => {
        if (section !== 'dashboard' &&
            section !== 'training' &&
            section !== 'scraper' &&
            section !== 'smoke-tests' &&
            section !== 'admin') {
            throw new Error('Active section must be "dashboard", "training", "scraper", "smoke-tests", or "admin".');
        }
        await actions.setActiveSection?.(section);
    });
    ipcMain.handle(DESKTOP_IPC_CHANNELS.setAssistOverlayActive, async (_event, active) => {
        if (typeof active !== 'boolean') {
            throw new Error('Overlay active flag must be a boolean.');
        }
        await actions.setAssistOverlayActive?.(active);
    });
    ipcMain.handle(DESKTOP_IPC_CHANNELS.setRendererOverlayActive, async (_event, active) => {
        if (typeof active !== 'boolean') {
            throw new Error('Renderer overlay active flag must be a boolean.');
        }
        await actions.setRendererOverlayActive?.(active);
    });
    ipcMain.handle(DESKTOP_IPC_CHANNELS.setAssistUrl, async (_event, url) => {
        if (typeof url !== 'string' || !isHttpUrl(url)) {
            throw new Error('Assist URL must be an http(s) URL.');
        }
        state.assistUrl = url;
        actions.setSetting?.('shell.assistUrl', url);
        await actions.loadAssistUrl?.(url);
        return cloneDesktopShellState(state);
    });
    ipcMain.handle(DESKTOP_IPC_CHANNELS.getSetting, async (_event, key) => {
        if (typeof key !== 'string' || !key.trim()) {
            throw new Error('Settings key must be a non-empty string.');
        }
        return actions.getSetting ? actions.getSetting(key) : undefined;
    });
    ipcMain.handle(DESKTOP_IPC_CHANNELS.listSmokeReports, async () => {
        return actions.listSmokeReports ? actions.listSmokeReports() : [];
    });
    ipcMain.handle(DESKTOP_IPC_CHANNELS.readSmokeReport, async (_event, filePath) => {
        if (typeof filePath !== 'string' || !filePath.trim()) {
            throw new Error('Smoke report path must be a non-empty string.');
        }
        return actions.readSmokeReport?.(filePath);
    });
    ipcMain.handle(DESKTOP_IPC_CHANNELS.listRuntimeProviders, async () => {
        return actions.listRuntimeProviders ? actions.listRuntimeProviders() : [];
    });
    ipcMain.handle(DESKTOP_IPC_CHANNELS.detectRuntimeProvider, async (_event, url) => {
        if (typeof url !== 'string') {
            throw new Error('Runtime provider detection requires a URL string.');
        }
        return (actions.detectRuntimeProvider?.(url) ?? {
            id: 'unsupported',
            label: 'Unsupported',
            readiness: 'unsupported',
            runner: null,
        });
    });
    ipcMain.handle(DESKTOP_IPC_CHANNELS.setSetting, async (_event, key, value) => {
        if (typeof key !== 'string' || !key.trim()) {
            throw new Error('Settings key must be a non-empty string.');
        }
        actions.setSetting?.(key, value);
    });
    ipcMain.handle(DESKTOP_IPC_CHANNELS.setPanelSizes, async (_event, sizes) => {
        if (!isDesktopShellPanelSizes(sizes)) {
            throw new Error('Panel sizes must include numeric sidebar, main, and assist values.');
        }
        state.panelSizes = {
            assist: sizes.assist,
            main: sizes.main,
            sidebar: sizes.sidebar,
        };
        actions.setSetting?.('shell.panelSizes', state.panelSizes);
        await actions.refreshLayout?.();
        return cloneDesktopShellState(state);
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
function cloneDesktopShellState(state) {
    return {
        ...state,
        panelSizes: {
            ...state.panelSizes,
        },
    };
}
function isDesktopShellPanelSizes(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const candidate = value;
    return (isFinitePanelSize(candidate.sidebar) &&
        isFinitePanelSize(candidate.main) &&
        isFinitePanelSize(candidate.assist));
}
function isFinitePanelSize(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
function isSetAssistFieldInput(value) {
    if (!value || typeof value !== 'object')
        return false;
    const candidate = value;
    if (typeof candidate.selector !== 'string' || !candidate.selector.trim()) {
        return false;
    }
    if (typeof candidate.value !== 'string')
        return false;
    return (candidate.kind === 'fill' ||
        candidate.kind === 'select' ||
        candidate.kind === 'click' ||
        candidate.kind === 'typeahead');
}
