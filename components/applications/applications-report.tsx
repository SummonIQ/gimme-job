'use client';

import {
  ApplicationSubmission,
  JobLead,
  JobListing,
  Prisma,
  Resume,
} from '@/generated/prisma/browser';
import { ExternalLink } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

import { Report } from '@/components/data/report';
import { Badge } from '@/components/ui/badge';
import type { ApiQuery } from '@/types/reporting/query';
import type { ReportColumn } from '@/types/reporting/report';

export const DateLabel = dynamic(
  () => import('@/components/data/date-label').then(mod => mod.DateLabel),
  { ssr: false },
);

type ApplicationRow = ApplicationSubmission & {
  jobLead: JobLead & { jobListing: JobListing | null };
  resume: Resume | null;
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

const ApplicationsReport = ({
  initialData,
  initialQuery,
  cacheKey,
  showColumnToggle = true,
  showPagination = true,
  showSearch = false,
  totalCount,
}: {
  cacheKey?: string;
  initialData?: ApplicationRow[];
  initialQuery?: ApiQuery<
    ApplicationRow,
    Prisma.ApplicationSubmissionInclude
  >;
  showColumnToggle?: boolean;
  showPagination?: boolean;
  showSearch?: boolean;
  totalCount?: number;
}) => {
  const columns: Array<ReportColumn<ApplicationRow>> = [
    {
      cellFn: row => (
        <div className="flex size-full grow items-start">
          <Link
            className="group flex flex-row items-center"
            href={`/applications/${row.id}`}
          >
            <div className="flex flex-col justify-start gap-y-0.5">
              <h4 className="line-clamp-1 text-sm font-semibold underline-offset-2 group-hover:underline">
                {row.jobLead.jobListing?.company || '—'}
              </h4>
              <p className="line-clamp-1 text-xs font-light text-muted-foreground">
                {row.jobLead.jobListing?.title || row.jobLead.title || '—'}
              </p>
            </div>
          </Link>
        </div>
      ),
      className: 'min-w-[240px] md:min-w-[320px]',
      header: 'Company / Role',
      key: 'jobLeadId',
      sortable: false,
      visible: true,
    },
    {
      align: 'left',
      cellFn: row => (
        <div className="flex flex-col gap-1">
          <Badge
            variant="outline"
            className={
              STATUS_BADGE_CLASSES[row.status] ?? STATUS_BADGE_CLASSES.PENDING
            }
          >
            {humanizeStatus(row.status)}
          </Badge>
          {row.status === 'FAILED' && row.failureReason ? (
            <span
              className="text-xs text-muted-foreground"
              title={row.errorMessage ?? undefined}
            >
              {row.failureReason}
            </span>
          ) : null}
        </div>
      ),
      className: 'min-w-32 md:min-w-40',
      header: 'Status',
      key: 'status',
      sortable: true,
      visible: true,
    },
    {
      align: 'left',
      cellFn: row => (
        <p className="text-xs font-light leading-relaxed text-muted-foreground">
          <DateLabel
            date={row.submittedAt ?? row.createdAt}
            variant="relative"
          />
        </p>
      ),
      className: 'min-w-20 md:min-w-28',
      header: 'Submitted',
      key: 'submittedAt',
      sortable: true,
      visible: true,
    },
    {
      align: 'left',
      cellFn: row => (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {row.wasAutomated ? 'Autopilot' : 'Manual'}
        </p>
      ),
      className: 'min-w-20 md:min-w-24',
      header: 'Source',
      key: 'wasAutomated',
      sortable: true,
      visible: true,
    },
    {
      align: 'right',
      cellFn: row => {
        const href =
          row.submissionUrl || row.jobLead.jobListing?.jobProviderUrl || null;
        if (!href) return null;
        return (
          <a
            aria-label={`Open ${row.jobLead.jobListing?.company || 'application'} posting`}
            className="inline-flex text-muted-foreground hover:text-foreground"
            href={href}
            rel="noreferrer noopener"
            target="_blank"
          >
            <ExternalLink className="size-3.5" />
          </a>
        );
      },
      className: 'min-w-12',
      header: '',
      sortable: false,
      visible: true,
    },
  ];

  return (
    <Report<ApplicationRow, Prisma.ApplicationSubmissionInclude>
      cacheKey={cacheKey}
      columns={columns}
      initialData={initialData}
      initialQuery={initialQuery}
      model="applications"
      searchField="jobLeadId"
      searchPlaceholder="Search applications..."
      showColumnToggle={showColumnToggle}
      showPagination={showPagination}
      showSearch={showSearch}
      totalCount={totalCount}
    />
  );
};
ApplicationsReport.displayName = 'ApplicationsReport';

export { ApplicationsReport };
