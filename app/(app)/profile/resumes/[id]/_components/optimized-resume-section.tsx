import {
  ResumeOptimization,
  ResumeOptimizationStatus,
} from '@/generated/prisma/browser';

import {
  Field,
  FieldLabel,
  Fields,
  FieldValue,
} from '@/components/data/fields';
import { MarkdownPreview } from '@/components/data/markdown-preview';
import { ResumeOptimizationStatusBadge } from '@/components/resumes/resume-optimization-status-badge';
import { ShareResumeButton } from '@/components/resumes/share-resume-button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardActions,
  CardContent,
  CardHeader,
  CardSummary,
  CardTitle,
} from '@/components/ui/card';
import { ReadMoreBlock } from '@/components/ui/read-more-block';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/css';
import { normalizeResumeMarkdown } from '@/lib/resumes/normalize-markdown';
import { isActiveResumeOptimizationStatus } from '@/lib/resumes/optimization-state';
import type { ResumeRevision } from '@/types/domain/resume';
import { BoltIcon } from '@heroicons/react/24/solid';
import { Download, Star } from 'lucide-react';
import Link from 'next/link';

interface OptimizedResumeSectionProps {
  isDefaultRevision: boolean;
  optimization:
    | (ResumeOptimization & { resumeRevision: ResumeRevision | null })
    | null;
  originalMarkdown: string | null;
  resumeId: string;
  resumeName: string;
  setDefaultRevisionAction: () => Promise<void>;
}

export function OptimizedResumeSection({
  isDefaultRevision,
  optimization,
  originalMarkdown,
  resumeId,
  resumeName,
  setDefaultRevisionAction,
}: OptimizedResumeSectionProps) {
  const normalizedRevisionMarkdown = optimization?.resumeRevision?.markdown
    ? normalizeResumeMarkdown(optimization.resumeRevision.markdown)
    : null;
  const optimizedPdfUrl = optimization?.resumeRevision?.pdfDocumentUrl ?? null;
  const optimizedWordUrl = getDocumentPreviewUrl(
    optimization?.resumeRevision?.wordDocumentUrl ?? null,
  );
  const optimizedDownloadUrl =
    optimization?.resumeRevision?.pdfDocumentUrl ??
    optimization?.resumeRevision?.wordDocumentUrl ??
    null;
  const defaultOptimizedTab = optimizedPdfUrl
    ? 'revision-pdf'
    : optimizedWordUrl
      ? 'revision-word'
      : 'revision-markdown';

  if (optimization?.status === ResumeOptimizationStatus.FAILED) {
    return (
      <Alert className="my-6" variant="destructive">
        <AlertTitle>Resume Optimization Failed</AlertTitle>
        <AlertDescription>
          {optimization?.summary
            ? optimization.summary
            : 'The resume optimization process failed. Please try again.'}
        </AlertDescription>
      </Alert>
    );
  }

  if (!optimization || isActiveResumeOptimizationStatus(optimization.status)) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
            <div className="flex items-center justify-center rounded-full bg-amber-500/10 p-4">
              <BoltIcon className="size-8 animate-pulse text-amber-500" />
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <h3 className="text-base font-semibold text-foreground">
                Optimization in Progress
              </h3>
              <p className="max-w-sm text-center text-sm text-muted-foreground">
                Your resume is being optimized. Results will appear here once
                processing is complete.
              </p>
              {optimization?.status && (
                <div className="mt-2">
                  <ResumeOptimizationStatusBadge
                    status={optimization.status}
                    variant="outline"
                  />
                </div>
              )}
            </div>
            <div className="mt-4 w-full max-w-md space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Optimized Resume Overview */}
      <Card>
        <CardHeader className="h-[59px] border-b-0 pb-0 md:px-5 md:pt-3 md:pb-0">
          <CardSummary>
            <CardTitle>{resumeName} - Optimized</CardTitle>
          </CardSummary>
          <CardActions>
            {optimization?.resumeRevisionId && !isDefaultRevision ? (
              <form action={setDefaultRevisionAction}>
                <button
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'sm' }),
                    'inline-flex items-center',
                  )}
                  type="submit"
                >
                  <Star className="mr-2 size-4" />
                  Set optimized as default
                </button>
              </form>
            ) : null}
            <ShareResumeButton
              resumeId={resumeId}
              resumeName={`${resumeName} - Optimized`}
              size="sm"
            />
            {optimizedDownloadUrl && (
              <Link
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'flex-inline items-center',
                )}
                href={optimizedDownloadUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Link>
            )}
          </CardActions>
        </CardHeader>
        <CardContent className="p-0 md:p-0">
          <Fields className="grid-cols-1">
            <Field>
              <FieldLabel>Description</FieldLabel>
              <FieldValue>{optimization?.summary}</FieldValue>
            </Field>
          </Fields>

          {(optimizedPdfUrl ||
            optimizedWordUrl ||
            normalizedRevisionMarkdown) && (
            <Tabs defaultValue={defaultOptimizedTab}>
              <div className="p-3 pb-0">
                <div className="flex justify-end">
                  <TabsList className="mt-0.5">
                    <TabsTrigger value="revision-pdf">PDF</TabsTrigger>
                    <TabsTrigger value="revision-word">Word</TabsTrigger>
                    <TabsTrigger value="revision-markdown">
                      Markdown
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>
              <TabsContent
                className="p-0"
                scrollable={false}
                value="revision-pdf"
              >
                {optimizedPdfUrl ? (
                  <iframe
                    className="h-[72vh] w-full rounded-lg border border-border bg-muted/20"
                    src={optimizedPdfUrl}
                    title="Optimized resume PDF"
                  />
                ) : (
                  <UnavailableFormat format="PDF" />
                )}
              </TabsContent>
              <TabsContent
                className="p-0"
                scrollable={false}
                value="revision-word"
              >
                {optimizedWordUrl ? (
                  <iframe
                    className="h-[72vh] w-full rounded-lg border border-border bg-muted/20"
                    src={optimizedWordUrl}
                    title="Optimized resume Word document"
                  />
                ) : (
                  <UnavailableFormat format="Word" />
                )}
              </TabsContent>
              <TabsContent
                className="p-0"
                scrollable={false}
                value="revision-markdown"
              >
                {normalizedRevisionMarkdown ? (
                  <ReadMoreBlock className="rounded-lg border border-border bg-muted/80 shadow-inner">
                    <MarkdownPreview
                      className="rounded-sm border border-border bg-muted/20 drop-shadow-lg dark:bg-white/[0.04]"
                      markdown={normalizedRevisionMarkdown}
                      paged
                    />
                  </ReadMoreBlock>
                ) : (
                  <UnavailableFormat format="Markdown" />
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Revision Changes */}
      <Card>
        <CardHeader className="border-b-0 pb-0">
          <CardTitle>
            Revision Changes ({optimization?.changelog?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 md:pt-5">
          {Array.isArray(optimization?.changelog) &&
          optimization.changelog.length > 0 ? (
            <ul className="ml-5 list-disc space-y-3">
              {(
                optimization.changelog as Array<
                  string | { change: string; reason: string }
                >
              ).map((entry, i) => {
                const isStructured =
                  typeof entry === 'object' &&
                  entry !== null &&
                  'change' in entry;
                return (
                  <li className="text-sm/6 text-foreground" key={`change-${i}`}>
                    {isStructured ? (
                      <>
                        <span>{entry.change}</span>
                        <p className="mt-0.5 text-xs/5 text-muted-foreground">
                          {entry.reason}
                        </p>
                      </>
                    ) : (
                      String(entry)
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No changes recorded.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Score Improvements */}
      {optimization && <ImprovementsCard optimization={optimization} />}
    </div>
  );
}

function UnavailableFormat({ format }: { format: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <p className="text-sm text-muted-foreground">
        No {format} preview available.
      </p>
    </div>
  );
}

function getDocumentPreviewUrl(url: string | null): string | null {
  if (!url) return null;

  const path = url.split('?')[0]?.toLowerCase() ?? '';
  if (path.endsWith('.pdf')) {
    return url;
  }

  if (path.endsWith('.doc') || path.endsWith('.docx')) {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
  }

  return url;
}

function ImprovementsCard({
  optimization,
}: {
  optimization: ResumeOptimization;
}) {
  return (
    <Card>
      <CardHeader className="border-b-0 pb-0">
        <CardTitle>Improvements</CardTitle>
      </CardHeader>
      <CardContent className="p-0 md:p-0">
        <Fields className="grid-cols-1 sm:grid-cols-2">
          {optimization.estimatedVisibilityBoost ? (
            <Field className="col-span-1">
              <FieldLabel>Estimated Visibility Boost</FieldLabel>
              <FieldValue className="font-mono text-lg font-semibold">
                {optimization.estimatedVisibilityBoost}
              </FieldValue>
            </Field>
          ) : null}

          {optimization.projectedShortlistProbability ? (
            <Field className="col-span-1">
              <FieldLabel>Projected Shortlist Probability</FieldLabel>
              <FieldValue className="font-mono text-lg font-semibold">
                {optimization.projectedShortlistProbability}
              </FieldValue>
            </Field>
          ) : null}

          {optimization.score ? (
            <Field className="col-span-1">
              <FieldLabel>New Score</FieldLabel>
              <FieldValue className="font-mono text-lg font-semibold">
                {optimization.score}
              </FieldValue>
            </Field>
          ) : null}

          {optimization.scoreImprovement ? (
            <Field className="col-span-1">
              <FieldLabel>Score Improvement</FieldLabel>
              <FieldValue
                className={cn(
                  optimization.scoreImprovement > 0
                    ? 'text-green-500'
                    : 'text-red-500',
                  'font-mono text-lg font-semibold',
                )}
              >
                {optimization.scoreImprovement > 0 ? '+' : '-'}
                {optimization.scoreImprovement}
              </FieldValue>
            </Field>
          ) : null}

          {optimization.scorePercentChange ? (
            <Field className="col-span-1">
              <FieldLabel>Percent Change</FieldLabel>
              <FieldValue
                className={cn(
                  optimization.scorePercentChange > 0
                    ? 'text-green-500'
                    : 'text-red-500',
                  'font-mono text-lg font-semibold',
                )}
              >
                {optimization.scorePercentChange > 0 ? '+' : '-'}
                {optimization.scorePercentChange}%
              </FieldValue>
            </Field>
          ) : null}

          {optimization.significantImprovements?.length ? (
            <Field className="sm:col-span-2">
              <FieldLabel>Significant Improvements</FieldLabel>
              <FieldValue>
                <ul className="ml-5 list-disc">
                  {optimization.significantImprovements.map((imp, i) => (
                    <li key={`imp-${i}`}>{imp}</li>
                  ))}
                </ul>
              </FieldValue>
            </Field>
          ) : null}
        </Fields>
      </CardContent>
    </Card>
  );
}
