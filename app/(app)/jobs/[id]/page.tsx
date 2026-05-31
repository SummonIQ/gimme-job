import { JobListingStatus, JobProvider } from '@/generated/prisma/browser';
import { CalendarIcon } from '@radix-ui/react-icons';
import type { Metadata as NextMetadata } from 'next';
import Link from 'next/link';

import { ApplyButton } from '@/components/job-applications/apply-button';

import { DateLabel } from '@/components/data/date-label';
import {
  Metadata,
  MetadataIcon,
  MetadataLabel,
} from '@/components/data/metadata-list';
import { AddJobListingToLeadsButton } from '@/components/job-leads/add-job-lead-button';
import { ShareJobLeadButton } from '@/components/job-leads/share-job-lead-button';
import { DismissJobListingButton } from '@/components/job-listings/dismiss-job-listing-button';
import { JobDescription } from '@/components/job-listings/job-description';
import { SaveJobListingButton } from '@/components/job-listings/save-job-listing-button';
import {
  Page,
  PageContent,
  PageHeader,
  PageMetadata,
} from '@/components/layout/page';
import {
  Card,
  CardActions,
  CardContent,
  CardHeader,
  CardSummary,
  CardTitle,
} from '@/components/ui/card';
import { createJobLead } from '@/lib/job-leads';
import { dismissJobListing } from '@/lib/job-listings/dismiss';
import { getJobListing } from '@/lib/job-listings/query';
import { saveJobListing, unsaveJobListing } from '@/lib/job-listings/save';
import { getCurrentUser } from '@/lib/user/query';
import { formatLocationLabel } from '@/lib/utils';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<NextMetadata> {
  const id = (await params).id;
  const user = await getCurrentUser();

  if (!user) {
    return {
      description: 'View job details',
      title: 'Job Details | Gimme Job',
    };
  }

  const job = await getJobListing({ id, userId: user.id });

  if (!job) {
    return {
      description: 'View job details',
      title: 'Job Details | Gimme Job',
    };
  }

  return {
    description: job?.description?.slice(0, 32),
    title: `${job.title} | Gimme Job`,
  };
}

export default async function JobListingDetailsPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    return {
      notFound: true,
    };
  }

  const id = (await params).id;
  const job = await getJobListing({ id, userId: user.id });

  if (!job) {
    return {
      notFound: true,
    };
  }

  const displayLocation = formatLocationLabel(job.location);

  return (
    <Page name="job-details">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-3 min-w-0">
            {job?.companyLogoUrl ? (
              <img
                alt={`${job?.company ?? 'Company'} logo`}
                className="h-10 w-10 shrink-0 rounded-md border border-border/60 bg-muted/40 object-contain p-1"
                loading="lazy"
                src={job.companyLogoUrl}
              />
            ) : null}
            <span className="truncate">{job?.title}</span>
          </span>
        }
        description={
          [job.company, displayLocation].filter(Boolean).length > 0
            ? [job.company, displayLocation].filter(Boolean).join(' • ')
            : undefined
        }
        actions={
          <div className="flex space-x-2">
            <ApplyButton
              jobId={job.id}
              size="sm"
              jobProvider={job.jobProvider ?? undefined}
              applyUrl={
                (job.applyOptions as any)?.applyUrl ||
                job.jobProviderUrl ||
                (job as any).url
              }
              applyOptions={
                Array.isArray(job.applyOptions)
                  ? (job.applyOptions as Array<{
                      link: string;
                      title?: string;
                      buttonText?: string;
                    }>)
                  : undefined
              }
            />
            <SaveJobListingButton
              jobListingId={job.id}
              save={async id => {
                'use server';

                const result = await saveJobListing(id);
                return result;
              }}
              saved={job.saved}
              unsave={async id => {
                'use server';

                const result = await unsaveJobListing(id);
                return result;
              }}
            />
            {job.status === JobListingStatus.ADDED_TO_LEADS && (
              <ShareJobLeadButton jobLeadId={job.id} jobTitle={job.title} />
            )}
          </div>
        }
      >
        {job?.postedAt ? (
          <PageMetadata>
            <Metadata>
              <MetadataIcon>
                <CalendarIcon
                  aria-hidden="true"
                  className="size-5 shrink-0 opacity-80"
                />
              </MetadataIcon>
              <MetadataLabel>
                <span>
                  Listed on{' '}
                  <DateLabel
                    className="font-semibold"
                    date={
                      job?.postedAt instanceof Date
                        ? job?.postedAt
                        : new Date(job?.postedAt)
                    }
                  />
                </span>
              </MetadataLabel>
            </Metadata>
          </PageMetadata>
        ) : null}
      </PageHeader>
      <PageContent className="p-0 rounded-b-2xl shadow-2xl drop-shadow-2xl overflow-hidden">
        <Card className="border border-border/60 border-t-white/10 shadow-none rounded-none bg-card/80">
          <CardHeader className="px-6 py-4 md:px-8 md:py-6 border-b border-border/60">
            <CardSummary>
              <CardTitle>Job Details</CardTitle>
            </CardSummary>

            <CardActions>
              {job.status !== JobListingStatus.ADDED_TO_LEADS ? (
                <DismissJobListingButton
                  dismiss={async id => {
                    'use server';

                    const result = await dismissJobListing(id);
                    return result;
                  }}
                  isDismissed={job.status === JobListingStatus.DISMISSED}
                  jobListingId={job.id}
                />
              ) : null}

              {job.status !== JobListingStatus.DISMISSED ? (
                <AddJobListingToLeadsButton
                  addToLeads={async id => {
                    'use server';

                    const result = await createJobLead({
                      jobListingId: id,
                    });
                    return result;
                  }}
                  hasDefaultResume={!!user.defaultResumeId}
                  isLead={job.status === JobListingStatus.ADDED_TO_LEADS}
                  jobListingId={job.id}
                />
              ) : null}
            </CardActions>
          </CardHeader>
          <CardContent className="flex-col p-0 md:p-0">
            <dl className="grid grid-cols-1 sm:grid-cols-2">
              {job?.company ? (
                <div className="space-y-1 border-b border-border/60 p-6 sm:col-span-1 md:p-7 ">
                  <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                    Company
                  </dt>
                  <dd className="truncate text-sm/6 font-medium text-foreground sm:mt-2">
                    <span>{job?.company}</span>
                  </dd>
                </div>
              ) : null}

              {job?.location ? (
                <div className="border-b border-border/60 p-6 sm:col-span-1 md:p-7">
                  <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                    Location
                  </dt>
                  <dd className="mt-1 truncate text-sm/6 text-foreground sm:mt-2">
                    {displayLocation}
                  </dd>
                </div>
              ) : null}

              {job?.salary ? (
                <div className="border-b border-border/60 p-6 sm:col-span-1 md:p-7">
                  <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                    Salary
                  </dt>
                  <dd className="mt-1 truncate text-sm/6 text-foreground sm:mt-2">
                    {job?.salary}
                  </dd>
                </div>
              ) : null}

              {job?.remote ? (
                <div className="border-b border-border/60 p-6 sm:col-span-1 md:p-7">
                  <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                    Remote
                  </dt>
                  <dd className="mt-1 truncate text-sm/6 text-foreground sm:mt-2">
                    {job?.remote ? 'Yes' : 'No'}
                  </dd>
                </div>
              ) : null}

              {job?.jobProvider ? (
                <div className="border-b border-border/60 p-6 sm:col-span-1 md:p-7">
                  <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                    Job board
                  </dt>
                  <dd className="mt-1 truncate text-sm/6 text-foreground sm:mt-2">
                    {job?.jobProvider === JobProvider.CAREER_BUILDER ? (
                      <span>CareerBuilder</span>
                    ) : job?.jobProvider === JobProvider.SERPAPI ? (
                      <span>Google Jobs</span>
                    ) : null}
                  </dd>
                </div>
              ) : null}

              {job?.jobProviderUrl ? (
                <div className="border-b border-border p-6 sm:col-span-2 md:p-7">
                  <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                    URL
                  </dt>
                  <dd className="mt-1 truncate text-sm/6 sm:mt-2">
                    <Link
                      className="text-primary underline underline-offset-2"
                      href={job?.jobProviderUrl}
                    >
                      {job?.jobProviderUrl}
                    </Link>
                  </dd>
                </div>
              ) : null}

              {job?.description ? (
                <div className="space-y-1 border-b border-border/60 p-6 sm:col-span-2 sm:space-y-2 md:p-7">
                  <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                    Description
                  </dt>
                  <dd className="text-pretty text-sm/6 tracking-wide text-foreground">
                    <JobDescription
                      description={job.description}
                      className="space-y-1"
                    />
                  </dd>
                </div>
              ) : null}

              {job?.healthInsurance ? (
                <div className="border-b border-border/60 p-6 sm:col-span-1 md:p-7">
                  <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                    Health Insurance
                  </dt>
                  <dd className="mt-1 truncate text-sm/6 text-foreground sm:mt-2">
                    {job?.healthInsurance ? 'Yes' : 'No'}
                  </dd>
                </div>
              ) : null}

              {job?.dentalCoverage ? (
                <div className="border-b border-border/60 p-6 sm:col-span-1 md:p-7">
                  <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                    Dental Coverage
                  </dt>
                  <dd className="mt-1 truncate text-sm/6 text-foreground sm:mt-2">
                    {job?.dentalCoverage ? 'Yes' : 'No'}
                  </dd>
                </div>
              ) : null}

              {job?.paidTimeOff ? (
                <div className="border-b border-border/60 p-6 sm:col-span-1 md:p-7">
                  <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                    Paid Time Off
                  </dt>
                  <dd className="mt-1 truncate text-sm/6 text-foreground sm:mt-2">
                    {job?.paidTimeOff ? 'Yes' : 'No'}
                  </dd>
                </div>
              ) : null}

              {job?.requirements && job.requirements.length > 0 ? (
                <div className="space-y-1 border-b border-border/60 p-6 sm:col-span-2 sm:space-y-2 md:p-7">
                  <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                    Requirements
                  </dt>
                  <dd className="mt-1 w-full sm:mt-2 md:mt-3">
                    <ul className="list-disc space-y-1 pl-6">
                      {job?.requirements.map((requirement, i) => (
                        <li
                          className="text-pretty text-sm/5"
                          // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                          key={`${requirement}-${i}`}
                        >
                          {requirement}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ) : null}

              {job?.responsibilities && job.responsibilities.length > 0 ? (
                <div className="border-b border-border/60 p-6 sm:col-span-2 md:p-7">
                  <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                    Responsibilities
                  </dt>
                  <dd className="mt-1 w-full sm:mt-2 md:mt-3">
                    <ul className="list-disc space-y-2.5 pl-6">
                      {job?.responsibilities.map((responsibility, i) => (
                        <li
                          className="text-pretty text-sm/5"
                          // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                          key={`${responsibility}-${i}`}
                        >
                          {responsibility}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ) : null}

              {job?.qualifications && job.qualifications.length > 0 ? (
                <div className="space-y-1 border-b border-border/60 p-6 sm:col-span-2 sm:space-y-2 md:p-7">
                  <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                    Qualifications
                  </dt>
                  <dd className="mt-1 w-full sm:mt-2 md:mt-3">
                    <ul className="list-disc space-y-2.5 pl-6">
                      {job?.qualifications.map((qualification, i) => (
                        <li
                          className="text-pretty text-sm/5"
                          // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                          key={`${qualification}-${i}`}
                        >
                          {qualification}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ) : null}

              {job?.benefits && job.benefits.length > 0 ? (
                <div className="space-y-1 border-b border-border/60 p-6 sm:col-span-2 sm:space-y-2 md:p-7">
                  <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                    Benefits
                  </dt>
                  <dd className="mt-1 w-full sm:mt-2 md:mt-3">
                    <ul className="list-disc space-y-2.5 pl-6">
                      {job?.benefits.map((benefit, i) => (
                        <li
                          className="text-pretty text-sm/5"
                          // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                          key={`${benefit}-${i}`}
                        >
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ) : null}

              {job?.applyOptions &&
              Array.isArray(job.applyOptions) &&
              job.applyOptions.length > 0 ? (
                <div className="space-y-1 border-b border-border/60 p-6 sm:col-span-2 sm:space-y-2 md:p-7">
                  <dt className="text-sm/6 font-medium tracking-wide text-muted-foreground/80">
                    Apply Options
                  </dt>
                  <dd className="mt-1 w-full sm:mt-2 md:mt-3">
                    <ul className="list-disc space-y-2.5 pl-6">
                      {(
                        job?.applyOptions as Array<{
                          link: string;
                          method: string;
                          buttonText?: string;
                        }>
                      ).map((applyOption, i: number) => (
                        <li
                          className="text-pretty text-sm/5"
                          key={`${applyOption.link}-${i}`}
                        >
                          <h4 className="font-semibold">
                            {applyOption.buttonText || applyOption.method}
                          </h4>

                          <Link
                            className="block truncate text-primary underline underline-offset-2"
                            href={applyOption.link}
                          >
                            {applyOption.link}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ) : null}
            </dl>
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
