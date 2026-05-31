'use client';

import { useTransition } from 'react';
import type {
  ApplicationConfirmationState,
} from '@/generated/prisma/browser';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  type ManualConfirmationState,
  manuallyTransitionConfirmationState,
} from '../actions';

export interface SubmissionRow {
  readonly id: string;
  readonly confirmationState: ApplicationConfirmationState;
  readonly status: string;
  readonly jobTitle: string;
  readonly company: string | null;
  readonly submittedAt: string | null;
  readonly verifiedAt: string | null;
}

export interface GroupedSubmissions {
  readonly state: ApplicationConfirmationState;
  readonly rows: readonly SubmissionRow[];
}

const STATE_LABELS: Record<ApplicationConfirmationState, string> = {
  PENDING: 'Pending',
  ATS_CONFIRMED: 'ATS confirmed',
  EMAIL_CONFIRMED: 'Email confirmed',
  DASHBOARD_CONFIRMED: 'Dashboard confirmed',
  PRESUMED_FAILED: 'Presumed failed',
  VERIFIED_FAILED: 'Verified failed',
};

const STATE_BADGE_VARIANT: Record<
  ApplicationConfirmationState,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  PENDING: 'outline',
  ATS_CONFIRMED: 'secondary',
  EMAIL_CONFIRMED: 'default',
  DASHBOARD_CONFIRMED: 'default',
  PRESUMED_FAILED: 'destructive',
  VERIFIED_FAILED: 'destructive',
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

interface ActionButtonsProps {
  submissionId: string;
  currentState: ApplicationConfirmationState;
}

function ActionButtons({ submissionId, currentState }: ActionButtonsProps) {
  const [isPending, startTransition] = useTransition();

  const handleClick = (nextState: ManualConfirmationState) => {
    startTransition(async () => {
      await manuallyTransitionConfirmationState({ nextState, submissionId });
    });
  };

  const canMarkVerified = currentState !== 'EMAIL_CONFIRMED';
  const canMarkFailed = currentState !== 'VERIFIED_FAILED';
  const canMarkPending = currentState !== 'PENDING';

  return (
    <div className="flex w-fit flex-wrap gap-2">
      <Button
        disabled={isPending || !canMarkVerified}
        onClick={() => handleClick('EMAIL_CONFIRMED')}
        size="sm"
        variant="secondary"
      >
        Mark verified
      </Button>
      <Button
        disabled={isPending || !canMarkFailed}
        onClick={() => handleClick('VERIFIED_FAILED')}
        size="sm"
        variant="destructive"
      >
        Mark failed
      </Button>
      <Button
        disabled={isPending || !canMarkPending}
        onClick={() => handleClick('PENDING')}
        size="sm"
        variant="outline"
      >
        Reset to pending
      </Button>
    </div>
  );
}

export function SubmissionsClient({
  groups,
  totalCount,
}: {
  groups: readonly GroupedSubmissions[];
  totalCount: number;
}) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Submission reconciliation</h1>
        <p className="text-sm text-muted-foreground">
          Showing the {totalCount} most recent submissions grouped by
          confirmation state. Use the buttons to manually mark a submission if
          the automation missed an outcome.
        </p>
      </header>

      {groups.map(group => (
        <Card key={group.state}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant={STATE_BADGE_VARIANT[group.state]}>
                {STATE_LABELS[group.state]}
              </Badge>
              <span className="text-muted-foreground text-sm">
                {group.rows.length} submission
                {group.rows.length === 1 ? '' : 's'}
              </span>
            </CardTitle>
            <CardDescription>
              {group.state === 'PENDING'
                ? 'Awaiting automated confirmation. Auto-fails after 72h.'
                : group.state === 'PRESUMED_FAILED'
                  ? 'Auto-failed after 72h without confirmation. Manually verify if you received a response.'
                  : group.state === 'VERIFIED_FAILED'
                    ? 'Explicitly marked as failed.'
                    : 'Confirmed submission.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {group.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No submissions in this state.
              </p>
            ) : (
              <ul className="divide-y">
                {group.rows.map(row => (
                  <li
                    key={row.id}
                    className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="font-medium">{row.jobTitle}</div>
                      <div className="text-sm text-muted-foreground">
                        {row.company ?? 'Unknown company'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Submitted: {formatDate(row.submittedAt)}
                        {row.verifiedAt
                          ? ` · Verified: ${formatDate(row.verifiedAt)}`
                          : ''}
                      </div>
                    </div>
                    <ActionButtons
                      currentState={row.confirmationState}
                      submissionId={row.id}
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
