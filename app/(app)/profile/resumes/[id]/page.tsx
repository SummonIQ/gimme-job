import {
  ResumeAnalysisStatus,
  ResumeOptimizationStatus,
  type Resume,
} from '@/generated/prisma/browser';
import { CalendarIcon, StarFilledIcon } from '@radix-ui/react-icons';
import { Download, MoreHorizontal, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { redirect, unauthorized } from 'next/navigation';

import { DateLabel } from '@/components/data/date-label';
import {
  Metadata,
  MetadataIcon,
  MetadataLabel,
} from '@/components/data/metadata-list';
import {
  Page,
  PageContent,
  PageHeader,
  PageMetadata,
} from '@/components/layout/page';
import { ResumeRealtimeStatus } from '@/components/resumes/resume-realtime-status';
import { ShareResumeMenuItem } from '@/components/resumes/share-resume-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getUserResume,
  setDefaultResumeRevision,
  setUserDefaultResume,
} from '@/lib/resumes';
import { deleteResume } from '@/lib/resumes/delete';
import { getSessionUser } from '@/lib/user/query';
import { getUserDefaultResumeId } from '@/lib/user/resumes';
import type { ResumeAnalysis } from '@/types/domain/resume';

import { AnalysisSection } from './_components/analysis-section';
import { OptimizedResumeSection } from './_components/optimized-resume-section';
import { OriginalResumeSection } from './_components/original-resume-section';
import { ResumeChat } from './_components/resume-chat';

export default async function ResumeDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  type ResumeDetailsOptimization = Parameters<
    typeof OptimizedResumeSection
  >[0]['optimization'];

  const { id } = await params;
  const selectedTab =
    (await searchParams)?.tab === 'optimized-resume'
      ? 'optimized-resume'
      : 'original-resume';
  const user = await getSessionUser();
  if (!user?.id) {
    return unauthorized();
  }

  const resume = (await getUserResume({
    id,
    include: {
      analysis: true,
      optimization: {
        include: {
          resumeRevision: true,
        },
      },
      revisions: true,
    },
    userId: user.id,
  })) as
    | (Resume & {
        analysis?: ResumeAnalysis | null;
        optimization?: ResumeDetailsOptimization;
      })
    | null;

  if (!resume) {
    return { notFound: true };
  }

  const defaultResumeId = await getUserDefaultResumeId(user.id);
  const isDefaultResume = defaultResumeId === resume.id;
  const userDefaultRevisionId =
    (user as { defaultRevisionId?: string | null }).defaultRevisionId ?? null;
  const optimizedRevisionId =
    resume.optimization?.resumeRevisionId ??
    resume.optimization?.resumeRevision?.id ??
    null;
  const defaultRevisionId = resume.defaultRevisionId ?? userDefaultRevisionId;
  const isDefaultOptimizedRevision = Boolean(
    isDefaultResume &&
    optimizedRevisionId &&
    defaultRevisionId === optimizedRevisionId,
  );
  const isDefaultOriginalResume =
    isDefaultResume && !isDefaultOptimizedRevision;
  const optimizedDownloadUrl =
    resume.optimization?.resumeRevision?.wordDocumentUrl ?? null;
  const hasDownloadActions = Boolean(resume.url || optimizedDownloadUrl);

  const hasDetailedAnalysis = Boolean(
    resume.analysis?.achievements &&
    resume.analysis?.formatting &&
    resume.analysis?.grammar &&
    resume.analysis?.keywords &&
    resume.analysis?.readability &&
    resume.analysis?.recommendations &&
    resume.analysis?.sections &&
    resume.analysis?.spelling,
  );

  const canRenderAnalysisSection =
    resume.analysis?.status === ResumeAnalysisStatus.COMPLETED &&
    hasDetailedAnalysis;
  const analysisForRender =
    canRenderAnalysisSection && resume.analysis ? resume.analysis : null;

  return (
    <Page card={false} contentWrapper={false} name="resume-details">
      <PageHeader
        title={
          <span className="flex min-w-0 items-center gap-3">
            <span>{resume.name}</span>
            {isDefaultResume ? (
              <Badge
                className="gap-x-2 rounded-md border-none bg-yellow-500/10 px-2 py-1 text-sm"
                variant="outline"
              >
                <StarFilledIcon className="size-[15px] text-yellow-500/80" />
                <span className="text-sm font-semibold leading-normal tracking-normal text-yellow-500/90">
                  Default
                </span>
              </Badge>
            ) : null}
          </span>
        }
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="size-9 min-w-9 rounded-full p-0"
                  size="icon"
                  variant="outline"
                >
                  <span className="sr-only">Open resume actions</span>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <ShareResumeMenuItem
                  resumeId={resume.id}
                  resumeName={resume.name}
                />
                {!isDefaultOriginalResume ? (
                  <>
                    <form
                      action={async () => {
                        'use server';

                        await setUserDefaultResume(resume.id);
                      }}
                    >
                      <DropdownMenuItem asChild>
                        <button
                          className="flex w-full items-center gap-2 text-left text-sm font-medium"
                          type="submit"
                        >
                          <StarFilledIcon className="size-4 text-current" />
                          <span className="text-sm font-medium">
                            Set original as default
                          </span>
                        </button>
                      </DropdownMenuItem>
                    </form>
                    {!hasDownloadActions ? <DropdownMenuSeparator /> : null}
                  </>
                ) : null}
                {hasDownloadActions ? (
                  <>
                    <DropdownMenuSeparator />
                    {resume.url ? (
                      <DropdownMenuItem asChild>
                        <Link
                          className="flex w-full items-center gap-2 text-left text-sm font-medium"
                          href={resume.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download className="size-4 text-current" />
                          <span className="text-sm font-medium">
                            Download original
                          </span>
                        </Link>
                      </DropdownMenuItem>
                    ) : null}
                    {optimizedDownloadUrl ? (
                      <DropdownMenuItem asChild>
                        <Link
                          className="flex w-full items-center gap-2 text-left text-sm font-medium"
                          href={optimizedDownloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download className="size-4 text-current" />
                          <span className="text-sm font-medium">
                            Download optimized
                          </span>
                        </Link>
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuSeparator />
                  </>
                ) : null}
                <form
                  action={async () => {
                    'use server';

                    await deleteResume(resume.id);
                    redirect('/profile');
                  }}
                >
                  <DropdownMenuItem asChild>
                    <button
                      className="flex w-full items-center gap-2 text-left text-sm font-medium text-rose-500"
                      type="submit"
                    >
                      <Trash2 className="size-4 text-current" />
                      <span className="text-sm font-medium">Delete</span>
                    </button>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>

            <ResumeChat
              resumeId={resume.id}
              resumeName={resume.name}
              currentMarkdown={resume.markdown}
              triggerClassName="self-end z-auto h-9 rounded-lg px-4 shadow-none"
            />
          </>
        }
      >
        <PageMetadata>
          <Metadata>
            <MetadataIcon>
              <CalendarIcon
                aria-hidden="true"
                className="-mt-px size-[18px] shrink-0 opacity-80"
              />
            </MetadataIcon>
            <MetadataLabel>
              <span>
                Uploaded on{' '}
                <DateLabel className="font-semibold" date={resume.createdAt} />
              </span>
            </MetadataLabel>
          </Metadata>
        </PageMetadata>
      </PageHeader>

      <PageContent>
        <ResumeRealtimeStatus
          initialProgress={resume.optimization?.progress ?? 0}
          initialStatus={resume.optimization?.status}
          resumeId={resume.id}
        />

        <Tabs defaultValue={selectedTab}>
          <TabsList>
            <TabsTrigger value="original-resume">Original Resume</TabsTrigger>
            <TabsTrigger
              className="flex items-center gap-1.5"
              value="optimized-resume"
            >
              {resume.optimization?.status ===
              ResumeOptimizationStatus.FAILED ? (
                <>
                  <span className="size-2.5 animate-pulse rounded-full bg-red-500" />
                  Optimized Resume
                </>
              ) : (
                'Optimized Resume'
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent
            className="space-y-6"
            scrollable={false}
            value="original-resume"
          >
            <OriginalResumeSection
              description={resume.description}
              markdown={resume.markdown}
              url={resume.url}
            />

            {analysisForRender ? (
              <AnalysisSection analysis={analysisForRender} />
            ) : resume.analysis ? (
              <p className="text-sm text-muted-foreground">
                Analysis is still in progress. Detailed insights will appear
                once processing is complete.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No analysis found.
              </p>
            )}
          </TabsContent>

          {/* ─── OPTIMIZED RESUME ────────────────────────────── */}
          <TabsContent scrollable={false} value="optimized-resume">
            <OptimizedResumeSection
              isDefaultRevision={isDefaultOptimizedRevision}
              optimization={resume.optimization ?? null}
              originalMarkdown={resume.markdown}
              resumeId={resume.id}
              resumeName={resume.name}
              setDefaultRevisionAction={async () => {
                'use server';

                if (!optimizedRevisionId) {
                  return;
                }

                await setDefaultResumeRevision(resume.id, optimizedRevisionId);
              }}
            />
          </TabsContent>
        </Tabs>
      </PageContent>
    </Page>
  );
}
