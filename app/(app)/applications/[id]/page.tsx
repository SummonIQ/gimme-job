import {
  ApplicationStatus,
  ApplicationConfirmationState,
} from '@/generated/prisma/browser';
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Mail,
  Workflow,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Page, PageHeader } from '@/components/layout/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardSummary,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';

export const metadata: Metadata = {
  description: 'Detail of a job application you have submitted.',
  title: 'Application Detail | Gimme Job',
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  SUBMITTED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  FAILED: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  REJECTED: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  UNDER_REVIEW: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  INTERVIEW_REQUESTED: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  INTERVIEW_SCHEDULED: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  INTERVIEW_COMPLETED: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  OFFER_RECEIVED: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  OFFER_ACCEPTED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  OFFER_REJECTED: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  WITHDRAWN: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  NOT_SELECTED: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  PENDING: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
};

function humanizeStatus(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatTimestamp(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.id) {
    redirect('/login');
  }

  const { id } = await params;

  const submission = await db.applicationSubmission.findFirst({
    where: { id, userId: user.id },
    include: {
      jobLead: {
        include: {
          jobListing: true,
        },
      },
      resume: { select: { id: true, name: true } },
      outcomeEvents: { orderBy: { createdAt: 'desc' } },
      applicationEmails: { orderBy: { receivedAt: 'desc' } },
      guidedApplication: {
        include: {
          fieldSuggestions: { orderBy: { displayOrder: 'asc' } },
          runtimeSessions: {
            orderBy: { startedAt: 'desc' },
            take: 1,
            include: {
              events: {
                where: {
                  // Only field-fill style events surface as "fields submitted".
                  actionType: { in: ['fill', 'select', 'check', 'upload'] },
                },
                orderBy: { createdAt: 'asc' },
              },
            },
          },
        },
      },
    },
  });

  if (!submission) {
    notFound();
  }

  const company = submission.jobLead.jobListing?.company ?? '—';
  const jobTitle =
    submission.jobLead.jobListing?.title || submission.jobLead.title || '—';
  const sourceUrl =
    submission.submissionUrl ||
    submission.jobLead.jobListing?.jobProviderUrl ||
    null;

  // Surface "fields submitted" from two complementary sources:
  //   - GuidedFieldSuggestion: the resolver's pre-fill view, including
  //     suggested vs user-overridden values.
  //   - ApplicationRuntimeEvent (latest session, action=fill): the actual
  //     fill events the runtime emitted, with valueRedacted (PII-safe).
  const guidedFields = submission.guidedApplication?.fieldSuggestions ?? [];
  const runtimeFields =
    submission.guidedApplication?.runtimeSessions[0]?.events ?? [];

  const isFailed =
    submission.status === ApplicationStatus.FAILED ||
    submission.confirmationState ===
      ApplicationConfirmationState.VERIFIED_FAILED ||
    submission.confirmationState ===
      ApplicationConfirmationState.PRESUMED_FAILED;

  return (
    <Page name="application-detail">
      <PageHeader
        title={company}
        description={jobTitle}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/applications">
                <ArrowLeft className="mr-1 size-4" />
                Back
              </Link>
            </Button>
            {sourceUrl ? (
              <Button asChild variant="outline" size="sm">
                <a href={sourceUrl} target="_blank" rel="noreferrer noopener">
                  <ExternalLink className="mr-1 size-4" />
                  Job posting
                </a>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="space-y-4">
        {/* Overview */}
        <Card>
          <CardHeader>
            <CardSummary>
              <CardTitle>Application</CardTitle>
              <CardDescription>
                Summary of this submission and its current outcome.
              </CardDescription>
            </CardSummary>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Status">
              <Badge
                variant="outline"
                className={
                  STATUS_BADGE_CLASSES[submission.status] ??
                  STATUS_BADGE_CLASSES.PENDING
                }
              >
                {humanizeStatus(submission.status)}
              </Badge>
            </Detail>
            <Detail label="Confirmation">
              {humanizeStatus(submission.confirmationState)}
            </Detail>
            <Detail label="Source">
              {submission.wasAutomated ? 'Autopilot' : 'Manual'}
            </Detail>
            <Detail label="Submitted at">
              {formatTimestamp(submission.submittedAt ?? submission.createdAt)}
            </Detail>
            <Detail label="Verified at">
              {formatTimestamp(submission.verifiedAt)}
            </Detail>
            <Detail label="Last update">
              {formatTimestamp(submission.updatedAt)}
            </Detail>
            <Detail label="Resume used">
              {submission.resume ? submission.resume.name : '—'}
            </Detail>
            <Detail label="Interview count">
              {submission.interviewCount}
            </Detail>
            <Detail label="Lead">
              <Link
                className="underline-offset-2 hover:underline"
                href={`/leads/${submission.jobLeadId}`}
              >
                Open lead →
              </Link>
            </Detail>
          </CardContent>
        </Card>

        {/* Failure details */}
        {isFailed ? (
          <Card>
            <CardHeader>
              <CardSummary>
                <CardTitle className="flex items-center gap-2 text-rose-300">
                  <AlertTriangle className="size-4" />
                  Failure
                </CardTitle>
                <CardDescription>
                  Why this application did not complete.
                </CardDescription>
              </CardSummary>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {submission.failureReason ? (
                <Detail label="Reason">{submission.failureReason}</Detail>
              ) : null}
              {submission.errorMessage ? (
                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    Error message
                  </div>
                  <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs">
                    {submission.errorMessage}
                  </pre>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {/* Fields submitted (guided / pre-fill) */}
        {guidedFields.length > 0 ? (
          <Card>
            <CardHeader>
              <CardSummary>
                <CardTitle>Fields filled (pre-submit)</CardTitle>
                <CardDescription>
                  Values the assistant suggested or you set before
                  submission.
                </CardDescription>
              </CardSummary>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field</TableHead>
                    <TableHead>Suggested</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {guidedFields.map(field => (
                    <TableRow key={field.id}>
                      <TableCell className="font-medium">
                        {field.fieldLabel || field.fieldName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {field.suggestedValue || '—'}
                      </TableCell>
                      <TableCell>
                        {field.userValue || field.currentValue || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {humanizeStatus(field.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}

        {/* Runtime fill events */}
        {runtimeFields.length > 0 ? (
          <Card>
            <CardHeader>
              <CardSummary>
                <CardTitle className="flex items-center gap-2">
                  <Workflow className="size-4" />
                  Runtime fill events
                </CardTitle>
                <CardDescription>
                  Field-by-field actions the runtime performed during this
                  submission (values redacted for privacy).
                </CardDescription>
              </CardSummary>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runtimeFields.map(event => (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">
                        {event.fieldLabel || event.fieldName || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {event.actionType || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {event.valueRedacted || '—'}
                      </TableCell>
                      <TableCell>
                        {event.success === true ? (
                          <span className="text-emerald-400">ok</span>
                        ) : event.success === false ? (
                          <span
                            className="text-rose-400"
                            title={event.errorMessage ?? undefined}
                          >
                            {event.errorCode || 'failed'}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatTimestamp(event.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}

        {/* Emails */}
        {submission.applicationEmails.length > 0 ? (
          <Card>
            <CardHeader>
              <CardSummary>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="size-4" />
                  Emails received
                </CardTitle>
                <CardDescription>
                  Emails to your application tracking address that we have
                  correlated to this job.
                </CardDescription>
              </CardSummary>
            </CardHeader>
            <CardContent className="space-y-3">
              {submission.applicationEmails.map(email => (
                <div
                  key={email.id}
                  className="rounded-md border bg-muted/30 p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">
                      {email.subject || '(no subject)'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatTimestamp(email.receivedAt)}
                    </div>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    From{' '}
                    {email.fromName
                      ? `${email.fromName} <${email.fromEmail}>`
                      : email.fromEmail}
                  </div>
                  {email.detectedStatus ? (
                    <div className="mt-1 text-xs">
                      <span className="text-muted-foreground">Detected:</span>{' '}
                      {humanizeStatus(email.detectedStatus)}
                    </div>
                  ) : null}
                  {email.textBody ? (
                    <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs text-muted-foreground">
                      {email.textBody}
                    </p>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {/* Outcome timeline */}
        {submission.outcomeEvents.length > 0 ? (
          <Card>
            <CardHeader>
              <CardSummary>
                <CardTitle>Status timeline</CardTitle>
                <CardDescription>
                  Status transitions for this application.
                </CardDescription>
              </CardSummary>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {submission.outcomeEvents.map(event => (
                  <li key={event.id} className="flex items-start gap-3">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
                    <div className="flex-1">
                      <div className="font-medium">
                        {humanizeStatus(event.eventType)}
                        {event.previousStatus && event.newStatus ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {humanizeStatus(event.previousStatus)} →{' '}
                            {humanizeStatus(event.newStatus)}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatTimestamp(event.createdAt)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </Page>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}
