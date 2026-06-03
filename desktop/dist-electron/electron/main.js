// The desktop runs on the user's machine (not Vercel), so the bundled
// scrape service IS allowed to launch Chromium for Playwright-based
// providers (indeed-scraper, etc.). The shared playwright-runtime module
// gates everything on this env var, so it must be set before any IPC
// handler that touches the bundle gets a chance to read it.
if (!process.env.ENABLE_PLAYWRIGHT_RENDER) {
    process.env.ENABLE_PLAYWRIGHT_RENDER = '1';
}
import { app, BrowserView, BrowserWindow, ipcMain, session as electronSession, shell, } from 'electron';
// In packaged builds the Chromium binary is bundled at
// Contents/Resources/playwright-browsers (see desktop/package.json
// extraResources + scripts/prepare-playwright-browsers.ts). Point
// Playwright at that path before its runtime asks the OS where to find
// the browser. In dev we leave the env var alone so it falls back to the
// user's ~/Library/Caches/ms-playwright cache.
if (app.isPackaged &&
    !process.env.PLAYWRIGHT_BROWSERS_PATH) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pathMod = require('node:path');
    process.env.PLAYWRIGHT_BROWSERS_PATH = pathMod.join(process.resourcesPath, 'playwright-browsers');
}
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseHtml } from 'node-html-parser';
// Load the repo's .env / .env.local into process.env before any IPC
// handler touches the bundled Prisma client. Without this, the adapter
// sees no DATABASE_URL and silently falls back to a local Postgres
// default, which connects but doesn't have the app schema (hence
// `relation "User" does not exist` on the desktop dashboard).
{
    const nodeRequire = createRequire(import.meta.url);
    const dotenv = nodeRequire('dotenv');
    const here = path.dirname(fileURLToPath(import.meta.url));
    // dist-electron/electron/main.js → ../../.. is the repo root.
    const repoRoot = path.resolve(here, '..', '..', '..');
    dotenv.config({ path: path.join(repoRoot, '.env'), override: false });
    dotenv.config({
        path: path.join(repoRoot, '.env.local'),
        override: true,
    });
}
import { createDesktopAgentChatClient } from './agent-chat/client.js';
import { collectAssistPageContext, highlightAssistPageField, } from './agent-chat/context.js';
import { registerDesktopAgentChatIpc } from './agent-chat/ipc.js';
import { createDesktopAuditWriter } from './audit/writer.js';
import { createDesktopAuthSession } from './auth/session.js';
import { createIdentityStore } from './identity/store.js';
import { registerDesktopAuthIpc } from './auth/ipc.js';
import { createDesktopTokenStore } from './auth/keychain-store.js';
import { createDesktopShellState, registerDesktopIpc } from './ipc.js';
import { getSetting, setSetting } from './settings-store.js';
import { listSmokeReports, readSmokeReport, } from './smoke-reports.js';
import { createDesktopSubmitClient, } from './submit/client.js';
import { detectClosedPosting, } from './submit/closed-posting-detector.js';
import { detectConfirmation as detectProviderConfirmation } from './submit/confirmation-detector.js';
import { inferGenderFromFirstName, runGreenhouseSubmitLead, setAutofillPaused as setGreenhouseAutofillPaused, } from './submit/greenhouse-submit.js';
import { runGenericSubmitLead } from './submit/generic-submit.js';
import { runAshbySubmitLead } from './submit/ashby-submit.js';
import { runLeverSubmitLead } from './submit/lever-submit.js';
import { runWorkableSubmitLead } from './submit/workable-submit.js';
import { runSmartRecruitersSubmitLead } from './submit/smartrecruiters-submit.js';
import { runRecruiteeSubmitLead } from './submit/recruitee-submit.js';
import { runTeamtailorSubmitLead } from './submit/teamtailor-submit.js';
import { runJobviteSubmitLead } from './submit/jobvite-submit.js';
import { runBambooHrSubmitLead } from './submit/bamboohr-submit.js';
import { runPersonioSubmitLead } from './submit/personio-submit.js';
import { runBreezySubmitLead } from './submit/breezy-submit.js';
import { runWorkdaySubmitLead } from './submit/workday-submit.js';
import { runIcimsSubmitLead } from './submit/icims-submit.js';
import { runTaleoSubmitLead } from './submit/taleo-submit.js';
import { DESKTOP_RUNTIME_PROVIDERS, getRuntimeProviderForUrl, shouldBlockAutopilotForProvider, } from './submit/provider-registry.js';
import { createRunId, createRunJsonlToolRegistry, openRunLog, } from './submit/run-jsonl-log.js';
import { addFieldRule, configureFieldRuleSync, findMatchingFieldRule, getAllFieldRules, hydrateRulesFromServer, promoteFieldRules, removeFieldRule, } from './field-rules-store.js';
import { DESKTOP_SUBMIT_IPC_EVENTS, registerDesktopSubmitIpc, } from './submit/ipc.js';
import { createElectronCdpToolDriver } from './tools/electron-driver.js';
import { registerDesktopToolIpc } from './tools/ipc.js';
import { createDesktopToolRegistry } from './tools/registry.js';
import { injectUserActionTracker, parseUserActionReport, } from './user-action-tracker.js';
import { DESKTOP_APP_HEADER_HEIGHT, DESKTOP_STATUS_BAR_HEIGHT, calculateDesktopLayout, } from './window-layout.js';
import { registerDesktopScrapeIpc } from './admin/scrape-ipc.js';
const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const rendererEntry = process.env.VITE_DEV_SERVER_URL ??
    pathToFileURL(path.join(desktopRoot, 'dist-renderer/index.html')).toString();
const preloadEntry = path.join(desktopRoot, 'dist-electron/electron/preload.cjs');
const RANDOM_PICK_AVAILABILITY_ATTEMPTS = 5;
const ASSIST_EYE_SAVER_CSS = `
:root {
  color-scheme: dark !important;
  background-color: #07090b !important;
}

html,
body {
  background-color: #07090b !important;
  background-image: none !important;
  color: #e5edf0 !important;
}

*,
*::before,
*::after {
  background-color: transparent !important;
  background-image: none !important;
  color: #e5edf0 !important;
  border-color: #1f2a30 !important;
  box-shadow: none !important;
  text-shadow: none !important;
}

input,
textarea,
select,
button,
[role="button"],
[role="textbox"],
[role="combobox"],
[role="listbox"],
[role="option"] {
  color-scheme: dark !important;
  background-color: #1a242a !important;
  color: #e5edf0 !important;
  border: 1px solid #5b7886 !important;
}

/* Ensure form inputs stand out against the page background so the vision
 * pipeline (and the user) can actually see empty fields. The default eye-saver
 * border was too dim against the near-black page bg and inputs disappeared. */
input:not([type="hidden"]),
textarea,
select,
[role="textbox"],
[role="combobox"] {
  outline: 1px solid rgba(124, 196, 255, 0.18) !important;
  outline-offset: -1px !important;
}

[role="dialog"],
[role="menu"],
[role="tooltip"] {
  background-color: #11181c !important;
}

a,
a * {
  color: #7cc4ff !important;
}

img,
picture,
video,
canvas,
svg,
iframe,
embed,
object,
[role="img"] {
  filter: brightness(0.85) !important;
}

::placeholder {
  color: #5d6c74 !important;
  opacity: 1 !important;
}

::selection {
  background: #355264 !important;
  color: #f3f7f8 !important;
}

::-webkit-scrollbar {
  background: #0c1114 !important;
}

::-webkit-scrollbar-thumb {
  background: #1f2a30 !important;
}
`;
const persistedAssistUrl = readPersistedAssistUrl();
const persistedPanelSizes = readPersistedPanelSizes();
const shellState = createDesktopShellState({
    appUrl: process.env.GIMME_JOB_APP_URL ?? 'http://localhost:10100',
    assistUrl: process.env.GIMME_JOB_ASSIST_URL ??
        persistedAssistUrl ??
        'https://job-boards.greenhouse.io',
    panelSizes: persistedPanelSizes ?? undefined,
});
const authSession = createDesktopAuthSession({
    appUrl: shellState.appUrl,
    deviceLabel: 'Gimme Job Desktop',
});
const desktopTokenStore = createDesktopTokenStore();
const auditWriter = createDesktopAuditWriter({
    appUrl: shellState.appUrl,
    tokenStore: desktopTokenStore,
});
const identityStore = createIdentityStore();
const submitClient = createDesktopSubmitClient({
    appUrl: shellState.appUrl,
    identityStore,
    tokenStore: desktopTokenStore,
});
const toolRegistry = createDesktopToolRegistry(createElectronCdpToolDriver({
    getWebContents: () => {
        if (!assistView) {
            throw new Error('ATS assist view is not ready.');
        }
        return assistView.webContents;
    },
    identityStore,
}));
let assistView = null;
let appBrowserView = null;
let desktopWindow = null;
let assistOverlayActive = false;
// Tracks the active top-level section in the renderer. BrowserViews are
// composited above the renderer's HTML by Electron — there is no z-index
// fix — so we collapse them to 0×0 when the user is anywhere except the
// Training section so the Scraper page (and any other future page) doesn't
// get covered.
let activeSection = 'dashboard';
const DESKTOP_ADMIN_BROWSER_CHROME_HEIGHT = 56;
// Toggled by the renderer whenever any HTML overlay (Radix dropdown,
// popover, dialog, modal) is open. While true, we collapse both
// BrowserViews to 0×0 so the overlay isn't visually covered. The
// renderer's MutationObserver flips it back the moment the last overlay
// closes.
let rendererOverlayActive = false;
let lastSubmitResult = null;
let activeRunController = null;
let smokeTestController = null;
const activeSubmitRunKeys = new Set();
const VERIFICATION_CODE_TTL_MS = 60_000;
const VERIFICATION_CODE_POLL_MS = 30_000;
const verificationCodeCache = new Map();
let verificationCodePollTimer = null;
function verificationCacheKey(digits) {
    return typeof digits === 'number' && Number.isFinite(digits)
        ? `d:${digits}`
        : 'any';
}
async function lookupVerificationCodeCached(digits, signal) {
    const key = verificationCacheKey(digits);
    const entry = verificationCodeCache.get(key);
    if (entry && Date.now() - entry.cachedAt < VERIFICATION_CODE_TTL_MS) {
        return entry.result;
    }
    try {
        const result = await submitClient.lookupRecentVerificationCode(digits, {
            signal,
        });
        verificationCodeCache.set(key, { cachedAt: Date.now(), result });
        return result;
    }
    catch (error) {
        if (entry)
            return entry.result; // Stale-while-error fallback
        throw error;
    }
}
async function pollVerificationCodesOnce() {
    // Refresh both the "any-digits" bucket and the common Greenhouse 8-digit
    // bucket. Any other digit-count the agent asks for will be filled in
    // on first lookup and then live-refreshed on its TTL.
    for (const digits of [undefined, 8]) {
        try {
            const result = await submitClient.lookupRecentVerificationCode(digits, {});
            const key = verificationCacheKey(digits);
            verificationCodeCache.set(key, { cachedAt: Date.now(), result });
            if (result) {
                console.log(`[verification-poll] cached ${result.digits}-digit code from ${result.fromEmail || 'inbox'}`);
            }
        }
        catch {
            // Network blip / not paired — silently skip; next tick will retry.
        }
    }
}
function startVerificationCodePoller() {
    if (verificationCodePollTimer)
        return;
    // Kick once immediately so the first agent lookup after pairing is warm.
    void pollVerificationCodesOnce();
    verificationCodePollTimer = setInterval(() => {
        void pollVerificationCodesOnce();
    }, VERIFICATION_CODE_POLL_MS);
    // Don't keep the event loop alive just for polling.
    if (typeof verificationCodePollTimer.unref === 'function') {
        verificationCodePollTimer.unref();
    }
}
const agentChatClient = createDesktopAgentChatClient({
    appUrl: shellState.appUrl,
    collectContext: () => {
        if (!assistView) {
            throw new Error('ATS assist view is not ready.');
        }
        return collectAssistPageContext({
            lastSubmitResult,
            webContents: assistView.webContents,
        });
    },
    tokenStore: desktopTokenStore,
    addFieldRule: input => {
        addFieldRule({
            question: input.question,
            answer: input.answer,
            hostname: input.hostname,
            source: 'chat',
        });
    },
    fillAssistField: async ({ selector, value, kind }) => {
        if (!assistView) {
            return { ok: false, error: 'Assist view is not ready.' };
        }
        if (kind === 'typeahead') {
            const filled = await toolRegistry.call({
                input: { selector, value },
                tool: 'fill',
            });
            if (!filled.ok)
                return { ok: false, error: filled.error?.message };
            await new Promise(resolve => setTimeout(resolve, 400));
            await toolRegistry.call({ input: { key: 'ArrowDown' }, tool: 'press_key' });
            await new Promise(resolve => setTimeout(resolve, 80));
            const enter = await toolRegistry.call({
                input: { key: 'Enter' },
                tool: 'press_key',
            });
            return { ok: enter.ok, error: enter.error?.message };
        }
        const result = await toolRegistry.call({
            input: { selector, value },
            tool: kind === 'select' ? 'select' : 'fill',
        });
        return { ok: result.ok, error: result.error?.message };
    },
});
function buildSubmitRunKey(input) {
    try {
        const url = new URL(input.applicationUrl);
        url.hash = '';
        url.hostname = url.hostname.toLowerCase();
        if (url.pathname.endsWith('/')) {
            url.pathname = url.pathname.replace(/\/+$/, '');
        }
        return url.toString();
    }
    catch {
        return input.applicationUrl.trim();
    }
}
function createDuplicateSubmitResult(input) {
    return {
        applicationUrl: input.applicationUrl,
        executionEnvironment: 'DESKTOP_CDP',
        jobLeadId: input.jobLeadId,
        message: input.message,
        mode: input.mode,
        status: 'paused_for_manual_review',
        toolCalls: [],
    };
}
function createProviderReadinessBlockedResult(input) {
    const isUnsupported = input.provider.readiness === 'unsupported';
    return {
        applicationUrl: input.applicationUrl,
        executionEnvironment: 'DESKTOP_CDP',
        jobLeadId: input.jobLeadId,
        message: isUnsupported
            ? 'Unsupported provider; autopilot refused to start this run.'
            : `${input.provider.label} is marked manual_review; autopilot paused before starting this run.`,
        mode: input.mode,
        status: isUnsupported ? 'unsupported_provider' : 'paused_for_manual_review',
        toolCalls: [],
    };
}
registerDesktopIpc(ipcMain, shellState, {
    assistGoBack: () => {
        const webContents = assistView?.webContents;
        if (webContents && webContents.canGoBack())
            webContents.goBack();
        return {
            canGoBack: webContents?.canGoBack() ?? false,
            canGoForward: webContents?.canGoForward() ?? false,
        };
    },
    assistGoForward: () => {
        const webContents = assistView?.webContents;
        if (webContents && webContents.canGoForward())
            webContents.goForward();
        return {
            canGoBack: webContents?.canGoBack() ?? false,
            canGoForward: webContents?.canGoForward() ?? false,
        };
    },
    getAssistNavState: () => ({
        canGoBack: assistView?.webContents.canGoBack() ?? false,
        canGoForward: assistView?.webContents.canGoForward() ?? false,
    }),
    getSetting: (key) => getSetting(key),
    setSetting: (key, value) => setSetting(key, value),
    listSmokeReports: () => listSmokeReports({
        smokeReportsDir: getSmokeReportsDirectory(),
    }),
    readSmokeReport: (filePath) => readSmokeReport({
        filePath,
        runLogsDir: getRunLogsDirectory(),
        smokeReportsDir: getSmokeReportsDirectory(),
    }),
    listRuntimeProviders: () => DESKTOP_RUNTIME_PROVIDERS.map(provider => ({
        id: provider.id,
        label: provider.label,
        readiness: provider.readiness,
        runner: provider.runner,
    })),
    detectRuntimeProvider: (url) => {
        const provider = getRuntimeProviderForUrl(url);
        return {
            id: provider.id,
            label: provider.label,
            readiness: provider.readiness,
            runner: provider.runner,
        };
    },
    getAssistPageContext: () => {
        if (!assistView)
            return null;
        return collectAssistPageContext({
            lastSubmitResult,
            webContents: assistView.webContents,
        });
    },
    getAssistTitle: () => assistView?.webContents.getTitle() ?? '',
    highlightAssistField: selector => {
        if (!assistView)
            return false;
        return highlightAssistPageField(assistView.webContents, selector);
    },
    setAssistField: async ({ kind, selector, value, question, hostname }) => {
        if (!assistView) {
            return { error: 'Assist view is not ready.', ok: false };
        }
        // Prefer the live assist view URL over whatever the renderer guessed —
        // the renderer's window.location is the desktop shell, not the ATS host.
        const effectiveHostname = readHostnameFromUrl(assistView.webContents.getURL()) ?? hostname ?? null;
        const recordRuleIfTeaching = () => {
            if (question && question.trim().length > 2 && value.trim().length > 0) {
                try {
                    addFieldRule({
                        question,
                        answer: value,
                        hostname: effectiveHostname,
                        source: 'state-tab',
                    });
                }
                catch (error) {
                    console.warn('[field-rules] failed to record manual fill:', error);
                }
            }
        };
        if (kind === 'click') {
            const result = await toolRegistry.call({
                input: { selector },
                tool: 'click',
            });
            return { error: result.error?.message, ok: result.ok };
        }
        if (kind === 'typeahead') {
            // Type the value into the field, then commit by selecting the
            // first highlighted suggestion (ArrowDown + Enter is what most
            // typeahead widgets — Greenhouse location, Algolia Places, etc.
            // — expect to commit the top match).
            const filled = await toolRegistry.call({
                input: { selector, value },
                tool: 'fill',
            });
            if (!filled.ok) {
                return { error: filled.error?.message, ok: false };
            }
            await new Promise(resolve => setTimeout(resolve, 500));
            await toolRegistry.call({
                input: { key: 'ArrowDown' },
                tool: 'press_key',
            });
            await new Promise(resolve => setTimeout(resolve, 80));
            const enter = await toolRegistry.call({
                input: { key: 'Enter' },
                tool: 'press_key',
            });
            if (enter.ok)
                recordRuleIfTeaching();
            return { error: enter.error?.message, ok: enter.ok };
        }
        const result = await toolRegistry.call({
            input: { selector, value },
            tool: kind === 'select' ? 'select' : 'fill',
        });
        // Manual State-tab fills become permanent rules: the user is
        // teaching us what the right answer is for this question, and we
        // want the next run to skip the LLM and use this directly.
        if (result.ok)
            recordRuleIfTeaching();
        return { error: result.error?.message, ok: result.ok };
    },
    getAssistFieldOptions: async (selector, options) => {
        if (!assistView) {
            return { error: 'Assist view is not ready.', ok: false };
        }
        const result = await readAssistSelectOptions(toolRegistry, selector, {
            query: options?.query,
        });
        return { ok: true, options: result };
    },
    loadAssistUrl: async (url) => {
        await assistView?.webContents.loadURL(url);
    },
    loadAppUrl: async (url) => {
        await appBrowserView?.webContents.loadURL(url);
    },
    refreshLayout: () => {
        if (!desktopWindow || !appBrowserView || !assistView) {
            return;
        }
        layoutViews(desktopWindow, appBrowserView, assistView);
    },
    setAssistEyeSaverMode: async (enabled) => {
        if (!assistView)
            return;
        await setAssistEyeSaverMode(assistView.webContents, enabled);
    },
    setAutofillPaused: paused => {
        setGreenhouseAutofillPaused(paused);
    },
    listFieldRules: () => getAllFieldRules(),
    removeFieldRule: id => removeFieldRule(id),
    addFieldRule: input => addFieldRule({
        question: input.question,
        answer: input.answer,
        hostname: input.hostname ?? null,
        source: 'manual',
    }),
    setActiveSection: section => {
        activeSection = section;
        if (!desktopWindow || !appBrowserView || !assistView)
            return;
        layoutViews(desktopWindow, appBrowserView, assistView);
    },
    setAssistOverlayActive: active => {
        assistOverlayActive = active;
        if (!desktopWindow || !appBrowserView || !assistView)
            return;
        layoutViews(desktopWindow, appBrowserView, assistView);
    },
    setRendererOverlayActive: active => {
        rendererOverlayActive = active;
        if (!desktopWindow || !appBrowserView || !assistView)
            return;
        layoutViews(desktopWindow, appBrowserView, assistView);
    },
});
// Native Scraper section IPC — provider list, saved searches,
// listings analytics (Prisma direct) and start/stop/subscribe scrape
// (HTTP-forwarded to /api/admin/scrape using the Electron defaultSession
// cookies). See desktop/electron/admin/scrape-ipc.ts.
registerDesktopScrapeIpc(ipcMain, {
    getAppSession: () => electronSession.defaultSession,
    getAppUrl: () => shellState.appUrl,
    getAuthUserId: () => authSession.peekUserId(),
    getMainWindow: () => desktopWindow,
});
registerDesktopAuthIpc(ipcMain, authSession);
registerDesktopToolIpc(ipcMain, toolRegistry, { auditWriter });
registerDesktopAgentChatIpc(ipcMain, agentChatClient);
// Start the 30-second verification-code poll. Safe to call before pairing —
// the underlying client returns null when no desktop token is present.
startVerificationCodePoller();
// Wire local field-rules to push every add/delete to the server, and
// hydrate the local cache from server-side rules at boot so a rule
// taught on a different machine becomes available without re-teaching.
configureFieldRuleSync(rule => submitClient.syncFieldRule({
    hostname: rule.hostname,
    question: rule.question,
    answer: rule.answer,
    source: rule.source,
}), id => submitClient.deleteFieldRule(id));
promoteFieldRules();
void submitClient
    .fetchFieldRules()
    .then(rules => {
    if (rules.length > 0) {
        hydrateRulesFromServer(rules.map(rule => ({
            id: rule.id,
            hostname: rule.hostname,
            question: rule.question,
            answer: rule.answer,
            source: rule.source,
            createdAt: rule.createdAt,
        })));
        console.log(`[field-rules] hydrated ${rules.length} rules from server`);
    }
})
    .catch(error => {
    console.warn('[field-rules] server hydrate failed:', error);
});
const desktopSubmitRunner = {
    cancelRun: async () => {
        if (activeRunController && !activeRunController.signal.aborted) {
            activeRunController.abort();
            return { cancelled: true };
        }
        return { cancelled: false };
    },
    pickRandomGreenhouseLead: query => pickAvailableRandomLead(query),
    recordManualSubmit: async (request) => {
        const recorded = await submitClient.recordSubmittedApplication({
            applicationUrl: request.applicationUrl,
            jobLeadId: request.jobLeadId,
            message: request.message ?? 'Recorded after manual submit click.',
            mode: 'submit',
            status: 'completed',
            toolCallCount: request.toolCallCount,
        });
        if (recorded.outcome === 'applied' && recorded.submissionId) {
            void detectAndRecordConfirmation({
                applicationUrl: request.applicationUrl,
                submissionId: recorded.submissionId,
            });
        }
        return recorded;
    },
    runLead: async (request) => {
        const provider = getRuntimeProviderForUrl(request.applicationUrl);
        const runStartedAt = Date.now();
        const runJsonlLog = await createDesktopRunJsonlLog({
            applicationUrl: request.applicationUrl,
            mode: request.mode,
            provider,
        });
        const runToolRegistry = runJsonlLog
            ? createRunJsonlToolRegistry(toolRegistry, runJsonlLog)
            : toolRegistry;
        let runJsonlSummaryWritten = false;
        const writeRunJsonlSummary = async (result) => {
            if (!runJsonlLog || runJsonlSummaryWritten)
                return;
            runJsonlSummaryWritten = true;
            try {
                const includeErrorTool = result.status !== 'completed';
                await runJsonlLog.appendSummary({
                    errorTool: includeErrorTool
                        ? getFirstFailedToolName(result)
                        : undefined,
                    errorToolMessage: includeErrorTool
                        ? getFirstFailedToolMessage(result)
                        : undefined,
                    status: result.status,
                    totalElapsedMs: Date.now() - runStartedAt,
                });
            }
            catch (error) {
                console.warn('[run-jsonl-log] summary write failed:', error);
            }
            finally {
                await runJsonlLog.close().catch(closeError => {
                    console.warn('[run-jsonl-log] close failed:', closeError);
                });
            }
        };
        const finishRun = async (result) => {
            await writeRunJsonlSummary(result);
            return result;
        };
        const submitRunKey = request.mode === 'submit' ? buildSubmitRunKey(request) : null;
        if (submitRunKey && activeSubmitRunKeys.has(submitRunKey)) {
            const result = createDuplicateSubmitResult({
                applicationUrl: request.applicationUrl,
                jobLeadId: request.jobLeadId,
                message: 'Skipped submit: another desktop submit run is already active for this application.',
                mode: request.mode,
            });
            lastSubmitResult = result;
            return finishRun(result);
        }
        if (submitRunKey) {
            activeSubmitRunKeys.add(submitRunKey);
        }
        const controller = new AbortController();
        activeRunController = controller;
        try {
            if (request.mode === 'submit') {
                const submittedCheck = await submitClient.checkSubmittedApplication({
                    applicationUrl: request.applicationUrl,
                    jobLeadId: request.jobLeadId,
                });
                if (submittedCheck.alreadySubmitted) {
                    const result = createDuplicateSubmitResult({
                        applicationUrl: request.applicationUrl,
                        jobLeadId: submittedCheck.jobLeadId ?? request.jobLeadId,
                        message: submittedCheck.reason === 'existing_submission'
                            ? 'Skipped submit: this application already has a recorded submission.'
                            : 'Skipped submit: this job lead is already marked applied.',
                        mode: request.mode,
                    });
                    lastSubmitResult = result;
                    return finishRun(result);
                }
            }
            console.log(`[desktop-submit] provider=${provider.id} readiness=${provider.readiness} runner=${provider.runner ?? 'none'}`);
            if (shouldBlockAutopilotForProvider(provider, request.mode)) {
                const result = createProviderReadinessBlockedResult({
                    applicationUrl: request.applicationUrl,
                    jobLeadId: request.jobLeadId,
                    mode: request.mode,
                    provider,
                });
                lastSubmitResult = result;
                void writeRunLog(request, result).catch(error => {
                    console.warn('Failed to write run log:', error);
                });
                void recordDesktopRunResult(request, result).catch(error => {
                    console.warn('Desktop submission record failed:', error);
                });
                return finishRun(result);
            }
            const profile = await submitClient.syncProfileToIdentity();
            const preflightVerdict = await preflightClosedPostingCheck({
                applicationUrl: request.applicationUrl,
                skipNavigate: Boolean(request.continueFromCurrentPage),
            });
            if (preflightVerdict.closed) {
                await reportLeadUnavailable({
                    applicationUrl: request.applicationUrl,
                    jobLeadId: request.jobLeadId,
                    jobListingId: request.jobListingId,
                    verdict: preflightVerdict,
                });
                const result = {
                    applicationUrl: request.applicationUrl,
                    executionEnvironment: 'DESKTOP_CDP',
                    jobLeadId: request.jobLeadId,
                    message: `Greenhouse posting is unavailable (${preflightVerdict.detectedPhrase ??
                        preflightVerdict.reason ??
                        'closed page detected'}).`,
                    mode: request.mode,
                    status: 'unavailable',
                    toolCalls: [],
                };
                lastSubmitResult = result;
                void writeRunLog(request, result).catch(error => {
                    console.warn('Failed to write run log:', error);
                });
                void recordDesktopRunResult(request, result).catch(error => {
                    console.warn('Desktop submission record failed:', error);
                });
                return finishRun(result);
            }
            // Kick off resume tailoring in parallel with the form-fill — but only
            // when the user has explicitly opted in via Settings > Profile. When
            // disabled (default), submissions use the stored default resume; the
            // tailored revision is still produced separately for history but the
            // upload step won't wait on it.
            const shouldTailor = Boolean(request.jobLeadId) &&
                profile.useOptimizedResumeOnSubmit === true;
            const tailorPromise = shouldTailor
                ? submitClient
                    .tailorResumeForLead({ leadId: request.jobLeadId })
                    .catch(error => {
                    console.warn('Parallel resume tailor failed; falling back to stored resume:', error);
                    return null;
                })
                : null;
            const prepareTailoredResume = tailorPromise
                ? async () => {
                    const tailored = await tailorPromise;
                    if (!tailored?.formats?.pdf)
                        return null;
                    try {
                        const downloaded = await submitClient.downloadResumeBytes({
                            url: tailored.formats.pdf,
                        });
                        const tempPath = path.join(os.tmpdir(), `gimme-job-tailored-${request.jobLeadId ?? 'lead'}-${Date.now()}.pdf`);
                        await fs.writeFile(tempPath, Buffer.from(downloaded.base64, 'base64'));
                        return tempPath;
                    }
                    catch (error) {
                        console.warn('Failed to materialize tailored resume PDF; falling back:', error);
                        return null;
                    }
                }
                : undefined;
            const runner = pickRunnerForProvider(provider);
            const result = await runner(runToolRegistry, {
                ...request,
                prepareTailoredResume,
                // Preflight already navigated the assist view, so skip the
                // runtime's own navigate call regardless of the user's original
                // continueFromCurrentPage choice.
                continueFromCurrentPage: true,
                applicantProfile: {
                    canadaWorkPreference: profile.canadaWorkPreference ?? null,
                    city: profile.city ?? null,
                    citizenshipStatus: profile.citizenshipStatus ?? null,
                    country: profile.country ?? null,
                    disabilityStatus: profile.disabilityStatus ?? null,
                    gender: profile.gender ??
                        inferGenderFromFirstName(profile.firstName ?? '') ??
                        null,
                    githubUrl: profile.githubUrl ?? null,
                    hispanicLatino: profile.hispanicLatino ?? null,
                    linkedinUrl: profile.linkedinUrl ?? null,
                    race: profile.race ?? null,
                    referralSource: profile.referralSource ?? 'Gimme Job',
                    salaryExpectation: profile.salaryExpectation ?? null,
                    sponsorshipRequired: profile.sponsorshipRequired ?? null,
                    state: profile.state ?? null,
                    veteranStatus: profile.veteranStatus ?? null,
                    websiteUrl: profile.websiteUrl ?? null,
                    workAuthorization: profile.workAuthorization ?? null,
                },
                onFormSnapshot: async (snapshot) => {
                    try {
                        const archived = await archiveFormSnapshot(snapshot);
                        await submitClient.recordFormSnapshot({
                            applicationUrl: snapshot.applicationUrl,
                            byteSize: archived.byteSize,
                            capturedAt: archived.capturedAt.toISOString(),
                            fields: snapshot.fields,
                            filePath: archived.filePath,
                            hostname: snapshot.hostname,
                            jobLeadId: request.jobLeadId,
                        });
                    }
                    catch (error) {
                        console.warn('Form snapshot archive failed:', error);
                    }
                },
                resolveUnknownFieldAnswer: async (query) => {
                    // Check user-defined rules before going to the LLM. Rules
                    // are taught either explicitly (UI) or implicitly (manual
                    // State-tab corrections) and persist across runs.
                    const hostname = readApplicationHostname(request.applicationUrl);
                    const rule = findMatchingFieldRule(query.question, hostname);
                    if (rule) {
                        return {
                            answer: rule.answer,
                            confidence: 'high',
                            reasoning: `Matched user rule "${rule.question}" (${rule.source}, ${rule.hostname ?? 'global'}).`,
                        };
                    }
                    // Deterministic answers for common ATS questions where we
                    // can reason from the user's profile alone — saves a model
                    // call AND avoids the "LLM produced empty answer for a
                    // free-text textarea" failure mode where a clearly-required
                    // sponsorship/authorization field is left empty and the
                    // form refuses to submit. Only kicks in when we have a
                    // confident inference from profile data.
                    const deterministic = inferDeterministicAnswer(query, profile);
                    if (deterministic) {
                        return deterministic;
                    }
                    return submitClient.resolveUnknownFieldAnswer({
                        aiProvider: request.aiProvider,
                        applicationUrl: request.applicationUrl,
                        jobLeadId: request.jobLeadId,
                        ...query,
                    }, { signal: controller.signal });
                },
                lookupRecentVerificationCode: digits => lookupVerificationCodeCached(digits, controller.signal),
            }, { signal: controller.signal });
            // Post-flight closed-posting check. Skip when the run already
            // completed (the page is past the form anyway) or was cancelled.
            // Catches cases where the agent failed early because the page
            // silently rendered the closed banner after navigate.
            if (result.status !== 'completed' &&
                result.status !== 'cancelled' &&
                result.status !== 'unavailable') {
                const postflightVerdict = await checkClosedPostingFromAssistView();
                if (postflightVerdict.closed) {
                    await reportLeadUnavailable({
                        applicationUrl: result.applicationUrl,
                        jobLeadId: result.jobLeadId,
                        jobListingId: request.jobListingId,
                        verdict: postflightVerdict,
                    });
                    const overridden = {
                        ...result,
                        message: `Greenhouse posting is unavailable (${postflightVerdict.detectedPhrase ??
                            postflightVerdict.reason ??
                            'closed page detected'}).`,
                        status: 'unavailable',
                    };
                    lastSubmitResult = overridden;
                    void writeRunLog(request, overridden).catch(error => {
                        console.warn('Failed to write run log:', error);
                    });
                    void recordDesktopRunResult(request, overridden).catch(error => {
                        console.warn('Desktop submission record failed:', error);
                    });
                    return finishRun(overridden);
                }
            }
            // Post-flight success check: if the runner reported failure but the
            // live assist view is showing a "thank you" / "received" page, the
            // submission actually went through and the in-runner dom_snapshot
            // missed it. Trust the live page and flip the result to completed.
            if (result.status === 'failed' &&
                request.mode === 'submit' &&
                assistView) {
                const successVerdict = await checkSubmissionSuccessFromAssistView();
                if (successVerdict.confirmed) {
                    const overridden = {
                        ...result,
                        message: `Submit confirmed via post-flight check (${successVerdict.detectedPhrase ?? 'thank-you page'}).`,
                        status: 'completed',
                    };
                    lastSubmitResult = overridden;
                    void writeRunLog(request, overridden).catch(error => {
                        console.warn('Failed to write run log:', error);
                    });
                    void recordDesktopRunResult(request, overridden).catch(error => {
                        console.warn('Desktop submission record failed:', error);
                    });
                    return finishRun(overridden);
                }
            }
            lastSubmitResult = result;
            void writeRunLog(request, result).catch(error => {
                console.warn('Failed to write run log:', error);
            });
            void recordDesktopRunResult(request, result).catch(error => {
                console.warn('Desktop submission record failed:', error);
            });
            if (assistView && result.status !== 'failed') {
                void injectUserActionTracker(assistView.webContents);
            }
            return finishRun(result);
        }
        catch (error) {
            if (runJsonlLog && !runJsonlSummaryWritten) {
                runJsonlSummaryWritten = true;
                try {
                    await runJsonlLog.appendSummary({
                        errorTool: 'runLead',
                        errorToolMessage: error instanceof Error ? error.message : String(error),
                        status: 'failed',
                        totalElapsedMs: Date.now() - runStartedAt,
                    });
                }
                catch (summaryError) {
                    console.warn('[run-jsonl-log] error summary write failed:', summaryError);
                }
                finally {
                    await runJsonlLog.close().catch(closeError => {
                        console.warn('[run-jsonl-log] close failed:', closeError);
                    });
                }
            }
            throw error;
        }
        finally {
            if (submitRunKey) {
                activeSubmitRunKeys.delete(submitRunKey);
            }
            if (activeRunController === controller) {
                activeRunController = null;
            }
        }
    },
    swapAssistResumeFile: async (request) => {
        if (!assistView) {
            return { injected: false, reason: 'Assist view is not available.' };
        }
        try {
            const bytes = await submitClient.downloadResumeBytes({
                url: request.pdfUrl,
            });
            const injected = (await assistView.webContents.executeJavaScript(buildResumeFileInjectionScript({
                base64: bytes.base64,
                contentType: bytes.contentType,
                fileName: request.fileName,
            }), true));
            return injected
                ? { injected: true }
                : {
                    injected: false,
                    reason: 'No matching <input type="file"> was found on the assist page.',
                };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.warn('Resume swap failed:', error);
            return { injected: false, reason: message };
        }
    },
    tailorResumeForLead: request => submitClient.tailorResumeForLead({ leadId: request.leadId }),
    runSmokeTest: (request) => runProviderSmokeTest(request),
    cancelSmokeTest: async () => {
        if (smokeTestController && !smokeTestController.signal.aborted) {
            smokeTestController.abort();
            return { cancelled: true };
        }
        return { cancelled: false };
    },
};
registerDesktopSubmitIpc(ipcMain, desktopSubmitRunner);
function emitSmokeProgress(event) {
    if (!desktopWindow || desktopWindow.isDestroyed())
        return;
    desktopWindow.webContents.send(DESKTOP_SUBMIT_IPC_EVENTS.smokeProgress, event);
}
async function runProviderSmokeTest(request) {
    const providerInfo = DESKTOP_RUNTIME_PROVIDERS.find(p => p.id === request.runtimeProviderId);
    if (!providerInfo) {
        throw new Error(`Unknown runtime provider: ${request.runtimeProviderId}`);
    }
    if (smokeTestController) {
        throw new Error('A smoke test is already running.');
    }
    const controller = new AbortController();
    smokeTestController = controller;
    const startedAt = new Date();
    const runs = [];
    const excludeListingIds = [...(request.excludeListingIds ?? [])];
    const excludeCompanies = [...(request.excludeCompanies ?? [])];
    try {
        for (let index = 0; index < request.count; index += 1) {
            if (controller.signal.aborted)
                break;
            emitSmokeProgress({
                index,
                phase: 'picking',
                runtimeProviderId: providerInfo.id,
                total: request.count,
            });
            let lead;
            try {
                lead = await submitClient.pickRandomGreenhouseLead({
                    excludeCompanies,
                    excludeListingIds,
                    provider: 'any',
                    runtimeProviders: [providerInfo.id],
                });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Random pick failed.';
                runs.push({
                    applicationUrl: '',
                    company: null,
                    durationMs: 0,
                    index,
                    message,
                    status: 'skipped',
                    title: null,
                    toolCallCount: null,
                });
                emitSmokeProgress({
                    index,
                    message,
                    phase: 'running',
                    runtimeProviderId: providerInfo.id,
                    total: request.count,
                });
                continue;
            }
            if (lead.jobListingId)
                excludeListingIds.push(lead.jobListingId);
            if (lead.company)
                excludeCompanies.push(lead.company);
            emitSmokeProgress({
                applicationUrl: lead.applicationUrl,
                index,
                phase: 'running',
                runtimeProviderId: providerInfo.id,
                total: request.count,
            });
            if (controller.signal.aborted)
                break;
            const startMs = Date.now();
            try {
                // Re-use the existing runLead handler so the BrowserView is loaded,
                // the agent runs, and the JSONL log is captured exactly as a normal
                // training run would.
                const result = await runLeadForSmoke({
                    applicationUrl: lead.applicationUrl,
                    jobLeadId: lead.jobLeadId ?? undefined,
                    jobListingId: lead.jobListingId ?? undefined,
                    mode: 'training',
                });
                const firstFail = result.toolCalls.find(c => !c.ok);
                runs.push({
                    applicationUrl: lead.applicationUrl,
                    company: lead.company,
                    durationMs: Date.now() - startMs,
                    errorTool: firstFail?.tool,
                    errorToolMessage: firstFail?.errorMessage,
                    index,
                    message: result.message,
                    status: result.status,
                    title: lead.title,
                    toolCallCount: result.toolCalls.length,
                });
            }
            catch (error) {
                runs.push({
                    applicationUrl: lead.applicationUrl,
                    company: lead.company,
                    durationMs: Date.now() - startMs,
                    index,
                    message: error instanceof Error ? error.message : String(error),
                    status: 'failed',
                    title: lead.title,
                    toolCallCount: null,
                });
            }
        }
    }
    finally {
        smokeTestController = null;
    }
    const endedAt = new Date();
    const reportPath = await writeSmokeTestReport({
        providerInfo,
        request,
        runs,
        startedAt,
        endedAt,
    });
    const completed = runs.filter(r => r.status === 'completed').length;
    const failed = runs.filter(r => r.status === 'failed' || r.status === 'unavailable').length;
    const skipped = runs.filter(r => r.status === 'skipped').length;
    emitSmokeProgress({
        index: runs.length,
        message: controller.signal.aborted ? 'Cancelled' : 'Complete',
        phase: controller.signal.aborted ? 'cancelled' : 'complete',
        runtimeProviderId: providerInfo.id,
        total: request.count,
    });
    return {
        completed,
        endedAt: endedAt.toISOString(),
        failed,
        requested: request.count,
        reportPath,
        runs,
        runtimeProviderId: providerInfo.id,
        runtimeProviderLabel: providerInfo.label,
        skipped,
        startedAt: startedAt.toISOString(),
        totalDurationMs: endedAt.getTime() - startedAt.getTime(),
    };
}
// Wrapper that calls the same `runLead` flow used by the regular IPC handler
// so the smoke-test loop benefits from the same JSONL log, post-flight checks,
// and history recording as a normal training run.
async function runLeadForSmoke(request) {
    return desktopSubmitRunner.runLead(request);
}
async function writeSmokeTestReport(input) {
    const baseDir = path.join(app.getPath('documents'), 'Gimme Job', 'smoke-tests');
    await fs.mkdir(baseDir, { recursive: true });
    const stamp = input.startedAt
        .toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .replace(/Z$/, '');
    const fileName = `${sanitizeFilenamePart(input.providerInfo.id)}-${stamp}.json`;
    const filePath = path.join(baseDir, fileName);
    const payload = {
        endedAt: input.endedAt.toISOString(),
        request: input.request,
        runs: input.runs,
        runtimeProvider: {
            id: input.providerInfo.id,
            label: input.providerInfo.label,
            readiness: input.providerInfo.readiness,
            runner: input.providerInfo.runner,
        },
        startedAt: input.startedAt.toISOString(),
        summary: {
            completed: input.runs.filter(r => r.status === 'completed').length,
            failed: input.runs.filter(r => r.status === 'failed' || r.status === 'unavailable').length,
            requested: input.request.count,
            skipped: input.runs.filter(r => r.status === 'skipped').length,
            totalDurationMs: input.endedAt.getTime() - input.startedAt.getTime(),
        },
    };
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
    return filePath;
}
function getSmokeReportsDirectory() {
    return path.join(app.getPath('documents'), 'Gimme Job', 'smoke-tests');
}
function getRunLogsDirectory() {
    return path.join(app.getPath('documents'), 'Gimme Job', 'run-logs');
}
async function pickAvailableRandomLead(query) {
    const excludeListingIds = [...(query.excludeListingIds ?? [])];
    const excludeCompanies = [...(query.excludeCompanies ?? [])];
    let lastUnavailable = null;
    for (let attempt = 0; attempt < RANDOM_PICK_AVAILABILITY_ATTEMPTS; attempt += 1) {
        const candidate = await submitClient.pickRandomGreenhouseLead({
            ...query,
            excludeCompanies,
            excludeListingIds,
        });
        if (!assistView) {
            return candidate;
        }
        const verdict = await preflightClosedPostingCheck({
            applicationUrl: candidate.applicationUrl,
            skipNavigate: false,
        });
        if (!verdict.closed) {
            return candidate;
        }
        lastUnavailable = candidate;
        console.warn('[random-pick] random_pick_skipped_closed', {
            applicationUrl: candidate.applicationUrl,
            detectedPhrase: verdict.detectedPhrase,
            jobLeadId: candidate.jobLeadId,
            jobListingId: candidate.jobListingId,
            reason: verdict.reason,
        });
        await reportLeadUnavailable({
            applicationUrl: candidate.applicationUrl,
            jobLeadId: candidate.jobLeadId,
            jobListingId: candidate.jobListingId,
            verdict,
        });
        excludeListingIds.push(candidate.jobListingId);
    }
    throw new Error(lastUnavailable
        ? `Random job picks were unavailable after ${RANDOM_PICK_AVAILABILITY_ATTEMPTS} attempts. Last closed posting: ${lastUnavailable.title}.`
        : 'No available random job could be loaded.');
}
// Greenhouse URL detection lives in submit/greenhouse-url.ts so it can
// be unit-tested without pulling in main.ts's Electron-app side effects.
// See that file for the recognized URL families.
// (re-exported via the submit/ module for runner consumers.)
// Forward user-action reports from the assist webContents straight into
// the server-side formFieldFeedback table. This is the closing-the-loop
// half of training: the LLM resolver already reads formFieldFeedback via
// loadFieldFeedback, but until now nothing populated it from desktop
// runs. Now every correction the user makes during a training pass shows
// up as a hostname-scoped hint the model sees on the next run.
async function persistUserActionFeedback(report) {
    if (!report || !report.url)
        return;
    let hostname = null;
    try {
        hostname = new URL(report.url).hostname.toLowerCase();
    }
    catch {
        return;
    }
    if (!hostname)
        return;
    const corrected = report.userChangedFields
        .filter(field => field.label.trim().length >= 4)
        .map(field => ({
        label: field.label,
        value: field.userValue,
        type: field.type,
        aiValue: field.aiValue,
    }));
    const filled = report.userFilledFields
        .filter(field => field.label.trim().length >= 4)
        .map(field => ({
        label: field.label,
        value: field.value,
        type: field.type,
    }));
    if (corrected.length === 0 && filled.length === 0)
        return;
    // Write to the SERVER side so the LLM resolver sees these as
    // approved-value hints for future runs (across all of this user's
    // desktop installs).
    await submitClient.recordTrainingFeedback({
        applicationUrl: report.url,
        hostname,
        capturedAt: report.capturedAt,
        trigger: report.trigger,
        correctedFields: corrected,
        filledFields: filled,
    });
    // Also persist as LOCAL field rules so the next run on THIS desktop
    // short-circuits the LLM entirely (matched answers return instantly,
    // no token spend). Only persist for fields with a meaningful question
    // label and a user-typed value — short labels like "Yes"/"No" are
    // option text, not the question.
    for (const field of [...corrected, ...filled]) {
        const question = field.label.trim();
        const answer = field.value.trim();
        if (question.length < 6 || answer.length === 0)
            continue;
        try {
            addFieldRule({
                question,
                answer,
                hostname,
                source: 'state-tab',
            });
        }
        catch (error) {
            console.warn('[training-feedback] local rule write failed:', error);
        }
    }
}
// Resolve a small number of well-known questions deterministically from
// the user's profile. Returning a non-null result short-circuits the LLM
// call entirely, which is both faster and more reliable than asking the
// model to reason over a textarea with no enumerated options. Most common
// failure mode this guards against: a required "Will you require visa
// sponsorship?" textarea getting left empty because the LLM produced an
// empty/low-confidence answer, blocking the entire submission.
function inferDeterministicAnswer(query, profile) {
    const question = query.question.trim().toLowerCase();
    if (!question)
        return null;
    const isSelect = query.fieldType === 'select' ||
        query.fieldType === 'radio' ||
        query.fieldType === 'checkbox';
    // Sponsorship questions ("Will you now or in the future require
    // sponsorship for employment visa status?"). Default to "No" when we
    // know the user is authorized to work in the target country (US is the
    // default target for US-based postings). The user can override per-app
    // by setting profile.requiresSponsorship.
    if (/\bsponsor(?:ship|ed)\b/.test(question) ||
        /\bvisa\s+(?:status|sponsorship)\b/.test(question) ||
        /\bemployment\s+visa\b/.test(question) ||
        /\brequire\s+(?:visa|sponsorship)\b/.test(question)) {
        const explicit = typeof profile.sponsorshipRequired === 'string'
            ? profile.sponsorshipRequired.trim().toLowerCase()
            : null;
        if (explicit === 'yes' || explicit === 'true') {
            return {
                answer: pickYesNoAnswer('yes', query.options, isSelect),
                confidence: 'high',
                reasoning: 'profile.sponsorshipRequired === yes',
            };
        }
        if (explicit === 'no' ||
            explicit === 'false' ||
            // Treat "authorized to work in US + no explicit sponsorship flag"
            // as a strong signal that no sponsorship is needed. The vast
            // majority of US-citizen / permanent-resident profiles fall here.
            (!explicit &&
                isUsBasedAuthorizedProfile(profile) &&
                questionTargetsUs(question))) {
            return {
                answer: pickYesNoAnswer('no', query.options, isSelect),
                confidence: 'high',
                reasoning: 'US-authorized profile, sponsorship question targeting US — answering No.',
            };
        }
    }
    // Post-employment restrictions / non-compete / non-solicitation
    // questions. We're job-seekers — assume the candidate is unencumbered
    // by enforceable restrictions from a prior employer. Answering "No"
    // here is the default expectation for nearly every applicant; if the
    // user is actually under restrictions, they can override per-field via
    // a saved rule.
    if (/\bnon[-\s]?compete\b/.test(question) ||
        /\bnon[-\s]?solicitation\b/.test(question) ||
        /\bpost[-\s]?employment\s+(?:restriction|agreement|covenant|obligation)\b/.test(question) ||
        /\brestrictive\s+covenant\b/.test(question) ||
        /\bbound\s+by.*\b(?:agreement|contract|covenant|nda|restriction)\b/.test(question) ||
        (/\bagreed\s+to\b/.test(question) &&
            /\b(?:restriction|non[-\s]?compete|non[-\s]?solicitation)\b/.test(question))) {
        return {
            answer: pickYesNoAnswer('no', query.options, isSelect),
            confidence: 'high',
            reasoning: 'Post-employment restriction question — defaulting to No (job-seeker assumption).',
        };
    }
    // Work authorization ("Are you legally authorized to work in the United
    // States?"). When profile.workAuthorization indicates citizen / GC /
    // authorized-without-sponsorship for the matching country, answer yes.
    if (/\bauthor(?:ized|ization)\b.*\bwork\b/.test(question) ||
        /\blegally\s+able\b.*\bwork\b/.test(question) ||
        /\beligible\s+to\s+work\b/.test(question)) {
        if (isUsBasedAuthorizedProfile(profile) && questionTargetsUs(question)) {
            return {
                answer: pickYesNoAnswer('yes', query.options, isSelect),
                confidence: 'high',
                reasoning: 'US-authorized profile, work-auth question targeting US — answering Yes.',
            };
        }
    }
    return null;
}
function isUsBasedAuthorizedProfile(profile) {
    const country = (profile.country ?? '').trim().toLowerCase();
    const authorization = (profile.workAuthorization ?? '').trim().toLowerCase();
    const usCountry = country === 'us' ||
        country === 'usa' ||
        country === 'united states' ||
        country === 'united states of america' ||
        country === 'america';
    if (!usCountry)
        return false;
    // Empty workAuthorization on a US-country profile is treated as
    // citizen/permanent-resident — the most common case for our user base.
    if (!authorization)
        return true;
    return (authorization.includes('citizen') ||
        authorization.includes('permanent') ||
        authorization.includes('green card') ||
        authorization.includes('authorized') ||
        authorization === 'yes');
}
function questionTargetsUs(question) {
    if (/\bunited states\b|\busa\b|\bu\.s\.?a?\b|\bin\s+the\s+us\b|\bthe\s+u\.?s\.?\b/.test(question)) {
        return true;
    }
    // No explicit country mentioned → assume the application is for US
    // (the dominant case for the boards we support). If the question
    // mentions a different country, our regex above wouldn't match and
    // a downstream check filters out the deterministic answer.
    return !/\bcanada|uk|united kingdom|germany|france|spain|italy|netherlands|australia|new zealand|japan|china|india|mexico|brazil|singapore|hong kong|south korea\b/i.test(question);
}
function pickYesNoAnswer(desired, options, isSelect) {
    if (!isSelect || !options || options.length === 0) {
        // Free-text / textarea — type the literal answer. The form will
        // accept "No" / "Yes" for nearly every yes/no prompt we hit.
        return desired === 'yes' ? 'Yes' : 'No';
    }
    // For selects/radios, prefer the option whose text matches the
    // desired answer most closely. Handles "Yes" / "Yeah, I am" /
    // "I do not require sponsorship" / etc.
    const wants = desired === 'yes' ? /^y/i : /^n/i;
    const exact = options.find(option => wants.test(option.trim()));
    if (exact)
        return exact;
    // Fallback: longer-form options like "I do not require sponsorship" —
    // pick by keyword.
    if (desired === 'no') {
        const negative = options.find(option => /\b(?:no|not|never|don['’]t|do not|none)\b/i.test(option));
        if (negative)
            return negative;
    }
    else {
        const positive = options.find(option => /\b(?:yes|yeah|sure|yep|i\s+am|i\s+do)\b/i.test(option));
        if (positive)
            return positive;
    }
    return desired === 'yes' ? 'Yes' : 'No';
}
// Dispatch each application URL to the most-specific runner we have. Each
// provider runner adds stable selectors for that ATS's identity fields
// and submit CTA before falling through to the shared LLM-resolver path.
function pickRunnerForProvider(provider) {
    switch (provider.runner) {
        case 'greenhouse':
            return runGreenhouseSubmitLead;
        case 'ashby':
            return runAshbySubmitLead;
        case 'lever':
            return runLeverSubmitLead;
        case 'workable':
            return runWorkableSubmitLead;
        case 'smartrecruiters':
            return runSmartRecruitersSubmitLead;
        case 'recruitee':
            return runRecruiteeSubmitLead;
        case 'teamtailor':
            return runTeamtailorSubmitLead;
        case 'jobvite':
            return runJobviteSubmitLead;
        case 'bamboohr':
            return runBambooHrSubmitLead;
        case 'personio':
            return runPersonioSubmitLead;
        case 'breezy':
            return runBreezySubmitLead;
        case 'workday':
            return runWorkdaySubmitLead;
        case 'icims':
            return runIcimsSubmitLead;
        case 'taleo':
            return runTaleoSubmitLead;
        default:
            return runGenericSubmitLead;
    }
}
async function readAssistSelectOptions(registry, selector, options) {
    const query = options?.query?.trim();
    // Greenhouse pages keep a phone-country picker mounted with ~250 [role="option"]
    // children at all times. When our target combobox doesn't expose
    // aria-controls/aria-owns, the scope walker can land on a high-up ancestor
    // that contains BOTH our dropdown's options AND the country picker. Snapshot
    // the option set BEFORE we open the field so we can diff it out afterwards.
    const baselineSnapshot = await registry.call({
        input: {},
        tool: 'dom_snapshot',
    });
    const baselineKeys = collectOptionKeysFromSnapshot(baselineSnapshot);
    // For typeahead inputs we type the query into the field — that is what
    // mounts the listbox suggestions. For plain custom selects we click the
    // control to expand it.
    if (query) {
        const filled = await registry.call({
            input: { selector, value: query },
            tool: 'fill',
        });
        if (!filled.ok)
            return [];
        // Typeaheads usually fetch suggestions with a short debounce, so wait
        // a bit longer than the click-to-open path before snapshotting.
        await new Promise(resolve => setTimeout(resolve, 380));
    }
    else {
        // Open the dropdown so its options mount into the DOM. Greenhouse and
        // react-select widgets only render [role="option"] children while the
        // listbox is open, so a static DOM snapshot returns nothing useful
        // before this click. Click + ArrowDown is the most reliable way: the
        // click focuses the control, ArrowDown forces react-select / Headless
        // UI / shadcn comboboxes that ignored the click to open.
        const open = await registry.call({
            input: { selector },
            tool: 'click',
        });
        if (!open.ok)
            return [];
        await new Promise(resolve => setTimeout(resolve, 120));
        await registry.call({
            input: { key: 'ArrowDown' },
            tool: 'press_key',
        });
        await new Promise(resolve => setTimeout(resolve, 220));
    }
    const snapshot = await registry.call({
        input: {},
        tool: 'dom_snapshot',
    });
    // Always close the dropdown afterwards regardless of snapshot success so
    // the user isn't left with an open listbox stealing focus.
    await registry.call({
        input: { key: 'Escape' },
        tool: 'press_key',
    });
    if (!snapshot.ok)
        return [];
    const data = snapshot.data;
    const html = typeof data?.html === 'string' ? data.html : '';
    if (!html)
        return [];
    const { parse } = await import('node-html-parser');
    const root = parse(html);
    const target = root.querySelector(selector);
    const scopes = [];
    const seenScope = new WeakSet();
    const pushScope = (node) => {
        if (!node)
            return;
        if (seenScope.has(node))
            return;
        seenScope.add(node);
        scopes.push(node);
    };
    const lookupById = (id) => root.querySelector('[id="' + id.replace(/"/g, '\\"') + '"]');
    const pushIdsFrom = (attr) => {
        if (!attr)
            return;
        for (const id of attr.split(/\s+/).filter(Boolean)) {
            pushScope(lookupById(id));
        }
    };
    if (target) {
        pushIdsFrom(target.getAttribute('aria-controls'));
        pushIdsFrom(target.getAttribute('aria-owns'));
        // Walk up to find a combobox ancestor and use ITS aria-controls/owns.
        let walker = target;
        for (let depth = 0; depth < 8 && walker; depth += 1) {
            const role = walker.getAttribute('role');
            if (role === 'combobox' || role === 'listbox') {
                pushIdsFrom(walker.getAttribute('aria-controls'));
                pushIdsFrom(walker.getAttribute('aria-owns'));
                pushScope(walker);
                break;
            }
            walker = walker.parentNode;
        }
        // Last resort: walk up further until we find a node containing
        // [role="option"] descendants (the smallest such ancestor wins).
        if (scopes.length === 0) {
            walker = target;
            for (let depth = 0; depth < 12 && walker; depth += 1) {
                if (walker.querySelectorAll('[role="option"]').length > 0) {
                    pushScope(walker);
                    break;
                }
                walker = walker.parentNode;
            }
        }
    }
    const seen = new Map();
    const optionSelector = '[role="option"], [class*="select__option"], [class*="-option-"], li[id*="option"], [data-option-value]';
    const collect = (scope, options) => {
        if (!scope)
            return;
        const candidates = scope.querySelectorAll(optionSelector);
        for (const candidate of candidates) {
            const label = (candidate.text ?? '').trim();
            if (!label || label.length > 200)
                continue;
            const value = (candidate.getAttribute('data-value') ??
                candidate.getAttribute('value') ??
                candidate.getAttribute('id') ??
                label).trim();
            const key = `${label}::${value}`;
            // Skip options that were already in the DOM before we opened this field
            // (e.g., Greenhouse's always-mounted phone-country picker). Anything
            // that just newly appeared belongs to the field we just clicked.
            if (options.filterBaseline && baselineKeys.has(key))
                continue;
            if (seen.has(key))
                continue;
            seen.set(key, { label, value });
            if (seen.size >= 60)
                break;
        }
    };
    const searchRoots = scopes.length > 0 ? scopes : [root];
    for (const scope of searchRoots) {
        collect(scope, { filterBaseline: scopes.length === 0 });
        if (seen.size >= 60)
            break;
    }
    // react-select / Greenhouse Boards portal the option menu outside the
    // click-target's subtree (often as a sibling of .select__control or
    // appended to document.body). The scoped walk above misses those, so
    // look at any visible listbox/menu when we came up empty.
    if (seen.size === 0) {
        const portalRoots = root.querySelectorAll('[role="listbox"], [class*="select__menu"], [class*="-menu-"], [class*="MenuList"]');
        for (const portalRoot of portalRoots) {
            collect(portalRoot, { filterBaseline: true });
            if (seen.size > 0)
                break;
        }
    }
    return Array.from(seen.values());
}
function collectOptionKeysFromSnapshot(snapshot) {
    const keys = new Set();
    if (!snapshot.ok)
        return keys;
    const data = snapshot.data;
    const html = typeof data?.html === 'string' ? data.html : '';
    if (!html)
        return keys;
    const root = parseHtml(html);
    const candidates = root.querySelectorAll('[role="option"], [class*="select__option"], [class*="-option-"], li[id*="option"], [data-option-value]');
    for (const candidate of candidates) {
        const label = (candidate.text ?? '').trim();
        if (!label || label.length > 200)
            continue;
        const value = (candidate.getAttribute('data-value') ??
            candidate.getAttribute('value') ??
            candidate.getAttribute('id') ??
            label).trim();
        keys.add(`${label}::${value}`);
    }
    return keys;
}
function buildResumeFileInjectionScript(input) {
    const fileNameJson = JSON.stringify(input.fileName);
    const contentTypeJson = JSON.stringify(input.contentType);
    const base64Json = JSON.stringify(input.base64);
    return `(() => {
    const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
    const resumeInput = inputs.find(input => {
      const name = (input.name || '').toLowerCase();
      const id = (input.id || '').toLowerCase();
      const aria = (input.getAttribute('aria-label') || '').toLowerCase();
      return /resume|cv/.test(name) || /resume|cv/.test(id) || /resume|cv/.test(aria);
    }) || inputs[0];
    if (!resumeInput) {
      return false;
    }
    const binary = atob(${base64Json});
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const file = new File([bytes], ${fileNameJson}, { type: ${contentTypeJson} });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    resumeInput.files = transfer.files;
    resumeInput.dispatchEvent(new Event('change', { bubbles: true }));
    resumeInput.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`;
}
// Live-page success check used as a safety net when the runner reported
// failure. Reads the actual webContents (title + body text) instead of
// going through the agent's tool registry — that registry may have lost
// track of the page across the navigation that submission triggered.
const SUCCESS_PHRASE_PATTERNS = [
    /thank(?:s|\s*you|-you)/i,
    /your\s+application\s+(?:has\s+been\s+|is\s+)?(?:received|submitted|on its way)/i,
    /application\s+(?:received|submitted|recorded|complete)/i,
    /successfully\s+(?:submitted|applied|sent)/i,
    /we['’]?ve\s+received/i,
    /we\s+have\s+received\s+your/i,
];
async function checkSubmissionSuccessFromAssistView() {
    if (!assistView) {
        return { confirmed: false, detectedPhrase: null };
    }
    // Give the page a beat to render the thank-you state in case the
    // failure return raced ahead of the navigation completing.
    await new Promise(resolve => setTimeout(resolve, 1200));
    try {
        const liveTitle = assistView.webContents.getTitle() ?? '';
        const liveBody = await assistView.webContents
            .executeJavaScript('(function () { try { return document.body && document.body.innerText ? document.body.innerText.slice(0, 4000) : ""; } catch (_) { return ""; } })();', true)
            .catch(() => '');
        const haystack = `${liveTitle}\n${typeof liveBody === 'string' ? liveBody : ''}`;
        for (const pattern of SUCCESS_PHRASE_PATTERNS) {
            const match = haystack.match(pattern);
            if (match) {
                return { confirmed: true, detectedPhrase: match[0] ?? null };
            }
        }
    }
    catch (error) {
        console.warn('Submission-success post-flight read failed:', error);
    }
    return { confirmed: false, detectedPhrase: null };
}
async function checkClosedPostingFromAssistView() {
    if (!assistView) {
        return { closed: false, detectedPhrase: null, reason: null };
    }
    try {
        const html = (await assistView.webContents.executeJavaScript('document.documentElement.outerHTML', true));
        const title = (await assistView.webContents.executeJavaScript('document.title', true));
        return detectClosedPosting({ html: html ?? '', title: title ?? '' });
    }
    catch (error) {
        console.warn('Closed-posting check failed:', error);
        return { closed: false, detectedPhrase: null, reason: null };
    }
}
async function preflightClosedPostingCheck(input) {
    if (!assistView) {
        return { closed: false, detectedPhrase: null, reason: null };
    }
    if (!input.skipNavigate) {
        try {
            await assistView.webContents.loadURL(input.applicationUrl);
        }
        catch (error) {
            console.warn('Preflight navigate failed:', error);
            // If the load itself failed, the page may be a 404 — fall through to
            // the DOM check anyway.
        }
        // Settle: give Greenhouse a moment to render its closed-page copy.
        await new Promise(resolve => setTimeout(resolve, 1500));
    }
    return checkClosedPostingFromAssistView();
}
async function reportLeadUnavailable(input) {
    if (!input.jobLeadId && !input.jobListingId)
        return;
    try {
        await submitClient.markLeadUnavailable({
            applicationUrl: input.applicationUrl,
            detectedPhrase: input.verdict.detectedPhrase ?? undefined,
            jobLeadId: input.jobLeadId,
            jobListingId: input.jobListingId,
            reason: input.verdict.reason ?? 'unknown',
        });
    }
    catch (error) {
        console.warn('Mark-lead-unavailable failed:', error);
    }
}
async function detectAndRecordConfirmation(input) {
    if (!assistView)
        return;
    const webContents = assistView.webContents;
    await new Promise(resolve => setTimeout(resolve, 1500));
    let pageHtml;
    try {
        pageHtml = (await webContents.executeJavaScript('document.documentElement.outerHTML', true));
    }
    catch (error) {
        console.warn('Confirmation HTML capture failed:', error);
        return;
    }
    if (!pageHtml || pageHtml.length === 0)
        return;
    const providerConfirmation = detectProviderConfirmation(input.applicationUrl, pageHtml);
    const providerId = getRuntimeProviderForUrl(input.applicationUrl).id;
    if ((providerId === 'lever' ||
        providerId === 'ashby' ||
        providerId === 'smartrecruiters' ||
        providerId === 'workable') &&
        !providerConfirmation.confirmed) {
        return;
    }
    const hostname = readHostnameFromUrl(input.applicationUrl);
    try {
        await submitClient.recordSubmissionConfirmation({
            hostname: hostname ?? undefined,
            pageHtml,
            submissionId: input.submissionId,
        });
    }
    catch (error) {
        console.warn('Confirmation record failed:', error);
    }
}
async function recordDesktopRunResult(request, result) {
    if (result.status === 'cancelled')
        return;
    const failureSnapshot = await captureFailureSnapshot(result.status);
    const recorded = await submitClient.recordSubmittedApplication({
        applicationUrl: result.applicationUrl,
        failureSnapshot,
        jobLeadId: result.jobLeadId,
        message: result.message,
        mode: result.mode,
        status: result.status,
        toolCallCount: result.toolCalls.length,
        validationFailures: result.validationFailures,
    });
    if (recorded.outcome === 'applied' && recorded.submissionId) {
        void detectAndRecordConfirmation({
            applicationUrl: request.applicationUrl,
            submissionId: recorded.submissionId,
        });
    }
}
async function captureFailureSnapshot(status) {
    if (status === 'completed' || status === 'cancelled' || !assistView) {
        return undefined;
    }
    const webContents = assistView.webContents;
    try {
        const page = (await webContents.executeJavaScript(`(() => {
        const doc = document.documentElement;
        const body = document.body;
        return {
          html: doc ? doc.outerHTML : '',
          width: Math.max(
            window.innerWidth || 0,
            doc?.clientWidth || 0,
            doc?.scrollWidth || 0,
            body?.clientWidth || 0,
            body?.scrollWidth || 0
          ),
          height: Math.max(
            window.innerHeight || 0,
            doc?.clientHeight || 0,
            doc?.scrollHeight || 0,
            body?.clientHeight || 0,
            body?.scrollHeight || 0
          )
        };
      })();`, true));
        const width = clampSnapshotDimension(page.width, 1_920);
        const height = clampSnapshotDimension(page.height, 12_000);
        const image = await webContents.capturePage({ height, width, x: 0, y: 0 });
        const domHtml = typeof page.html === 'string' && page.html.trim()
            ? page.html
            : '<html></html>';
        return {
            capturedAt: new Date().toISOString(),
            domHtml,
            screenshotPngBase64: image.toPNG().toString('base64'),
        };
    }
    catch (error) {
        console.warn('[failure-snapshot] capture failed:', error);
        return undefined;
    }
}
function clampSnapshotDimension(value, fallback) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        return fallback;
    }
    return Math.min(Math.ceil(value), fallback);
}
function readHostnameFromUrl(url) {
    try {
        return new URL(url).hostname.toLowerCase();
    }
    catch {
        return null;
    }
}
async function archiveFormSnapshot(snapshot) {
    const baseDir = path.join(app.getPath('documents'), 'Gimme Job');
    const hostDir = path.join(baseDir, sanitizeFilenamePart(snapshot.hostname));
    await fs.mkdir(hostDir, { recursive: true });
    const capturedAt = new Date();
    const stamp = capturedAt
        .toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .replace(/-Z$|Z$/, '');
    const leadSegment = snapshot.jobLeadId
        ? `-${sanitizeFilenamePart(snapshot.jobLeadId)}`
        : '';
    const fileName = `${stamp}${leadSegment}.html`;
    const filePath = path.join(hostDir, fileName);
    await fs.writeFile(filePath, snapshot.html, 'utf8');
    return {
        byteSize: Buffer.byteLength(snapshot.html, 'utf8'),
        capturedAt,
        filePath,
    };
}
function sanitizeFilenamePart(value) {
    return value.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
}
// Persisted shell state — assist URL and panel sizes survive across app
// restarts via desktop-settings.json so the user lands back where they were.
const SHELL_ASSIST_URL_KEY = 'shell.assistUrl';
const SHELL_PANEL_SIZES_KEY = 'shell.panelSizes';
function readPersistedAssistUrl() {
    const value = getSetting(SHELL_ASSIST_URL_KEY);
    if (typeof value !== 'string')
        return undefined;
    const trimmed = value.trim();
    if (!trimmed)
        return undefined;
    try {
        const parsed = new URL(trimmed);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:'
            ? trimmed
            : undefined;
    }
    catch {
        return undefined;
    }
}
function readPersistedPanelSizes() {
    const value = getSetting(SHELL_PANEL_SIZES_KEY);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }
    const record = value;
    const assist = readPanelSize(record.assist);
    const main = readPanelSize(record.main);
    const sidebar = readPanelSize(record.sidebar);
    if (assist === undefined || main === undefined || sidebar === undefined) {
        return undefined;
    }
    return { assist, main, sidebar };
}
function readPanelSize(value) {
    return typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 100
        ? value
        : undefined;
}
function readApplicationHostname(url) {
    try {
        return new URL(url).hostname || null;
    }
    catch {
        return null;
    }
}
const PAGE_CONSOLE_BUFFER_LIMIT = 200;
const pageConsoleBuffer = [];
function capturePageConsoleEvent(event) {
    pageConsoleBuffer.push({ ...event, capturedAt: new Date().toISOString() });
    if (pageConsoleBuffer.length > PAGE_CONSOLE_BUFFER_LIMIT) {
        pageConsoleBuffer.splice(0, pageConsoleBuffer.length - PAGE_CONSOLE_BUFFER_LIMIT);
    }
}
function drainPageConsoleBuffer() {
    const snapshot = pageConsoleBuffer.slice();
    pageConsoleBuffer.length = 0;
    return snapshot;
}
function getFirstFailedToolName(result) {
    return result.toolCalls.find(call => !call.ok)?.tool;
}
function getFirstFailedToolMessage(result) {
    return result.toolCalls.find(call => !call.ok)?.errorMessage;
}
async function createDesktopRunJsonlLog(input) {
    try {
        return await openRunLog(createRunId(), {
            applicationUrl: input.applicationUrl,
            baseDir: path.join(app.getPath('documents'), 'Gimme Job', 'run-logs'),
            mode: input.mode,
            runtimeProviderId: input.provider.id,
            runtimeReadiness: input.provider.readiness,
        });
    }
    catch (error) {
        console.warn('[run-jsonl-log] create failed:', error);
        return null;
    }
}
// Write a per-run JSON log to ~/Documents/Gimme Job/run-logs/. Captures the
// request, the result (status + message + tool-call trace), and a hostname
// stub for filename grouping. Lets the user reconstruct exactly why a run
// failed without having to re-run it under the debugger.
async function writeRunLog(request, result) {
    try {
        const baseDir = path.join(app.getPath('documents'), 'Gimme Job', 'run-logs');
        await fs.mkdir(baseDir, { recursive: true });
        const stamp = new Date()
            .toISOString()
            .replace(/[:.]/g, '-')
            .replace('T', '_')
            .replace(/-Z$|Z$/, '');
        let host = 'unknown-host';
        try {
            host = sanitizeFilenamePart(new URL(request.applicationUrl).hostname);
        }
        catch {
            // applicationUrl wasn't a valid URL; keep default
        }
        const leadSegment = request.jobLeadId
            ? `-${sanitizeFilenamePart(request.jobLeadId)}`
            : '';
        const fileName = `${stamp}-${result.status}-${host}${leadSegment}.json`;
        const filePath = path.join(baseDir, fileName);
        const pageConsoleErrors = drainPageConsoleBuffer();
        const payload = {
            applicationUrl: request.applicationUrl,
            jobLeadId: request.jobLeadId,
            mode: request.mode,
            status: result.status,
            message: result.message,
            capturedAt: new Date().toISOString(),
            toolCalls: result.toolCalls,
            pageConsoleErrors,
        };
        await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
        if (result.status === 'failed') {
            console.warn(`[run-log] failed run logged → ${filePath}`);
        }
        // Also upload to the server so the admin desktop-submissions page can
        // show the full tool-call trace alongside the failure reason. Done
        // best-effort — local file persistence is the source of truth.
        void submitClient
            .uploadRunLog({
            applicationUrl: request.applicationUrl,
            jobLeadId: request.jobLeadId,
            mode: request.mode === 'training' ? 'training' : 'submit',
            status: result.status,
            message: result.message,
            capturedAt: payload.capturedAt,
            toolCalls: result.toolCalls,
            pageConsoleErrors,
        })
            .catch(error => {
            console.warn('[run-log] upload failed:', error);
        });
    }
    catch (error) {
        console.warn('writeRunLog failure:', error);
    }
}
app
    .whenReady()
    .then(createWindow)
    .catch(error => {
    console.error('Failed to start desktop shell:', error);
    app.quit();
});
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        void createWindow();
    }
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
async function createWindow() {
    const mainWindow = new BrowserWindow({
        height: 900,
        minHeight: 720,
        minWidth: 1120,
        title: 'Gimme Job Desktop',
        // Frameless except for macOS traffic-light buttons — the app
        // header (logo + nav + right-side controls) is rendered by the
        // React shell and doubles as the title bar (drag region is set
        // via -webkit-app-region: drag in renderer/styles.css).
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 18, y: 18 },
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: preloadEntry,
            sandbox: true,
        },
        width: 1440,
    });
    const appView = new BrowserView({
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });
    const atsView = new BrowserView({
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });
    assistView = atsView;
    appBrowserView = appView;
    desktopWindow = mainWindow;
    const ensureEyeSaver = () => {
        if (!shellState.isEyeSaverMode)
            return;
        void setAssistEyeSaverMode(atsView.webContents, true);
    };
    atsView.webContents.on('dom-ready', ensureEyeSaver);
    atsView.webContents.on('did-finish-load', ensureEyeSaver);
    atsView.webContents.on('did-navigate', ensureEyeSaver);
    atsView.webContents.on('did-navigate-in-page', ensureEyeSaver);
    atsView.webContents.on('did-stop-loading', ensureEyeSaver);
    const sendNavState = () => {
        if (mainWindow.isDestroyed())
            return;
        mainWindow.webContents.send('desktop:assist-nav-state', {
            canGoBack: atsView.webContents.canGoBack(),
            canGoForward: atsView.webContents.canGoForward(),
        });
    };
    atsView.webContents.on('did-navigate', sendNavState);
    atsView.webContents.on('did-navigate-in-page', sendNavState);
    atsView.webContents.on('did-finish-load', sendNavState);
    // Emit a "page changed" event the renderer's State tab listens for so
    // it can re-scan field state without the user having to hit Refresh.
    // Rate-limited via debounce because some sites fire 'did-navigate-in-page'
    // many times during route transitions.
    let pageChangedTimer = null;
    const emitPageChanged = () => {
        if (pageChangedTimer)
            clearTimeout(pageChangedTimer);
        pageChangedTimer = setTimeout(() => {
            if (!mainWindow.isDestroyed()) {
                mainWindow.webContents.send('desktop:assist-page-changed');
            }
        }, 600);
    };
    atsView.webContents.on('did-navigate', emitPageChanged);
    atsView.webContents.on('did-navigate-in-page', emitPageChanged);
    atsView.webContents.on('did-finish-load', emitPageChanged);
    const applyWindowTitle = (title) => {
        if (mainWindow.isDestroyed())
            return;
        const trimmed = title.trim();
        mainWindow.setTitle(trimmed ? `${trimmed} — Gimme Job` : 'Gimme Job Desktop');
    };
    atsView.webContents.on('page-title-updated', (_event, title) => {
        applyWindowTitle(title);
    });
    atsView.webContents.on('did-navigate', () => {
        applyWindowTitle(atsView.webContents.getTitle());
    });
    atsView.webContents.on('console-message', event => {
        const report = parseUserActionReport(event.message);
        if (report) {
            mainWindow.webContents.send('desktop:user-action-report', report);
            // Auto-write the user's corrections / fills into formFieldFeedback so
            // the LLM resolver picks them up on future runs (closes the local
            // training loop without requiring an admin review step).
            void persistUserActionFeedback(report).catch(error => {
                console.warn('[training-feedback] persist failed:', error);
            });
            return;
        }
        // Capture page-level error/warning console output into a ring buffer so
        // writeRunLog can attach the trace to the per-run audit log. Helps the
        // admin page surface JS errors that crashed validators or kept Submit
        // disabled — invisible signal otherwise.
        const rawLevel = String(event.level);
        if (rawLevel === 'error' || rawLevel === 'warning' || rawLevel === '3' || rawLevel === '2') {
            capturePageConsoleEvent({
                level: rawLevel === 'error' || rawLevel === '3' ? 'error' : 'warning',
                message: event.message.slice(0, 2000),
                source: event.sourceId,
                line: event.lineNumber,
            });
        }
    });
    mainWindow.addBrowserView(appView);
    mainWindow.addBrowserView(atsView);
    mainWindow.on('resize', () => {
        layoutViews(mainWindow, appView, atsView);
    });
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        void shell.openExternal(url);
        return { action: 'deny' };
    });
    layoutViews(mainWindow, appView, atsView);
    await mainWindow.loadURL(rendererEntry);
    if (process.env.GIMME_JOB_DEVTOOLS === '1') {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
    await Promise.all([
        appView.webContents.loadURL(shellState.appUrl),
        loadOptionalAssistUrl(atsView.webContents, shellState.assistUrl),
    ]);
}
async function setAssistEyeSaverMode(webContents, enabled) {
    const cssLiteral = JSON.stringify(ASSIST_EYE_SAVER_CSS);
    const script = enabled
        ? `(function(){
         var id = '__gimme_job_eye_saver';
         var existing = document.getElementById(id);
         if (existing) existing.textContent = ${cssLiteral};
         else {
           var s = document.createElement('style');
           s.id = id;
           s.textContent = ${cssLiteral};
           (document.head || document.documentElement).appendChild(s);
         }
       })();`
        : `(function(){
         var s = document.getElementById('__gimme_job_eye_saver');
         if (s) s.remove();
       })();`;
    try {
        await webContents.executeJavaScript(script, true);
    }
    catch (error) {
        console.warn('Failed to apply eye saver CSS:', error);
    }
}
async function loadOptionalAssistUrl(webContents, url) {
    try {
        await webContents.loadURL(url);
    }
    catch (error) {
        console.warn(`Assist view initial navigation failed for ${url}: ${readNavigationError(error)}`);
    }
}
function layoutViews(mainWindow, appView, currentAssistView) {
    // Bail if any of the views were destroyed mid-flight (e.g. window
    // closing during an async call) — touching destroyed BrowserViews
    // throws "Object has been destroyed".
    if (mainWindow.isDestroyed() ||
        appView.webContents.isDestroyed() ||
        currentAssistView.webContents.isDestroyed()) {
        return;
    }
    const [width, height] = mainWindow.getContentSize();
    const layout = calculateDesktopLayout({ height, width }, shellState.panelSizes);
    // Collapse both BrowserViews to 0×0 whenever the renderer is showing a
    // non-browser section OR an HTML overlay (dropdown / popover / dialog)
    // is open in the renderer. BrowserViews are always composited above
    // the renderer's HTML; without this they cover native desktop pages
    // and any popover that extends into the BrowserView area.
    if ((activeSection !== 'training' && activeSection !== 'admin') ||
        rendererOverlayActive) {
        const hidden = { x: 0, y: 0, width: 0, height: 0 };
        appView.setBounds(hidden);
        appView.setAutoResize({ height: false, width: false });
        currentAssistView.setBounds(hidden);
        currentAssistView.setAutoResize({ height: false, width: false });
        return;
    }
    if (activeSection === 'admin') {
        const appTopChrome = DESKTOP_APP_HEADER_HEIGHT + DESKTOP_ADMIN_BROWSER_CHROME_HEIGHT;
        appView.setBounds({
            height: Math.max(0, height - appTopChrome - DESKTOP_STATUS_BAR_HEIGHT),
            width,
            x: 0,
            y: appTopChrome,
        });
        appView.setAutoResize({ height: true, width: true });
        currentAssistView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
        currentAssistView.setAutoResize({ height: false, width: false });
        return;
    }
    appView.setBounds(layout.main);
    appView.setAutoResize({ height: true, width: true });
    if (assistOverlayActive) {
        currentAssistView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
        currentAssistView.setAutoResize({ height: false, width: false });
    }
    else {
        currentAssistView.setBounds(layout.assist);
        currentAssistView.setAutoResize({ height: true, width: true });
    }
}
function readNavigationError(error) {
    if (error instanceof Error) {
        const code = 'code' in error && typeof error.code === 'string' ? ` ${error.code}` : '';
        return `${error.message}${code}`;
    }
    return 'Unknown navigation error';
}
