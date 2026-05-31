'use client';

import { JobListing, JobListingStatus, Prisma } from '@/generated/prisma/browser';
import { CheckCircle, MoreHorizontal, StarIcon, TrashIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Report } from '@/components/data/report';
import { BulkJobListingActionBar } from '@/components/job-listings/job-listings-bulk-action-bar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEvent } from '@/hooks/use-event';
import { useUserChannel } from '@/hooks/use-user-channel';
import { DataEventType, EventType } from '@/types/events';
import { JobSearchProgressPayload } from '@/types/job-search';
import { ApiQuery, Filter, Pagination, Sort } from '@/types/reporting/query';
import { ReportColumn } from '@/types/reporting/report';

import { JobListingStatusBadge } from './job-listing-status-badge';
export const DateLabel = dynamic(
  () => import('@/components/data/date-label').then(mod => mod.DateLabel),
  { ssr: false },
);

export function JobListingsReport({
  addToLeads,
  cacheKey,
  dismiss,
  initialData,
  initialQuery,
  pagination,
  save,
  showExport = true,
  showPagination = true,
  showSearch = true,
  showPostedAt = false,
  showSelectedCount = false,
  showColumnToggle = true,
  undismiss,
  unsave,
  sort = [{ direction: 'desc', field: 'createdAt' }],
  filters,
  totalCount,
}: {
  addToLeads?: (ids: string[]) => Promise<void>;
  cacheKey?: string;
  dismiss?: (ids: string[]) => Promise<void>;
  filters?: Array<Filter<JobListing>>;
  initialData?: Array<JobListing>;
  initialQuery?: ApiQuery<JobListing, Prisma.JobListingInclude>;
  pagination?: Pagination;
  save?: (ids: string[]) => Promise<void>;
  showColumnToggle?: boolean;
  showExport?: boolean;
  showPagination?: boolean;
  showPostedAt?: boolean;
  showSearch?: boolean;
  showSelectedCount?: boolean;
  sort?: Array<Sort<JobListing>>;
  undismiss?: (ids: string[]) => Promise<void>;
  unsave?: (ids: string[]) => Promise<void>;
  totalCount?: number;
}) {
  const router = useRouter();
  const userChannel = useUserChannel();
  const [selectedRows, setSelectedRows] = useState<Record<string, JobListing>>(
    {},
  );
  const [localData, setLocalData] = useState<Array<JobListing> | undefined>(initialData);

  // Sync when initialData prop changes (e.g. after router.refresh())
  useEffect(() => {
    if (initialData) {
      setLocalData(initialData);
    }
  }, [initialData]);

  // Listen for job-listing-updated events (from modal or bulk actions)
  useEffect(() => {
    const handleJobListingUpdated = (event: Event) => {
      const { id, status } = (event as CustomEvent<{ id: string; status: JobListingStatus }>).detail;
      setLocalData(prev =>
        prev?.map(job => (job.id === id ? { ...job, status } : job)),
      );
    };

    window.addEventListener('job-listing-updated', handleJobListingUpdated);
    return () => window.removeEventListener('job-listing-updated', handleJobListingUpdated);
  }, []);

  // Wrap addToLeads to dispatch events for immediate UI update
  const wrappedAddToLeads = addToLeads
    ? async (ids: string[]) => {
        await addToLeads(ids);
        for (const id of ids) {
          window.dispatchEvent(
            new CustomEvent('job-listing-updated', {
              detail: { id, status: JobListingStatus.ADDED_TO_LEADS },
            }),
          );
        }
      }
    : undefined;

  useEvent<{
    data: JobSearchProgressPayload;
    type: DataEventType.JOB_SEARCH_PROGRESS;
  }>(userChannel, EventType.DataUpdate, async payload => {
    if (!payload) return;

    console.log('payload', payload);
    const { id, progress, status, searchTerm } = payload.data;

    if (progress >= 100) {
      router.refresh();
    }
  });

  const handleJobClick = (job: JobListing) => {
    const encodedId = encodeURIComponent(job.id);
    sessionStorage.setItem(`job-${encodedId}`, JSON.stringify(job));
    router.push(`/jobs/${encodedId}`);
  };

  const columns: Array<ReportColumn<JobListing>> = [
    {
      align: 'left',
      cellFn: row => (
        <button
          type="button"
          className="group relative hover:bg-blue-500 flex flex-row items-center text-left hover:before:bg-border/50"
          onClick={() => handleJobClick(row)}
        >
          <div className="flex flex-col justify-start space-y-0.5">
            <h4 className="line-clamp-1 space-x-1.5 text-sm underline-offset-2 group-hover:underline">
              {row.saved && (
                <span className="text-xs font-semibold text-yellow-500">
                  Saved
                </span>
              )}
              <span className="font-semibold">{row.title}</span>
            </h4>
            <p className="line-clamp-2 text-sm font-light text-muted-foreground">
              {row.description && row.description.length > 220
                ? `${row.description.slice(0, 220)}...`
                : row.description}
            </p>
          </div>
        </button>
      ),
      className: 'min-w-[300px] md:min-w-[420px]',
      header: 'Title',
      key: 'title',
      sortable: true,
      visible: true,
    },
    {
      align: 'left',
      cellFn: ({ company }) => (
        <p className="line-clamp-3 text-xs">{company}</p>
      ),
      className: 'min-w-28 md:min-w-40',
      header: 'Company',
      key: 'company',
      sortable: true,
      visible: true,
    },
    {
      align: 'left',
      cellFn: ({ status }) => {
        return (
          <JobListingStatusBadge
            status={status ?? undefined}
            variant="outline"
          />
        );
      },
      className: 'min-w-28 md:min-w-32',
      header: 'Status',
      sortable: false,
      visible: true,
    },
    ...(showPostedAt
      ? [
          {
            align: 'left' as const,
            cellFn: (row: JobListing) => (
              <p className="text-xs font-light leading-relaxed text-muted-foreground">
                <DateLabel
                  date={new Date(row.postedAt ?? row.createdAt)}
                  variant="relative"
                />
              </p>
            ),
            className: 'min-w-16 md:min-w-24',
            header: 'Posted',
            key: 'postedAt' as const,
            sortable: true,
            visible: true,
          },
        ]
      : []),
    {
      align: 'left',
      cellFn: row => (
        <p className="text-xs font-light leading-relaxed text-muted-foreground">
          <DateLabel date={new Date(row.createdAt)} variant="relative" />
        </p>
      ),
      className: 'min-w-16 md:min-w-24',
      header: 'Added',
      key: 'createdAt',
      sortable: true,
      visible: true,
    },
    {
      align: 'center',
      cellFn: () => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="size-8 rounded-full border border-border/30 p-2 hover:border-border hover:bg-background"
              variant="ghost"
            >
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="cursor-pointer items-center text-green-500 hover:!bg-green-500/40 hover:!text-green-600">
              <CheckCircle className="size-4" />
              <span className="text-xs font-semibold">Add Lead</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer items-center text-red-500 hover:!bg-red-500/40 hover:!text-red-600">
              <TrashIcon className="size-4" />
              <span className="text-xs font-semibold">Dismiss</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer items-center text-yellow-500 hover:!bg-yellow-500/40 hover:!text-yellow-600">
              <StarIcon className="size-4" />
              <span className="text-xs font-semibold">Save</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      className: 'min-w-16 max-w-20 text-center',
      header: 'Actions',
      sortable: false,
      visible: true,
    },
  ];

  return (
    <>
      <Report<JobListing, Prisma.JobListingInclude>
        cacheKey={cacheKey}
        columns={columns}
        enableRowSelection={true}
        initialData={localData}
        initialQuery={initialQuery}
        model="job-listings"
        onSelectedRowsChange={setSelectedRows}
        searchField="title"
        searchPlaceholder="Search job listings..."
        selectedRows={selectedRows}
        showColumnToggle={showColumnToggle}
        showExport={showExport}
        showPagination={showPagination}
        showSearch={showSearch}
        showSelectedCount={showSelectedCount}
        totalCount={totalCount}
      />

      <BulkJobListingActionBar
        addToLeads={wrappedAddToLeads}
        dismiss={dismiss}
        resetSelectedJobs={() => setSelectedRows({})}
        save={save}
        selectedJobs={selectedRows}
        undismiss={undismiss}
        unsave={unsave}
      />
    </>
  );
}
