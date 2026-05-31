import { Prisma, NotificationCategory, NotificationChannel, NotificationPriority, NotificationStatus } from '@/generated/prisma/browser';

export { NotificationCategory, NotificationChannel, NotificationPriority, NotificationStatus };

/**
 * Supported notification event types.
 */
export type NotificationEventType =
  | 'APPLICATION_STATUS_CHANGED'
  | 'INTERVIEW_REQUESTED'
  | 'JOB_SEARCH_COMPLETED'
  | 'RESUME_ANALYSIS_COMPLETED'
  | 'AUTOMATION_EVENT'
  | 'SYSTEM_ALERT'
  | 'NETWORKING_REMINDER'
  | 'SHARE_ACTIVITY'
  | 'RESUME_FEEDBACK_PROVIDED';

/**
 * CTA data for actionable notifications.
 */
export interface NotificationAction {
  label: string;
  url: string;
}

/**
 * Base notification data
 */
export interface BaseNotification {
  id?: string;
  userId?: string | null;
  recipientEmail?: string | null;
  type: NotificationEventType;
  title: string;
  body: string;
  status: NotificationStatus;
  metadata?: Prisma.JsonValue;
  priority?: NotificationPriority;
  category?: NotificationCategory;
  channels?: NotificationChannel[];
  action?: NotificationAction;
  templateId?: string;
  createdAt?: Date;
  readAt?: Date | null;
  expiresAt?: Date | null;
}

/**
 * Application status notification metadata
 */
export interface ApplicationStatusNotificationMetadata {
  jobLeadId: string;
  jobTitle: string;
  companyName: string;
  previousStatus: string;
  newStatus: string;
  applicationId: string;
}

/**
 * Interview request notification metadata
 */
export interface InterviewRequestNotificationMetadata {
  jobLeadId: string;
  jobTitle: string;
  companyName: string;
  interviewDate?: string;
  interviewType?: string;
  interviewLocation?: string;
  contactPerson?: string;
}

/**
 * Job search completion notification metadata
 */
export interface JobSearchCompletionNotificationMetadata {
  searchId: string;
  searchQuery: string;
  jobsFound: number;
  newJobsAdded: number;
  platform: string;
  duration: number; // in seconds
  status: 'completed' | 'failed' | 'partial';
  errorMessage?: string;
}

/**
 * Resume analysis completion notification metadata
 */
export interface ResumeAnalysisNotificationMetadata {
  resumeId: string;
  resumeName: string;
  analysisType: 'ats' | 'keyword' | 'optimization';
  score?: number;
  suggestions: number;
  status: 'completed' | 'failed';
  errorMessage?: string;
}

/**
 * Automation event notification metadata
 */
export interface AutomationNotificationMetadata {
  automationType: 'application_submission' | 'job_search' | 'resume_analysis';
  status: 'started' | 'completed' | 'failed' | 'paused';
  itemsProcessed: number;
  totalItems: number;
  successCount: number;
  failureCount: number;
  duration?: number; // in seconds
  errorMessage?: string;
}

export interface NotificationMetadataMap {
  APPLICATION_STATUS_CHANGED: ApplicationStatusNotificationMetadata;
  INTERVIEW_REQUESTED: InterviewRequestNotificationMetadata;
  JOB_SEARCH_COMPLETED: JobSearchCompletionNotificationMetadata;
  RESUME_ANALYSIS_COMPLETED: ResumeAnalysisNotificationMetadata;
  AUTOMATION_EVENT: AutomationNotificationMetadata;
  NETWORKING_REMINDER: Record<string, unknown>;
  SHARE_ACTIVITY: Record<string, unknown>;
  RESUME_FEEDBACK_PROVIDED: Record<string, unknown>;
  SYSTEM_ALERT: Record<string, unknown>;
}

export type NotificationMetadata<T extends NotificationEventType> =
  NotificationMetadataMap[T];

export interface NotificationDraft<T extends NotificationEventType> {
  type: T;
  title: string;
  body: string;
  priority?: NotificationPriority;
  category?: NotificationCategory;
  channels?: NotificationChannel[];
  metadata?: NotificationMetadata<T>;
  action?: NotificationAction;
  expiresAt?: Date;
  templateId?: string;
}

export interface NotificationContext<T extends NotificationEventType> {
  userId: string;
  eventType: T;
  metadata: NotificationMetadata<T>;
  recipientEmail?: string | null;
  locale?: string;
}

export type NotificationBuilder<T extends NotificationEventType> = (
  context: NotificationContext<T>
) => Promise<NotificationDraft<T>>;

export interface NotificationPreferenceSetting {
  eventType: NotificationEventType;
  channel: NotificationChannel;
  enabled: boolean;
}

export interface NotificationPreferenceMap {
  [eventType: string]: Partial<Record<NotificationChannel, boolean>>;
}
