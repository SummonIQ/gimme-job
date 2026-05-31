import { createHash } from 'node:crypto';

import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { Prisma } from '@/generated/prisma/client';
import { validateToken } from '@/lib/desktop-tokens';
import { db } from '@/lib/db/client';
import { embedFormFieldFeedback } from '@/lib/ai/embeddings';
import { storeFailureSnapshotArtifacts } from '@/lib/applications/failure-snapshot';
import { ensureJobFitAnalysisForLead } from '@/lib/job-leads/analyze/job-fit';

// P17.1 typed statuses. Keep in sync with
// desktop/electron/agent/types.ts:DESKTOP_AGENT_SESSION_STATUSES.
const DESKTOP_RUN_STATUSES = [
  'blocked_by_submit_guard',
  'cancelled',
  'captcha_required',
  'closed_posting',
  'completed',
  'confirmation_timeout',
  'failed',
  'manual_auth_required',
  'paused_for_manual_review',
  'unavailable',
  'unsupported_provider',
  'validation_failed',
] as const;

const requestSchema = z.object({
  applicationUrl: z.string().url(),
  jobLeadId: z.string().optional(),
  message: z.string().optional(),
  mode: z.enum(['submit', 'training']),
  status: z.enum(DESKTOP_RUN_STATUSES),
  toolCallCount: z.number().int().nonnegative().optional(),
  failureSnapshot: z
    .object({
      capturedAt: z.string().datetime().optional(),
      domHtml: z.string().min(1),
      screenshotPngBase64: z.string().min(1),
    })
    .optional(),
  validationFailures: z
    .array(
      z.object({
        fieldLabel: z.string(),
        fieldSelector: z.string(),
        message: z.string(),
      }),
    )
    .optional(),
});

type DesktopRunMode = 'submit' | 'training';
type DesktopRunStatus = (typeof DESKTOP_RUN_STATUSES)[number];

type SubmittedApplicationCheck = {
  readonly alreadySubmitted: boolean;
  readonly jobLeadId: string | null;
  readonly reason: 'existing_submission' | 'job_lead_applied' | null;
  readonly status: string | null;
  readonly submissionId: string | null;
  readonly submittedAt: string | null;
};

/**
 * Decide what to do with a desktop run when recording it.
 *
 * - applied: a real submission landed in Greenhouse; mark the lead APPLIED
 *   and create an ApplicationSubmission.
 * - tracked: the run never actually clicked submit (training, paused, guard
 *   blocked); ensure a lead exists so the user can find it later but don't
 *   create a submission record.
 * - skipped: the run failed before reaching anything meaningful; do not add
 *   noise to the user's dashboard.
 */
// P17.1 status routing. Each typed status falls into one of three
// outcomes:
//
//   - applied: submit-mode run that produced a verified confirmation.
//   - tracked: the user should see the lead in their dashboard — either
//     because we actually tried to submit (validation_failed,
//     confirmation_timeout) or because the run is sitting in a state
//     that needs the user to intervene (paused_for_manual_review,
//     manual_auth_required).
//   - skipped: nothing meaningful happened; don't pollute the
//     dashboard. `failed` stays here as the generic catch-all; a
//     captcha or unsupported-provider abort never even attempted a
//     submission.
// Statuses where the runner never actually attempted a submission — these
// shouldn't pollute the submission history. NOTE: 'failed' is intentionally
// NOT in this set anymore. The runner uses 'failed' for real submit-click-
// didn't-confirm outcomes which we DO want tracked so the dashboard's
// success rate reflects reality.
const SKIPPED_RUN_STATUSES = new Set<DesktopRunStatus>([
  'cancelled',
  'captcha_required',
  'closed_posting',
  'unavailable',
  'unsupported_provider',
]);

// Subset of typed statuses that represent a real submission failure
// (the runner finished but the submission did not succeed). When one
// of these lands on the tracked branch we persist a FAILED submission
// row so the admin trace + future P17.13 metrics dashboard can read
// the typed reason.
const FAILURE_RUN_STATUSES = new Set<DesktopRunStatus>([
  'captcha_required',
  'closed_posting',
  'confirmation_timeout',
  'failed',
  'manual_auth_required',
  'unsupported_provider',
  'validation_failed',
]);

function classifyDesktopRun(
  mode: DesktopRunMode,
  status: DesktopRunStatus,
): 'applied' | 'tracked' | 'skipped' {
  if (mode === 'submit' && status === 'completed') return 'applied';
  if (SKIPPED_RUN_STATUSES.has(status)) return 'skipped';
  return 'tracked';
}

export async function GET(request: Request) {
  const rawToken = readBearerToken(request);
  if (!rawToken) {
    return NextResponse.json(
      { error: 'Missing Bearer token' },
      { status: 401 },
    );
  }

  const validation = await validateToken(rawToken, {
    requireScope: 'desktop:runtime',
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 401 });
  }

  const url = new URL(request.url);
  const applicationUrl = url.searchParams.get('applicationUrl')?.trim() ?? '';
  const jobLeadId = url.searchParams.get('jobLeadId')?.trim() || undefined;

  if (!applicationUrl) {
    return NextResponse.json(
      { error: 'applicationUrl is required' },
      { status: 400 },
    );
  }

  const parsed = z.string().url().safeParse(applicationUrl);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'applicationUrl must be a valid URL' },
      { status: 400 },
    );
  }

  const check = await checkExistingSubmittedApplication({
    applicationUrl: parsed.data,
    jobLeadId,
    userId: validation.token.userId,
  });

  return NextResponse.json(check);
}

export async function POST(request: Request) {
  const rawToken = readBearerToken(request);
  if (!rawToken) {
    return NextResponse.json(
      { error: 'Missing Bearer token' },
      { status: 401 },
    );
  }

  const validation = await validateToken(rawToken, {
    requireScope: 'desktop:runtime',
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 401 });
  }

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Invalid request body',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 400 },
    );
  }

  const userId = validation.token.userId;
  const outcome = classifyDesktopRun(body.mode, body.status);
  const shouldTrackFailureSnapshot =
    body.mode === 'submit' &&
    Boolean(body.failureSnapshot) &&
    FAILURE_RUN_STATUSES.has(body.status);
  const effectiveOutcome =
    outcome === 'skipped' && shouldTrackFailureSnapshot ? 'tracked' : outcome;

  if (effectiveOutcome === 'skipped') {
    return NextResponse.json({
      jobLeadId: null,
      outcome: effectiveOutcome,
      submissionId: null,
    });
  }

  const user = await db.user.findUnique({
    select: { defaultResumeId: true },
    where: { id: userId },
  });

  const jobLead = await resolveJobLead({
    applicationUrl: body.applicationUrl,
    jobLeadId: body.jobLeadId,
    userId,
  });

  const metadata = {
    applicationUrl: body.applicationUrl,
    desktop: {
      message: body.message ?? null,
      mode: body.mode,
      source: 'desktop_app',
      status: body.status,
      toolCallCount: body.toolCallCount ?? null,
      validationFailures: body.validationFailures ?? [],
    },
  };

  let submissionId: string | null = null;

  if (effectiveOutcome === 'applied') {
    const existingSubmission = await db.applicationSubmission.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { id: true },
      where: {
        jobLeadId: jobLead.id,
        status: { not: 'FAILED' },
        userId,
      },
    });

    const submittedAt = new Date();
    const submission = existingSubmission
      ? await db.applicationSubmission.update({
          data: {
            // Clear any prior typed-failure reason so a successful
            // resubmit doesn't leave stale failure metadata behind.
            failureReason: null,
            metadata,
            status: 'SUBMITTED',
            submissionUrl: body.applicationUrl,
            submittedAt,
            userAgent: 'gimme-job-desktop/1.0',
            wasAutomated: true,
          },
          select: { id: true },
          where: { id: existingSubmission.id },
        })
      : await db.applicationSubmission.create({
          data: {
            jobLeadId: jobLead.id,
            metadata,
            resumeId: user?.defaultResumeId ?? undefined,
            status: 'SUBMITTED',
            submissionUrl: body.applicationUrl,
            submittedAt,
            userAgent: 'gimme-job-desktop/1.0',
            userId,
            wasAutomated: true,
          },
          select: { id: true },
        });
    submissionId = submission.id;

    await db.jobLead.update({
      data: { status: 'APPLIED' },
      where: { id: jobLead.id },
    });

    void ensureJobFitAnalysisForLead(jobLead.id).catch(error => {
      console.warn(
        `Failed to backfill job-fit analysis for lead ${jobLead.id}:`,
        error,
      );
    });
  } else if (
    effectiveOutcome === 'tracked' &&
    FAILURE_RUN_STATUSES.has(body.status as DesktopRunStatus)
  ) {
    // Persist a FAILED submission row carrying the typed failureReason
    // so admin trace + P17.13 metrics can group runs by reason. Reuse
    // the latest open submission for this lead if one exists; otherwise
    // create a fresh row.
    const existingFailure = await db.applicationSubmission.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { id: true },
      where: { jobLeadId: jobLead.id, userId, status: { not: 'SUBMITTED' } },
    });
    const submission = existingFailure
      ? await db.applicationSubmission.update({
          data: {
            errorMessage: body.message ?? null,
            failureReason: body.status,
            metadata,
            status: 'FAILED',
            userAgent: 'gimme-job-desktop/1.0',
            wasAutomated: true,
          },
          select: { id: true },
          where: { id: existingFailure.id },
        })
      : await db.applicationSubmission.create({
          data: {
            errorMessage: body.message ?? null,
            failureReason: body.status,
            jobLeadId: jobLead.id,
            metadata,
            resumeId: user?.defaultResumeId ?? undefined,
            status: 'FAILED',
            submissionUrl: body.applicationUrl,
            userAgent: 'gimme-job-desktop/1.0',
            userId,
            wasAutomated: true,
          },
          select: { id: true },
        });
    submissionId = submission.id;
  }

  if (submissionId && body.failureSnapshot && body.status !== 'completed') {
    const metadataWithArtifacts = await attachFailureSnapshotArtifacts({
      metadata,
      snapshot: body.failureSnapshot,
      submissionId,
    });
    await db.applicationSubmission.update({
      data: { metadata: metadataWithArtifacts as Prisma.InputJsonValue },
      where: { id: submissionId },
    });
  }

  await db.jobListing.update({
    data: { status: 'ADDED_TO_LEADS' },
    where: { id: jobLead.jobListingId },
  });

  // Positive-signal feedback: when a submit run actually completes, the
  // values in the most recent form snapshot for this URL are by definition
  // "answers the form accepted". Auto-write them as approved
  // formFieldFeedback rows so the LLM resolver biases toward those values
  // on future runs against the same hostname (esp. for custom dropdown
  // questions where guessing right took the LLM a few tries).
  if (body.mode === 'submit' && body.status === 'completed') {
    void recordPositiveFeedbackFromSuccessfulRun({
      applicationUrl: body.applicationUrl,
      userId,
    }).catch(error => {
      console.warn('[positive-feedback] write failed:', error);
    });
  }

  revalidateTag(`user:${userId}:applications`, 'max');
  revalidateTag(`user:${userId}:job-leads`, 'max');
  revalidateTag(`user:${userId}:report:job-leads`, 'max');
  revalidateTag(`user:${userId}:report:job-leads:applied`, 'max');
  revalidateTag(`job-lead:${jobLead.id}`, 'max');

  return NextResponse.json({
    jobLeadId: jobLead.id,
    outcome: effectiveOutcome,
    submissionId,
  });
}

async function attachFailureSnapshotArtifacts(input: {
  readonly metadata: {
    readonly applicationUrl: string;
    readonly desktop: Record<string, unknown>;
  };
  readonly snapshot: NonNullable<
    z.infer<typeof requestSchema>['failureSnapshot']
  >;
  readonly submissionId: string;
}) {
  try {
    const artifacts = await storeFailureSnapshotArtifacts({
      snapshot: input.snapshot,
      submissionId: input.submissionId,
    });
    return {
      ...input.metadata,
      desktop: {
        ...input.metadata.desktop,
        failureArtifacts: artifacts,
      },
    };
  } catch (error) {
    console.warn('[failure-snapshot] upload failed:', error);
    return {
      ...input.metadata,
      desktop: {
        ...input.metadata.desktop,
        failureArtifacts: {
          capturedAt: input.snapshot.capturedAt ?? new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error),
        },
      },
    };
  }
}

async function checkExistingSubmittedApplication(input: {
  readonly applicationUrl: string;
  readonly jobLeadId?: string;
  readonly userId: string;
}): Promise<SubmittedApplicationCheck> {
  const applicationUrlVariants = buildApplicationUrlVariants(
    input.applicationUrl,
  );
  const urlMatches = applicationUrlVariants.map(jobProviderUrl => ({
    jobListing: { jobProviderUrl },
  }));

  const lead = await db.jobLead.findFirst({
    orderBy: { updatedAt: 'desc' },
    select: {
      applicationSubmissions: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          submittedAt: true,
        },
        take: 1,
        where: {
          status: { not: 'FAILED' },
        },
      },
      id: true,
      status: true,
    },
    where: {
      AND: [
        {
          OR: [
            ...(input.jobLeadId ? [{ id: input.jobLeadId }] : []),
            ...urlMatches,
            {
              applicationSubmissions: {
                some: {
                  status: { not: 'FAILED' },
                  submissionUrl: { in: applicationUrlVariants },
                },
              },
            },
          ],
        },
        {
          OR: [
            { status: 'APPLIED' },
            {
              applicationSubmissions: {
                some: {
                  status: { not: 'FAILED' },
                },
              },
            },
          ],
        },
      ],
      userId: input.userId,
    },
  });

  if (!lead) {
    return {
      alreadySubmitted: false,
      jobLeadId: null,
      reason: null,
      status: null,
      submissionId: null,
      submittedAt: null,
    };
  }

  const submission = lead.applicationSubmissions[0] ?? null;

  return {
    alreadySubmitted: true,
    jobLeadId: lead.id,
    reason: submission ? 'existing_submission' : 'job_lead_applied',
    status: submission?.status ?? lead.status,
    submissionId: submission?.id ?? null,
    submittedAt: submission?.submittedAt?.toISOString() ?? null,
  };
}

async function resolveJobLead(input: {
  readonly applicationUrl: string;
  readonly jobLeadId?: string;
  readonly userId: string;
}): Promise<{ id: string; jobListingId: string }> {
  if (input.jobLeadId) {
    const existingLead = await db.jobLead.findFirst({
      select: { id: true, jobListingId: true },
      where: {
        id: input.jobLeadId,
        userId: input.userId,
      },
    });
    if (existingLead) return existingLead;
  }

  const applicationUrlVariants = buildApplicationUrlVariants(
    input.applicationUrl,
  );
  const listing = await db.jobListing.findFirst({
    select: {
      id: true,
      lead: {
        select: { id: true, jobListingId: true },
      },
      title: true,
    },
    where: {
      OR: applicationUrlVariants.map(jobProviderUrl => ({ jobProviderUrl })),
      userId: input.userId,
    },
  });

  if (listing?.lead) return listing.lead;

  if (listing) {
    return db.jobLead.create({
      data: {
        jobListingId: listing.id,
        title: listing.title,
        userId: input.userId,
      },
      select: { id: true, jobListingId: true },
    });
  }

  return createAppliedLeadForDesktopSubmission(input);
}

async function createAppliedLeadForDesktopSubmission(input: {
  readonly applicationUrl: string;
  readonly userId: string;
}): Promise<{ id: string; jobListingId: string }> {
  const fallback = describeDesktopSubmissionUrl(input.applicationUrl);
  const jobId = buildDesktopSubmissionJobId(input);
  const listing = await db.jobListing.upsert({
    create: {
      company: fallback.company,
      jobId,
      jobProvider: fallback.jobProvider,
      jobProviderUrl: input.applicationUrl,
      source: 'Desktop App',
      status: 'ADDED_TO_LEADS',
      title: fallback.title,
      userId: input.userId,
    },
    select: {
      id: true,
      lead: {
        select: { id: true, jobListingId: true },
      },
      title: true,
    },
    update: {
      jobProviderUrl: input.applicationUrl,
      status: 'ADDED_TO_LEADS',
    },
    where: {
      jobId,
    },
  });

  if (listing.lead) return listing.lead;

  // Created here as ADDED. The caller decides whether to promote this lead
  // to APPLIED based on whether the run actually clicked submit.
  return db.jobLead.create({
    data: {
      jobListingId: listing.id,
      status: 'ADDED',
      title: listing.title,
      userId: input.userId,
    },
    select: { id: true, jobListingId: true },
  });
}

function buildApplicationUrlVariants(applicationUrl: string): string[] {
  const variants = new Set([applicationUrl.trim()]);

  try {
    const parsedUrl = new URL(applicationUrl);
    parsedUrl.hash = '';
    variants.add(parsedUrl.toString());

    if (parsedUrl.pathname.endsWith('/')) {
      parsedUrl.pathname = parsedUrl.pathname.replace(/\/+$/, '');
      variants.add(parsedUrl.toString());
    }
  } catch {
    // Request validation already enforces URL shape; keep the original value.
  }

  return [...variants].filter(Boolean);
}

function buildDesktopSubmissionJobId(input: {
  readonly applicationUrl: string;
  readonly userId: string;
}): string {
  const fingerprint = createHash('sha256')
    .update(`${input.userId}:${canonicalizeApplicationUrl(input.applicationUrl)}`)
    .digest('hex')
    .slice(0, 24);

  return `desktop:${fingerprint}`;
}

function canonicalizeApplicationUrl(applicationUrl: string): string {
  try {
    const parsedUrl = new URL(applicationUrl);
    parsedUrl.hash = '';
    return parsedUrl.toString();
  } catch {
    return applicationUrl.trim();
  }
}

function describeDesktopSubmissionUrl(applicationUrl: string): {
  readonly company: string | null;
  readonly jobProvider: 'GREENHOUSE' | 'OTHER';
  readonly title: string;
} {
  const parsedUrl = new URL(applicationUrl);
  const hostname = parsedUrl.hostname.replace(/^www\./, '');
  const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
  const isGreenhouse = hostname.includes('greenhouse.io');
  const companySlug =
    isGreenhouse &&
    (hostname === 'boards.greenhouse.io' ||
      hostname === 'job-boards.greenhouse.io')
      ? pathParts[0]
      : hostname.split('.')[0];
  const company = humanizeSlug(companySlug);

  return {
    company,
    jobProvider: isGreenhouse ? 'GREENHOUSE' : 'OTHER',
    title: company ? `${company} application` : 'Desktop application',
  };
}

function humanizeSlug(value: string | undefined): string | null {
  const words = value
    ?.replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();

  if (!words) return null;

  return words.replace(/\b\w/g, character => character.toUpperCase());
}

function readBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/);
  return match?.[1]?.trim() || null;
}

// Read the latest form snapshot for the given application URL and write
// each non-empty (label, value) pair as an approved formFieldFeedback row.
// The LLM resolver's loadFieldFeedback already reads these — so once we
// upload the success signal, the next run on the same hostname biases
// toward the same answer.
async function recordPositiveFeedbackFromSuccessfulRun(input: {
  readonly applicationUrl: string;
  readonly userId: string;
}): Promise<void> {
  let hostname: string | null = null;
  try {
    hostname = new URL(input.applicationUrl).hostname.toLowerCase();
  } catch {
    return;
  }
  if (!hostname) return;

  // The desktop emits a form-snapshot to /api/desktop/agent-chat/form-snapshot
  // right before the submit click. The latest one for this URL captures
  // exactly what got accepted by the form.
  const snapshot = await db.localFormSnapshot.findFirst({
    where: { userId: input.userId, applicationUrl: input.applicationUrl },
    orderBy: { capturedAt: 'desc' },
    select: { fields: true, hostname: true, applicationUrl: true },
  });
  if (!snapshot) return;
  const fields = Array.isArray(snapshot.fields)
    ? (snapshot.fields as Array<Record<string, unknown>>)
    : [];
  if (fields.length === 0) return;
  const snapshotHostname = snapshot.hostname?.trim().toLowerCase() || hostname;

  for (const field of fields) {
    const label =
      typeof field.label === 'string' ? field.label.trim() : '';
    const value =
      typeof field.value === 'string' ? field.value.trim() : '';
    const fieldType =
      typeof field.fieldType === 'string' ? field.fieldType : null;
    if (label.length < 4 || value.length === 0) continue;
    // Identity fields (name/email/phone/etc) are filled from the user's
    // profile and don't benefit from per-question feedback rows. Skip
    // them so the feedback table stays focused on custom-question
    // answers where the LLM actually had room to be wrong.
    if (
      /^(?:first\s*name|last\s*name|full\s*name|email|phone|resume|linkedin|github)$/i.test(
        label,
      )
    ) {
      continue;
    }
    try {
      const existing = await db.formFieldFeedback.findFirst({
        where: {
          userId: input.userId,
          hostname: snapshotHostname,
          fieldLabel: label,
        },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, status: true },
      });
      // If the user already gave us explicit feedback for this label
      // (approved/rejected), don't overwrite — explicit > automatic.
      if (existing?.status === 'approved' || existing?.status === 'rejected') {
        continue;
      }
      const data = {
        applicationUrl: input.applicationUrl,
        feedback: 'auto_success_signal',
        fieldType,
        filledValue: value,
        rejectReason: null,
        status: 'approved' as const,
      };
      if (existing) {
        await db.formFieldFeedback.update({
          data,
          where: { id: existing.id },
        });
        void embedFormFieldFeedback(existing.id).catch(error => {
          console.warn('[positive-feedback] embed failed', error);
        });
      } else {
        const created = await db.formFieldFeedback.create({
          data: {
            ...data,
            fieldLabel: label,
            hostname: snapshotHostname,
            userId: input.userId,
          },
          select: { id: true },
        });
        void embedFormFieldFeedback(created.id).catch(error => {
          console.warn('[positive-feedback] embed failed', error);
        });
      }
    } catch (error) {
      console.warn(
        `[positive-feedback] failed to upsert "${label}" on ${snapshotHostname}:`,
        error,
      );
    }
  }
}
