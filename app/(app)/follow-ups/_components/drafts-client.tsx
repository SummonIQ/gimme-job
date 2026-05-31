'use client';

import { useState, useTransition } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { FollowUpDraftStatus } from '@/generated/prisma/browser';

import {
  dismissFollowUpDraft,
  markFollowUpDraftSent,
  updateFollowUpDraftBody,
} from '../actions';

export interface FollowUpDraftRow {
  readonly id: string;
  readonly subject: string;
  readonly bodyMarkdown: string;
  readonly status: FollowUpDraftStatus;
  readonly daysSinceSubmission: number;
  readonly generatedAt: string;
  readonly jobTitle: string;
  readonly company: string | null;
}

function DraftCard({ draft }: { draft: FollowUpDraftRow }) {
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.bodyMarkdown);
  const [isPending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const isDirty = subject !== draft.subject || body !== draft.bodyMarkdown;

  const handleSave = () => {
    startTransition(async () => {
      await updateFollowUpDraftBody(draft.id, body, subject);
      setSavedAt(new Date().toLocaleTimeString());
    });
  };

  const handleSent = () => {
    startTransition(async () => {
      if (isDirty) {
        await updateFollowUpDraftBody(draft.id, body, subject);
      }
      await markFollowUpDraftSent(draft.id);
    });
  };

  const handleDismiss = () => {
    startTransition(async () => {
      await dismissFollowUpDraft(draft.id);
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="flex-1">{draft.jobTitle}</CardTitle>
          <Badge variant="outline">{draft.status}</Badge>
        </div>
        <CardDescription>
          {draft.company ?? 'Unknown company'} · Submitted{' '}
          {draft.daysSinceSubmission} days ago
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2">
          <label className="text-xs font-medium" htmlFor={`subject-${draft.id}`}>
            Subject
          </label>
          <Input
            id={`subject-${draft.id}`}
            onChange={event => setSubject(event.target.value)}
            value={subject}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-xs font-medium" htmlFor={`body-${draft.id}`}>
            Body
          </label>
          <Textarea
            className="min-h-[180px]"
            id={`body-${draft.id}`}
            onChange={event => setBody(event.target.value)}
            value={body}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={!isDirty || isPending}
            onClick={handleSave}
            size="sm"
            variant="outline"
          >
            Save edits
          </Button>
          <Button
            disabled={isPending || draft.status === 'SENT'}
            onClick={handleSent}
            size="sm"
          >
            Mark sent
          </Button>
          <Button
            disabled={isPending || draft.status === 'DISMISSED'}
            onClick={handleDismiss}
            size="sm"
            variant="destructive"
          >
            Dismiss
          </Button>
          {savedAt ? (
            <span className="text-muted-foreground text-xs">
              Saved at {savedAt}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function DraftsClient({
  drafts,
}: {
  drafts: readonly FollowUpDraftRow[];
}) {
  if (drafts.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No follow-up drafts right now. New drafts appear here once the daily
        scheduler runs.
      </p>
    );
  }
  return (
    <div className="grid gap-4">
      {drafts.map(draft => (
        <DraftCard draft={draft} key={draft.id} />
      ))}
    </div>
  );
}
