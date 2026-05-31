'use client';

import { useTransition } from 'react';
import type {
  ConfirmationInbox,
  ConfirmationInboxProvider,
} from '@/generated/prisma/browser';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import {
  deleteConfirmationInbox,
  toggleConfirmationInboxActive,
} from '../actions';

export interface InboxListRow {
  readonly id: string;
  readonly label: string;
  readonly emailAddress: string;
  readonly provider: ConfirmationInboxProvider;
  readonly isActive: boolean;
  readonly imapHost: string | null;
  readonly imapPort: number | null;
  readonly lastPolledAt: string | null;
  readonly pollingCadenceSeconds: number;
  readonly createdAt: string;
}

export function toListRow(inbox: ConfirmationInbox): InboxListRow {
  return {
    createdAt: inbox.createdAt.toISOString(),
    emailAddress: inbox.emailAddress,
    id: inbox.id,
    imapHost: inbox.imapHost,
    imapPort: inbox.imapPort,
    isActive: inbox.isActive,
    label: inbox.label,
    lastPolledAt: inbox.lastPolledAt?.toISOString() ?? null,
    pollingCadenceSeconds: inbox.pollingCadenceSeconds,
    provider: inbox.provider,
  };
}

export function InboxList({ inboxes }: { inboxes: readonly InboxListRow[] }) {
  const [isPending, startTransition] = useTransition();

  if (inboxes.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No inboxes yet. Add one above to start reconciling confirmation
        emails.
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-md border">
      {inboxes.map(inbox => (
        <li
          key={inbox.id}
          className="flex flex-col gap-2 p-4 md:flex-row md:items-start md:justify-between"
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{inbox.label}</span>
              <Badge variant={inbox.isActive ? 'default' : 'outline'}>
                {inbox.isActive ? 'Active' : 'Paused'}
              </Badge>
              <Badge variant="secondary">{inbox.provider}</Badge>
            </div>
            <div className="text-muted-foreground text-sm">
              {inbox.emailAddress}
            </div>
            {inbox.imapHost ? (
              <div className="text-muted-foreground text-xs">
                {inbox.imapHost}:{inbox.imapPort}
              </div>
            ) : null}
            <div className="text-muted-foreground text-xs">
              Poll cadence: {inbox.pollingCadenceSeconds}s · Last polled:{' '}
              {inbox.lastPolledAt
                ? new Date(inbox.lastPolledAt).toLocaleString()
                : 'never'}
            </div>
          </div>

          <div className="flex w-fit gap-2">
            <Button
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await toggleConfirmationInboxActive(inbox.id);
                })
              }
              size="sm"
              variant="outline"
            >
              {inbox.isActive ? 'Pause' : 'Resume'}
            </Button>
            <Button
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await deleteConfirmationInbox(inbox.id);
                })
              }
              size="sm"
              variant="destructive"
            >
              Delete
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
