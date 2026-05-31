import {
  ApplicationStatus,
  type Prisma,
  type Resume,
  type CoverLetter,
} from '@/generated/prisma/browser';
import { revalidateTag } from '@/lib/cache/revalidate';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';
import { getPrivateUserChannel } from '@/lib/events/channels';
import { sendDataUpdate } from '@/lib/events/data-update';
import { sendNotification } from '@/lib/events/notifications';
import { createApplicationStatusNotification } from '@/lib/notifications/application-notifications';
import { DataEventType } from '@/types/events';
import { submitToJobBoard } from './services';

// Re-export for components
export { submitToJobBoard };
// axios removed - using native fetch instead

// Rate limiting configuration
const RATE_LIMITS = {
  APPLICATIONS_PER_HOUR: 10,
  APPLICATIONS_PER_DAY: 50,
  MIN_INTERVAL_MINUTES: 5, // Minimum time between applications
} as const;

// Safety configuration
const SAFETY_CHECKS = {
  REQUIRE_USER_APPROVAL: true,
  MAX_RETRIES: 3,
  TIMEOUT_MS: 30000, // 30 seconds
} as const;

export interface ApplicationSubmissionOptions {
  jobLeadId: string;
  resumeId?: string;
  coverLetterId?: string;
  customFields?: Record<string, any>;
  userApproved?: boolean;
  skipSafetyChecks?: boolean; // Only for manual applications
}

export interface ApplicationSubmissionResult {
  success: boolean;
  submissionId?: string;
  error?: string;
  requiresApproval?: boolean;
  nextAvailableTime?: Date;
}

/**
 * Check if user has exceeded rate limits for application submissions
 */
async function checkRateLimits(userId: string): Promise<{
  canSubmit: boolean;
  nextAvailableTime?: Date;
  reason?: string;
}> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const minIntervalAgo = new Date(
    now.getTime() - RATE_LIMITS.MIN_INTERVAL_MINUTES * 60 * 1000,
  );

  // Check applications in the last hour
  const hourlyCount = await db.applicationSubmission.count({
    where: {
      userId,
      createdAt: { gte: oneHourAgo },
      status: { not: ApplicationStatus.FAILED },
    },
  });

  if (hourlyCount >= RATE_LIMITS.APPLICATIONS_PER_HOUR) {
    return {
      canSubmit: false,
      nextAvailableTime: new Date(oneHourAgo.getTime() + 60 * 60 * 1000),
      reason: `Exceeded hourly limit of ${RATE_LIMITS.APPLICATIONS_PER_HOUR} applications`,
    };
  }

  // Check applications in the last day
  const dailyCount = await db.applicationSubmission.count({
    where: {
      userId,
      createdAt: { gte: oneDayAgo },
      status: { not: ApplicationStatus.FAILED },
    },
  });

  if (dailyCount >= RATE_LIMITS.APPLICATIONS_PER_DAY) {
    return {
      canSubmit: false,
      nextAvailableTime: new Date(oneDayAgo.getTime() + 24 * 60 * 60 * 1000),
      reason: `Exceeded daily limit of ${RATE_LIMITS.APPLICATIONS_PER_DAY} applications`,
    };
  }

  // Check minimum interval between applications
  const lastSubmission = await db.applicationSubmission.findFirst({
    where: {
      userId,
      status: { not: ApplicationStatus.FAILED },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (lastSubmission && lastSubmission.createdAt > minIntervalAgo) {
    return {
      canSubmit: false,
      nextAvailableTime: new Date(
        lastSubmission.createdAt.getTime() +
          RATE_LIMITS.MIN_INTERVAL_MINUTES * 60 * 1000,
      ),
      reason: `Must wait ${RATE_LIMITS.MIN_INTERVAL_MINUTES} minutes between applications`,
    };
  }

  return { canSubmit: true };
}

/**
 * Perform safety checks before submitting an application
 */
async function performSafetyChecks(
  jobLeadId: string,
  userId: string,
): Promise<{ safe: boolean; reason?: string }> {
  // Check if application already exists for this job lead
  const existingApplication = await db.applicationSubmission.findFirst({
    where: {
      jobLeadId,
      userId,
      status: { in: [ApplicationStatus.SUBMITTED, ApplicationStatus.PENDING] },
    },
  });

  if (existingApplication) {
    return {
      safe: false,
      reason: 'Application already submitted for this job',
    };
  }

  // Verify job lead exists and belongs to user
  const jobLead = await db.jobLead.findFirst({
    where: {
      id: jobLeadId,
      userId,
    },
    include: {
      jobListing: true,
    },
  });

  if (!jobLead) {
    return {
      safe: false,
      reason: 'Job lead not found or access denied',
    };
  }

  // Check if job listing has necessary application information
  if (!jobLead.jobListing.applyOptions) {
    return {
      safe: false,
      reason: 'No application options available for this job',
    };
  }

  return { safe: true };
}

/**
 * Create application submission record
 */
async function createApplicationRecord(
  options: ApplicationSubmissionOptions,
  userId: string,
  wasAutomated: boolean = true,
): Promise<string> {
  const submission = await db.applicationSubmission.create({
    data: {
      jobLeadId: options.jobLeadId,
      userId,
      resumeId: options.resumeId,
      status: ApplicationStatus.PENDING,
      wasAutomated,
      userAgent: wasAutomated ? 'gimme-job-automation/1.0' : undefined,
      metadata: {
        customFields: options.customFields || {},
        coverLetterId: options.coverLetterId,
      },
    },
  });

  return submission.id;
}

/**
 * Update application status and metadata
 */
async function updateApplicationStatus(
  submissionId: string,
  status: ApplicationStatus,
  metadata?: Record<string, any>,
  errorMessage?: string,
): Promise<void> {
  // Get previous application status for notification
  const previousApplication = await db.applicationSubmission.findUnique({
    where: { id: submissionId },
  });

  const previousStatus = previousApplication?.status;

  // Update application status in database
  await db.applicationSubmission.update({
    where: { id: submissionId },
    data: {
      status,
      ...(metadata ? { metadata: metadata as Prisma.JsonValue } : {}),
      ...(errorMessage ? { errorMessage } : {}),
      ...(status === ApplicationStatus.SUBMITTED
        ? {
            submittedAt: new Date(),
          }
        : {}),
    },
  });

  // Send event for status update
  const submission = await db.applicationSubmission.findUnique({
    where: { id: submissionId },
    include: { user: true },
  });

  if (submission) {
    // Send data update for real-time UI updates
    sendDataUpdate({
      userId: submission.userId,
      type: DataEventType.ApplicationUpdate,
      data: { submissionId, status },
    });

    // Create a structured notification for the status change if the status actually changed
    if (previousStatus && previousStatus !== status) {
      await createApplicationStatusNotification(
        submission.userId,
        submissionId,
        previousStatus,
        status,
      );
    }
  }
}

/**
 * Update job lead status to APPLIED when application is submitted
 */
async function updateJobLeadStatus(jobLeadId: string): Promise<void> {
  await db.jobLead.update({
    where: { id: jobLeadId },
    data: {
      status: 'APPLIED',
    },
  });
}

/**
 * Submit job application with rate limiting and safety checks
 */
export async function submitApplication(
  options: ApplicationSubmissionOptions,
): Promise<ApplicationSubmissionResult> {
  const user = await getCurrentUser();
  const userChannel = getPrivateUserChannel(user.id);

  // Check rate limits
  const rateLimitCheck = await checkRateLimits(user.id);
  if (!rateLimitCheck.canSubmit) {
    return {
      success: false,
      error: rateLimitCheck.reason,
      nextAvailableTime: rateLimitCheck.nextAvailableTime,
    };
  }

  // Perform safety checks if not skipped
  if (!options.skipSafetyChecks) {
    const safetyCheck = await performSafetyChecks(options.jobLeadId, user.id);
    if (!safetyCheck.safe) {
      return {
        success: false,
        error: safetyCheck.reason,
      };
    }
  }

  // Check if user approval is required but not provided
  if (SAFETY_CHECKS.REQUIRE_USER_APPROVAL && !options.userApproved) {
    return {
      success: false,
      requiresApproval: true,
      error: 'User approval required before submitting application',
    };
  }

  try {
    // Create application submission record
    const submissionId = await createApplicationRecord(options, user.id);

    // Fetch job lead and related job listing data
    const jobLead = await db.jobLead.findUnique({
      where: { id: options.jobLeadId },
      include: { jobListing: true },
    });

    if (!jobLead || !jobLead.jobListing) {
      throw new Error('Job listing not found');
    }

    // Get resume data if resumeId is provided
    let resumeData: Buffer | undefined;
    if (options.resumeId) {
      const resume = await db.resume.findUnique({
        where: { id: options.resumeId },
      });

      const resumeRevision =
        user.defaultRevisionId && resume
          ? await db.resumeRevision.findFirst({
              select: { pdfDocumentUrl: true },
              where: {
                id: user.defaultRevisionId,
                resumeId: resume.id,
              },
            })
          : null;
      const resumeUrl = user.defaultRevisionId
        ? resumeRevision?.pdfDocumentUrl || resume?.url
        : resume?.url;

      if (resumeUrl) {
        try {
          const response = await fetch(resumeUrl);
          if (!response.ok)
            throw new Error(`HTTP error! status: ${response.status}`);
          const arrayBuffer = await response.arrayBuffer();
          resumeData = Buffer.from(arrayBuffer);
        } catch (error) {
          console.error('Failed to fetch resume file:', error);
        }
      }
    }

    // Get cover letter data if coverLetterId is provided
    let coverLetterData: Buffer | undefined;
    if (options.coverLetterId) {
      const coverLetter = await db.coverLetter.findUnique({
        where: { id: options.coverLetterId },
      });

      // Get content from markdown or URL if available
      if (coverLetter?.markdown) {
        coverLetterData = Buffer.from(coverLetter.markdown);
      } else if (coverLetter?.json) {
        // Convert JSON to string if that's how cover letters are stored
        const jsonContent = JSON.stringify(coverLetter.json);
        coverLetterData = Buffer.from(jsonContent);
      }
    }

    // Submit application to job board
    const submissionResult = await submitToJobBoard(
      jobLead.jobListing.jobProvider,
      {
        jobId: jobLead.jobListing.jobId || '',
        jobUrl:
          jobLead.jobListing.applyUrl || jobLead.jobListing.externalUrl || '',
        resumeData,
        coverLetterData,
        customFields: {
          ...options.customFields,
          // Add any user profile info that might be needed
          // This would typically come from the user's profile
        },
      },
    );

    // Update application status based on submission result
    await updateApplicationStatus(
      submissionId,
      submissionResult.success
        ? ApplicationStatus.SUBMITTED
        : ApplicationStatus.FAILED,
      submissionResult.success
        ? {
            submissionDetails: {
              method: 'api',
              timestamp: new Date().toISOString(),
              confirmationCode: submissionResult.confirmationCode,
              metadata: submissionResult.metadata,
            },
          }
        : undefined,
      submissionResult.success ? undefined : submissionResult.error,
    );

    // Update job lead status
    await updateJobLeadStatus(options.jobLeadId);

    // Revalidate cache tags
    revalidateTag(`user:${user.id}:job-leads`);
    revalidateTag(`user:${user.id}:applications`);

    // Send notification to user
    sendNotification({
      channel: userChannel,
      payload: {
        title: 'Application Submitted',
        description: 'Your job application has been successfully submitted.',
        type: 'success',
        duration: 5000,
      },
    });

    return {
      success: true,
      submissionId,
    };
  } catch (error) {
    console.error('Application submission error:', error);

    // Update application status to failed
    if (options.jobLeadId) {
      try {
        const failedSubmission = await db.applicationSubmission.findFirst({
          where: {
            jobLeadId: options.jobLeadId,
            userId: user.id,
            status: ApplicationStatus.PENDING,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (failedSubmission) {
          await updateApplicationStatus(
            failedSubmission.id,
            ApplicationStatus.FAILED,
            undefined,
            error instanceof Error ? error.message : 'Unknown error',
          );
        }
      } catch (updateError) {
        console.error('Failed to update application status:', updateError);
      }
    }

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Application submission failed',
    };
  }
}

/**
 * Queue application for submission (for automated batch processing)
 */
export async function queueApplication(
  options: ApplicationSubmissionOptions,
): Promise<ApplicationSubmissionResult> {
  const user = await getCurrentUser();

  // Perform basic validation
  if (!options.jobLeadId) {
    return {
      success: false,
      error: 'Job lead ID is required',
    };
  }

  try {
    // Create pending application record
    const submissionId = await createApplicationRecord(
      options,
      user.id,
      true, // wasAutomated = true
    );

    return {
      success: true,
      submissionId,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to queue application',
    };
  }
}
