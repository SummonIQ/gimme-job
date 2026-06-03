import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAdminDb } from './admin-db.js';
// Per-process cancellation set. Lives outside the registerDesktopScrapeIpc
// closure so the hook installed on the bundle (also lazy-loaded) can
// reference it from anywhere.
const cancelledScrapeIds = new Set();
const pausedScrapeIds = new Set();
function isScrapeIdCancelledLocal(scrapeId) {
    return cancelledScrapeIds.has(scrapeId);
}
function isScrapeIdPausedLocal(scrapeId) {
    return pausedScrapeIds.has(scrapeId);
}
let scrapeBundlePromise = null;
async function loadScrapeBundle() {
    if (!scrapeBundlePromise) {
        scrapeBundlePromise = (async () => {
            // Resolve relative to this compiled file. After tsc the layout is:
            //   dist-electron/electron/admin/scrape-ipc.js
            //   dist-electron/scrape-bundle.mjs
            const here = path.dirname(fileURLToPath(import.meta.url));
            const bundlePath = path.resolve(here, '../../scrape-bundle.mjs');
            const mod = (await import(bundlePath));
            await mod.setScrapeCancellationHook(isScrapeIdCancelledLocal);
            await mod.setScrapePauseHook(isScrapeIdPausedLocal);
            return mod;
        })();
    }
    return scrapeBundlePromise;
}
// Bridge an unused-variable hint while still exporting createRequire
// for callers that want it. Currently nobody else does.
void createRequire;
const DESKTOP_ADMIN_SCRAPE_PROGRESS_EVENT = 'desktop-admin-event:scrape-progress';
const DESKTOP_ADMIN_SUBSCRIBE_SCRAPE = 'desktop-admin:subscribe-scrape';
const DESKTOP_ADMIN_UNSUBSCRIBE_SCRAPE = 'desktop-admin:unsubscribe-scrape';
const SCRAPE_PROGRESS_POLL_INTERVAL_MS = 1_500;
const SCRAPE_PROGRESS_EVENT_PAGE_SIZE = 100;
export const DESKTOP_SCRAPE_IPC_CHANNELS = {
    getDashboardStats: 'desktop-admin:get-dashboard-stats',
    getListingsAnalytics: 'desktop-admin:get-listings-analytics',
    getListingsProviders: 'desktop-admin:get-listings-providers',
    getProviderRuns: 'desktop-admin:get-provider-runs',
    getSavedSearches: 'desktop-admin:get-saved-searches',
    saveSearch: 'desktop-admin:save-search',
    pauseScrape: 'desktop-admin:pause-scrape',
    startScrape: 'desktop-admin:start-scrape',
    stopScrape: 'desktop-admin:stop-scrape',
    subscribeScrape: DESKTOP_ADMIN_SUBSCRIBE_SCRAPE,
    unsubscribeScrape: DESKTOP_ADMIN_UNSUBSCRIBE_SCRAPE,
    scrapeProgressEvent: DESKTOP_ADMIN_SCRAPE_PROGRESS_EVENT,
};
// Canonical provider metadata. Mirrors MANUAL_PROVIDER_OPTIONS in
// app/(app)/admin/listings/listings-tabs.tsx so providers that have
// never run still appear in the desktop list. Keep label/sourceSummary
// in sync with the web definitions; the source of truth eventually
// moves into a shared module once the web admin retires.
const LISTINGS_PROVIDER_META = [
    { label: 'LinkedIn', provider: 'linkedin-guest', sourceSummary: 'Public scraper · ~400/run' },
    { label: 'Indeed', provider: 'indeed-scraper', sourceSummary: 'Playwright scraper · ~250/run' },
    { label: 'Fantastic Jobs', provider: 'fantastic', sourceSummary: 'Aggregator API · ~10k+' },
    { label: 'TheirStack', provider: 'theirstack', sourceSummary: 'Hiring signal API · 200/mo' },
    { label: 'Greenhouse Boards', provider: 'greenhouse-boards', sourceSummary: 'Public ATS API · ~8k' },
    { label: 'Jooble', provider: 'jooble', sourceSummary: 'Aggregator API · ~5k+' },
    { label: 'JobDataAPI', provider: 'jobdataapi', sourceSummary: 'ATS jobs API · very high volume' },
    { label: 'SerpAPI', provider: 'serpapi', sourceSummary: 'Search API · ~5k' },
    { label: 'Ashby Boards', provider: 'ashby-boards', sourceSummary: 'Public ATS API · ~1.5k+' },
    { label: 'DevITjobs', provider: 'devitjobs', sourceSummary: 'Public API · ~3.4k' },
    { label: 'Adzuna', provider: 'adzuna', sourceSummary: 'Search API · ~2.5k' },
    { label: 'CareerBuilder', provider: 'careerbuilder', sourceSummary: 'Public search API · ~2k' },
    { label: 'The Muse', provider: 'themuse', sourceSummary: 'Public API · ~2k' },
    { label: 'Lever Boards', provider: 'lever-boards', sourceSummary: 'Public ATS API · ~1k+' },
    { label: 'USAJobs', provider: 'usajobs', sourceSummary: 'Official API · ~1k+' },
    { label: 'SmartRecruiters Boards', provider: 'smartrecruiters-boards', sourceSummary: 'Public ATS API · ~1k+' },
    { label: 'Recruitee Boards', provider: 'recruitee-boards', sourceSummary: 'Public ATS API · ~50+' },
    { label: 'Workable Boards', provider: 'workable-boards', sourceSummary: 'Public ATS API · ~10 companies' },
    { label: 'OpenJobs', provider: 'openjobs', sourceSummary: 'Static aggregator · ~200' },
    { label: 'Jobspresso', provider: 'jobspresso', sourceSummary: 'Public job feed · ~1k+' },
    { label: 'Himalayas', provider: 'himalayas', sourceSummary: 'Public API · ~200' },
    { label: 'Arbeitnow', provider: 'arbeitnow', sourceSummary: 'Public API · ~200' },
    { label: 'Remote First Jobs', provider: 'remotefirstjobs', sourceSummary: 'Public API · ~100' },
    { label: 'RemoteJobs.org', provider: 'remotejobs-org', sourceSummary: 'Public API · ~800+' },
    { label: 'Jobicy', provider: 'jobicy', sourceSummary: 'Public API · up to 100' },
    { label: 'Remotive', provider: 'remotive', sourceSummary: 'Public API · ~1k+' },
    { label: 'ClawJobs', provider: 'clawjobs', sourceSummary: 'Public API · global feed' },
    { label: 'Findwork', provider: 'findwork', sourceSummary: 'Developer jobs API' },
    { label: 'BreezyHR Boards', provider: 'breezyhr-boards', sourceSummary: 'Public ATS API' },
    { label: 'Workday Boards', provider: 'workday-boards', sourceSummary: 'CXS APIs · enterprise' },
    { label: 'Comeet Boards', provider: 'comeet-boards', sourceSummary: 'Public ATS API' },
    { label: 'Jobvite Boards', provider: 'jobvite-boards', sourceSummary: 'Public ATS HTML' },
    { label: 'JazzHR Boards', provider: 'jazzhr-boards', sourceSummary: 'Public ATS HTML' },
    { label: 'Welcome to the Jungle', provider: 'welcometothejungle', sourceSummary: 'Algolia-based' },
    { label: 'Built In', provider: 'builtin', sourceSummary: 'HTML scrape' },
    { label: 'NoDesk', provider: 'nodesk', sourceSummary: 'Public feed' },
    { label: 'We Work Remotely', provider: 'weworkremotely', sourceSummary: 'RSS feed' },
    { label: 'Working Nomads', provider: 'workingnomads', sourceSummary: 'Public API' },
    { label: 'Remote OK', provider: 'remoteok', sourceSummary: 'Public API' },
    { label: 'Work at a Startup', provider: 'workatastartup', sourceSummary: 'HTML scrape' },
    { label: 'Crunchboard', provider: 'crunchboard', sourceSummary: 'Public feed' },
    { label: 'HackerNews', provider: 'hackernews', sourceSummary: 'Firebase API' },
];
// Subset that requires Playwright/Chromium at runtime. Keep in sync
// with lib/admin/usage-budget.ts which gates on this for the runtime
// availability badge.
const PLAYWRIGHT_PROVIDERS = new Set(['indeed-scraper']);
const PROVIDER_REQUIRED_ENV = {
    findwork: 'FINDWORK_API_KEY',
    jobdataapi: 'JOBDATAAPI_KEY',
    theirstack: 'THEIRSTACK_API_KEY',
};
const PLAYWRIGHT_UNAVAILABLE_REASON = 'Requires a Chromium runtime. Run with ENABLE_PLAYWRIGHT_RENDER=1.';
const FANTASTIC_MONTHLY_JOBS_LIMIT = 50_000;
const FANTASTIC_MONTHLY_REQUESTS_LIMIT = 50_000;
const monthStart = (now) => new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
const monthEnd = (now) => new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
const toFiniteNumber = (value) => {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
};
// Mirrors lib/admin/usage-budget.ts::getFantasticUsageBudget. Inlined so
// the electron compile graph doesn't need to reach into web app source.
function computeFantasticBudget(logs) {
    const now = new Date();
    const cycleStart = monthStart(now);
    const cycleEnd = monthEnd(now);
    let jobsUsed = 0;
    let requestsUsed = 0;
    for (const log of logs) {
        const metadata = (log.metadata ?? {});
        const provider = typeof metadata.provider === 'string'
            ? metadata.provider.toLowerCase()
            : '';
        if (provider !== 'fantastic')
            continue;
        if (log.actionType === 'error')
            continue;
        jobsUsed += Math.max(0, Math.floor(toFiniteNumber(metadata.fetched)));
        requestsUsed += Math.max(0, Math.floor(toFiniteNumber(metadata.apiRequests)));
    }
    const msElapsed = Math.max(now.getTime() - cycleStart.getTime(), 1);
    const daysElapsed = Math.max(msElapsed / 86_400_000, 1 / 24);
    const daysInCycle = Math.max((cycleEnd.getTime() - cycleStart.getTime()) / 86_400_000, 1);
    const jobsPerDay = jobsUsed / daysElapsed;
    const requestsPerDay = requestsUsed / daysElapsed;
    return {
        cycleEnd: cycleEnd.toISOString(),
        cycleStart: cycleStart.toISOString(),
        jobsLimit: FANTASTIC_MONTHLY_JOBS_LIMIT,
        jobsUsed,
        projectedJobsUsed: Math.round(jobsPerDay * daysInCycle),
        projectedRequestsUsed: Math.round(requestsPerDay * daysInCycle),
        requestsLimit: FANTASTIC_MONTHLY_REQUESTS_LIMIT,
        requestsUsed,
    };
}
const buildCookieHeaderFromSession = async (session, url) => {
    const cookies = await session.cookies.get({ url });
    return cookies.map(c => `${c.name}=${c.value}`).join('; ');
};
// ── Handler registration ────────────────────────────────────
export function registerDesktopScrapeIpc(ipcMain, context) {
    // ── Scrape progress subscription ─────────────────────────
    // Keyed by scrapeId so multiple renderers can watch different runs.
    // lastSequenceByScrape tracks how far through the scrapeSessionEvent
    // stream each scrape's poller has progressed.
    const scrapePollers = new Map();
    const lastSequenceByScrape = new Map();
    const pollScrapeEvents = async (scrapeId) => {
        const win = context.getMainWindow();
        if (!win || win.isDestroyed())
            return;
        try {
            const db = await getAdminDb();
            const session = (await db.scrapeSession.findUnique({
                select: { id: true, status: true },
                where: { scrapeId },
            }));
            if (!session) {
                win.webContents.send(DESKTOP_ADMIN_SCRAPE_PROGRESS_EVENT, {
                    error: `No scrape session found for ${scrapeId}`,
                    ok: false,
                    scrapeId,
                });
                return;
            }
            const afterSequence = lastSequenceByScrape.get(scrapeId) ?? -1;
            const events = (await db.scrapeSessionEvent.findMany({
                orderBy: { sequence: 'asc' },
                select: {
                    emittedAt: true,
                    id: true,
                    kind: true,
                    payload: true,
                    sequence: true,
                },
                take: SCRAPE_PROGRESS_EVENT_PAGE_SIZE,
                where: {
                    sequence: { gt: afterSequence },
                    sessionId: session.id,
                },
            }));
            if (events.length > 0) {
                lastSequenceByScrape.set(scrapeId, events[events.length - 1].sequence);
                win.webContents.send(DESKTOP_ADMIN_SCRAPE_PROGRESS_EVENT, {
                    events: events.map(e => ({
                        emittedAt: e.emittedAt.toISOString(),
                        id: e.id,
                        kind: e.kind,
                        payload: e.payload,
                        sequence: e.sequence,
                    })),
                    ok: true,
                    scrapeId,
                    status: session.status,
                });
            }
            // Stop polling automatically when the session reaches a terminal
            // state — saves the renderer from also tracking that.
            const isTerminal = session.status === 'COMPLETED' ||
                session.status === 'FAILED' ||
                session.status === 'CANCELLED';
            const hasDrainedStoredEvents = events.length < SCRAPE_PROGRESS_EVENT_PAGE_SIZE;
            if (isTerminal && hasDrainedStoredEvents) {
                const poller = scrapePollers.get(scrapeId);
                if (poller) {
                    clearInterval(poller.timer);
                    scrapePollers.delete(scrapeId);
                }
                win.webContents.send(DESKTOP_ADMIN_SCRAPE_PROGRESS_EVENT, {
                    ok: true,
                    scrapeId,
                    status: session.status,
                    terminal: true,
                });
            }
        }
        catch (error) {
            win.webContents.send(DESKTOP_ADMIN_SCRAPE_PROGRESS_EVENT, {
                error: error instanceof Error ? error.message : String(error),
                ok: false,
                scrapeId,
            });
        }
    };
    ipcMain.handle(DESKTOP_ADMIN_SUBSCRIBE_SCRAPE, async (_event, ...args) => {
        const request = (args[0] ?? {});
        if (!request.scrapeId) {
            return { error: 'scrapeId is required', ok: false };
        }
        const existing = scrapePollers.get(request.scrapeId);
        if (existing) {
            existing.subscribers += 1;
            return {
                ok: true,
                scrapeId: request.scrapeId,
                subscribers: existing.subscribers,
            };
        }
        // Fire immediately so subscribers don't wait the full interval.
        void pollScrapeEvents(request.scrapeId);
        const timer = setInterval(() => {
            void pollScrapeEvents(request.scrapeId);
        }, SCRAPE_PROGRESS_POLL_INTERVAL_MS);
        scrapePollers.set(request.scrapeId, { subscribers: 1, timer });
        return { ok: true, scrapeId: request.scrapeId, subscribers: 1 };
    });
    ipcMain.handle(DESKTOP_ADMIN_UNSUBSCRIBE_SCRAPE, async (_event, ...args) => {
        const request = (args[0] ?? {});
        if (!request.scrapeId) {
            return { error: 'scrapeId is required', ok: false };
        }
        const poller = scrapePollers.get(request.scrapeId);
        if (!poller) {
            return { ok: true, scrapeId: request.scrapeId, subscribers: 0 };
        }
        poller.subscribers -= 1;
        if (poller.subscribers <= 0) {
            clearInterval(poller.timer);
            scrapePollers.delete(request.scrapeId);
            lastSequenceByScrape.delete(request.scrapeId);
        }
        return {
            ok: true,
            scrapeId: request.scrapeId,
            subscribers: Math.max(0, poller.subscribers),
        };
    });
    // ── Start / stop scrape (local orchestrator) ─────────────
    //
    // Invokes runAdminScrape from the esbuild-bundled
    // lib/admin/scrape-service.ts — see scripts/bundle-scrape.ts.
    // Cancellation hook is installed on first load and consults a local
    // Set that stopScrape mutates. The scrape itself writes progress
    // events to scrapeSessionEvent which the subscribeScrape handler
    // above is already polling.
    ipcMain.handle(DESKTOP_SCRAPE_IPC_CHANNELS.startScrape, async (_event, ...args) => {
        const request = (args[0] ?? {});
        const userId = context.getAuthUserId();
        if (!userId) {
            return {
                error: 'Desktop is not paired — sign in / pair before starting a scrape.',
                ok: false,
            };
        }
        const providers = Array.isArray(request.providers)
            ? request.providers.filter((p) => typeof p === 'string' && p.length > 0)
            : [];
        if (providers.length === 0) {
            return { error: 'At least one provider is required.', ok: false };
        }
        const scrapeId = `scrape-${Date.now()}`;
        // The renderer sends location as separate city / stateCode /
        // country fields plus a `globalDateRange` posted-within window;
        // runAdminScrape takes them as a single `location` string and
        // `postedWithin`. Join them here.
        const locationParts = [
            request.city,
            request.stateCode,
            request.country,
        ].filter((part) => Boolean(part?.trim()));
        const location = locationParts.length > 0 ? locationParts.join(', ') : undefined;
        try {
            const bundle = await loadScrapeBundle();
            // Fire-and-forget: the renderer subscribes via subscribeScrape
            // which polls scrapeSessionEvent for progress. Returning early
            // matches the web route's behavior of resolving with scrapeId
            // before the scrape finishes.
            void bundle
                .runAdminScrape({
                insertAnyway: request.insertAnyway,
                isScrapeIdCancelled: isScrapeIdCancelledLocal,
                location,
                maxPages: request.maxPages,
                mode: 'sync',
                postedWithin: request.globalDateRange,
                providerOverrides: request.providerOverrides,
                providers,
                remote: request.remote,
                scrapeId,
                searchTerm: request.searchTerm,
                trigger: 'manual',
                userId,
            })
                .catch((error) => {
                console.error('[scrape-ipc] runAdminScrape failed', scrapeId, error instanceof Error ? error.message : error);
            });
            return { ok: true, scrapeId, status: 202 };
        }
        catch (error) {
            return {
                error: error instanceof Error ? error.message : String(error),
                ok: false,
            };
        }
    });
    ipcMain.handle(DESKTOP_SCRAPE_IPC_CHANNELS.stopScrape, async (_event, ...args) => {
        const request = (args[0] ?? {});
        if (!request.scrapeId) {
            return { error: 'scrapeId is required', ok: false };
        }
        cancelledScrapeIds.add(request.scrapeId);
        pausedScrapeIds.delete(request.scrapeId);
        // Mirror the web route's TTL so a long-since-finished scrapeId
        // doesn't leak forever.
        setTimeout(() => cancelledScrapeIds.delete(request.scrapeId), 10 * 60 * 1000);
        return { ok: true, status: 202 };
    });
    ipcMain.handle(DESKTOP_SCRAPE_IPC_CHANNELS.pauseScrape, async (_event, ...args) => {
        const request = (args[0] ?? {});
        if (!request.scrapeId) {
            return { error: 'scrapeId is required', ok: false };
        }
        if (request.paused) {
            pausedScrapeIds.add(request.scrapeId);
        }
        else {
            pausedScrapeIds.delete(request.scrapeId);
        }
        return { ok: true, paused: Boolean(request.paused), status: 202 };
    });
    // ── Dashboard summary (Prisma direct) ────────────────────
    ipcMain.handle(DESKTOP_SCRAPE_IPC_CHANNELS.getDashboardStats, async () => {
        const startedAt = Date.now();
        try {
            const db = await getAdminDb();
            const now = Date.now();
            const day1 = new Date(now - 24 * 60 * 60 * 1000);
            const day7 = new Date(now - 7 * 24 * 60 * 60 * 1000);
            const day30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
            const [summaryRows, latestUsersRaw, providerDailyRows, budgetLogs] = (await Promise.all([
                db.$queryRawUnsafe(`
              select
                (select count(*) from "JobListing")::bigint as "totalListings",
                (select count(*) from "JobLead")::bigint as "totalLeads",
                (select count(*) from "ApplicationSubmission")::bigint as "totalApplications",
                (select count(*) from "ApplicationSubmission" where status::text in ('INTERVIEW_REQUESTED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED'))::bigint as "interviewCount",
                (select count(*) from "ApplicationSubmission" where status::text in ('OFFER_RECEIVED', 'OFFER_ACCEPTED'))::bigint as "offerCount",
                (select count(*) from "JobListing" where "createdAt" >= $1)::bigint as "listings24h",
                (select count(*) from "JobLead" where "createdAt" >= $1)::bigint as "leads24h",
                (select count(*) from "ApplicationSubmission" where "createdAt" >= $1)::bigint as "applications24h",
                (select count(*) from "Resume" where "createdAt" >= $1)::bigint as "resumes24h",
                (select count(*) from "Notification" where "createdAt" >= $1)::bigint as "notifications24h",
                (select count(*) from "JobListing" where "createdAt" >= $2)::bigint as "listings7d",
                (select count(*) from "JobListing" where "createdAt" >= $3)::bigint as "listings30d",
                (select count(*) from "JobLead" where "createdAt" >= $2)::bigint as "leads7d",
                (select count(*) from "ApplicationSubmission" where "createdAt" >= $2)::bigint as "applications7d",
                (select count(*) from "JobLead" where status::text = 'APPLIED')::bigint as "leadsApplied",
                (select count(*) from "JobLead" where status::text = 'REMOVED')::bigint as "leadsDismissed",
                (select count(*) from "JobLead" where status::text in ('ADDED', 'ANALYZING', 'ANALYZED', 'OPTIMIZING', 'OPTIMIZED', 'APPLYING', 'APPLIED', 'ADVANCED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'OFFER'))::bigint as "leadsActive",
                (select count(*) from "Resume")::bigint as "totalResumes",
                (select count(*) from "ResumeAnalysis" where status::text = 'COMPLETED')::bigint as "analysesCompleted",
                (select count(*) from "ResumeAnalysis" where status::text = 'FAILED')::bigint as "analysesFailed",
                (select count(*) from "ResumeOptimization" where status::text = 'COMPLETED')::bigint as "optimizationsCompleted",
                (select avg(score) from "ResumeAnalysis" where status::text = 'COMPLETED' and score is not null)::float as "avgResumeScore",
                (select count(*) from "ApplicationSubmission" where status::text = 'SUBMITTED')::bigint as "appsSubmitted",
                (select count(*) from "ApplicationSubmission" where status::text = 'PENDING')::bigint as "appsPending",
                (select count(*) from "ApplicationSubmission" where status::text in ('FAILED', 'NOT_SELECTED'))::bigint as "appsFailed",
                (select count(*) from "ApplicationSubmission" where "wasAutomated" = true)::bigint as "appsAutomated",
                (select count(*) from "user")::bigint as "totalUsers",
                (select count(*) from "user" where "createdAt" >= $2)::bigint as "newUsers7d",
                (select count(*) from "session" where "expiresAt" > now())::bigint as "activeSessions",
                (select count(*) from "Subscription" where status in ('active', 'trialing'))::bigint as "activeSubscriptions",
                (select count(*) from "AutomationScheduledApplication" where status = 'scheduled')::bigint as "scheduledApps",
                (select count(*) from "AutomationAuditLog" where "createdAt" >= $1)::bigint as "auditLogs24h"
              `, day1, day7, day30),
                db.$queryRawUnsafe('select id, email, name, "firstName", "lastName", "createdAt" from "user" order by "createdAt" desc limit 5'),
                db.$queryRawUnsafe('select coalesce("jobBoard"::text, \'unknown\') as provider, count(*)::bigint as count from "JobListing" where "createdAt" >= $1 group by 1 order by 2 desc', day1),
                db.automationAuditLog.findMany({
                    select: { actionType: true, metadata: true },
                    where: {
                        action: {
                            in: [
                                'ingestion_provider_run',
                                'ingestion_script_provider_run',
                            ],
                        },
                        createdAt: { gte: monthStart(new Date()) },
                    },
                }),
            ]));
            const row = summaryRows[0];
            if (!row) {
                throw new Error('Dashboard summary query returned no rows.');
            }
            const num = (value) => Math.max(0, Math.round(toFiniteNumber(value)));
            const pct = (part, total) => total > 0 ? Math.round((part / total) * 100) : 0;
            const totalListings = num(row.totalListings);
            const totalLeads = num(row.totalLeads);
            const totalApplications = num(row.totalApplications);
            const interviewCount = num(row.interviewCount);
            const offerCount = num(row.offerCount);
            const appsAutomated = num(row.appsAutomated);
            const budget = computeFantasticBudget(budgetLogs);
            return {
                durationMs: Date.now() - startedAt,
                fetchedAt: new Date().toISOString(),
                ok: true,
                stats: {
                    activity24h: {
                        applications: num(row.applications24h),
                        leads: num(row.leads24h),
                        listings: num(row.listings24h),
                        notifications: num(row.notifications24h),
                        resumes: num(row.resumes24h),
                    },
                    applications: {
                        automated: appsAutomated,
                        failed: num(row.appsFailed),
                        manualCount: Math.max(totalApplications - appsAutomated, 0),
                        pending: num(row.appsPending),
                        submitted: num(row.appsSubmitted),
                        total: totalApplications,
                    },
                    automation: {
                        auditLogs24h: num(row.auditLogs24h),
                        scheduledApps: num(row.scheduledApps),
                    },
                    budget,
                    funnel: {
                        appToInterviewRate: pct(interviewCount, totalApplications),
                        interviewCount,
                        interviewToOfferRate: pct(offerCount, interviewCount),
                        leadToAppRate: pct(totalApplications, totalLeads),
                        listingToLeadRate: pct(totalLeads, totalListings),
                        offerCount,
                        totalApplications,
                        totalLeads,
                        totalListings,
                    },
                    pipeline: {
                        leadsActive: num(row.leadsActive),
                        leadsApplied: num(row.leadsApplied),
                        leadsDismissed: num(row.leadsDismissed),
                    },
                    providerDaily: Object.fromEntries(providerDailyRows.map(providerRow => [
                        providerRow.provider ?? 'unknown',
                        num(providerRow.count),
                    ])),
                    resumeHealth: {
                        analysesCompleted: num(row.analysesCompleted),
                        analysesFailed: num(row.analysesFailed),
                        avgScore: num(row.avgResumeScore),
                        optimizationsCompleted: num(row.optimizationsCompleted),
                        totalResumes: num(row.totalResumes),
                    },
                    trends: {
                        applications7d: num(row.applications7d),
                        leads7d: num(row.leads7d),
                        listings30d: num(row.listings30d),
                        listings7d: num(row.listings7d),
                    },
                    users: {
                        activeSessions: num(row.activeSessions),
                        activeSubscriptions: num(row.activeSubscriptions),
                        latest: latestUsersRaw.map(user => ({
                            createdAt: user.createdAt.toISOString(),
                            email: user.email,
                            id: user.id,
                            name: user.name ??
                                [user.firstName, user.lastName].filter(Boolean).join(' ') ??
                                null,
                        })),
                        new7d: num(row.newUsers7d),
                        total: num(row.totalUsers),
                    },
                },
            };
        }
        catch (error) {
            return {
                error: error instanceof Error ? error.message : String(error),
                ok: false,
            };
        }
    });
    // ── Provider summary (Prisma direct) ─────────────────────
    ipcMain.handle(DESKTOP_SCRAPE_IPC_CHANNELS.getListingsProviders, async () => {
        const startedAt = Date.now();
        try {
            const db = await getAdminDb();
            const now = new Date();
            const cycleStart = monthStart(now);
            const cycleEnd = monthEnd(now);
            const playwrightEnabled = process.env.ENABLE_PLAYWRIGHT_RENDER === '1' && !process.env.VERCEL;
            const logs = (await db.automationAuditLog.findMany({
                orderBy: { createdAt: 'desc' },
                select: {
                    actionType: true,
                    createdAt: true,
                    metadata: true,
                },
                where: {
                    action: {
                        in: ['ingestion_provider_run', 'ingestion_script_provider_run'],
                    },
                    createdAt: { gte: cycleStart, lt: cycleEnd },
                },
            }));
            const byProvider = new Map();
            for (const log of logs) {
                const metadata = (log.metadata ?? {});
                const provider = typeof metadata.provider === 'string'
                    ? metadata.provider.toLowerCase()
                    : '';
                if (!provider)
                    continue;
                let entry = byProvider.get(provider);
                if (!entry) {
                    entry = {
                        apiRequests: 0,
                        failedRuns: 0,
                        jobsCreated: 0,
                        jobsFetched: 0,
                        jobsUpdated: 0,
                        lastError: null,
                        lastRunAt: null,
                        lastStatus: 'unknown',
                        providerRuns: 0,
                    };
                    byProvider.set(provider, entry);
                }
                entry.providerRuns += 1;
                if (!entry.lastRunAt || log.createdAt > entry.lastRunAt) {
                    entry.lastRunAt = log.createdAt;
                    entry.lastError =
                        typeof metadata.error === 'string' ? metadata.error : null;
                    entry.lastStatus =
                        log.actionType === 'success' || log.actionType === 'error'
                            ? log.actionType
                            : 'unknown';
                }
                if (log.actionType === 'error') {
                    entry.failedRuns += 1;
                    continue;
                }
                entry.apiRequests += Math.max(0, Math.floor(toFiniteNumber(metadata.apiRequests)));
                entry.jobsFetched += Math.max(0, Math.floor(toFiniteNumber(metadata.fetched)));
                entry.jobsCreated += Math.max(0, Math.floor(toFiniteNumber(metadata.created)));
                entry.jobsUpdated += Math.max(0, Math.floor(toFiniteNumber(metadata.updated)));
            }
            const providers = LISTINGS_PROVIDER_META.map(meta => {
                const data = byProvider.get(meta.provider) ?? {
                    apiRequests: 0,
                    failedRuns: 0,
                    jobsCreated: 0,
                    jobsFetched: 0,
                    jobsUpdated: 0,
                    lastError: null,
                    lastRunAt: null,
                    lastStatus: 'unknown',
                    providerRuns: 0,
                };
                const requiredEnv = PROVIDER_REQUIRED_ENV[meta.provider];
                const missingEnv = requiredEnv && !process.env[requiredEnv];
                const missingPlaywright = PLAYWRIGHT_PROVIDERS.has(meta.provider) && !playwrightEnabled;
                const runtimeAvailable = !missingEnv && !missingPlaywright;
                const unavailableReason = missingPlaywright
                    ? PLAYWRIGHT_UNAVAILABLE_REASON
                    : missingEnv
                        ? `Set ${requiredEnv} to run this provider.`
                        : null;
                const successRuns = Math.max(0, data.providerRuns - data.failedRuns);
                const avgFetched = successRuns > 0 ? data.jobsFetched / successRuns : 0;
                const avgCreated = successRuns > 0 ? data.jobsCreated / successRuns : 0;
                return {
                    apiRequests: data.apiRequests,
                    avgCreated,
                    avgFetched,
                    failedRuns: data.failedRuns,
                    jobsCreated: data.jobsCreated,
                    jobsFetched: data.jobsFetched,
                    jobsUpdated: data.jobsUpdated,
                    label: meta.label,
                    lastError: data.lastError,
                    lastRunAt: data.lastRunAt ? data.lastRunAt.toISOString() : null,
                    lastStatus: data.lastStatus,
                    provider: meta.provider,
                    providerRuns: data.providerRuns,
                    runtimeAvailable,
                    sourceSummary: meta.sourceSummary,
                    unavailableReason,
                };
            });
            return {
                durationMs: Date.now() - startedAt,
                fetchedAt: new Date().toISOString(),
                ok: true,
                providers,
            };
        }
        catch (error) {
            return {
                error: error instanceof Error ? error.message : String(error),
                ok: false,
            };
        }
    });
    // ── Saved searches (Prisma direct) ───────────────────────
    ipcMain.handle(DESKTOP_SCRAPE_IPC_CHANNELS.getSavedSearches, async () => {
        const startedAt = Date.now();
        try {
            const db = await getAdminDb();
            // De-duplicate by (searchTerm, location) tuple — JobSearch rows
            // accumulate quickly from cron, no need to show all of them.
            const rows = (await db.jobSearch.findMany({
                distinct: ['searchTerm', 'location'],
                orderBy: { createdAt: 'desc' },
                select: {
                    createdAt: true,
                    id: true,
                    location: true,
                    remote: true,
                    searchTerm: true,
                },
                take: 30,
                where: { searchTerm: { not: null } },
            }));
            return {
                durationMs: Date.now() - startedAt,
                fetchedAt: new Date().toISOString(),
                ok: true,
                searches: rows
                    .filter(r => r.searchTerm)
                    .map(r => ({
                    createdAt: r.createdAt.toISOString(),
                    id: r.id,
                    location: r.location,
                    remote: r.remote,
                    searchTerm: r.searchTerm,
                })),
            };
        }
        catch (error) {
            return {
                error: error instanceof Error ? error.message : String(error),
                ok: false,
            };
        }
    });
    // ── Save current search (Prisma direct) ──────────────────
    //
    // Mirrors the web app's POST /api/job-searches handler so the desktop
    // Star button can persist the active search to JobSearch the same way.
    ipcMain.handle(DESKTOP_SCRAPE_IPC_CHANNELS.saveSearch, async (_event, ...args) => {
        const userId = context.getAuthUserId();
        if (!userId) {
            return {
                ok: false,
                error: 'Desktop is not paired — sign in / pair before saving.',
            };
        }
        const request = (args[0] ?? {});
        const searchTerm = (request.searchTerm ?? '').trim();
        if (!searchTerm) {
            return { ok: false, error: 'Search term is required.' };
        }
        const location = (request.location ?? '').trim() || null;
        const filters = {
            location: location ?? '',
            search: searchTerm,
        };
        if (typeof request.remote === 'boolean')
            filters.remote = request.remote;
        if (request.maxPages !== undefined)
            filters.maxPages = request.maxPages;
        if (request.postedWithin)
            filters.postedWithin = request.postedWithin;
        try {
            const db = await getAdminDb();
            const existing = (await db.jobSearch.findFirst({
                where: { userId, searchTerm, location },
            }));
            if (existing) {
                const existingMetadata = existing.metadata && typeof existing.metadata === 'object'
                    ? existing.metadata
                    : {};
                const updated = (await db.jobSearch.update({
                    where: { id: existing.id },
                    data: {
                        saved: true,
                        metadata: { ...existingMetadata, filters },
                    },
                }));
                return {
                    ok: true,
                    search: {
                        id: updated.id,
                        searchTerm: updated.searchTerm ?? searchTerm,
                        location: updated.location ?? null,
                        remote: updated.remote ?? null,
                        createdAt: updated.createdAt.toISOString(),
                    },
                };
            }
            const created = (await db.jobSearch.create({
                data: {
                    userId,
                    searchTerm,
                    location,
                    saved: true,
                    metadata: { filters },
                },
            }));
            return {
                ok: true,
                search: {
                    id: created.id,
                    searchTerm: created.searchTerm ?? searchTerm,
                    location: created.location ?? null,
                    remote: created.remote ?? null,
                    createdAt: created.createdAt.toISOString(),
                },
            };
        }
        catch (error) {
            return {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });
    // ── Provider run history (Prisma direct) ─────────────────
    //
    // Mirrors GET /api/admin/scrape/runs?provider=… — drills into the
    // automationAuditLog table for the most recent runs of one provider so
    // the per-provider ⋯ menu can show a history popover.
    ipcMain.handle(DESKTOP_SCRAPE_IPC_CHANNELS.getProviderRuns, async (_event, ...args) => {
        const request = (args[0] ?? {});
        const provider = (request.provider ?? '').trim();
        if (!provider) {
            return { ok: false, error: 'Provider is required.' };
        }
        const limit = Math.min(Math.max(request.limit ?? 25, 1), 100);
        try {
            const db = await getAdminDb();
            const rows = (await db.automationAuditLog.findMany({
                orderBy: { createdAt: 'desc' },
                take: limit,
                where: {
                    action: {
                        in: ['ingestion_provider_run', 'ingestion_script_provider_run'],
                    },
                    metadata: { path: ['provider'], equals: provider },
                },
                select: {
                    id: true,
                    actionType: true,
                    createdAt: true,
                    metadata: true,
                },
            }));
            const runs = rows.map(r => {
                const meta = (r.metadata ?? {});
                const num = (key) => {
                    const value = meta[key];
                    return typeof value === 'number' ? value : 0;
                };
                const str = (key) => {
                    const value = meta[key];
                    return typeof value === 'string' ? value : null;
                };
                const status = r.actionType === 'success'
                    ? 'success'
                    : r.actionType === 'error' || r.actionType === 'failure'
                        ? 'error'
                        : 'unknown';
                return {
                    id: r.id,
                    createdAt: r.createdAt.toISOString(),
                    status,
                    jobsFetched: num('jobsFetched'),
                    jobsCreated: num('jobsCreated'),
                    jobsUpdated: num('jobsUpdated'),
                    durationMs: typeof meta.durationMs === 'number'
                        ? meta.durationMs
                        : null,
                    searchTerm: str('searchTerm'),
                    error: str('error') ?? str('errorMessage'),
                };
            });
            return { ok: true, runs };
        }
        catch (error) {
            return {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });
    // ── Listings analytics (Prisma direct) ───────────────────
    ipcMain.handle(DESKTOP_SCRAPE_IPC_CHANNELS.getListingsAnalytics, async () => {
        const startedAt = Date.now();
        try {
            const db = await getAdminDb();
            const now = Date.now();
            const day1 = new Date(now - 24 * 60 * 60 * 1000);
            const day7 = new Date(now - 7 * 24 * 60 * 60 * 1000);
            const [totalListings, unreviewedListings, dismissedListings, leadsConverted, created24h, created7d, providerBreakdownRaw, recentListingsRaw, fantasticAuditLogs,] = (await Promise.all([
                db.jobListing.count(),
                db.jobListing.count({ where: { status: 'UNREVIEWED' } }),
                db.jobListing.count({ where: { status: 'DISMISSED' } }),
                db.jobListing.count({ where: { status: 'ADDED_TO_LEADS' } }),
                db.jobListing.count({ where: { createdAt: { gte: day1 } } }),
                db.jobListing.count({ where: { createdAt: { gte: day7 } } }),
                db.$queryRawUnsafe('select "jobBoard"::text as provider, count(*)::bigint as count from "JobListing" group by 1 order by 2 desc'),
                db.$queryRawUnsafe('select id, title, company, "jobBoard"::text as provider, status::text as status, "createdAt" from "JobListing" order by "createdAt" desc limit 15'),
                db.automationAuditLog.findMany({
                    select: { actionType: true, metadata: true },
                    where: {
                        action: {
                            in: ['ingestion_provider_run', 'ingestion_script_provider_run'],
                        },
                        createdAt: { gte: monthStart(new Date()) },
                    },
                }),
            ]));
            const conversionRate = totalListings > 0
                ? Math.round((leadsConverted / totalListings) * 100)
                : 0;
            const providerBreakdown = providerBreakdownRaw.map(row => {
                const count = Number(row.count);
                return {
                    count,
                    percentage: totalListings > 0
                        ? Math.round((count / totalListings) * 100)
                        : 0,
                    provider: row.provider ?? 'UNKNOWN',
                };
            });
            const recentListings = recentListingsRaw.map(row => ({
                company: row.company,
                createdAt: row.createdAt.toISOString(),
                id: row.id,
                provider: row.provider,
                status: row.status,
                title: row.title,
            }));
            const fantasticBudget = computeFantasticBudget(fantasticAuditLogs);
            // day7 is referenced via the createdAt query above; keep void
            // so an aggressive unused-locals rule doesn't trip.
            void day7;
            return {
                budget: {
                    jobsLimit: fantasticBudget.jobsLimit,
                    jobsRemaining: Math.max(fantasticBudget.jobsLimit - fantasticBudget.jobsUsed, 0),
                    jobsUsed: fantasticBudget.jobsUsed,
                    requestsLimit: fantasticBudget.requestsLimit,
                    requestsRemaining: Math.max(fantasticBudget.requestsLimit - fantasticBudget.requestsUsed, 0),
                    requestsUsed: fantasticBudget.requestsUsed,
                },
                durationMs: Date.now() - startedAt,
                fetchedAt: new Date().toISOString(),
                ok: true,
                providerBreakdown,
                recentListings,
                totals: {
                    conversionRate,
                    created24h,
                    created7d,
                    dismissedListings,
                    leadsConverted,
                    totalListings,
                    unreviewedListings,
                },
            };
        }
        catch (error) {
            return {
                error: error instanceof Error ? error.message : String(error),
                ok: false,
            };
        }
    });
}
