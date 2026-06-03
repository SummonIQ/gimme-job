import type { DesktopShellPanelSizes } from '../electron/window-layout';
import type {
  DesktopAgentChatRequest,
  DesktopAgentChatResult,
  DesktopAssistPageContext,
} from '../electron/agent-chat/types';

export type {
  DesktopAgentChatRequest,
  DesktopAgentChatResult,
  DesktopAssistPageContext,
  DesktopAssistPageField,
  DesktopAssistPageIssue,
} from '../electron/agent-chat/types';

export interface DesktopFieldRule {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
  readonly hostname: string | null;
  readonly source: 'manual' | 'state-tab' | 'chat';
  readonly createdAt: string;
}

export interface DesktopAuthState {
  readonly message?: string;
  readonly scopes?: readonly string[];
  readonly status: 'unpaired' | 'paired' | 'invalid';
  readonly tokenId?: string;
  readonly userId?: string;
}

export interface DesktopShellState {
  readonly appUrl: string;
  readonly assistUrl: string;
  readonly isEyeSaverMode: boolean;
  readonly panelSizes: DesktopShellPanelSizes;
}

export interface DesktopAssistNavState {
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
}

export type DesktopAiProvider = 'openai' | 'ollama';

export interface DesktopSubmitLeadRequest {
  readonly aiProvider?: DesktopAiProvider;
  readonly applicationUrl: string;
  readonly continueFromCurrentPage?: boolean;
  readonly jobLeadId?: string;
  readonly jobListingId?: string;
  readonly mode: 'training' | 'submit';
}

export interface DesktopSubmitLeadResult {
  readonly applicationUrl: string;
  readonly executionEnvironment: 'DESKTOP_CDP';
  readonly jobLeadId?: string;
  readonly message: string;
  readonly mode: 'training' | 'submit';
  readonly status:
    | 'blocked_by_submit_guard'
    | 'cancelled'
    | 'captcha_required'
    | 'closed_posting'
    | 'completed'
    | 'confirmation_timeout'
    | 'failed'
    | 'manual_auth_required'
    | 'paused_for_manual_review'
    | 'unavailable'
    | 'unsupported_provider'
    | 'validation_failed';
  readonly toolCalls: readonly {
    readonly errorMessage?: string;
    readonly input?: {
      readonly enabled?: boolean;
      readonly fileName?: string;
      readonly key?: string;
      readonly text?: string;
      readonly timeoutMs?: number;
      readonly url?: string;
      readonly value?: string;
    };
    readonly ok: boolean;
    readonly reason?: string;
    readonly selector?: string;
    readonly tool: string;
  }[];
  readonly validationFailures?: readonly {
    readonly fieldLabel: string;
    readonly fieldSelector: string;
    readonly message: string;
  }[];
}

export interface DesktopRandomGreenhouseLead {
  readonly applicationUrl: string;
  readonly company: string | null;
  readonly jobLeadId?: string;
  readonly jobListingId: string;
  readonly location?: string | null;
  readonly source: string | null;
  readonly title: string;
}

export type DesktopRandomJobProviderScope = 'any' | 'greenhouse';
export type DesktopRandomJobProviderId = string;

export interface DesktopGreenhouseLeadSearchQuery {
  readonly excludeCompanies?: readonly string[];
  readonly excludeListingIds?: readonly string[];
  readonly location?: string;
  readonly provider?: DesktopRandomJobProviderScope;
  readonly providers?: readonly DesktopRandomJobProviderId[];
  readonly remote?: boolean;
  /**
   * Filter by runtime ATS provider (Lever, Ashby, SmartRecruiters, etc.) —
   * distinct from `providers`, which filters by job-source scraper.
   */
  readonly runtimeProviders?: readonly string[];
  readonly search?: string;
}

export interface DesktopUserActionFieldEntry {
  readonly id: string;
  readonly label: string;
  readonly type: string;
  readonly value: string;
}

export interface DesktopUserActionReport {
  readonly aiBaseline: readonly DesktopUserActionFieldEntry[];
  readonly capturedAt: string;
  readonly emptyFields: readonly DesktopUserActionFieldEntry[];
  readonly trigger: 'submit' | 'manual';
  readonly unchangedFields: readonly DesktopUserActionFieldEntry[];
  readonly url: string;
  readonly userChangedFields: readonly {
    readonly aiValue: string;
    readonly id: string;
    readonly label: string;
    readonly type: string;
    readonly userValue: string;
  }[];
  readonly userFilledFields: readonly DesktopUserActionFieldEntry[];
}

export interface DesktopApi {
  readonly auth: {
    readonly clearToken: () => Promise<DesktopAuthState>;
    readonly getState: () => Promise<DesktopAuthState>;
    readonly pairWithCode: (code: string) => Promise<DesktopAuthState>;
  };
  readonly agent: {
    readonly chat: (
      request: DesktopAgentChatRequest,
    ) => Promise<DesktopAgentChatResult>;
  };
  readonly shell: {
    readonly assistGoBack: () => Promise<DesktopAssistNavState>;
    readonly assistGoForward: () => Promise<DesktopAssistNavState>;
    readonly getAssistNavState: () => Promise<DesktopAssistNavState>;
    readonly getAssistPageContext: () => Promise<DesktopAssistPageContext | null>;
    readonly getAssistTitle: () => Promise<string>;
    readonly getState: () => Promise<DesktopShellState>;
    readonly highlightAssistField: (selector: string) => Promise<boolean>;
    readonly loadAppUrl: (url: string) => Promise<void>;
    readonly onAssistNavStateChange: (
      callback: (navState: DesktopAssistNavState) => void,
    ) => () => void;
    readonly onAssistPageChanged: (callback: () => void) => () => void;
    readonly setAssistEyeSaverMode: (
      enabled: boolean,
    ) => Promise<DesktopShellState>;
    readonly setAutofillPaused: (paused: boolean) => Promise<void>;
    readonly listFieldRules: () => Promise<readonly DesktopFieldRule[]>;
    readonly removeFieldRule: (id: string) => Promise<boolean>;
    readonly addFieldRule: (input: {
      readonly question: string;
      readonly answer: string;
      readonly hostname?: string | null;
    }) => Promise<DesktopFieldRule>;
    readonly setAssistField: (input: {
      readonly kind: 'fill' | 'select' | 'click' | 'typeahead';
      readonly selector: string;
      readonly value: string;
      // When present, record this as a field rule so the agent reuses
      // the answer for the same question in future runs. The State tab
      // editor passes the field's label as `question` so manual
      // corrections turn into permanent overrides automatically.
      readonly question?: string;
      readonly hostname?: string;
    }) => Promise<{ readonly ok: boolean; readonly error?: string }>;
    readonly getAssistFieldOptions: (
      selector: string,
      options?: { readonly query?: string },
    ) => Promise<{
      readonly ok: boolean;
      readonly error?: string;
      readonly options?: ReadonlyArray<{
        readonly label: string;
        readonly value: string;
      }>;
    }>;
    readonly setActiveSection: (
      section: 'dashboard' | 'training' | 'scraper' | 'smoke-tests' | 'admin',
    ) => Promise<void>;
    readonly setRendererOverlayActive: (active: boolean) => Promise<void>;
    readonly setAssistOverlayActive: (active: boolean) => Promise<void>;
    readonly setAssistUrl: (url: string) => Promise<DesktopShellState>;
    readonly setPanelSizes: (
      panelSizes: DesktopShellPanelSizes,
    ) => Promise<DesktopShellState>;
  };
  readonly submit: {
    readonly cancelRun: () => Promise<{ readonly cancelled: boolean }>;
    readonly pickRandomGreenhouseLead: (
      request?: DesktopGreenhouseLeadSearchQuery,
    ) => Promise<DesktopRandomGreenhouseLead>;
    readonly recordManualSubmit: (request: {
      readonly applicationUrl: string;
      readonly jobLeadId?: string;
      readonly message?: string;
      readonly toolCallCount?: number;
    }) => Promise<{
      readonly jobLeadId: string | null;
      readonly outcome: 'applied' | 'tracked' | 'skipped';
      readonly submissionId: string | null;
    }>;
    readonly runLead: (
      request: DesktopSubmitLeadRequest,
    ) => Promise<DesktopSubmitLeadResult>;
    readonly runSmokeTest: (
      request: DesktopSmokeTestRequest,
    ) => Promise<DesktopSmokeTestResult>;
    readonly cancelSmokeTest: () => Promise<{ readonly cancelled: boolean }>;
    readonly onSmokeProgress: (
      callback: (event: DesktopSmokeTestProgressEvent) => void,
    ) => () => void;
    readonly swapAssistResumeFile: (request: {
      readonly fileName: string;
      readonly pdfUrl: string;
    }) => Promise<{
      readonly injected: boolean;
      readonly reason?: string;
    }>;
    readonly tailorResumeForLead: (request: {
      readonly leadId: string;
    }) => Promise<{
      readonly diffSummary: unknown;
      readonly emphasizedKeywords: readonly string[];
      readonly formats: {
        readonly docx: string;
        readonly html: string;
        readonly pdf: string;
        readonly txt: string;
      };
      readonly revisionId: string;
      readonly summary: string;
    }>;
  };
  readonly userActions: {
    readonly onReport: (
      callback: (report: DesktopUserActionReport) => void,
    ) => () => void;
  };
  readonly settings: {
    readonly get: (key: string) => Promise<unknown>;
    readonly set: (key: string, value: unknown) => Promise<void>;
  };
  readonly smokeReports: {
    readonly list: () => Promise<readonly DesktopSmokeReportSummary[]>;
    readonly read: (filePath: string) => Promise<DesktopSmokeReportFull>;
  };
  readonly providers: {
    readonly listRuntime: () => Promise<readonly DesktopRuntimeProviderInfo[]>;
    readonly detectFor: (url: string) => Promise<DesktopRuntimeProviderInfo>;
  };
  readonly admin: DesktopAdminApi;
}

export type DesktopRuntimeProviderReadiness =
  | 'production'
  | 'beta'
  | 'manual_review'
  | 'unsupported';

export interface DesktopRuntimeProviderInfo {
  readonly id: string;
  readonly label: string;
  readonly readiness: DesktopRuntimeProviderReadiness;
  readonly runner: string | null;
}

export interface DesktopSmokeTestRequest {
  readonly runtimeProviderId: string;
  readonly count: number;
  readonly excludeListingIds?: readonly string[];
  readonly excludeCompanies?: readonly string[];
}

export interface DesktopSmokeTestRun {
  readonly index: number;
  readonly runId?: string;
  readonly applicationUrl: string;
  readonly company: string | null;
  readonly title: string | null;
  readonly status: DesktopSubmitLeadResult['status'] | 'skipped';
  readonly durationMs: number;
  readonly toolCallCount: number | null;
  readonly errorTool?: string;
  readonly errorToolMessage?: string;
  readonly message?: string;
}

export interface DesktopSmokeTestResult {
  readonly runtimeProviderId: string;
  readonly runtimeProviderLabel: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly totalDurationMs: number;
  readonly requested: number;
  readonly completed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly runs: readonly DesktopSmokeTestRun[];
  readonly reportPath: string;
}

export interface DesktopSmokeReportSummary {
  readonly filePath: string;
  readonly runtimeProviderId: string;
  readonly runtimeProviderLabel: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly totalDurationMs: number;
  readonly requested: number;
  readonly completed: number;
  readonly failed: number;
  readonly skipped: number;
}

export interface DesktopSmokeReportFull extends DesktopSmokeReportSummary {
  readonly request: DesktopSmokeTestRequest;
  readonly runLogsDirectory: string;
  readonly runtimeProvider: DesktopRuntimeProviderInfo;
  readonly runs: readonly DesktopSmokeTestRun[];
}

export interface DesktopSmokeTestProgressEvent {
  readonly phase: 'picking' | 'running' | 'complete' | 'cancelled' | 'error';
  readonly runtimeProviderId: string;
  readonly index: number;
  readonly total: number;
  readonly applicationUrl?: string;
  readonly message?: string;
}

// ── Admin (scrape slice only) ──────────────────────────────
// Only the channels the native AdminListingsManualPage uses. Other
// admin domains (plan board, observations, data explorer, …) are
// out of scope for this port and intentionally absent.

export interface DesktopAdminSavedSearchRow {
  readonly id: string;
  readonly searchTerm: string;
  readonly location: string | null;
  readonly remote: boolean | null;
  readonly createdAt: string;
}

export interface DesktopAdminSavedSearchesResult {
  readonly ok: true;
  readonly fetchedAt: string;
  readonly durationMs: number;
  readonly searches: readonly DesktopAdminSavedSearchRow[];
}

export interface DesktopAdminSavedSearchesError {
  readonly ok: false;
  readonly error: string;
}

export type DesktopAdminSavedSearchesApiResult =
  | DesktopAdminSavedSearchesResult
  | DesktopAdminSavedSearchesError;

export interface DesktopAdminSaveSearchRequest {
  readonly searchTerm: string;
  readonly location?: string | null;
  readonly remote?: boolean;
  readonly maxPages?: number;
  readonly postedWithin?: string;
}

export interface DesktopAdminSaveSearchResult {
  readonly ok: true;
  readonly search: DesktopAdminSavedSearchRow;
}

export interface DesktopAdminSaveSearchError {
  readonly ok: false;
  readonly error: string;
}

export type DesktopAdminSaveSearchApiResult =
  | DesktopAdminSaveSearchResult
  | DesktopAdminSaveSearchError;

export interface DesktopAdminProviderRunRow {
  readonly id: string;
  readonly createdAt: string;
  readonly status: 'success' | 'error' | 'unknown';
  readonly jobsFetched: number;
  readonly jobsCreated: number;
  readonly jobsUpdated: number;
  readonly durationMs: number | null;
  readonly searchTerm: string | null;
  readonly error: string | null;
}

export interface DesktopAdminProviderRunsRequest {
  readonly provider: string;
  readonly limit?: number;
}

export interface DesktopAdminProviderRunsResult {
  readonly ok: true;
  readonly runs: readonly DesktopAdminProviderRunRow[];
}

export interface DesktopAdminProviderRunsError {
  readonly ok: false;
  readonly error: string;
}

export type DesktopAdminProviderRunsApiResult =
  | DesktopAdminProviderRunsResult
  | DesktopAdminProviderRunsError;

export interface DesktopListingsProviderBreakdown {
  readonly provider: string;
  readonly count: number;
  readonly percentage: number;
}

export interface DesktopListingsRecent {
  readonly id: string;
  readonly title: string;
  readonly company: string | null;
  readonly provider: string | null;
  readonly status: string;
  readonly createdAt: string;
}

export interface DesktopAdminListingsAnalyticsResult {
  readonly ok: true;
  readonly fetchedAt: string;
  readonly durationMs: number;
  readonly totals: {
    readonly totalListings: number;
    readonly unreviewedListings: number;
    readonly dismissedListings: number;
    readonly leadsConverted: number;
    readonly conversionRate: number;
    readonly created24h: number;
    readonly created7d: number;
  };
  readonly budget: {
    readonly jobsLimit: number;
    readonly jobsUsed: number;
    readonly jobsRemaining: number;
    readonly requestsLimit: number;
    readonly requestsUsed: number;
    readonly requestsRemaining: number;
  };
  readonly providerBreakdown: readonly DesktopListingsProviderBreakdown[];
  readonly recentListings: readonly DesktopListingsRecent[];
}

export interface DesktopAdminListingsAnalyticsError {
  readonly ok: false;
  readonly error: string;
}

export type DesktopAdminListingsAnalyticsApiResult =
  | DesktopAdminListingsAnalyticsResult
  | DesktopAdminListingsAnalyticsError;

export interface DesktopAdminDashboardStatsResult {
  readonly ok: true;
  readonly fetchedAt: string;
  readonly durationMs: number;
  readonly stats: {
    readonly funnel: {
      readonly totalListings: number;
      readonly totalLeads: number;
      readonly totalApplications: number;
      readonly interviewCount: number;
      readonly offerCount: number;
      readonly listingToLeadRate: number;
      readonly leadToAppRate: number;
      readonly appToInterviewRate: number;
      readonly interviewToOfferRate: number;
    };
    readonly activity24h: {
      readonly listings: number;
      readonly leads: number;
      readonly applications: number;
      readonly resumes: number;
      readonly notifications: number;
    };
    readonly trends: {
      readonly listings7d: number;
      readonly listings30d: number;
      readonly leads7d: number;
      readonly applications7d: number;
    };
    readonly pipeline: {
      readonly leadsApplied: number;
      readonly leadsDismissed: number;
      readonly leadsActive: number;
    };
    readonly resumeHealth: {
      readonly totalResumes: number;
      readonly analysesCompleted: number;
      readonly analysesFailed: number;
      readonly optimizationsCompleted: number;
      readonly avgScore: number;
    };
    readonly applications: {
      readonly total: number;
      readonly submitted: number;
      readonly pending: number;
      readonly failed: number;
      readonly automated: number;
      readonly manualCount: number;
    };
    readonly users: {
      readonly total: number;
      readonly new7d: number;
      readonly activeSessions: number;
      readonly activeSubscriptions: number;
      readonly latest: readonly {
        readonly id: string;
        readonly email: string;
        readonly name: string | null;
        readonly createdAt: string;
      }[];
    };
    readonly automation: {
      readonly scheduledApps: number;
      readonly auditLogs24h: number;
    };
    readonly budget: {
      readonly cycleStart: string;
      readonly cycleEnd: string;
      readonly jobsUsed: number;
      readonly jobsLimit: number;
      readonly requestsUsed: number;
      readonly requestsLimit: number;
      readonly projectedJobsUsed: number;
      readonly projectedRequestsUsed: number;
    };
    readonly providerDaily: Record<string, number>;
  };
}

export interface DesktopAdminDashboardStatsError {
  readonly ok: false;
  readonly error: string;
}

export type DesktopAdminDashboardStatsApiResult =
  | DesktopAdminDashboardStatsResult
  | DesktopAdminDashboardStatsError;

export interface DesktopListingsProviderRow {
  readonly provider: string;
  readonly label: string;
  readonly sourceSummary: string;
  readonly runtimeAvailable: boolean;
  readonly unavailableReason: string | null;
  readonly lastStatus: 'success' | 'error' | 'unknown';
  readonly lastError: string | null;
  readonly lastRunAt: string | null;
  readonly providerRuns: number;
  readonly failedRuns: number;
  readonly apiRequests: number;
  readonly jobsFetched: number;
  readonly jobsCreated: number;
  readonly jobsUpdated: number;
  readonly avgFetched: number;
  readonly avgCreated: number;
}

export interface DesktopAdminListingsProvidersResult {
  readonly ok: true;
  readonly fetchedAt: string;
  readonly durationMs: number;
  readonly providers: readonly DesktopListingsProviderRow[];
}

export interface DesktopAdminListingsProvidersError {
  readonly ok: false;
  readonly error: string;
}

export type DesktopAdminListingsProvidersApiResult =
  | DesktopAdminListingsProvidersResult
  | DesktopAdminListingsProvidersError;

export interface DesktopAdminProviderOverride {
  readonly insertAnyway?: boolean;
  readonly location?: string;
  readonly maxPages?: number;
  readonly mode?: 'sync' | 'weekly' | 'backfill';
  readonly postedWithin?: string;
  readonly remote?: boolean;
  readonly searchTerm?: string;
}

export interface DesktopAdminStartScrapeRequest {
  readonly providers?: readonly string[];
  readonly providerOverrides?: Record<string, DesktopAdminProviderOverride>;
  readonly searchTerm?: string;
  readonly city?: string;
  readonly country?: string;
  readonly stateCode?: string;
  readonly remote?: boolean;
  readonly globalDateRange?: string;
  readonly mode?: string;
  readonly maxPages?: number;
  readonly insertAnyway?: boolean;
}

export interface DesktopAdminStartScrapeResult {
  readonly ok: true;
  readonly scrapeId: string | null;
  readonly status: number;
}

export interface DesktopAdminStartScrapeError {
  readonly ok: false;
  readonly error: string;
  readonly status?: number;
}

export type DesktopAdminStartScrapeApiResult =
  | DesktopAdminStartScrapeResult
  | DesktopAdminStartScrapeError;

export interface DesktopAdminStopScrapeRequest {
  readonly scrapeId: string;
}

export interface DesktopAdminPauseScrapeRequest {
  readonly paused: boolean;
  readonly scrapeId: string;
}

export interface DesktopAdminStopScrapeResult {
  readonly ok: true;
  readonly status: number;
}

export interface DesktopAdminStopScrapeError {
  readonly ok: false;
  readonly error: string;
  readonly status?: number;
}

export type DesktopAdminStopScrapeApiResult =
  | DesktopAdminStopScrapeResult
  | DesktopAdminStopScrapeError;

export interface DesktopAdminScrapeProgressEvent {
  readonly id: string;
  readonly sequence: number;
  readonly kind: string;
  readonly payload: unknown;
  readonly emittedAt: string;
}

export interface DesktopAdminScrapeProgressDelta {
  readonly ok: true;
  readonly scrapeId: string;
  readonly status: string;
  readonly terminal?: boolean;
  readonly events?: readonly DesktopAdminScrapeProgressEvent[];
}

export interface DesktopAdminScrapeProgressDeltaError {
  readonly ok: false;
  readonly scrapeId: string;
  readonly error: string;
}

export type DesktopAdminScrapeProgressDeltaApi =
  | DesktopAdminScrapeProgressDelta
  | DesktopAdminScrapeProgressDeltaError;

export interface DesktopAdminSubscribeScrapeRequest {
  readonly scrapeId: string;
}

export interface DesktopAdminApi {
  readonly getDashboardStats: () => Promise<DesktopAdminDashboardStatsApiResult>;
  readonly getListingsAnalytics: () => Promise<DesktopAdminListingsAnalyticsApiResult>;
  readonly getListingsProviders: () => Promise<DesktopAdminListingsProvidersApiResult>;
  readonly getProviderRuns: (
    request: DesktopAdminProviderRunsRequest,
  ) => Promise<DesktopAdminProviderRunsApiResult>;
  readonly getSavedSearches: () => Promise<DesktopAdminSavedSearchesApiResult>;
  readonly saveSearch: (
    request: DesktopAdminSaveSearchRequest,
  ) => Promise<DesktopAdminSaveSearchApiResult>;
  readonly pauseScrape: (
    request: DesktopAdminPauseScrapeRequest,
  ) => Promise<DesktopAdminStopScrapeApiResult & { readonly paused?: boolean }>;
  readonly startScrape: (
    request: DesktopAdminStartScrapeRequest,
  ) => Promise<DesktopAdminStartScrapeApiResult>;
  readonly stopScrape: (
    request: DesktopAdminStopScrapeRequest,
  ) => Promise<DesktopAdminStopScrapeApiResult>;
  readonly subscribeScrape: (
    request: DesktopAdminSubscribeScrapeRequest,
  ) => Promise<{ ok: boolean; scrapeId?: string; error?: string }>;
  readonly unsubscribeScrape: (
    request: DesktopAdminSubscribeScrapeRequest,
  ) => Promise<{ ok: boolean; scrapeId?: string; error?: string }>;
  readonly onScrapeProgress: (
    callback: (delta: DesktopAdminScrapeProgressDeltaApi) => void,
  ) => () => void;
}

declare global {
  interface Window {
    readonly gimmeJobDesktop?: DesktopApi;
  }
}

export {};
