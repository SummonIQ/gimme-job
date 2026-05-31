import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardActions,
  CardContent,
  CardDescription,
  CardHeader,
  CardSummary,
  CardTitle,
} from '@/components/ui/card';

import type { RuntimeSessionDetail } from './types';

interface SessionReviewProps {
  bulkApproveAction: (formData: FormData) => void | Promise<void>;
  reviewCandidateAction: (formData: FormData) => void | Promise<void>;
  session: RuntimeSessionDetail;
}

export function SessionReview({
  bulkApproveAction,
  reviewCandidateAction,
  session,
}: SessionReviewProps) {
  const screenshots = session.artifacts.flatMap(artifact =>
    artifact.screenshotUrls.map(url => ({
      artifactId: artifact.id,
      url,
    })),
  );
  const candidateCount = session.candidates.length;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardSummary>
            <CardTitle>{session.jobTitle ?? 'Runtime session'}</CardTitle>
            <CardDescription>
              {session.company ?? session.hostname ?? 'Unknown target'}
            </CardDescription>
          </CardSummary>
          <CardActions>
            <Badge variant="outline">{session.status}</Badge>
            <Badge variant="secondary">{session.mode}</Badge>
          </CardActions>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <SummaryCell label="Events" value={session.events.length} />
          <SummaryCell label="Candidates" value={candidateCount} />
          <SummaryCell label="Artifacts" value={session.artifacts.length} />
          <SummaryCell label="Current step" value={session.currentStepIndex} />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <EventTimeline events={session.events} />
        <CandidatePanel
          bulkApproveAction={bulkApproveAction}
          candidates={session.candidates}
          reviewCandidateAction={reviewCandidateAction}
          sessionId={session.id}
        />
      </div>

      <ScreenshotPreview screenshots={screenshots} />
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border/50 p-3">
      <div className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function EventTimeline({ events }: { events: RuntimeSessionDetail['events'] }) {
  return (
    <Card>
      <CardHeader>
        <CardSummary>
          <CardTitle>Event timeline</CardTitle>
          <CardDescription>
            Ordered runtime events from this session.
          </CardDescription>
        </CardSummary>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events recorded.</p>
        ) : (
          events.map(event => (
            <div
              key={event.id}
              className="rounded-md border border-border/50 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={event.success === false ? 'destructive' : 'outline'}
                >
                  {event.eventType}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDate(event.createdAt)}
                </span>
                {event.stepIndex !== null ? (
                  <span className="text-xs text-muted-foreground">
                    Step {event.stepIndex}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 text-sm">
                {event.fieldLabel ??
                  event.fieldName ??
                  event.actionType ??
                  'Runtime event'}
              </div>
              {event.selector ? (
                <code className="mt-2 block truncate rounded bg-muted px-2 py-1 text-xs">
                  {event.selector}
                </code>
              ) : null}
              {event.errorMessage ? (
                <p className="mt-2 text-sm text-destructive">
                  {event.errorMessage}
                </p>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function CandidatePanel({
  bulkApproveAction,
  candidates,
  reviewCandidateAction,
  sessionId,
}: {
  bulkApproveAction: (formData: FormData) => void | Promise<void>;
  candidates: RuntimeSessionDetail['candidates'];
  reviewCandidateAction: (formData: FormData) => void | Promise<void>;
  sessionId: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardSummary>
          <CardTitle>Candidate rules</CardTitle>
          <CardDescription>
            Approve or reject learned selectors.
          </CardDescription>
        </CardSummary>
        <CardActions>
          <form action={bulkApproveAction}>
            <input name="sessionId" type="hidden" value={sessionId} />
            <Button size="sm" type="submit" variant="secondary">
              Bulk approve trivial
            </Button>
          </form>
        </CardActions>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No promotion candidates for this session hostname yet.
          </p>
        ) : (
          candidates.map(candidate => (
            <div
              key={candidate.id}
              className="flex flex-col gap-3 rounded-md border border-border/50 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">
                    {candidate.fieldLabel ??
                      candidate.fieldName ??
                      candidate.actionType}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Confidence {Math.round(candidate.confidence * 100)}% -{' '}
                    {candidate.successCount}/{candidate.observationCount}{' '}
                    successful
                  </div>
                </div>
                <Badge variant="outline">{candidate.promotionStatus}</Badge>
              </div>
              <code className="block truncate rounded bg-muted px-2 py-1 text-xs">
                {candidate.stableSelector}
              </code>
              <div className="flex flex-wrap justify-end gap-2">
                <form action={reviewCandidateAction}>
                  <input
                    name="candidateId"
                    type="hidden"
                    value={candidate.id}
                  />
                  <input name="sessionId" type="hidden" value={sessionId} />
                  <input name="decision" type="hidden" value="reject" />
                  <Button size="sm" type="submit" variant="outline">
                    Reject
                  </Button>
                </form>
                <form action={reviewCandidateAction}>
                  <input
                    name="candidateId"
                    type="hidden"
                    value={candidate.id}
                  />
                  <input name="sessionId" type="hidden" value={sessionId} />
                  <input name="decision" type="hidden" value="approve" />
                  <Button size="sm" type="submit">
                    Approve
                  </Button>
                </form>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ScreenshotPreview({
  screenshots,
}: {
  screenshots: { artifactId: string; url: string }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardSummary>
          <CardTitle>Screenshots</CardTitle>
          <CardDescription>
            Captured replay screenshots by artifact.
          </CardDescription>
        </CardSummary>
      </CardHeader>
      <CardContent>
        {screenshots.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No screenshots captured for this session.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {screenshots.map(screenshot => (
              <figure
                className="overflow-hidden rounded-md border border-border/50"
                key={`${screenshot.artifactId}:${screenshot.url}`}
              >
                <img
                  alt="Runtime replay screenshot"
                  className="aspect-video w-full bg-muted object-contain"
                  src={screenshot.url}
                />
                <figcaption className="truncate border-t border-border/50 px-3 py-2 text-xs text-muted-foreground">
                  {screenshot.artifactId}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
