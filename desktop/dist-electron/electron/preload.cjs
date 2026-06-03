"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron = require('electron');
const { contextBridge, ipcRenderer } = electron;
const desktopAuthChannels = {
    clearToken: 'desktop-auth:clear-token',
    getState: 'desktop-auth:get-state',
    pairWithCode: 'desktop-auth:pair-with-code',
};
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
};
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
};
const desktopAssistNavStateChannel = 'desktop:assist-nav-state';
const desktopAssistPageChangedChannel = 'desktop:assist-page-changed';
const desktopAgentChatChannels = {
    sendMessage: 'desktop-agent-chat:send-message',
};
const desktopSubmitChannels = {
    cancelRun: 'desktop-submit:cancel-run',
    pickRandomGreenhouseLead: 'desktop-submit:pick-random-greenhouse-lead',
    recordManualSubmit: 'desktop-submit:record-manual-submit',
    runLead: 'desktop-submit:run-lead',
    runSmokeTest: 'desktop-submit:run-smoke-test',
    cancelSmokeTest: 'desktop-submit:cancel-smoke-test',
    swapAssistResumeFile: 'desktop-submit:swap-assist-resume-file',
    tailorResumeForLead: 'desktop-submit:tailor-resume-for-lead',
};
const desktopSmokeProgressChannel = 'desktop-submit-event:smoke-progress';
const desktopUserActionChannel = 'desktop:user-action-report';
contextBridge.exposeInMainWorld('gimmeJobDesktop', {
    admin: {
        getDashboardStats: () => ipcRenderer.invoke(desktopAdminChannels.getDashboardStats),
        getListingsAnalytics: () => ipcRenderer.invoke(desktopAdminChannels.getListingsAnalytics),
        getListingsProviders: () => ipcRenderer.invoke(desktopAdminChannels.getListingsProviders),
        getProviderRuns: (request) => ipcRenderer.invoke(desktopAdminChannels.getProviderRuns, request),
        getSavedSearches: () => ipcRenderer.invoke(desktopAdminChannels.getSavedSearches),
        saveSearch: (request) => ipcRenderer.invoke(desktopAdminChannels.saveSearch, request),
        pauseScrape: (request) => ipcRenderer.invoke(desktopAdminChannels.pauseScrape, request),
        startScrape: (request) => ipcRenderer.invoke(desktopAdminChannels.startScrape, request),
        stopScrape: (request) => ipcRenderer.invoke(desktopAdminChannels.stopScrape, request),
        subscribeScrape: (request) => ipcRenderer.invoke(desktopAdminChannels.subscribeScrape, request),
        unsubscribeScrape: (request) => ipcRenderer.invoke(desktopAdminChannels.unsubscribeScrape, request),
        onScrapeProgress: (callback) => {
            const listener = (_event, delta) => callback(delta);
            ipcRenderer.on(desktopAdminChannels.scrapeProgressEvent, listener);
            return () => {
                ipcRenderer.removeListener(desktopAdminChannels.scrapeProgressEvent, listener);
            };
        },
    },
    agent: {
        chat: (request) => ipcRenderer.invoke(desktopAgentChatChannels.sendMessage, request),
    },
    auth: {
        clearToken: () => ipcRenderer.invoke(desktopAuthChannels.clearToken),
        getState: () => ipcRenderer.invoke(desktopAuthChannels.getState),
        pairWithCode: (code) => ipcRenderer.invoke(desktopAuthChannels.pairWithCode, code),
    },
    shell: {
        assistGoBack: () => ipcRenderer.invoke(desktopShellChannels.assistGoBack),
        assistGoForward: () => ipcRenderer.invoke(desktopShellChannels.assistGoForward),
        getAssistNavState: () => ipcRenderer.invoke(desktopShellChannels.getAssistNavState),
        getAssistPageContext: () => ipcRenderer.invoke(desktopShellChannels.getAssistPageContext),
        getAssistTitle: () => ipcRenderer.invoke(desktopShellChannels.getAssistTitle),
        getState: () => ipcRenderer.invoke(desktopShellChannels.getState),
        highlightAssistField: (selector) => ipcRenderer.invoke(desktopShellChannels.highlightAssistField, selector),
        loadAppUrl: (url) => ipcRenderer.invoke(desktopShellChannels.loadAppUrl, url),
        onAssistNavStateChange: (callback) => {
            const listener = (_event, navState) => callback(navState);
            ipcRenderer.on(desktopAssistNavStateChannel, listener);
            return () => {
                ipcRenderer.removeListener(desktopAssistNavStateChannel, listener);
            };
        },
        onAssistPageChanged: (callback) => {
            const listener = () => callback();
            ipcRenderer.on(desktopAssistPageChangedChannel, listener);
            return () => {
                ipcRenderer.removeListener(desktopAssistPageChangedChannel, listener);
            };
        },
        setAssistEyeSaverMode: (enabled) => ipcRenderer.invoke(desktopShellChannels.setAssistEyeSaverMode, enabled),
        setAssistField: (input) => ipcRenderer.invoke(desktopShellChannels.setAssistField, input),
        getAssistFieldOptions: (selector, options) => ipcRenderer.invoke(desktopShellChannels.getAssistFieldOptions, selector, options),
        setActiveSection: (section) => ipcRenderer.invoke(desktopShellChannels.setActiveSection, section),
        setRendererOverlayActive: (active) => ipcRenderer.invoke(desktopShellChannels.setRendererOverlayActive, active),
        setAssistOverlayActive: (active) => ipcRenderer.invoke(desktopShellChannels.setAssistOverlayActive, active),
        setAutofillPaused: (paused) => ipcRenderer.invoke(desktopShellChannels.setAutofillPaused, paused),
        listFieldRules: () => ipcRenderer.invoke(desktopShellChannels.listFieldRules),
        removeFieldRule: (id) => ipcRenderer.invoke(desktopShellChannels.removeFieldRule, id),
        addFieldRule: (input) => ipcRenderer.invoke(desktopShellChannels.addFieldRule, input),
        setPanelSizes: (panelSizes) => ipcRenderer.invoke(desktopShellChannels.setPanelSizes, panelSizes),
        setAssistUrl: (url) => ipcRenderer.invoke(desktopShellChannels.setAssistUrl, url),
    },
    settings: {
        get: (key) => ipcRenderer.invoke(desktopShellChannels.getSetting, key),
        set: (key, value) => ipcRenderer.invoke(desktopShellChannels.setSetting, key, value),
    },
    smokeReports: {
        list: () => ipcRenderer.invoke(desktopShellChannels.listSmokeReports),
        read: (filePath) => ipcRenderer.invoke(desktopShellChannels.readSmokeReport, filePath),
    },
    providers: {
        listRuntime: () => ipcRenderer.invoke(desktopShellChannels.listRuntimeProviders),
        detectFor: (url) => ipcRenderer.invoke(desktopShellChannels.detectRuntimeProvider, url),
    },
    submit: {
        cancelRun: () => ipcRenderer.invoke(desktopSubmitChannels.cancelRun),
        pickRandomGreenhouseLead: (request) => ipcRenderer.invoke(desktopSubmitChannels.pickRandomGreenhouseLead, request),
        recordManualSubmit: (request) => ipcRenderer.invoke(desktopSubmitChannels.recordManualSubmit, request),
        runLead: (request) => ipcRenderer.invoke(desktopSubmitChannels.runLead, request),
        runSmokeTest: (request) => ipcRenderer.invoke(desktopSubmitChannels.runSmokeTest, request),
        cancelSmokeTest: () => ipcRenderer.invoke(desktopSubmitChannels.cancelSmokeTest),
        onSmokeProgress: (callback) => {
            const handler = (_event, payload) => callback(payload);
            ipcRenderer.on(desktopSmokeProgressChannel, handler);
            return () => {
                ipcRenderer.removeListener(desktopSmokeProgressChannel, handler);
            };
        },
        swapAssistResumeFile: (request) => ipcRenderer.invoke(desktopSubmitChannels.swapAssistResumeFile, request),
        tailorResumeForLead: (request) => ipcRenderer.invoke(desktopSubmitChannels.tailorResumeForLead, request),
    },
    userActions: {
        onReport: (callback) => {
            const listener = (_event, report) => callback(report);
            ipcRenderer.on(desktopUserActionChannel, listener);
            return () => {
                ipcRenderer.removeListener(desktopUserActionChannel, listener);
            };
        },
    },
});
