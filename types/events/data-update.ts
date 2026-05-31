import type { Event, EventType } from '@/types/events';
import type { JobLeadOptimizationProgressPayload } from '@/types/job-lead/event';
import type { JobSearchProgressPayload } from '@/types/job-search/event';
import type {
  ResumeAnalysisProgressPayload,
  ResumeOptimizationProgressPayload,
} from '@/types/resumes';

export enum DataEventType {
  ADMIN_SCRAPE_PROGRESS = 'admin-scrape-progress',
  ADMIN_SCRAPE_REQUEST_LOG = 'admin-scrape-request-log',
  ASSIST_TRAINING_PROGRESS = 'assist-training-progress',
  INBOX_EMAIL_RECEIVED = 'inbox-email-received',
  INBOX_VERIFICATION_CODE = 'inbox-verification-code',
  JOB_LEAD_OPTIMIZATION_PROGRESS = 'job-lead-optimization-progress',
  JOB_SEARCH_PROGRESS = 'job-search-progress',
  JOB_SEARCH_UPDATED = 'job-search-updated',
  LIVE_SEARCH_UPDATE = 'live-search-update',
  RESUME_ANALYSIS_PROGRESS = 'resume-analysis-progress',
  RESUME_OPTIMIZATION_PROGRESS = 'resume-optimization-progress',
  INTERVIEWER_RESEARCH_PROGRESS = 'interviewer-research-progress',
  TEST = 'test',
}

export interface AssistTrainingProgressPayload {
  sessionId: string;
  status: string;
  hostname: string;
  completedSteps: number;
  totalSteps: number;
  progress: number;
  observationsCreated: number;
  rulesPromoted: number;
  error?: string | null;
  completedAt?: string | null;
  stepLogs?: Record<string, unknown>[];
}

export interface AdminScrapePersistBreakdown {
  /** Rows dropped because the same jobId appeared twice in the fetched batch. */
  inBatchDuplicate: number;
  /** Rows dropped by cross-source remote-feed dedupe (applyUrl / title+company). */
  crossFeedDuplicate: number;
  /** Rows dropped because the jobId already exists for this user and updateExisting=false. */
  alreadyExistsSameUser: number;
  /** Rows that Prisma createMany({ skipDuplicates: true }) rejected at the DB boundary. */
  dbSkipDuplicates: number;
}

export interface AdminScrapeUpdatedListingPreview {
  applyUrl?: string | null;
  changedFields?: {
    field: string;
    from: string | null;
    to: string | null;
  }[];
  company?: string | null;
  jobProvider?: string | null;
  location?: string | null;
  postedAt?: string | null;
  reason?: string;
  source?: string | null;
  title: string;
}

export interface AdminScrapeProgressPayload {
  scrapeId: string;
  provider: string;
  mode: 'backfill' | 'sync' | 'weekly';
  status: 'starting' | 'fetching' | 'persisting' | 'complete' | 'error';
  currentPage: number;
  totalPages: number;
  jobsFetched: number;
  jobsCreated: number;
  jobsUpdated: number;
  jobsSkipped: number;
  /** Per-reason breakdown of jobs fetched but not persisted. Fields are
   *  independent - the numbers do NOT always sum to (fetched - created -
   *  updated - skipped) because `skipped` already counts some of them
   *  (cross-user collisions, no-change updates). Surfaced to the live
   *  progress UI so the 91 fetched -> 8 created gap is explicable. */
  persistBreakdown?: AdminScrapePersistBreakdown;
  diagnostics?: {
    duplicateOrExisting?: number;
    filteredOut?: number;
    invalidListing?: number;
    matchedForInsert?: number;
    missingApplyUrl?: number;
    reasons?: string[];
    sourceReturned?: number;
    updatedExisting?: number;
  };
  rateLimit?: {
    jobsRemaining?: number;
    jobsLimit?: number;
    requestsRemaining?: number;
    requestsLimit?: number;
  };
  message: string;
  error?: string;
  recentCreatedListings?: AdminScrapeUpdatedListingPreview[];
  recentRejectedListings?: AdminScrapeUpdatedListingPreview[];
  recentUpdatedListings?: AdminScrapeUpdatedListingPreview[];
  requestLog?: {
    page: number;
    requestUrl: string;
    responseBodyPreview: string;
    responseStatus: number;
    timestamp: string;
  };
  startedAt: string;
  elapsed?: number;
}

export interface AdminScrapeRequestLogPayload {
  requestLog: NonNullable<AdminScrapeProgressPayload['requestLog']>;
  scrapeId: string;
}

export interface InboxEmailRow {
  id: string;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  receivedAt: string;
  status: string;
  detectedStatus: string | null;
  detectedCompany: string | null;
  detectedJobTitle: string | null;
  textBody: string | null;
  jobLeadId: string | null;
  jobLeadTitle: string | null;
  jobLeadCompany: string | null;
  submissionId: string | null;
  submissionStatus: string | null;
}

export interface InboxEmailReceivedPayload {
  email: InboxEmailRow;
}

export interface InboxVerificationCodePayload {
  code: string;
  emailId: string;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  receivedAt: string;
}

export interface LiveSearchUpdatePayload {
  searchId: string;
  jobs: unknown[];
  page: number;
  totalPages: number;
  totalJobsSoFar: number;
  isComplete: boolean;
  nextPageToken?: string | null;
  hasMorePages?: boolean;
}

export type DataEventPayload =
  | {
      data: JobSearchProgressPayload;
      type?: DataEventType.JOB_SEARCH_PROGRESS;
    }
  | {
      data: JobLeadOptimizationProgressPayload;
      type: DataEventType.JOB_LEAD_OPTIMIZATION_PROGRESS;
    }
  | {
      data: ResumeAnalysisProgressPayload;
      type: DataEventType.RESUME_ANALYSIS_PROGRESS;
    }
  | {
      data: ResumeOptimizationProgressPayload;
      type: DataEventType.RESUME_OPTIMIZATION_PROGRESS;
    }
  | {
      data: any;
      type: DataEventType.INTERVIEWER_RESEARCH_PROGRESS;
    }
  | {
      data: LiveSearchUpdatePayload;
      type: DataEventType.LIVE_SEARCH_UPDATE;
    }
  | {
      data: AdminScrapeProgressPayload;
      type: DataEventType.ADMIN_SCRAPE_PROGRESS;
    }
  | {
      data: AdminScrapeRequestLogPayload;
      type: DataEventType.ADMIN_SCRAPE_REQUEST_LOG;
    }
  | {
      data: AssistTrainingProgressPayload;
      type: DataEventType.ASSIST_TRAINING_PROGRESS;
    }
  | {
      data: InboxEmailReceivedPayload;
      type: DataEventType.INBOX_EMAIL_RECEIVED;
    }
  | {
      data: InboxVerificationCodePayload;
      type: DataEventType.INBOX_VERIFICATION_CODE;
    }
  | {
      data: unknown;
      type: DataEventType.TEST;
    };

export type DataEvent = Event<EventType.DataUpdate, DataEventPayload>;
