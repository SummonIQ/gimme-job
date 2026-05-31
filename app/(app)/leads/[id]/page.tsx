import { MarkdownPreview } from '@/components/data/markdown-preview';
import { ApplyButton } from '@/components/job-applications/apply-button';
import { JobLeadProgressTracker } from '@/components/job-leads/job-lead-progress-tracker';
import { JobDescription } from '@/components/job-listings/job-description';
import { Page } from '@/components/layout/page';
import { DownloadResume } from '@/components/resumes/download-resume';
import { ResumeMarkdownDiff } from '@/components/resumes/resume-markdown-diff';
import { ResumeOptimizationStatusBadge } from '@/components/resumes/resume-optimization-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ReadMoreBlock } from '@/components/ui/read-more-block';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  JobFitAnalysis,
  JobFitAnalysisStatus,
  JobLead,
  JobLeadOptimization,
  JobLeadOptimizationStatus,
  JobLeadStatus,
  JobListing,
  JobProvider,
  Resume,
  ResumeOptimization,
  ResumeOptimizationStatus,
  ResumeRevision,
} from '@/generated/prisma/browser';
import { cn } from '@/lib/css';
import { getJobLead } from '@/lib/job-leads/query';
import { updateJobLeadStatus } from '@/lib/job-leads/status';
import { getSessionUser } from '@/lib/user/query';
import { formatLocationLabel } from '@/lib/utils';
import {
  AlertTriangle,
  Ban,
  CheckCircle,
  MoreHorizontal,
  RefreshCcw,
} from 'lucide-react';
import type { Metadata as NextMetadata } from 'next';
import Link from 'next/link';
import { notFound, unauthorized } from 'next/navigation';
import { Suspense } from 'react';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<NextMetadata> {
  // read route params
  const id = (await params).id;
  const user = await getSessionUser();

  if (!user?.id) {
    return unauthorized();
  }

  const jobLead = (await getJobLead({
    id,
    include: {
      jobListing: true,
    },
    userId: user.id,
  })) as JobLead & {
    jobListing: JobListing;
  };

  if (!jobLead) {
    return {
      description: 'View job lead details',
      title: 'Job Lead Details | Gimme Job',
    };
  }

  return {
    description: jobLead?.jobListing?.description?.slice(0, 32),
    title: `Job Lead - ${jobLead.jobListing?.title} | Gimme Job`,
  };
}

export default async function LeadDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();

  if (!user?.id) {
    return unauthorized();
  }

  const { id } = await params;

  // Note: The include now fetches jobFitAnalysis along with other relations.
  const jobLead = (await getJobLead({
    id,
    include: {
      jobFitAnalysis: {
        include: {
          resume: true,
          resumeRevision: true,
        },
      },
      jobListing: true,
      optimization: {
        include: {
          resumeRevision: {
            include: {
              resume: true,
            },
          },
        },
      },
      resumeOptimizations: {
        take: 1,
        orderBy: { createdAt: 'desc' as const },
      },
    },
    userId: user.id,
  })) as JobLead & {
    jobFitAnalysis: JobFitAnalysis & {
      resume?: Resume | null;
      resumeRevision?: ResumeRevision | null;
    };
    jobListing: JobListing;
    optimization: JobLeadOptimization & {
      resumeRevision: (ResumeRevision & { resume?: Resume | null }) | null;
    };
    resumeOptimizations: ResumeOptimization[];
  };

  if (!jobLead) {
    return notFound();
  }

  const analysisProgress =
    jobLead.jobFitAnalysis?.status === JobFitAnalysisStatus.COMPLETED
      ? 100
      : (jobLead.jobFitAnalysis?.progress ?? 0);
  const optimizationProgress =
    jobLead.optimization?.status === JobLeadOptimizationStatus.COMPLETED
      ? 100
      : (jobLead.optimization?.progress ?? 0);
  const originalResumeMarkdown =
    jobLead.jobFitAnalysis?.resumeRevision?.markdown ??
    jobLead.jobFitAnalysis?.resume?.markdown ??
    jobLead.optimization?.resumeRevision?.resume?.markdown ??
    '';
  const revisedResumeMarkdown =
    jobLead.optimization?.resumeRevision?.markdown ?? '';
  const hasResumeComparison = Boolean(
    originalResumeMarkdown && revisedResumeMarkdown,
  );
  const changelog = jobLead.resumeOptimizations?.[0]?.changelog;
  const hasCompanyLogo = Boolean(jobLead.jobListing?.companyLogoUrl);
  const applyOptions = Array.isArray(jobLead.jobListing?.applyOptions)
    ? (
        jobLead.jobListing.applyOptions as Array<{
          buttonText?: string;
          link?: string;
          title?: string;
        }>
      )
        .filter(option => Boolean(option.link))
        .map(option => ({
          buttonText: option.buttonText,
          link: option.link as string,
          title: option.title,
        }))
    : [];
  const applyUrl =
    jobLead.jobListing?.jobProviderUrl || applyOptions[0]?.link || undefined;

  return (
    <Page
      actions={
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="size-8 rounded-full p-0"
                size="icon"
                variant="outline"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {jobLead.status !== JobLeadStatus.APPLIED && (
                <>
                  <form
                    action={async () => {
                      'use server';

                      await updateJobLeadStatus({
                        jobLeadId: jobLead.id,
                        status: JobLeadStatus.APPLIED,
                      });
                    }}
                  >
                    <DropdownMenuItem asChild>
                      <button
                        className="flex w-full items-center gap-2 text-left text-sm font-medium"
                        type="submit"
                      >
                        <CheckCircle className="size-4 text-current" />
                        <span className="text-sm font-medium">
                          Mark as Applied
                        </span>
                      </button>
                    </DropdownMenuItem>
                  </form>
                  <DropdownMenuSeparator />
                </>
              )}
              <form
                action={async () => {
                  'use server';

                  const { reoptimizeJobLead } =
                    await import('@/lib/job-leads/reoptimize');
                  await reoptimizeJobLead({ jobLeadId: jobLead.id });
                }}
              >
                <DropdownMenuItem asChild>
                  <button
                    className="flex w-full items-center gap-2 text-left text-sm font-medium"
                    type="submit"
                  >
                    <RefreshCcw className="size-4 text-current" />
                    <span className="text-sm font-medium">
                      Re-optimize Resume
                    </span>
                  </button>
                </DropdownMenuItem>
              </form>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-sm font-medium text-rose-500 focus:bg-rose-500/10 focus:text-rose-300">
                <Ban className="size-4 text-current" />
                <span className="text-sm font-medium">Dismiss</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {(applyUrl || applyOptions.length > 0) && (
            <ApplyButton
              applyOptions={applyOptions}
              applyUrl={applyUrl}
              jobId={jobLead.jobListing?.jobId || jobLead.id}
              jobLeadId={jobLead.id}
              size="sm"
              userName={user.name}
              variant="default"
            />
          )}
        </>
      }
      name="job-lead-details"
      description={`Created on ${jobLead?.createdAt ? new Date(jobLead.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}`}
      title={jobLead?.jobListing?.title || 'Job Lead Details'}
    >
      <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/20 shadow-sm">
        <Suspense fallback={<></>}>
          <JobLeadProgressTracker
            className="mb-0 rounded-none border-b border-border/60 bg-background px-6 pb-4 pt-[22px] shadow-sm"
            createComplete={true}
            analyzeComplete={
              jobLead.jobFitAnalysis?.status === JobFitAnalysisStatus.COMPLETED
            }
            analyzeProgress={analysisProgress}
            jobLeadStatus={jobLead.status}
            optimizedProgress={optimizationProgress}
            jobLeadId={jobLead.id}
          />
        </Suspense>

        {(jobLead.status === JobLeadStatus.ANALYSIS_FAILED ||
          jobLead.status === JobLeadStatus.OPTIMIZATION_FAILED) && (
          <div className="mx-5 mt-5 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
            <AlertTriangle className="size-5 shrink-0 text-red-500" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-500">
                {jobLead.status === JobLeadStatus.ANALYSIS_FAILED
                  ? 'Job fit analysis failed'
                  : 'Resume optimization failed'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {jobLead.status === JobLeadStatus.ANALYSIS_FAILED
                  ? 'The AI was unable to analyze this job against your resume. This can happen due to timeouts or service issues.'
                  : 'The AI was unable to optimize your resume for this job. This can happen due to timeouts or service issues.'}
              </p>
            </div>
            <form
              action={async () => {
                'use server';
                const { reoptimizeJobLead } =
                  await import('@/lib/job-leads/reoptimize');
                await reoptimizeJobLead({ jobLeadId: jobLead.id });
              }}
            >
              <Button
                type="submit"
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5 border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-600"
              >
                <RefreshCcw className="size-3.5" />
                Retry
              </Button>
            </form>
          </div>
        )}

        <div className="p-3 sm:p-5">
          <Tabs defaultValue="job-details">
            <TabsList className="mb-3">
              <TabsTrigger value="job-details">Job Details</TabsTrigger>
              <TabsTrigger
                className="flex items-center gap-1.5"
                value="analysis"
              >
                {jobLead.jobFitAnalysis ? (
                  jobLead.jobFitAnalysis.status ===
                  JobFitAnalysisStatus.ANALYZING ? (
                    <>
                      <span className="size-2.5 animate-pulse rounded-full bg-blue-500">
                        <RefreshCcw className="size-1.5 animate-spin text-background" />
                      </span>
                      Job Fit Analysis
                    </>
                  ) : jobLead.jobFitAnalysis.status ===
                    JobFitAnalysisStatus.COMPLETED ? (
                    <>
                      <span className="size-2.5 rounded-full bg-green-500" />
                      Job Fit Analysis
                    </>
                  ) : (
                    <>
                      <span className="size-2.5 rounded-full bg-red-500" />
                      Job Fit Analysis
                    </>
                  )
                ) : (
                  <>Job Fit Analysis</>
                )}
              </TabsTrigger>
              <TabsTrigger
                className="flex items-center gap-1.5"
                value="resumes"
              >
                {jobLead.optimization?.status ===
                  JobLeadOptimizationStatus.ANALYZING ||
                jobLead.optimization?.status ===
                  JobLeadOptimizationStatus.OPTIMIZING ||
                jobLead.optimization?.status ===
                  JobLeadOptimizationStatus.QUEUED ? (
                  <>
                    <span className="size-2.5 animate-pulse rounded-full bg-blue-500">
                      <RefreshCcw className="size-1.5 animate-spin text-background" />
                    </span>
                    Optimizing Resume
                  </>
                ) : jobLead.optimization?.status ===
                  JobLeadOptimizationStatus.COMPLETED ? (
                  <>
                    <span className="size-2.5 rounded-full bg-green-500" />
                    Optimized Resume
                  </>
                ) : jobLead.optimization?.status ===
                  JobLeadOptimizationStatus.FAILED ? (
                  <>
                    <span className="size-2.5 rounded-full bg-red-500" />
                    Optimized Resume
                  </>
                ) : null}
              </TabsTrigger>
            </TabsList>

            <TabsContent
              className="mt-0"
              scrollable={false}
              value="job-details"
            >
              <Card>
                <CardContent className="flex-col p-0 md:p-0">
                  <dl className="grid grid-cols-1 sm:grid-cols-2">
                    {jobLead?.jobListing?.company && (
                      <div className="space-y-1 border-b border-border/60 p-4 sm:col-span-1 md:p-5 ">
                        <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                          Company
                        </dt>
                        <dd className="flex flex-row items-center truncate text-sm/6 font-medium text-foreground sm:mt-2">
                          <div
                            className={cn(
                              'relative mr-3 flex h-12 w-12 items-center justify-center overflow-hidden rounded-sm border border-border bg-muted text-xs font-semibold uppercase',
                              hasCompanyLogo
                                ? 'text-transparent'
                                : 'text-muted-foreground',
                            )}
                            style={
                              hasCompanyLogo
                                ? {
                                    backgroundImage: `url(${jobLead.jobListing.companyLogoUrl})`,
                                    backgroundPosition: 'center',
                                    backgroundRepeat: 'no-repeat',
                                    backgroundSize: 'contain',
                                  }
                                : undefined
                            }
                          >
                            <span>
                              {jobLead.jobListing.company?.slice(0, 1) ?? '?'}
                            </span>
                          </div>
                          <span>{jobLead.jobListing.company}</span>
                        </dd>
                      </div>
                    )}
                    {jobLead.jobListing?.location && (
                      <div className="border-b border-border/60 p-4 sm:col-span-1 md:p-5">
                        <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                          Location
                        </dt>
                        <dd className="mt-1 truncate text-sm/6 text-foreground sm:mt-2">
                          {formatLocationLabel(jobLead.jobListing.location)}
                        </dd>
                      </div>
                    )}
                    {jobLead.jobListing?.salary && (
                      <div className="border-b border-border/60 p-4 sm:col-span-1 md:p-5">
                        <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                          Salary
                        </dt>
                        <dd className="mt-1 truncate text-sm/6 text-foreground sm:mt-2">
                          {jobLead.jobListing.salary}
                        </dd>
                      </div>
                    )}
                    {jobLead.jobListing?.remote && (
                      <div className="border-b border-border/60 p-4 sm:col-span-1 md:p-5">
                        <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                          Remote
                        </dt>
                        <dd className="mt-1 truncate text-sm/6 text-foreground sm:mt-2">
                          {jobLead.jobListing.remote ? 'Yes' : 'No'}
                        </dd>
                      </div>
                    )}
                    {jobLead.jobListing?.jobProvider && (
                      <div className="border-b border-border/60 p-4 sm:col-span-1 md:p-5">
                        <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                          Job board
                        </dt>
                        <dd className="mt-1 truncate text-sm/6 text-foreground sm:mt-2">
                          {jobLead.jobListing.jobProvider ===
                          JobProvider.CAREER_BUILDER ? (
                            <span>CareerBuilder</span>
                          ) : jobLead.jobListing.jobProvider ===
                            JobProvider.SERPAPI ? (
                            <span>Google Jobs</span>
                          ) : null}
                        </dd>
                      </div>
                    )}
                    {jobLead.jobListing?.jobProviderUrl && (
                      <div className="border-b border-border p-4 sm:col-span-2 md:p-5">
                        <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                          URL
                        </dt>
                        <dd className="mt-1 truncate text-sm/6 sm:mt-2">
                          <a
                            className="text-primary underline underline-offset-2"
                            href={jobLead.jobListing.jobProviderUrl}
                          >
                            {jobLead.jobListing.jobProviderUrl}
                          </a>
                        </dd>
                      </div>
                    )}
                    {jobLead.jobListing?.healthInsurance && (
                      <div className="border-b border-border/60 p-4 sm:col-span-1 md:p-5">
                        <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                          Health Insurance
                        </dt>
                        <dd className="mt-1 truncate text-sm/6 text-foreground sm:mt-2">
                          {jobLead.jobListing.healthInsurance ? 'Yes' : 'No'}
                        </dd>
                      </div>
                    )}
                    {jobLead.jobListing?.dentalCoverage && (
                      <div className="border-b border-border/60 p-4 sm:col-span-1 md:p-5">
                        <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                          Dental Coverage
                        </dt>
                        <dd className="mt-1 truncate text-sm/6 text-foreground sm:mt-2">
                          {jobLead.jobListing.dentalCoverage ? 'Yes' : 'No'}
                        </dd>
                      </div>
                    )}
                    {jobLead.jobListing?.paidTimeOff && (
                      <div className="border-b border-border/60 p-4 sm:col-span-1 md:p-5">
                        <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                          Paid Time Off
                        </dt>
                        <dd className="mt-1 truncate text-sm/6 text-foreground sm:mt-2">
                          {jobLead.jobListing.paidTimeOff ? 'Yes' : 'No'}
                        </dd>
                      </div>
                    )}
                    {jobLead.jobListing?.requirements &&
                      jobLead.jobListing.requirements.length > 0 && (
                        <div className="space-y-1 border-b border-border/60 p-4 sm:col-span-2 sm:space-y-2 md:p-5">
                          <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                            Requirements
                          </dt>
                          <dd className="mt-1 w-full sm:mt-2 md:mt-3">
                            <ul className="list-disc space-y-2.5 pl-6">
                              {jobLead.jobListing.requirements.map(
                                (requirement, i) => (
                                  <li
                                    className="text-pretty text-sm/5"
                                    key={`${requirement}-${i}`}
                                  >
                                    {requirement}
                                  </li>
                                ),
                              )}
                            </ul>
                          </dd>
                        </div>
                      )}
                    {jobLead.jobListing?.responsibilities &&
                      jobLead.jobListing.responsibilities.length > 0 && (
                        <div className="border-b border-border/60 p-4 sm:col-span-2 md:p-5">
                          <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                            Responsibilities
                          </dt>
                          <dd className="mt-1 w-full sm:mt-2 md:mt-3">
                            <ul className="list-disc space-y-2.5 pl-6">
                              {jobLead.jobListing.responsibilities.map(
                                (responsibility, i) => (
                                  <li
                                    className="text-pretty text-sm/5"
                                    key={`${responsibility}-${i}`}
                                  >
                                    {responsibility}
                                  </li>
                                ),
                              )}
                            </ul>
                          </dd>
                        </div>
                      )}
                    {jobLead.jobListing?.qualifications &&
                      jobLead.jobListing.qualifications.length > 0 && (
                        <div className="space-y-1 border-b border-border/60 p-4 sm:col-span-2 sm:space-y-2 md:p-5">
                          <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                            Qualifications
                          </dt>
                          <dd className="mt-1 w-full sm:mt-2 md:mt-3">
                            <ul className="list-disc space-y-2.5 pl-6">
                              {jobLead.jobListing.qualifications.map(
                                (qualification, i) => (
                                  <li
                                    className="text-pretty text-sm/5"
                                    key={`${qualification}-${i}`}
                                  >
                                    {qualification}
                                  </li>
                                ),
                              )}
                            </ul>
                          </dd>
                        </div>
                      )}
                    {jobLead.jobListing?.benefits &&
                      jobLead.jobListing.benefits.length > 0 && (
                        <div className="space-y-1 border-b border-border/60 p-4 sm:col-span-2 sm:space-y-2 md:p-5">
                          <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                            Benefits
                          </dt>
                          <dd className="mt-1 w-full sm:mt-2 md:mt-3">
                            <ul className="list-disc space-y-2.5 pl-6">
                              {jobLead.jobListing.benefits.map((benefit, i) => (
                                <li
                                  className="text-pretty text-sm/5"
                                  key={`${benefit}-${i}`}
                                >
                                  {benefit}
                                </li>
                              ))}
                            </ul>
                          </dd>
                        </div>
                      )}
                    {jobLead.jobListing?.applyOptions &&
                      Array.isArray(jobLead.jobListing.applyOptions) &&
                      jobLead.jobListing.applyOptions.length > 0 && (
                        <div className="space-y-1 border-b border-border/60 p-4 sm:col-span-2 sm:space-y-2 md:p-5">
                          <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                            Apply Options
                          </dt>
                          <dd className="mt-1 w-full sm:mt-2 md:mt-3">
                            <ul className="list-disc space-y-2.5 pl-6">
                              {jobLead.jobListing.applyOptions.map(
                                (applyOption, i) => (
                                  <li
                                    className="text-pretty text-sm/5"
                                    key={`${(applyOption as { url: string }).url}-${i}`}
                                  >
                                    <h4 className="font-semibold">
                                      {(applyOption as { title: string }).title}
                                    </h4>
                                    <a
                                      className="block truncate text-primary underline underline-offset-2"
                                      href={
                                        (applyOption as { link: string }).link
                                      }
                                    >
                                      {(applyOption as { link: string }).link}
                                    </a>
                                  </li>
                                ),
                              )}
                            </ul>
                          </dd>
                        </div>
                      )}
                    {jobLead.jobListing?.description && (
                      <div className="space-y-1 border-b border-border/60 p-4 sm:col-span-2 sm:space-y-2 md:p-5">
                        <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                          Description
                        </dt>
                        <dd className="text-pretty text-sm/6 tracking-wide text-foreground">
                          <JobDescription
                            description={jobLead.jobListing.description}
                            className="space-y-1"
                          />
                        </dd>
                      </div>
                    )}
                  </dl>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent className="mt-0" scrollable={false} value="analysis">
              <Card>
                <CardContent className="flex-col p-0 md:p-0">
                  {jobLead.jobFitAnalysis ? (
                    <dl className="grid grid-cols-1 sm:grid-cols-2">
                      {jobLead.jobFitAnalysis ? (
                        <>
                          <div className="space-y-1 border-b border-border/60 p-4 sm:col-span-1 md:p-5">
                            <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                              Job Fit Score
                            </dt>
                            <dd className="flex flex-row items-center truncate text-sm/6 font-medium text-foreground sm:mt-2">
                              <span className="font-mono text-lg">
                                {jobLead.jobFitAnalysis.overallMatchScore}
                              </span>
                            </dd>
                          </div>
                          <div className="space-y-1 border-b border-border/60 p-4 sm:col-span-2 sm:space-y-2 md:p-5">
                            <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                              Job Fit Summary
                            </dt>
                            <dd className="text-pretty text-sm/6 tracking-wide text-foreground">
                              {jobLead.jobFitAnalysis.summary}
                            </dd>
                          </div>
                          <div className="space-y-1 border-b border-border/60 p-4 sm:col-span-2 sm:space-y-2 md:p-5">
                            <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                              Keyword Match
                            </dt>
                            <dd className="text-pretty text-sm/6 tracking-wide text-foreground">
                              Matched Keywords:{' '}
                              {(
                                jobLead.jobFitAnalysis.keywordMatch as any
                              )?.matched_keywords?.join(', ')}
                              <br />
                              Match Percentage:{' '}
                              {
                                (jobLead.jobFitAnalysis.keywordMatch as any)
                                  ?.match_percentage
                              }
                              %
                            </dd>
                          </div>
                          <div className="space-y-1 border-b border-border/60 p-4 sm:col-span-2 sm:space-y-2 md:p-5">
                            <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                              Missing Keywords
                            </dt>
                            <dd className="text-pretty text-sm/6 tracking-wide text-foreground">
                              {jobLead.jobFitAnalysis.missingKeywords.join(
                                ', ',
                              )}
                            </dd>
                          </div>
                          <div className="space-y-1 border-b border-border/60 p-4 sm:col-span-2 sm:space-y-2 md:p-5">
                            <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                              Skills Alignment
                            </dt>
                            <dd className="text-pretty text-sm/6 tracking-wide text-foreground">
                              Skills:{' '}
                              {(
                                jobLead.jobFitAnalysis.skillsAlignment as any
                              )?.skills?.join(', ')}
                              <br />
                              Alignment Score:{' '}
                              {
                                (jobLead.jobFitAnalysis.skillsAlignment as any)
                                  ?.alignment_score
                              }
                            </dd>
                          </div>
                          <div className="space-y-1 border-b border-border/60 p-4 sm:col-span-1 md:p-5">
                            <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                              Experience Relevance Score
                            </dt>
                            <dd className="text-pretty text-sm/6 tracking-wide text-foreground">
                              {jobLead.jobFitAnalysis.experienceRelevanceScore}
                            </dd>
                          </div>
                          <div className="space-y-1 border-b border-border/60 p-4 sm:col-span-1 md:p-5">
                            <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                              Education Relevance Score
                            </dt>
                            <dd className="text-pretty text-sm/6 tracking-wide text-foreground">
                              {jobLead.jobFitAnalysis.educationRelevanceScore}
                            </dd>
                          </div>
                          <div className="space-y-1 border-b border-border/60 p-4 sm:col-span-2 sm:space-y-2 md:p-5">
                            <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                              Recommendations
                            </dt>
                            <dd className="text-pretty text-sm/6 tracking-wide text-foreground">
                              <ul>
                                {jobLead.jobFitAnalysis.recommendations.map(
                                  (rec, index) => (
                                    <li key={index}>{rec}</li>
                                  ),
                                )}
                              </ul>
                            </dd>
                          </div>
                          {jobLead.jobFitAnalysis.additionalMetrics && (
                            <div className="space-y-1 border-b border-border/60 p-4 sm:col-span-2 sm:space-y-2 md:p-5">
                              <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                                Additional Metrics
                              </dt>
                              <dd className="text-pretty text-sm/6 tracking-wide text-foreground">
                                <pre className="whitespace-pre-wrap">
                                  {JSON.stringify(
                                    jobLead.jobFitAnalysis.additionalMetrics,
                                    null,
                                    2,
                                  )}
                                </pre>
                              </dd>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="p-4">
                          <p className="text-sm text-muted-foreground">
                            Job fit analysis not available.
                          </p>
                        </div>
                      )}
                    </dl>
                  ) : (
                    <div className="p-4 text-center">
                      <p className="text-sm text-muted-foreground">
                        Job fit analysis not available.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent className="mt-0" scrollable={false} value="resumes">
              <Card>
                <CardContent className="flex-col p-0 md:p-0">
                  {jobLead.optimization?.status ===
                  JobLeadOptimizationStatus.COMPLETED ? (
                    <dl className="grid grid-cols-1 gap-3 p-4 md:p-5">
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <dt className="text-sm font-medium text-muted-foreground/80">
                            Revision
                          </dt>
                          <dd className="text-sm font-medium text-foreground">
                            #1
                          </dd>
                        </div>
                        <span className="hidden text-border sm:inline">|</span>
                        <div className="flex items-center gap-2">
                          <dt className="text-sm font-medium text-muted-foreground/80">
                            Status
                          </dt>
                          <dd>
                            {jobLead.optimization?.status && (
                              <ResumeOptimizationStatusBadge
                                status={
                                  jobLead.optimization
                                    ?.status as ResumeOptimizationStatus
                                }
                              />
                            )}
                          </dd>
                        </div>
                        <span className="hidden text-border sm:inline">|</span>
                        <div className="flex items-center gap-2">
                          <dt className="text-sm font-medium text-muted-foreground/80">
                            Progress
                          </dt>
                          <dd className="text-sm font-medium text-foreground">
                            {optimizationProgress}%
                          </dd>
                        </div>
                      </div>

                      {Array.isArray(changelog) && changelog.length > 0 && (
                        <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-4 sm:col-span-2">
                          <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                            Resume Optimizations
                          </dt>
                          <dd>
                            <ul className="ml-5 list-disc space-y-3">
                              {(
                                changelog as Array<
                                  string | { change: string; reason: string }
                                >
                              ).map((entry, i) => {
                                const isStructured =
                                  typeof entry === 'object' &&
                                  entry !== null &&
                                  'change' in entry;
                                return (
                                  <li
                                    className="text-pretty text-sm/6 tracking-wide text-foreground"
                                    key={`change-${i}`}
                                  >
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
                          </dd>
                        </div>
                      )}

                      {jobLead.optimization?.resumeRevision?.markdown && (
                        <Tabs
                          className="sm:col-span-2"
                          defaultValue="markdown-preview"
                        >
                          <div className="flex grow flex-col space-y-2 rounded-md border border-border/60 bg-muted/20 p-4 sm:col-span-2">
                            <dt className="flex grow justify-between text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                              <span>Optimized Resume</span>

                              {jobLead.optimization?.resumeRevision
                                ?.wordDocumentUrl && (
                                <DownloadResume
                                  url={
                                    jobLead.optimization?.resumeRevision
                                      ?.wordDocumentUrl
                                  }
                                />
                              )}
                              {/* <TabsList>
                              <TabsTrigger value="markdown-preview">
                                Preview
                              </TabsTrigger>
                              <TabsTrigger value="markdown-raw">
                                Raw
                              </TabsTrigger>
                            </TabsList> */}
                            </dt>
                            <TabsContent value="markdown-preview">
                              <ReadMoreBlock className="bg-muted/80 p-6">
                                <MarkdownPreview
                                  className="rounded-sm border border-border bg-background p-10 drop-shadow-lg"
                                  markdown={
                                    jobLead.optimization?.resumeRevision
                                      ?.markdown
                                  }
                                />
                              </ReadMoreBlock>
                            </TabsContent>
                            <TabsContent value="markdown-raw">
                              <ReadMoreBlock className="text-sm/6 tracking-wide text-foreground">
                                <dd
                                  dangerouslySetInnerHTML={{
                                    __html:
                                      jobLead.optimization?.resumeRevision?.markdown.replace(
                                        /(?:\r\n|\r|\n)/g,
                                        '<br />',
                                      ),
                                  }}
                                />
                              </ReadMoreBlock>
                            </TabsContent>
                          </div>
                        </Tabs>
                      )}
                      {hasResumeComparison && (
                        <div className="flex flex-col gap-4 rounded-md border border-border/60 bg-muted/20 p-4 sm:col-span-2">
                          <Tabs defaultValue="comparison-side-by-side">
                            <div className="flex items-center justify-between">
                              <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                                Resume Comparison
                              </dt>
                              <TabsList>
                                <TabsTrigger value="comparison-side-by-side">
                                  Side by Side
                                </TabsTrigger>
                                <TabsTrigger value="comparison-diff">
                                  Diff
                                </TabsTrigger>
                              </TabsList>
                            </div>
                            <TabsContent value="comparison-side-by-side">
                              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                <div className="flex flex-col gap-2">
                                  <p className="text-xs font-semibold uppercase text-muted-foreground/70">
                                    Original Resume
                                  </p>
                                  <MarkdownPreview
                                    className="rounded-sm border border-border bg-background p-6"
                                    markdown={originalResumeMarkdown}
                                  />
                                </div>
                                <div className="flex flex-col gap-2">
                                  <p className="text-xs font-semibold uppercase text-muted-foreground/70">
                                    Revised Resume
                                  </p>
                                  <MarkdownPreview
                                    className="rounded-sm border border-border bg-background p-6"
                                    markdown={revisedResumeMarkdown}
                                  />
                                </div>
                              </div>
                            </TabsContent>
                            <TabsContent value="comparison-diff">
                              <ResumeMarkdownDiff
                                optimizedMarkdown={revisedResumeMarkdown}
                                originalMarkdown={originalResumeMarkdown}
                              />
                            </TabsContent>
                          </Tabs>
                          {Array.isArray(changelog) && changelog.length > 0 ? (
                            <div className="rounded-md border border-border/60 bg-muted/40 p-4">
                              <p className="text-xs font-semibold uppercase text-muted-foreground/70">
                                Revision Changes
                              </p>
                              <ul className="ml-5 mt-2 list-disc space-y-3 text-sm/6 text-foreground">
                                {(
                                  changelog as Array<
                                    string | { change: string; reason: string }
                                  >
                                ).map((entry, i) => {
                                  const isStructured =
                                    typeof entry === 'object' &&
                                    entry !== null &&
                                    'change' in entry;
                                  return (
                                    <li key={`change-${i}`}>
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
                            </div>
                          ) : null}
                        </div>
                      )}
                    </dl>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                      {jobLead.optimization?.status ===
                        JobLeadOptimizationStatus.OPTIMIZING ||
                      jobLead.optimization?.status ===
                        JobLeadOptimizationStatus.ANALYZING ||
                      jobLead.optimization?.status ===
                        JobLeadOptimizationStatus.QUEUED ||
                      jobLead.status === JobLeadStatus.OPTIMIZING ||
                      jobLead.status === JobLeadStatus.ANALYZING ? (
                        <>
                          <div className="flex items-center gap-2">
                            <RefreshCcw className="h-4 w-4 animate-spin text-primary" />
                            <p className="text-sm font-medium text-foreground">
                              Optimizing your resume...
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            We&apos;re tailoring your resume to match this
                            job&apos;s requirements. This usually takes a minute
                            or two.
                          </p>
                          {optimizationProgress > 0 && (
                            <div className="mt-1 flex items-center gap-2">
                              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-primary transition-all duration-500"
                                  style={{
                                    width: `${optimizationProgress}%`,
                                  }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {optimizationProgress}%
                              </span>
                            </div>
                          )}
                        </>
                      ) : jobLead.optimization?.status ===
                        JobLeadOptimizationStatus.FAILED ? (
                        <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                          <AlertTriangle className="size-4 shrink-0 text-red-500" />
                          <p className="flex-1 text-sm text-muted-foreground">
                            Resume optimization failed. Click retry to re-run
                            the analysis and optimization.
                          </p>
                          <form
                            action={async () => {
                              'use server';
                              const { reoptimizeJobLead } =
                                await import('@/lib/job-leads/reoptimize');
                              await reoptimizeJobLead({
                                jobLeadId: jobLead.id,
                              });
                            }}
                          >
                            <Button
                              type="submit"
                              size="sm"
                              variant="outline"
                              className="shrink-0 gap-1.5 border-red-500/30 text-red-500 hover:bg-red-500/10"
                            >
                              <RefreshCcw className="size-3.5" />
                              Retry
                            </Button>
                          </form>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No revisions available.
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Page>
  );
}
