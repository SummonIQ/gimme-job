const electron = require('electron') as typeof import('electron');

const { contextBridge, ipcRenderer } = electron;

const desktopAuthChannels = {
  clearToken: 'desktop-auth:clear-token',
  getState: 'desktop-auth:get-state',
  pairWithCode: 'desktop-auth:pair-with-code',
} as const;

const desktopShellChannels = {
  assistGoBack: 'desktop:assist-go-back',
  assistGoForward: 'desktop:assist-go-forward',
  getAssistFieldOptions: 'desktop:get-assist-field-options',
  getAssistNavState: 'desktop:get-assist-nav-state',
  getAssistPageContext: 'desktop:get-assist-page-context',
  getAssistTitle: 'desktop:get-assist-title',
  getState: 'desktop:get-state',
  getSetting: 'desktop:settings-get',
  highlightAssistField: 'desktop:highlight-assist-field',
  listSmokeReports: 'desktop:smoke-reports-list',
  loadAppUrl: 'desktop:load-app-url',
  readSmokeReport: 'desktop:smoke-reports-read',
  setActiveSection: 'desktop:set-active-section',
  setRendererOverlayActive: 'desktop:set-renderer-overlay-active',
  setAssistEyeSaverMode: 'desktop:set-assist-eye-saver-mode',
  setAssistField: 'desktop:set-assist-field',
  setAssistOverlayActive: 'desktop:set-assist-overlay-active',
  setAutofillPaused: 'desktop:set-autofill-paused',
  listFieldRules: 'desktop:field-rules-list',
  removeFieldRule: 'desktop:field-rules-remove',
  addFieldRule: 'desktop:field-rules-add',
  setPanelSizes: 'desktop:set-panel-sizes',
  setAssistUrl: 'desktop:set-assist-url',
  setSetting: 'desktop:settings-set',
  listRuntimeProviders: 'desktop:runtime-providers-list',
  detectRuntimeProvider: 'desktop:runtime-providers-detect',
} as const;

// Scrape-slice admin channels — used by the native Scraper section.
// Other admin domains (plan board, observations, …) are intentionally
// absent here; they live in the web admin.
const desktopAdminChannels = {
  getDashboardStats: 'desktop-admin:get-dashboard-stats',
  getListingsAnalytics: 'desktop-admin:get-listings-analytics',
  getListingsProviders: 'desktop-admin:get-listings-providers',
  getProviderRuns: 'desktop-admin:get-provider-runs',
  getSavedSearches: 'desktop-admin:get-saved-searches',
  pauseScrape: 'desktop-admin:pause-scrape',
  saveSearch: 'desktop-admin:save-search',
  startScrape: 'desktop-admin:start-scrape',
  stopScrape: 'desktop-admin:stop-scrape',
  subscribeScrape: 'desktop-admin:subscribe-scrape',
  unsubscribeScrape: 'desktop-admin:unsubscribe-scrape',
  scrapeProgressEvent: 'desktop-admin-event:scrape-progress',
} as const;

const desktopAssistNavStateChannel = 'desktop:assist-nav-state';
const desktopAssistPageChangedChannel = 'desktop:assist-page-changed';

const desktopAgentChatChannels = {
  sendMessage: 'desktop-agent-chat:send-message',
} as const;

const desktopSubmitChannels = {
  cancelRun: 'desktop-submit:cancel-run',
  pickRandomGreenhouseLead: 'desktop-submit:pick-random-greenhouse-lead',
  recordManualSubmit: 'desktop-submit:record-manual-submit',
  runLead: 'desktop-submit:run-lead',
  runSmokeTest: 'desktop-submit:run-smoke-test',
  cancelSmokeTest: 'desktop-submit:cancel-smoke-test',
  swapAssistResumeFile: 'desktop-submit:swap-assist-resume-file',
  tailorResumeForLead: 'desktop-submit:tailor-resume-for-lead',
} as const;

const desktopSmokeProgressChannel = 'desktop-submit-event:smoke-progress';

const desktopUserActionChannel = 'desktop:user-action-report';

contextBridge.exposeInMainWorld('gimmeJobDesktop', {
  admin: {
    getDashboardStats: () =>
      ipcRenderer.invoke(desktopAdminChannels.getDashboardStats),
    getListingsAnalytics: () =>
      ipcRenderer.invoke(desktopAdminChannels.getListingsAnalytics),
    getListingsProviders: () =>
      ipcRenderer.invoke(desktopAdminChannels.getListingsProviders),
    getProviderRuns: (request: unknown) =>
      ipcRenderer.invoke(desktopAdminChannels.getProviderRuns, request),
    getSavedSearches: () =>
      ipcRenderer.invoke(desktopAdminChannels.getSavedSearches),
    saveSearch: (request: unknown) =>
      ipcRenderer.invoke(desktopAdminChannels.saveSearch, request),
    pauseScrape: (request: unknown) =>
      ipcRenderer.invoke(desktopAdminChannels.pauseScrape, request),
    startScrape: (request: unknown) =>
      ipcRenderer.invoke(desktopAdminChannels.startScrape, request),
    stopScrape: (request: unknown) =>
      ipcRenderer.invoke(desktopAdminChannels.stopScrape, request),
    subscribeScrape: (request: unknown) =>
      ipcRenderer.invoke(desktopAdminChannels.subscribeScrape, request),
    unsubscribeScrape: (request: unknown) =>
      ipcRenderer.invoke(desktopAdminChannels.unsubscribeScrape, request),
    onScrapeProgress: (callback: (delta: unknown) => void) => {
      const listener = (_event: unknown, delta: unknown) => callback(delta);
      ipcRenderer.on(desktopAdminChannels.scrapeProgressEvent, listener);
      return () => {
        ipcRenderer.removeListener(
          desktopAdminChannels.scrapeProgressEvent,
          listener,
        );
      };
    },
  },
  agent: {
    chat: (request: unknown) =>
      ipcRenderer.invoke(desktopAgentChatChannels.sendMessage, request),
  },
  auth: {
    clearToken: () => ipcRenderer.invoke(desktopAuthChannels.clearToken),
    getState: () => ipcRenderer.invoke(desktopAuthChannels.getState),
    pairWithCode: (code: string) =>
      ipcRenderer.invoke(desktopAuthChannels.pairWithCode, code),
  },
  shell: {
    assistGoBack: () => ipcRenderer.invoke(desktopShellChannels.assistGoBack),
    assistGoForward: () =>
      ipcRenderer.invoke(desktopShellChannels.assistGoForward),
    getAssistNavState: () =>
      ipcRenderer.invoke(desktopShellChannels.getAssistNavState),
    getAssistPageContext: () =>
      ipcRenderer.invoke(desktopShellChannels.getAssistPageContext),
    getAssistTitle: () =>
      ipcRenderer.invoke(desktopShellChannels.getAssistTitle),
    getState: () => ipcRenderer.invoke(desktopShellChannels.getState),
    highlightAssistField: (selector: string) =>
      ipcRenderer.invoke(desktopShellChannels.highlightAssistField, selector),
    loadAppUrl: (url: string) =>
      ipcRenderer.invoke(desktopShellChannels.loadAppUrl, url),
    onAssistNavStateChange: (
      callback: (navState: {
        canGoBack: boolean;
        canGoForward: boolean;
      }) => void,
    ) => {
      const listener = (
        _event: unknown,
        navState: { canGoBack: boolean; canGoForward: boolean },
      ) => callback(navState);
      ipcRenderer.on(desktopAssistNavStateChannel, listener);
      return () => {
        ipcRenderer.removeListener(desktopAssistNavStateChannel, listener);
      };
    },
    onAssistPageChanged: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on(desktopAssistPageChangedChannel, listener);
      return () => {
        ipcRenderer.removeListener(desktopAssistPageChangedChannel, listener);
      };
    },
    setAssistEyeSaverMode: (enabled: boolean) =>
      ipcRenderer.invoke(desktopShellChannels.setAssistEyeSaverMode, enabled),
    setAssistField: (input: unknown) =>
      ipcRenderer.invoke(desktopShellChannels.setAssistField, input),
    getAssistFieldOptions: (
      selector: string,
      options?: { readonly query?: string },
    ) =>
      ipcRenderer.invoke(
        desktopShellChannels.getAssistFieldOptions,
        selector,
        options,
      ),
    setActiveSection: (
      section: 'dashboard' | 'training' | 'scraper' | 'smoke-tests' | 'admin',
    ) =>
      ipcRenderer.invoke(desktopShellChannels.setActiveSection, section),
    setRendererOverlayActive: (active: boolean) =>
      ipcRenderer.invoke(
        desktopShellChannels.setRendererOverlayActive,
        active,
      ),
    setAssistOverlayActive: (active: boolean) =>
      ipcRenderer.invoke(desktopShellChannels.setAssistOverlayActive, active),
    setAutofillPaused: (paused: boolean) =>
      ipcRenderer.invoke(desktopShellChannels.setAutofillPaused, paused),
    listFieldRules: () =>
      ipcRenderer.invoke(desktopShellChannels.listFieldRules),
    removeFieldRule: (id: string) =>
      ipcRenderer.invoke(desktopShellChannels.removeFieldRule, id),
    addFieldRule: (input: unknown) =>
      ipcRenderer.invoke(desktopShellChannels.addFieldRule, input),
    setPanelSizes: (panelSizes: unknown) =>
      ipcRenderer.invoke(desktopShellChannels.setPanelSizes, panelSizes),
    setAssistUrl: (url: string) =>
      ipcRenderer.invoke(desktopShellChannels.setAssistUrl, url),
  },
  settings: {
    get: (key: string) =>
      ipcRenderer.invoke(desktopShellChannels.getSetting, key),
    set: (key: string, value: unknown) =>
      ipcRenderer.invoke(desktopShellChannels.setSetting, key, value),
  },
  smokeReports: {
    list: () => ipcRenderer.invoke(desktopShellChannels.listSmokeReports),
    read: (filePath: string) =>
      ipcRenderer.invoke(desktopShellChannels.readSmokeReport, filePath),
  },
  providers: {
    listRuntime: () =>
      ipcRenderer.invoke(desktopShellChannels.listRuntimeProviders),
    detectFor: (url: string) =>
      ipcRenderer.invoke(desktopShellChannels.detectRuntimeProvider, url),
  },
  submit: {
    cancelRun: () => ipcRenderer.invoke(desktopSubmitChannels.cancelRun),
    pickRandomGreenhouseLead: (request: unknown) =>
      ipcRenderer.invoke(
        desktopSubmitChannels.pickRandomGreenhouseLead,
        request,
      ),
    recordManualSubmit: (request: unknown) =>
      ipcRenderer.invoke(desktopSubmitChannels.recordManualSubmit, request),
    runLead: (request: unknown) =>
      ipcRenderer.invoke(desktopSubmitChannels.runLead, request),
    runSmokeTest: (request: unknown) =>
      ipcRenderer.invoke(desktopSubmitChannels.runSmokeTest, request),
    cancelSmokeTest: () =>
      ipcRenderer.invoke(desktopSubmitChannels.cancelSmokeTest),
    onSmokeProgress: (callback: (event: unknown) => void) => {
      const handler = (_event: unknown, payload: unknown) => callback(payload);
      ipcRenderer.on(desktopSmokeProgressChannel, handler);
      return () => {
        ipcRenderer.removeListener(desktopSmokeProgressChannel, handler);
      };
    },
    swapAssistResumeFile: (request: unknown) =>
      ipcRenderer.invoke(desktopSubmitChannels.swapAssistResumeFile, request),
    tailorResumeForLead: (request: unknown) =>
      ipcRenderer.invoke(desktopSubmitChannels.tailorResumeForLead, request),
  },
  userActions: {
    onReport: (callback: (report: unknown) => void) => {
      const listener = (_event: unknown, report: unknown) => callback(report);
      ipcRenderer.on(desktopUserActionChannel, listener);
      return () => {
        ipcRenderer.removeListener(desktopUserActionChannel, listener);
      };
    },
  },
});
