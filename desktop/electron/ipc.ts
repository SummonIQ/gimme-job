import {
  DEFAULT_DESKTOP_PANEL_SIZES,
  type DesktopShellPanelSizes,
} from './window-layout.js';
import type { DesktopAssistPageContext } from './agent-chat/types.js';
import type {
  DesktopSmokeReportFull,
  DesktopSmokeReportSummary,
} from './smoke-reports.js';

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
} as const;

export type DesktopRuntimeProviderReadinessIpc =
  | 'production'
  | 'beta'
  | 'manual_review'
  | 'unsupported';

export interface DesktopRuntimeProviderInfo {
  readonly id: string;
  readonly label: string;
  readonly readiness: DesktopRuntimeProviderReadinessIpc;
  readonly runner: string | null;
}

export interface DesktopFieldRuleEntry {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
  readonly hostname: string | null;
  readonly source: 'manual' | 'state-tab' | 'chat';
  readonly createdAt: string;
}

export interface DesktopAssistFieldOption {
  readonly label: string;
  readonly value: string;
}

export const DESKTOP_IPC_EVENTS = {
  assistNavState: 'desktop:assist-nav-state',
} as const;

export interface DesktopAssistNavState {
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface DesktopShellState {
  assistUrl: string;
  appUrl: string;
  isEyeSaverMode: boolean;
  panelSizes: DesktopShellPanelSizes;
}

export interface DesktopIpcActions {
  assistGoBack?: () => Promise<DesktopAssistNavState> | DesktopAssistNavState;
  assistGoForward?: () =>
    | Promise<DesktopAssistNavState>
    | DesktopAssistNavState;
  getAssistNavState?: () =>
    | Promise<DesktopAssistNavState>
    | DesktopAssistNavState;
  getAssistPageContext?: () =>
    | Promise<DesktopAssistPageContext | null>
    | DesktopAssistPageContext
    | null;
  getAssistTitle?: () => Promise<string> | string;
  getSetting?: (key: string) => unknown;
  highlightAssistField?: (selector: string) => Promise<boolean> | boolean;
  listSmokeReports?: () =>
    | readonly DesktopSmokeReportSummary[]
    | Promise<readonly DesktopSmokeReportSummary[]>;
  loadAssistUrl?: (url: string) => Promise<void> | void;
  loadAppUrl?: (url: string) => Promise<void> | void;
  readSmokeReport?: (
    filePath: string,
  ) => DesktopSmokeReportFull | Promise<DesktopSmokeReportFull>;
  refreshLayout?: () => Promise<void> | void;
  setAssistEyeSaverMode?: (enabled: boolean) => Promise<void> | void;
  setAutofillPaused?: (paused: boolean) => Promise<void> | void;
  listFieldRules?: () => readonly DesktopFieldRuleEntry[] | Promise<readonly DesktopFieldRuleEntry[]>;
  removeFieldRule?: (id: string) => boolean | Promise<boolean>;
  addFieldRule?: (input: {
    question: string;
    answer: string;
    hostname?: string | null;
  }) => DesktopFieldRuleEntry | Promise<DesktopFieldRuleEntry>;
  setAssistField?: (input: {
    kind: 'fill' | 'select' | 'click' | 'typeahead';
    selector: string;
    value: string;
    question?: string;
    hostname?: string;
  }) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  getAssistFieldOptions?: (
    selector: string,
    options?: { readonly query?: string },
  ) => Promise<{
    ok: boolean;
    error?: string;
    options?: readonly DesktopAssistFieldOption[];
  }>;
  setActiveSection?: (
    section: 'dashboard' | 'training' | 'scraper' | 'smoke-tests' | 'admin',
  ) => Promise<void> | void;
  setAssistOverlayActive?: (active: boolean) => Promise<void> | void;
  setRendererOverlayActive?: (active: boolean) => Promise<void> | void;
  setSetting?: (key: string, value: unknown) => void;
  listRuntimeProviders?: () => readonly DesktopRuntimeProviderInfo[];
  detectRuntimeProvider?: (url: string) => DesktopRuntimeProviderInfo;
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
    isEyeSaverMode: true,
    ...overrides,
    panelSizes: {
      ...DEFAULT_DESKTOP_PANEL_SIZES,
      ...overrides.panelSizes,
    },
  };
}

export function registerDesktopIpc(
  ipcMain: DesktopIpcMain,
  state: DesktopShellState,
  actions: DesktopIpcActions = {},
) {
  ipcMain.handle(DESKTOP_IPC_CHANNELS.getState, () =>
    cloneDesktopShellState(state),
  );
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
  ipcMain.handle(
    DESKTOP_IPC_CHANNELS.highlightAssistField,
    async (_event, selector) => {
      if (typeof selector !== 'string' || !selector.trim()) {
        throw new Error('Assist field selector is required.');
      }

      return Boolean(await actions.highlightAssistField?.(selector.trim()));
    },
  );
  ipcMain.handle(
    DESKTOP_IPC_CHANNELS.setAssistField,
    async (_event, input) => {
      if (!isSetAssistFieldInput(input)) {
        throw new Error(
          'setAssistField requires { selector, value, kind: fill|select }.',
        );
      }
      const result = await actions.setAssistField?.(input);
      return result ?? { ok: false, error: 'No handler registered.' };
    },
  );
  ipcMain.handle(
    DESKTOP_IPC_CHANNELS.getAssistFieldOptions,
    async (_event, selector, options) => {
      if (typeof selector !== 'string' || !selector.trim()) {
        throw new Error('Assist field selector is required.');
      }
      const optionArg =
        options && typeof options === 'object'
          ? {
              query:
                typeof (options as Record<string, unknown>).query === 'string'
                  ? ((options as Record<string, unknown>).query as string)
                  : undefined,
            }
          : undefined;
      const result = await actions.getAssistFieldOptions?.(
        selector.trim(),
        optionArg,
      );
      return result ?? { ok: false, error: 'No handler registered.' };
    },
  );
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
  ipcMain.handle(
    DESKTOP_IPC_CHANNELS.removeFieldRule,
    async (_event, id) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('Field-rule id must be a non-empty string.');
      }
      return Boolean(await actions.removeFieldRule?.(id));
    },
  );
  ipcMain.handle(
    DESKTOP_IPC_CHANNELS.addFieldRule,
    async (_event, input) => {
      if (
        !input ||
        typeof input !== 'object' ||
        typeof (input as Record<string, unknown>).question !== 'string' ||
        typeof (input as Record<string, unknown>).answer !== 'string'
      ) {
        throw new Error('Field-rule input requires question + answer strings.');
      }
      const candidate = input as Record<string, unknown>;
      return actions.addFieldRule?.({
        question: candidate.question as string,
        answer: candidate.answer as string,
        hostname:
          typeof candidate.hostname === 'string' ? candidate.hostname : null,
      });
    },
  );
  ipcMain.handle(
    DESKTOP_IPC_CHANNELS.setAutofillPaused,
    async (_event, paused) => {
      if (typeof paused !== 'boolean') {
        throw new Error('Autofill pause flag must be a boolean.');
      }
      await actions.setAutofillPaused?.(paused);
    },
  );
  ipcMain.handle(
    DESKTOP_IPC_CHANNELS.setAssistEyeSaverMode,
    async (_event, enabled) => {
      if (typeof enabled !== 'boolean') {
        throw new Error('Eye saver mode must be a boolean.');
      }

      state.isEyeSaverMode = enabled;
      await actions.setAssistEyeSaverMode?.(enabled);

      return cloneDesktopShellState(state);
    },
  );
  ipcMain.handle(
    DESKTOP_IPC_CHANNELS.setActiveSection,
    async (_event, section) => {
      if (
        section !== 'dashboard' &&
        section !== 'training' &&
        section !== 'scraper' &&
        section !== 'smoke-tests' &&
        section !== 'admin'
      ) {
        throw new Error(
          'Active section must be "dashboard", "training", "scraper", "smoke-tests", or "admin".',
        );
      }

      await actions.setActiveSection?.(section);
    },
  );
  ipcMain.handle(
    DESKTOP_IPC_CHANNELS.setAssistOverlayActive,
    async (_event, active) => {
      if (typeof active !== 'boolean') {
        throw new Error('Overlay active flag must be a boolean.');
      }

      await actions.setAssistOverlayActive?.(active);
    },
  );
  ipcMain.handle(
    DESKTOP_IPC_CHANNELS.setRendererOverlayActive,
    async (_event, active) => {
      if (typeof active !== 'boolean') {
        throw new Error('Renderer overlay active flag must be a boolean.');
      }
      await actions.setRendererOverlayActive?.(active);
    },
  );
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
  ipcMain.handle(
    DESKTOP_IPC_CHANNELS.readSmokeReport,
    async (_event, filePath) => {
      if (typeof filePath !== 'string' || !filePath.trim()) {
        throw new Error('Smoke report path must be a non-empty string.');
      }
      return actions.readSmokeReport?.(filePath);
    },
  );
  ipcMain.handle(DESKTOP_IPC_CHANNELS.listRuntimeProviders, async () => {
    return actions.listRuntimeProviders ? actions.listRuntimeProviders() : [];
  });
  ipcMain.handle(
    DESKTOP_IPC_CHANNELS.detectRuntimeProvider,
    async (_event, url) => {
      if (typeof url !== 'string') {
        throw new Error('Runtime provider detection requires a URL string.');
      }
      return (
        actions.detectRuntimeProvider?.(url) ?? {
          id: 'unsupported',
          label: 'Unsupported',
          readiness: 'unsupported' as const,
          runner: null,
        }
      );
    },
  );
  ipcMain.handle(
    DESKTOP_IPC_CHANNELS.setSetting,
    async (_event, key, value) => {
      if (typeof key !== 'string' || !key.trim()) {
        throw new Error('Settings key must be a non-empty string.');
      }
      actions.setSetting?.(key, value);
    },
  );
  ipcMain.handle(DESKTOP_IPC_CHANNELS.setPanelSizes, async (_event, sizes) => {
    if (!isDesktopShellPanelSizes(sizes)) {
      throw new Error(
        'Panel sizes must include numeric sidebar, main, and assist values.',
      );
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

function isHttpUrl(value: string) {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
}

function cloneDesktopShellState(state: DesktopShellState): DesktopShellState {
  return {
    ...state,
    panelSizes: {
      ...state.panelSizes,
    },
  };
}

function isDesktopShellPanelSizes(
  value: unknown,
): value is DesktopShellPanelSizes {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<DesktopShellPanelSizes>;

  return (
    isFinitePanelSize(candidate.sidebar) &&
    isFinitePanelSize(candidate.main) &&
    isFinitePanelSize(candidate.assist)
  );
}

function isFinitePanelSize(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isSetAssistFieldInput(
  value: unknown,
): value is {
  kind: 'fill' | 'select' | 'click' | 'typeahead';
  selector: string;
  value: string;
} {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.selector !== 'string' || !candidate.selector.trim()) {
    return false;
  }
  if (typeof candidate.value !== 'string') return false;
  return (
    candidate.kind === 'fill' ||
    candidate.kind === 'select' ||
    candidate.kind === 'click' ||
    candidate.kind === 'typeahead'
  );
}
