'use client';

import {
  ApplicationSubmission,
  JobFitAnalysis,
  type JobLead,
  JobLeadOptimization,
  JobListing,
  Prisma,
} from '@/generated/prisma/browser';
import { JobLeadStatus } from '@/generated/prisma/browser';
import { Loader2, MoreHorizontal, RefreshCw, TrashIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';

import { Report } from '@/components/data/report';
import { JobLeadsBulkActionBar } from '@/components/job-leads/job-leads-bulk-action-bar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  // DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ApiQuery, Pagination, Sort } from '@/types/reporting/query';
import { ReportColumn } from '@/types/reporting/report';

import { getEffectiveJobLeadStatus } from '@/lib/job-leads/effective-status';

import { JobLeadStatusBadge } from './job-lead-status-badge';

export const DateLabel = dynamic(
  () => import('@/components/data/date-label').then(mod => mod.DateLabel),
  { ssr: false },
);

/*
  useEvent<{
    data: JobLeadAnalysisProgressPayload;
    type: DataEventType.JOB_LEAD_OPTIMIZATION_PROGRESS;
  }>(userChannel, EventType.DataUpdate, payload => {
    if (!payload) return;

    // const { id, progress } = payload.data;

    // startTransition(async () => {
    //   if (progress >= 100) {
    //     setTimeout(() => {
    //       setQueue(prev => {
    //         const newQueue = { ...prev };
    //         delete newQueue[id];
    //         return newQueue;
    //       });
    //     }, 3000);
    //   } else if (
    //     (queue[id]?.progress && progress > queue[id]?.progress) ||
    //     !queue[id]?.progress
    //   ) {
    //     setQueue(prev => ({
    //       ...prev,
    //       [id]: {
    //         progress,
    //       },
    //     }));
    //   }

    //   router.refresh();
    // });
  });
*/

const JobLeadsReport = ({
  dismiss,
  initialData,
  initialQuery,
  cacheKey,
  showExport = false,
  isPaginationSticky = false,
  showPagination = false,
  showSearch = true,
  showSelectedCount = true,
  showColumnToggle = true,
  totalCount,
}: {
  cacheKey?: string;
  dismiss?: (ids: Array<string>) => Promise<void>;
  initialData?: Array<
    JobLead & {
      applicationSubmissions?: ApplicationSubmission[];
      jobFitAnalysis: JobFitAnalysis;
      jobListing: JobListing;
      optimization?: JobLeadOptimization | null;
    }
  >;
  initialQuery?: ApiQuery<JobLead, Prisma.JobLeadInclude>;
  pagination?: Pagination;
  showColumnToggle?: boolean;
  showExport?: boolean;
  isPaginationSticky?: boolean;
  showPagination?: boolean;
  showSearch?: boolean;
  showSelectedCount?: boolean;
  sort?: Array<Sort<JobLead>>;
  totalCount?: number;
}) => {
  const [selectedRows, setSelectedRows] = useState<
    Record<
      string,
      JobLead & {
        applicationSubmissions?: ApplicationSubmission[];
        jobFitAnalysis: JobFitAnalysis;
        jobListing: JobListing;
        optimization?: JobLeadOptimization | null;
      }
    >
  >({});

  const columns: Array<
    ReportColumn<
      JobLead & {
        applicationSubmissions?: ApplicationSubmission[];
        jobFitAnalysis: JobFitAnalysis;
        jobListing: JobListing;
        optimization?: JobLeadOptimization | null;
      }
    >
  > = [
    {
      cellFn: ({ title, id, jobListing }) => {
        return (
          <div className="flex size-full grow items-start">
            <Link
              className="group flex flex-row items-center"
              href={`/leads/${id}`}
            >
              <div className="flex flex-col justify-start gap-y-0.5">
                <h4 className="line-clamp-1 text-sm font-semibold underline-offset-2 group-hover:underline">
                  {title}
                </h4>

                <p className="line-clamp-2 text-sm font-light text-muted-foreground">
                  {jobListing?.description
                    ? `${jobListing.description?.slice(0, 220)}...`
                    : jobListing?.description}
                </p>
              </div>
            </Link>
          </div>
        );
      },
      className: 'min-w-[300px] md:min-w-[420px]',
      header: 'Title',
      key: 'title',
      sortable: true,
      visible: true,
    },
    {
      align: 'left',
      cellFn: ({ jobListing }) => {
        return (
          <div className="flex w-full items-center">
            <p className="text-xs font-medium leading-relaxed text-muted-foreground">
              {jobListing?.company}
            </p>
          </div>
        );
      },
      className: 'min-w-28 md:min-w-40',
      header: 'Company',
      sortable: true,
      visible: true,
    },
    {
      align: 'left',
      cellFn: ({ jobFitAnalysis }) => {
        return (
          <div className="flex w-full items-center">
            <p className="text-xs font-medium leading-relaxed text-muted-foreground">
              {jobFitAnalysis?.overallMatchScore}
            </p>
          </div>
        );
      },
      className: 'min-w-20 md:min-w-24',
      header: 'Job Fit Score',
      sortable: true,
      visible: true,
    },
    {
      align: 'left',
      cellFn: lead => {
        const effectiveStatus = getEffectiveJobLeadStatus(lead);
        return (
          <div className="flex items-center text-center">
            <JobLeadStatusBadge status={effectiveStatus} />
          </div>
        );
      },
      className: 'min-w-28 md:min-w-40',
      header: 'Status',
      key: 'status',
      sortable: true,
      visible: true,
    },
    {
      align: 'left',
      cellFn: ({ createdAt }) => (
        <p className="text-xs font-light leading-relaxed text-muted-foreground">
          <DateLabel date={createdAt} variant="relative" />
        </p>
      ),
      className: 'min-w-16 md:min-w-24',
      header: 'Added',
      key: 'createdAt',
      sortable: true,
      visible: true,
    },
    {
      cellFn: row => {
        const isFailed =
          row.status === JobLeadStatus.ANALYSIS_FAILED ||
          row.status === JobLeadStatus.OPTIMIZATION_FAILED;
        return (
          <div className="flex items-center gap-1">
            {isFailed && <RetryButton jobLeadId={row.id} />}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="size-8 rounded-full border border-border/20 p-2 hover:border-border/50 hover:bg-muted/50"
                  variant="ghost"
                >
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="cursor-pointer items-center text-red-500 hover:bg-red-500/40! hover:text-red-600!">
                  <TrashIcon className="size-4" />
                  <span className="text-xs font-semibold">Dismiss</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      className: 'min-w-20 md:min-w-28',
      header: 'Actions',
      sortable: false,
      visible: true,
    },
  ];
  // const [queue, setQueue] = useState<
  //   Record<
  //     string,
  //     {
  //       progress: number;
  //     }
  //   >
  // >({});
  // const [isPending, startTransition] = useTransition();
  // const router = useRouter();

  // const userChannel = useUserChannel();

  return (
    <>
      <Report<JobLead, Prisma.JobLeadInclude>
        cacheKey={cacheKey}
        columns={columns}
        enableRowSelection={true}
        initialData={initialData}
        initialQuery={initialQuery}
        model="job-leads"
        onSelectedRowsChange={setSelectedRows}
        searchField="title"
        searchPlaceholder="Search leads..."
        selectedRows={selectedRows}
        showColumnToggle={showColumnToggle}
        showExport={showExport}
        isPaginationSticky={isPaginationSticky}
        showPagination={showPagination}
        showSearch={showSearch}
        showSelectedCount={showSelectedCount}
        totalCount={totalCount}
      />
      {/* 
      <DataTable
        columnVisibility={{
          description: false,
          id: false,
        }}
        columns={columns}
        data={jobLeads}
        onRowSelectionChange={setRowSelection}
        searchField={searchField}
        searchPlaceholder="Search leads..."
        showColumnVisibility={true}
        showExport={showExport}
        showPagination={showPagination}
        showSearch={showSearch}
        showSelectedCount={showSelectedCount}
      /> */}

      <JobLeadsBulkActionBar
        dismiss={dismiss}
        resetSelectedJobs={() => setSelectedRows({})}
        selectedJobLeads={selectedRows}
      />
      {/* <BulkJobListingActionBar selectedJobs={rowSelection} /> */}
    </>
  );
};
JobLeadsReport.displayName = 'JobLeadsReport';

function RetryButton({ jobLeadId }: { jobLeadId: string }) {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const { reoptimizeJobLead } = await import('@/lib/job-leads/reoptimize');
      await reoptimizeJobLead({ jobLeadId });
    } catch {
      // Status will update via realtime events
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <Button
      className="h-7 gap-1 rounded-full px-2.5 text-xs"
      disabled={isRetrying}
      onClick={handleRetry}
      size="sm"
      variant="outline"
    >
      {isRetrying ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <RefreshCw className="size-3" />
      )}
      Retry
    </Button>
  );
}

export { JobLeadsReport };
