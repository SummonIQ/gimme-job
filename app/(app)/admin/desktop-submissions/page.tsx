import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { Page } from '@/components/layout/page';
import { db } from '@/lib/db/client';
import { getRuntimeProviderForUrl } from '@/lib/runtime-provider/registry';
import { getCurrentUser } from '@/lib/user/query';

import { SubmissionsTable, type SubmissionRow } from './_components/submissions-table';
import { extractFailureSignals, type FailureSignal } from './_components/failure-signals';

export const metadata: Metadata = {
  description:
    'Every desktop submit run with per-field failure reasons and a recommendation for what would unblock it.',
  title: 'Desktop submissions | Gimme Job Admin',
};

export default async function DesktopSubmissionsPage() {
  const user = await getCurrentUser();
  if (!user?.id) redirect('/login');

  const [submissions, runLogs] = await Promise.all([
    db.applicationSubmission.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      where: {
        userId: user.id,
        wasAutomated: true,
      },
      select: {
        id: true,
        createdAt: true,
        submissionUrl: true,
        submittedAt: true,
        status: true,
        errorMessage: true,
        metadata: true,
        jobLead: {
          select: {
            id: true,
            jobListing: {
              select: { title: true, company: true },
            },
          },
        },
      },
    }),
    db.automationAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 400,
      where: {
        userId: user.id,
        action: 'desktop_run_log',
      },
      select: { id: true, createdAt: true, metadata: true },
    }),
  ]);

  // Index run logs by applicationUrl so each submission row can attach
  // the most-recent matching trace. The audit log preserves traces from
  // failed runs that never landed an ApplicationSubmission row, so we
  // also surface those as standalone "failed run" rows below.
  const runLogsByUrl = new Map<string, typeof runLogs>();
  for (const log of runLogs) {
    const meta = (log.metadata ?? {}) as Record<string, unknown>;
    const url =
      typeof meta.applicationUrl === 'string' ? meta.applicationUrl : null;
    if (!url) continue;
    const existing = runLogsByUrl.get(url) ?? [];
    runLogsByUrl.set(url, [...existing, log]);
  }

  const rows: SubmissionRow[] = [];
  for (const submission of submissions) {
    const metadata = (submission.metadata ?? {}) as Record<string, unknown>;
    const desktop = (metadata.desktop ?? {}) as Record<string, unknown>;
    const message =
      typeof desktop.message === 'string'
        ? desktop.message
        : submission.errorMessage ?? null;
    const status =
      typeof desktop.status === 'string' ? desktop.status : submission.status;
    const mode = typeof desktop.mode === 'string' ? desktop.mode : null;
    const provider = getRuntimeProviderForUrl(submission.submissionUrl ?? '');
    const toolCallCount =
      typeof desktop.toolCallCount === 'number'
        ? desktop.toolCallCount
        : null;
    const validationFailures = readValidationFailures(desktop);
    const failureArtifacts = readFailureArtifacts(desktop);
    const signals = extractFailureSignals({ message, status });
    const traceLog = submission.submissionUrl
      ? runLogsByUrl.get(submission.submissionUrl)?.[0]
      : undefined;
    const traceMeta = (traceLog?.metadata ?? {}) as Record<string, unknown>;
    const toolCalls = Array.isArray(traceMeta.toolCalls)
      ? (traceMeta.toolCalls as ReadonlyArray<Record<string, unknown>>)
      : [];
    rows.push({
      id: submission.id,
      createdAt: submission.createdAt.toISOString(),
      submissionUrl: submission.submissionUrl ?? '',
      submittedAt: submission.submittedAt?.toISOString() ?? null,
      status,
      providerLabel: provider.label,
      providerReadiness: provider.readiness,
      mode,
      message,
      toolCallCount,
      jobTitle: submission.jobLead?.jobListing?.title ?? null,
      company: submission.jobLead?.jobListing?.company ?? null,
      signals,
      failureArtifacts,
      validationFailures,
      toolCalls: toolCalls.map(call => ({
        tool: typeof call.tool === 'string' ? call.tool : 'unknown',
        ok: Boolean(call.ok),
        reason: typeof call.reason === 'string' ? call.reason : null,
        errorMessage:
          typeof call.errorMessage === 'string' ? call.errorMessage : null,
        selector: typeof call.selector === 'string' ? call.selector : null,
      })),
    });
  }

  // Surface run logs for runs that NEVER produced an ApplicationSubmission
  // (failed before submit, paused for review, etc.) — those don't appear
  // in the submissions query above but are precisely the runs the user
  // most needs to see in this admin view.
  const submissionUrls = new Set(
    submissions.map(s => s.submissionUrl).filter((u): u is string => !!u),
  );
  for (const log of runLogs) {
    const meta = (log.metadata ?? {}) as Record<string, unknown>;
    const url =
      typeof meta.applicationUrl === 'string' ? meta.applicationUrl : null;
    if (!url || submissionUrls.has(url)) continue;
    const status = typeof meta.status === 'string' ? meta.status : 'failed';
    const message = typeof meta.message === 'string' ? meta.message : null;
    const mode = typeof meta.mode === 'string' ? meta.mode : null;
    const provider = getRuntimeProviderForUrl(url);
    const toolCalls = Array.isArray(meta.toolCalls)
      ? (meta.toolCalls as ReadonlyArray<Record<string, unknown>>)
      : [];
    const validationFailures = readValidationFailures(meta);
    rows.push({
      id: log.id,
      createdAt: log.createdAt.toISOString(),
      submissionUrl: url,
      submittedAt: null,
      status,
      providerLabel: provider.label,
      providerReadiness: provider.readiness,
      mode,
      message,
      toolCallCount: toolCalls.length,
      jobTitle: null,
      company: null,
      signals: extractFailureSignals({ message, status }),
      failureArtifacts: readFailureArtifacts(meta),
      validationFailures,
      toolCalls: toolCalls.map(call => ({
        tool: typeof call.tool === 'string' ? call.tool : 'unknown',
        ok: Boolean(call.ok),
        reason: typeof call.reason === 'string' ? call.reason : null,
        errorMessage:
          typeof call.errorMessage === 'string' ? call.errorMessage : null,
        selector: typeof call.selector === 'string' ? call.selector : null,
      })),
    });
    // Mark URL so we don't double-add when the same URL has multiple logs.
    submissionUrls.add(url);
  }
  rows.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const totalCount = rows.length;
  const failedCount = rows.filter(
    row => /failed/i.test(row.status) || row.signals.length > 0,
  ).length;

  return (
    <Page name="admin_desktop_submissions">
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-semibold">Desktop submissions</h1>
          <p className="text-muted-foreground text-sm">
            Last {totalCount} desktop submit runs ({failedCount} surfaced
            failure reasons). Each row shows what blocked the submit and what
            you can change to unblock the next one.
          </p>
        </header>
        <SubmissionsTable rows={rows} />
      </div>
    </Page>
  );
}

function readFailureArtifacts(
  metadata: Record<string, unknown>,
): SubmissionRow['failureArtifacts'] {
  const raw = metadata.failureArtifacts;
  if (!raw || typeof raw !== 'object') return null;
  const artifacts = raw as Record<string, unknown>;
  const screenshotUrl =
    typeof artifacts.screenshotUrl === 'string'
      ? artifacts.screenshotUrl
      : null;
  const domUrl = typeof artifacts.domUrl === 'string' ? artifacts.domUrl : null;
  const capturedAt =
    typeof artifacts.capturedAt === 'string' ? artifacts.capturedAt : null;
  const error = typeof artifacts.error === 'string' ? artifacts.error : null;
  if (!screenshotUrl && !domUrl && !error) return null;
  return { capturedAt, domUrl, error, screenshotUrl };
}

function readValidationFailures(
  metadata: Record<string, unknown>,
): SubmissionRow['validationFailures'] {
  const raw = metadata.validationFailures;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is {
        readonly fieldLabel: string;
        readonly fieldSelector: string;
        readonly message: string;
      } => {
        if (typeof item !== 'object' || item === null) return false;
        return (
          typeof item.fieldLabel === 'string' &&
          typeof item.fieldSelector === 'string' &&
          typeof item.message === 'string'
        );
      },
    )
    .map(item => ({
      fieldLabel: item.fieldLabel,
      fieldSelector: item.fieldSelector,
      message: item.message,
    }));
}
