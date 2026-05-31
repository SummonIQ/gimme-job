import { db } from '@/lib/db/client';
import { analyzeApplicationEmail } from '@/lib/email/analyze-email';
import { extractVerificationCode } from '@/lib/email/verification-code';
import { getPrivateUserChannel } from '@/lib/events/channels';
import { sendDataUpdate } from '@/lib/events/data-update';
import { ApplicationStatus, JobLeadStatus } from '@/generated/prisma/browser';
import { DataEventType } from '@/types/events';
import { NextRequest, NextResponse } from 'next/server';

/**
 * ImprovMX webhook IPs for request verification. ImprovMX publishes a
 * small set of egress IPs; all incoming webhooks must originate from one
 * of these. We hard-code the documented list and additionally honor
 * `IMPROVMX_WEBHOOK_ALLOWED_IPS` (comma-separated env var) for cases
 * where ImprovMX rolls out a new IP before this list is updated.
 *
 * If you're seeing emails arrive in regular mail clients but never in
 * the in-app inbox, this allowlist is the most common cause — toggle
 * on `IMPROVMX_WEBHOOK_LOG_ONLY=true` in env to bypass the check while
 * still logging every incoming origin so the IP can be added back.
 *
 * See: https://improvmx.com/guides/webhooks
 */
const IMPROVMX_WEBHOOK_IPS: readonly string[] = [
  '15.237.103.194',
  // Older / regional egress points seen in production webhook logs.
  '15.236.30.85',
  '15.236.197.206',
  '15.237.16.157',
  '15.237.93.230',
];

function getAllowedWebhookIps(): Set<string> {
  const fromEnv = (process.env.IMPROVMX_WEBHOOK_ALLOWED_IPS ?? '')
    .split(',')
    .map(ip => ip.trim())
    .filter(Boolean);
  return new Set([...IMPROVMX_WEBHOOK_IPS, ...fromEnv]);
}

interface ImprovMXWebhookPayload {
  headers: Record<string, string | string[]>;
  to: Array<{ name: string; email: string }>;
  from: { name: string; email: string };
  subject: string;
  'message-id': string;
  date: string;
  'return-path': { name: string | null; email: string };
  timestamp: number;
  text: string | null;
  html: string | null;
  inlines?: Array<{ type: string; name: string; content: string; cid: string }>;
  attachments?: Array<{
    type: string;
    name: string;
    content: string;
    encoding: string;
  }>;
}

type EmailAnalysis = Awaited<ReturnType<typeof analyzeApplicationEmail>>;

interface MatchedApplicationContext {
  jobLeadId: string | null;
  submissionId: string | null;
}

const statusOrder: readonly JobLeadStatus[] = [
  JobLeadStatus.ADDED,
  JobLeadStatus.ANALYZING,
  JobLeadStatus.ANALYZED,
  JobLeadStatus.OPTIMIZING,
  JobLeadStatus.OPTIMIZED,
  JobLeadStatus.APPLYING,
  JobLeadStatus.APPLIED,
  JobLeadStatus.ADVANCED,
  JobLeadStatus.INTERVIEW_SCHEDULED,
  JobLeadStatus.INTERVIEW_COMPLETED,
  JobLeadStatus.OFFER,
  JobLeadStatus.HIRED,
  JobLeadStatus.REJECTED,
  JobLeadStatus.REMOVED,
  JobLeadStatus.ANALYSIS_FAILED,
  JobLeadStatus.OPTIMIZATION_FAILED,
  JobLeadStatus.INTERVIEW_CANCELLED,
  JobLeadStatus.INTERVIEWED_NOT_SELECTED,
  JobLeadStatus.OFFER_DECLINED,
] as const;

function mapAnalysisToApplicationStatus(
  analysis: EmailAnalysis,
): ApplicationStatus | null {
  switch (analysis.status) {
    case 'APPLICATION_RECEIVED':
      return ApplicationStatus.SUBMITTED;
    case 'APPLICATION_REJECTED':
      return ApplicationStatus.REJECTED;
    case 'INTERVIEW_FOLLOWUP':
    case 'ASSESSMENT_REQUEST':
      return ApplicationStatus.INTERVIEW_REQUESTED;
    case 'INTERVIEW_SCHEDULED':
      return ApplicationStatus.INTERVIEW_SCHEDULED;
    case 'OFFER_MADE':
      return ApplicationStatus.OFFER_RECEIVED;
    case 'OFFER_REJECTED':
      return ApplicationStatus.OFFER_REJECTED;
    case 'GENERAL_UPDATE':
      return ApplicationStatus.UNDER_REVIEW;
    default:
      return null;
  }
}

function mapAnalysisToJobLeadStatus(
  analysis: EmailAnalysis,
): JobLeadStatus | null {
  switch (analysis.status) {
    case 'APPLICATION_RECEIVED':
      return JobLeadStatus.APPLIED;
    case 'APPLICATION_REJECTED':
      return JobLeadStatus.REJECTED;
    case 'INTERVIEW_FOLLOWUP':
    case 'ASSESSMENT_REQUEST':
      return JobLeadStatus.ADVANCED;
    case 'INTERVIEW_SCHEDULED':
      return JobLeadStatus.INTERVIEW_SCHEDULED;
    case 'OFFER_MADE':
      return JobLeadStatus.OFFER;
    case 'OFFER_REJECTED':
      return JobLeadStatus.OFFER_DECLINED;
    case 'GENERAL_UPDATE':
      return JobLeadStatus.ADVANCED;
    default:
      return null;
  }
}

function shouldAdvanceJobLead(
  currentStatus: JobLeadStatus,
  nextStatus: JobLeadStatus,
): boolean {
  if (nextStatus === JobLeadStatus.REJECTED) {
    return currentStatus !== JobLeadStatus.REJECTED;
  }

  return statusOrder.indexOf(nextStatus) > statusOrder.indexOf(currentStatus);
}

async function pushInboxEmailUpdate(
  emailId: string,
  userId: string,
): Promise<void> {
  const email = await db.applicationEmail.findUnique({
    where: { id: emailId },
    include: {
      jobLead: {
        select: {
          id: true,
          jobListing: { select: { title: true, company: true } },
        },
      },
      applicationSubmission: { select: { id: true, status: true } },
    },
  });
  if (!email) return;

  await sendDataUpdate({
    channel: getPrivateUserChannel(userId),
    payload: {
      data: {
        email: {
          id: email.id,
          fromEmail: email.fromEmail,
          fromName: email.fromName,
          subject: email.subject,
          receivedAt: email.receivedAt.toISOString(),
          status: email.status,
          detectedStatus: email.detectedStatus,
          detectedCompany: email.detectedCompany,
          detectedJobTitle: email.detectedJobTitle,
          textBody: email.textBody,
          jobLeadId: email.jobLeadId,
          jobLeadTitle: email.jobLead?.jobListing?.title ?? null,
          jobLeadCompany: email.jobLead?.jobListing?.company ?? null,
          submissionId: email.applicationSubmissionId,
          submissionStatus: email.applicationSubmission?.status ?? null,
        },
      },
      type: DataEventType.INBOX_EMAIL_RECEIVED,
    },
  });
}

async function findMatchingApplicationContext(
  userId: string,
  analysis: EmailAnalysis,
): Promise<MatchedApplicationContext> {
  const searchTerms = [analysis.companyName, analysis.jobTitle].filter(
    (value): value is string => Boolean(value?.trim()),
  );

  if (searchTerms.length === 0) {
    return {
      jobLeadId: null,
      submissionId: null,
    };
  }

  const textFilters = searchTerms.map(term => ({
    contains: term,
    mode: 'insensitive' as const,
  }));
  const companyMatchClauses = textFilters.map(filter => ({
    jobLead: {
      jobListing: {
        company: filter,
      },
    },
  }));
  const jobListingTitleMatchClauses = textFilters.map(filter => ({
    jobLead: {
      jobListing: {
        title: filter,
      },
    },
  }));
  const leadTitleMatchClauses = textFilters.map(filter => ({
    jobLead: {
      title: filter,
    },
  }));

  const matchingSubmission = await db.applicationSubmission.findFirst({
    where: {
      userId,
      OR: [
        ...companyMatchClauses,
        ...jobListingTitleMatchClauses,
        ...leadTitleMatchClauses,
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      jobLeadId: true,
    },
  });

  if (matchingSubmission) {
    return {
      jobLeadId: matchingSubmission.jobLeadId,
      submissionId: matchingSubmission.id,
    };
  }

  const matchingLead = await db.jobLead.findFirst({
    where: {
      userId,
      OR: [
        ...textFilters.map(filter => ({
          jobListing: {
            company: filter,
          },
        })),
        ...textFilters.map(filter => ({
          jobListing: {
            title: filter,
          },
        })),
        ...textFilters.map(filter => ({
          title: filter,
        })),
      ],
    },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });

  return {
    jobLeadId: matchingLead?.id ?? null,
    submissionId: null,
  };
}

/**
 * POST /api/webhooks/improvmx
 * Receives incoming emails forwarded by ImprovMX for application tracking.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify the request comes from ImprovMX (optional in dev). ALWAYS
    // log the incoming origin so when IPs shift we can spot it in logs
    // and add the new IP via IMPROVMX_WEBHOOK_ALLOWED_IPS without a
    // redeploy. Set IMPROVMX_WEBHOOK_LOG_ONLY=true to disable the check
    // while we wait for the new IP to be confirmed.
    const forwardedFor =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
    const realIp = request.headers.get('x-real-ip') ?? '';
    const originIp = forwardedFor || realIp || '(unknown)';
    const sharedSecretHeader =
      request.headers.get('x-improvmx-secret') ??
      request.headers.get('x-webhook-secret') ??
      '';
    const expectedSecret = process.env.IMPROVMX_WEBHOOK_SECRET ?? '';
    const secretMatched =
      Boolean(expectedSecret) && sharedSecretHeader === expectedSecret;

    console.info(
      `[IMPROVMX WEBHOOK] received from ip=${originIp} secret_supplied=${Boolean(sharedSecretHeader)} secret_match=${secretMatched}`,
    );

    if (
      process.env.NODE_ENV === 'production' &&
      process.env.IMPROVMX_WEBHOOK_LOG_ONLY !== 'true'
    ) {
      const allowedIps = getAllowedWebhookIps();
      const ipAllowed =
        allowedIps.has(forwardedFor) || allowedIps.has(realIp);
      if (!ipAllowed && !secretMatched) {
        console.warn(
          `[IMPROVMX WEBHOOK] Rejected: ip=${originIp} not in allowlist and no shared-secret match. Add it to IMPROVMX_WEBHOOK_ALLOWED_IPS or set IMPROVMX_WEBHOOK_LOG_ONLY=true if this is genuinely from ImprovMX.`,
        );
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const payload = (await request.json()) as ImprovMXWebhookPayload;

    // Extract the alias from the "to" address
    const toEmail = payload.to?.[0]?.email;
    if (!toEmail) {
      console.error('[IMPROVMX WEBHOOK] No recipient email in payload');
      return NextResponse.json(
        { error: 'No recipient email' },
        { status: 400 },
      );
    }

    const alias = toEmail.split('@')[0];

    // Find the user by their tracking email alias
    const user = await db.user.findFirst({
      where: { trackingEmailAlias: alias },
      select: { id: true, email: true },
    });

    if (!user) {
      console.warn(`[IMPROVMX WEBHOOK] No user found for alias: ${alias}`);
      return NextResponse.json({ success: true });
    }

    // Check for duplicate message
    const messageId = payload['message-id'];
    if (messageId) {
      const existing = await db.applicationEmail.findUnique({
        where: { messageId },
      });
      if (existing) {
        console.log(
          `[IMPROVMX WEBHOOK] Duplicate message ignored: ${messageId}`,
        );
        return NextResponse.json({ success: true });
      }
    }

    // Store the incoming email
    const applicationEmail = await db.applicationEmail.create({
      data: {
        userId: user.id,
        fromEmail: payload.from.email,
        fromName: payload.from.name || null,
        toEmail,
        subject: payload.subject,
        textBody: payload.text || null,
        htmlBody: payload.html || null,
        messageId: messageId || null,
        receivedAt: payload.timestamp
          ? new Date(payload.timestamp * 1000)
          : new Date(),
        status: 'ANALYZING',
      },
    });

    // Detect a one-time verification code as cheaply as possible
    // (regex over the body, no AI call). If found, push it on the
    // user channel right away so the toast shows up before the
    // multi-second AI analysis completes — the user can copy the
    // code immediately and paste it into the form they're filling.
    const verificationBody = [payload.text, payload.html]
      .filter((value): value is string => Boolean(value?.trim()))
      .join('\n');
    const verification = extractVerificationCode(
      verificationBody || null,
      payload.subject,
    );
    if (verification) {
      void sendDataUpdate({
        channel: getPrivateUserChannel(user.id),
        payload: {
          data: {
            code: verification.code,
            emailId: applicationEmail.id,
            fromEmail: payload.from.email,
            fromName: payload.from.name || null,
            receivedAt: applicationEmail.receivedAt.toISOString(),
            subject: payload.subject,
          },
          type: DataEventType.INBOX_VERIFICATION_CODE,
        },
      }).catch(err => {
        console.error(
          `[IMPROVMX WEBHOOK] Failed to push verification code for ${applicationEmail.id}:`,
          err,
        );
      });
    }

    // Analyze the email with AI in the background
    // We don't await this so the webhook returns quickly
    processEmailAnalysis(applicationEmail.id, user.id, {
      fromEmail: payload.from.email,
      fromName: payload.from.name || null,
      subject: payload.subject,
      textBody: payload.text || null,
      htmlBody: payload.html || null,
    }).catch(err => {
      console.error(
        `[IMPROVMX WEBHOOK] Background analysis failed for ${applicationEmail.id}:`,
        err,
      );
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[IMPROVMX WEBHOOK] Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * Process email analysis in the background.
 * Analyzes the email content, matches to a job lead, and updates statuses.
 */
async function processEmailAnalysis(
  emailId: string,
  userId: string,
  emailData: {
    fromEmail: string;
    fromName: string | null;
    subject: string;
    textBody: string | null;
    htmlBody: string | null;
  },
): Promise<void> {
  try {
    const analysis = await analyzeApplicationEmail(emailData);

    // Verification-code / OTP emails (e.g. Greenhouse "Security code for
    // your application to <Company>") are firmly part of the job-application
    // flow but the AI classifier sometimes lumps them into NOT_JOB_RELATED
    // because the body is short and templated. The deterministic regex
    // already proved a code is present, so override the AI verdict so the
    // email shows up in the inbox instead of being silently filtered out.
    const verificationBody = [emailData.textBody, emailData.htmlBody]
      .filter((value): value is string => Boolean(value?.trim()))
      .join('\n');
    const verification = extractVerificationCode(
      verificationBody || null,
      emailData.subject,
    );
    if (!analysis.isJobRelated && verification) {
      analysis.isJobRelated = true;
      if (analysis.status === 'NOT_JOB_RELATED') {
        analysis.status = 'GENERAL_UPDATE';
      }
    }

    if (!analysis.isJobRelated) {
      await db.applicationEmail.update({
        where: { id: emailId },
        data: {
          status: 'NOT_JOB_RELATED',
          isJobRelated: false,
          aiAnalysis: analysis as any,
        },
      });
      return;
    }

    // Note: pushInboxEmailUpdate runs after the analysis update below so
    // the live inbox receives a single payload with the AI-detected
    // status / company / job title fields populated. Pushing earlier
    // means the user sees the row appear with empty status badges that
    // would update a few seconds later.

    const matchedContext = await findMatchingApplicationContext(
      userId,
      analysis,
    );

    // Update the application email record
    await db.applicationEmail.update({
      where: { id: emailId },
      data: {
        status: matchedContext.jobLeadId ? 'MATCHED' : 'ANALYZED',
        isJobRelated: true,
        detectedStatus: analysis.status,
        detectedCompany: analysis.companyName,
        detectedJobTitle: analysis.jobTitle,
        aiAnalysis: analysis as any,
        jobLeadId: matchedContext.jobLeadId,
        applicationSubmissionId: matchedContext.submissionId,
      },
    });

    if (matchedContext.submissionId) {
      await updateSubmissionFromEmail(matchedContext.submissionId, analysis);
    }

    if (matchedContext.jobLeadId) {
      await updateJobLeadFromEmail(matchedContext.jobLeadId, analysis);
    }

    if (matchedContext.jobLeadId && analysis.status === 'INTERVIEW_SCHEDULED') {
      await triggerInterviewPrepHandoff({
        analysis,
        emailId,
        jobLeadId: matchedContext.jobLeadId,
        submissionId: matchedContext.submissionId,
        userId,
      }).catch(error => {
        console.error(
          `[EMAIL ANALYSIS] Interview prep handoff failed for ${emailId}:`,
          error,
        );
      });
    }

    // Send notification to the user
    await notifyUserOfEmail(
      userId,
      emailId,
      analysis,
      matchedContext.jobLeadId,
      matchedContext.submissionId,
    );

    await pushInboxEmailUpdate(emailId, userId).catch(error => {
      console.error(
        `[EMAIL ANALYSIS] Failed to push live inbox update for ${emailId}:`,
        error,
      );
    });
  } catch (error) {
    console.error(`[EMAIL ANALYSIS] Error analyzing email ${emailId}:`, error);
    await db.applicationEmail
      .update({
        where: { id: emailId },
        data: { status: 'FAILED' },
      })
      .catch(() => {});
  }
}

/**
 * Update a job lead's status based on the analyzed email content.
 */
async function updateJobLeadFromEmail(
  jobLeadId: string,
  analysis: EmailAnalysis,
): Promise<void> {
  const { triggerJobLeadStatusNotification } =
    await import('@/lib/notifications/triggers');

  const jobLead = await db.jobLead.findUnique({
    where: { id: jobLeadId },
    select: { status: true },
  });

  if (!jobLead) return;

  const newStatus = mapAnalysisToJobLeadStatus(analysis);

  if (!newStatus || !shouldAdvanceJobLead(jobLead.status, newStatus)) {
    return;
  }

  const previousStatus = jobLead.status;

  await db.jobLead.update({
    where: { id: jobLeadId },
    data: { status: newStatus },
  });

  // Trigger notification for job lead status change
  await triggerJobLeadStatusNotification(jobLeadId, previousStatus, newStatus);
}

async function updateSubmissionFromEmail(
  submissionId: string,
  analysis: EmailAnalysis,
): Promise<void> {
  const submissionStatus = mapAnalysisToApplicationStatus(analysis);

  if (!submissionStatus) {
    return;
  }

  const { trackApplicationOutcome } =
    await import('@/lib/applications/outcomes/track');

  await trackApplicationOutcome(submissionId, {
    status: submissionStatus,
    metadata: {
      company: analysis.companyName,
      detectedStatus: analysis.status,
      interviewDate: analysis.interviewDate,
      interviewType: analysis.interviewType,
      nextSteps: analysis.nextSteps,
      source: 'improvmx_webhook',
      summary: analysis.summary,
    },
    notes: `Auto-detected from email: ${analysis.summary}`,
    createdBy: 'improvmx_webhook',
  });
}

async function triggerInterviewPrepHandoff({
  analysis,
  emailId,
  jobLeadId,
  submissionId,
  userId,
}: {
  readonly analysis: EmailAnalysis;
  readonly emailId: string;
  readonly jobLeadId: string;
  readonly submissionId: string | null;
  readonly userId: string;
}): Promise<void> {
  const { onInterviewCreated } =
    await import('@/lib/hooks/on-interview-created');

  await onInterviewCreated({
    applicationSubmissionId: submissionId,
    emailId,
    interviewDate: analysis.interviewDate,
    interviewType: analysis.interviewType,
    jobLeadId,
    source: 'improvmx_webhook',
    userId,
  });
}

/**
 * Send a notification to the user about a received application email.
 */
async function notifyUserOfEmail(
  userId: string,
  emailId: string,
  analysis: EmailAnalysis,
  matchedJobLeadId: string | null,
  matchedSubmissionId: string | null,
): Promise<void> {
  const { createNotification } = await import('@/lib/notifications');
  const {
    NotificationCategory,
    NotificationChannel,
    NotificationPriority,
    NotificationStatus,
  } = await import('@/lib/notifications/types');

  if (!analysis.isJobRelated) return;

  const companyName = analysis.companyName || 'Unknown Company';
  const jobTitle = analysis.jobTitle || 'a position';

  const statusLabels: Record<string, string> = {
    APPLICATION_RECEIVED: 'Application Confirmed',
    APPLICATION_REJECTED: 'Application Rejected',
    INTERVIEW_SCHEDULED: 'Interview Scheduled',
    INTERVIEW_FOLLOWUP: 'Interview Follow-up',
    OFFER_MADE: 'Offer Received',
    OFFER_REJECTED: 'Offer Declined',
    ASSESSMENT_REQUEST: 'Assessment Requested',
    GENERAL_UPDATE: 'Application Update',
  };

  const statusLabel = statusLabels[analysis.status] || 'Application Update';

  if (matchedSubmissionId || matchedJobLeadId) {
    return;
  }

  await createNotification({
    userId,
    type: 'SYSTEM_ALERT',
    title: `${statusLabel}: ${companyName}`,
    body: `We received a job-related email about ${jobTitle}, but could not match it to one of your tracked leads yet.`,
    status: NotificationStatus.PENDING,
    priority: NotificationPriority.MEDIUM,
    category: NotificationCategory.SYSTEM,
    channels: [NotificationChannel.IN_APP],
    action: {
      label: 'Review Tracking Email',
      url: '/profile/application-tracking',
    },
    metadata: {
      companyName,
      detectedStatus: analysis.status,
      emailId,
      jobLeadId: matchedJobLeadId,
      jobTitle,
      summary: analysis.summary,
    },
  });
}
