import {
  ApplicationStatus,
  type ApplicationSubmission,
  type Prisma,
} from '@/generated/prisma/browser';
import { db } from '@/lib/db/client';
import { revalidateTag } from '@/lib/cache/revalidate';
import { sendDataUpdate } from '@/lib/events/data-update';
import { DataEventType } from '@/types/events';
import { createApplicationStatusNotification } from '@/lib/notifications/application-notifications';

export interface ApplicationOutcome {
  status: ApplicationStatus;
  metadata?: Record<string, any>;
  notes?: string;
  createdBy?: string;
}

/**
 * Track an application outcome event
 */
export async function trackApplicationOutcome(
  submissionId: string,
  outcome: ApplicationOutcome,
): Promise<void> {
  const submission = await db.applicationSubmission.findUnique({
    where: { id: submissionId },
    include: { user: true },
  });

  if (!submission) {
    throw new Error('Application submission not found');
  }

  // Don't track if status hasn't changed
  if (submission.status === outcome.status) {
    return;
  }

  const now = new Date();
  const previousStatus = submission.status;

  // Calculate time metrics
  const daysSinceSubmission = submission.submittedAt
    ? Math.floor(
        (now.getTime() - submission.submittedAt.getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : null;

  // Determine if this is the first response
  const isFirstResponse =
    !submission.responseReceivedAt &&
    [
      ApplicationStatus.UNDER_REVIEW,
      ApplicationStatus.INTERVIEW_REQUESTED,
      ApplicationStatus.REJECTED,
      ApplicationStatus.NOT_SELECTED,
    ].includes(outcome.status);

  // Determine if this is a final outcome
  const isFinalOutcome = [
    ApplicationStatus.OFFER_ACCEPTED,
    ApplicationStatus.OFFER_REJECTED,
    ApplicationStatus.WITHDRAWN,
    ApplicationStatus.NOT_SELECTED,
    ApplicationStatus.REJECTED,
  ].includes(outcome.status);

  // Calculate interview count
  const interviewCount =
    outcome.status === ApplicationStatus.INTERVIEW_SCHEDULED
      ? submission.interviewCount + 1
      : submission.interviewCount;

  // Update submission with new outcome data
  await db.$transaction(async tx => {
    // Create outcome event
    await tx.applicationOutcomeEvent.create({
      data: {
        applicationSubmissionId: submissionId,
        eventType: getEventType(previousStatus, outcome.status),
        previousStatus,
        newStatus: outcome.status,
        metadata: outcome.metadata as Prisma.JsonValue,
        notes: outcome.notes,
        createdBy: outcome.createdBy || 'system',
      },
    });

    // Update submission
    await tx.applicationSubmission.update({
      where: { id: submissionId },
      data: {
        status: outcome.status,
        lastStatusChangeAt: now,
        interviewCount,
        daysSinceSubmission,
        ...(isFirstResponse && {
          responseReceivedAt: now,
          daysToResponse: daysSinceSubmission,
        }),
        ...(isFinalOutcome && {
          finalOutcomeAt: now,
          daysToFinalOutcome: daysSinceSubmission,
        }),
      },
    });
  });

  // Send real-time update
  sendDataUpdate({
    userId: submission.userId,
    type: DataEventType.ApplicationUpdate,
    data: {
      submissionId,
      status: outcome.status,
      previousStatus,
    },
  });

  // Create notification
  await createApplicationStatusNotification(
    submission.userId,
    submissionId,
    previousStatus,
    outcome.status,
  );

  // Revalidate cache
  revalidateTag(`user:${submission.userId}:applications`);
  revalidateTag(`user:${submission.userId}:analytics`);
}

/**
 * Get event type based on status change
 */
function getEventType(
  previousStatus: ApplicationStatus,
  newStatus: ApplicationStatus,
): string {
  if (newStatus === ApplicationStatus.UNDER_REVIEW) {
    return 'response_received';
  }
  if (
    newStatus === ApplicationStatus.INTERVIEW_REQUESTED ||
    newStatus === ApplicationStatus.INTERVIEW_SCHEDULED
  ) {
    return 'interview_scheduled';
  }
  if (newStatus === ApplicationStatus.INTERVIEW_COMPLETED) {
    return 'interview_completed';
  }
  if (newStatus === ApplicationStatus.OFFER_RECEIVED) {
    return 'offer_received';
  }
  if (newStatus === ApplicationStatus.OFFER_ACCEPTED) {
    return 'offer_accepted';
  }
  if (newStatus === ApplicationStatus.OFFER_REJECTED) {
    return 'offer_rejected';
  }
  if (newStatus === ApplicationStatus.WITHDRAWN) {
    return 'application_withdrawn';
  }
  if (
    newStatus === ApplicationStatus.NOT_SELECTED ||
    newStatus === ApplicationStatus.REJECTED
  ) {
    return 'application_rejected';
  }
  return 'status_change';
}

/**
 * Get application outcome history
 */
export async function getApplicationOutcomeHistory(submissionId: string) {
  return db.applicationOutcomeEvent.findMany({
    where: { applicationSubmissionId: submissionId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get user's application outcomes for analytics
 */
export async function getUserApplicationOutcomes(
  userId: string,
  filters?: {
    startDate?: Date;
    endDate?: Date;
    status?: ApplicationStatus[];
    wasAutomated?: boolean;
  },
) {
  const submissions = await db.applicationSubmission.findMany({
    where: {
      userId,
      ...(filters?.startDate && {
        submittedAt: { gte: filters.startDate },
      }),
      ...(filters?.endDate && {
        submittedAt: { lte: filters.endDate },
      }),
      ...(filters?.status && {
        status: { in: filters.status },
      }),
      ...(filters?.wasAutomated !== undefined && {
        wasAutomated: filters.wasAutomated,
      }),
    },
    include: {
      outcomeEvents: {
        orderBy: { createdAt: 'asc' },
      },
      jobLead: {
        include: {
          jobListing: true,
        },
      },
    },
    orderBy: { submittedAt: 'desc' },
  });

  return submissions;
}
