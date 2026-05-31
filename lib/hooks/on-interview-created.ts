import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db/client';
import { createInterviewSessionForUser } from '@/lib/interviews/generate';
import {
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
} from '@/lib/notifications/types';
import { createNotification } from '@/lib/notifications';

export interface InterviewCreatedEvent {
  readonly applicationSubmissionId?: string | null;
  readonly emailId?: string | null;
  readonly interviewDate?: string | null;
  readonly interviewType?: string | null;
  readonly jobLeadId: string;
  readonly source: string;
  readonly userId: string;
}

export interface InterviewPrepHandoffResult {
  readonly alreadyPrepared: boolean;
  readonly notificationId: string | null;
  readonly sessionId: string;
}

function getNotificationId(notification: unknown): string | null {
  if (!notification || typeof notification !== 'object') return null;

  const candidate = notification as { readonly id?: unknown };
  return typeof candidate.id === 'string' ? candidate.id : null;
}

export async function onInterviewCreated(
  event: InterviewCreatedEvent,
): Promise<InterviewPrepHandoffResult | null> {
  const jobLead = await db.jobLead.findFirst({
    include: { jobListing: true },
    where: {
      id: event.jobLeadId,
      userId: event.userId,
    },
  });

  if (!jobLead) return null;

  const existingSession = event.emailId
    ? await db.interviewSession.findUnique({
        select: { id: true },
        where: { sourceEmailId: event.emailId },
      })
    : null;

  if (existingSession) {
    return {
      alreadyPrepared: true,
      notificationId: null,
      sessionId: existingSession.id,
    };
  }

  const companyName = jobLead.jobListing.company || 'Unknown Company';
  const jobTitle = jobLead.jobListing.title || jobLead.title;
  const metadata = {
    applicationSubmissionId: event.applicationSubmissionId ?? null,
    companyName,
    interviewDate: event.interviewDate ?? null,
    interviewType: event.interviewType ?? null,
    jobLeadId: event.jobLeadId,
    jobTitle,
    source: event.source,
    sourceEmailId: event.emailId ?? null,
  } satisfies Prisma.InputJsonObject;

  const sessionId = await createInterviewSessionForUser(event.userId, {
    count: 5,
    jobLeadId: event.jobLeadId,
    metadata,
    sessionName: `Interview Prep - ${jobTitle}`,
    source: event.source,
    sourceEmailId: event.emailId ?? undefined,
  });

  const notification = await createNotification({
    action: {
      label: 'Practice interview',
      url: `/interviews/simulate?jobLeadId=${event.jobLeadId}`,
    },
    body: `Prep questions are ready for ${jobTitle} at ${companyName}.`,
    category: NotificationCategory.INTERVIEW_REQUEST,
    channels: [NotificationChannel.IN_APP],
    metadata: {
      ...metadata,
      interviewSessionId: sessionId,
    },
    priority: NotificationPriority.URGENT,
    status: NotificationStatus.PENDING,
    title: `Interview prep ready: ${jobTitle}`,
    type: 'INTERVIEW_REQUESTED',
    userId: event.userId,
  });

  return {
    alreadyPrepared: false,
    notificationId: getNotificationId(notification),
    sessionId,
  };
}
