'use client';

import { type JobSearch, Prisma } from '@/generated/prisma/browser';
import { MoreHorizontal } from 'lucide-react';
import Link from 'next/link';

import { Report } from '@/components/data/report';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sort } from '@/types/reporting/query';
import { Filter } from '@/types/reporting/query';
import { Pagination } from '@/types/reporting/query';
import { ReportColumn } from '@/types/reporting/report';

import { DateLabel } from '../data/date-label';
import { JobSearchStatusBadge } from './job-search-status-badge';

/*
  const [progress, setProgress] = useState<
    Record<
      string,
      {
        jobListingsCount?: number;
        page?: number;
        progress: number;
        totalPages?: number;
      }
    >
  >({});
  const router = useRouter();

  const userChannel = useUserChannel();

  userChannel?.bind(
    DataEventType.JOB_SEARCH_PROGRESS,
    (payload: {
      data: {
        id: string;
        jobListingsCount?: number;
        page?: number;
        progress: number;
        totalPages?: number;
      };
      type: DataEventType;
    }) => {
      if (payload.type === DataEventType.JOB_SEARCH_PROGRESS) {
        if (payload.data.progress >= 100) {
          setProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[payload.data.id];
            return newProgress;
          });

          router.refresh();
        } else {
          setProgress(prev => ({
            ...prev,
            [payload.data.id]: {
              jobListingsCount: payload.data.jobListingsCount ?? 0,
              page: payload.data.page,
              progress: payload.data.progress,
              totalPages: payload.data.totalPages,
            },
          }));
        }
      }
    },
  );

  */

type JobSearchWithListings = JobSearch & {
  jobSearchListings?: Array<{ jobListingId: string }>;
};

const columns: Array<ReportColumn<JobSearchWithListings>> = [
  // {
  //   accessorKey: "id",
  //   enableHiding: false,
  // },

  {
    align: 'left',
    cellFn: ({ id, searchTerm }) => {
      return (
        <div className="flex w-full items-center pl-3 font-medium">
          <Link
            className="group flex flex-row items-center space-x-4"
            href={`/jobs/searches/${id}`}
          >
            <div className="flex flex-col space-y-0.5">
              <h4 className="text-sm font-semibold underline-offset-4 group-hover:underline">
                {searchTerm}
                {/* {row.getValue("title")} */}
              </h4>

              {/* <p className="text-xs font-light text-muted-foreground">
                  {row.getValue("company")}
                </p> */}
            </div>
          </Link>
        </div>
      );
    },
    className: 'min-w-28 md:min-w-40',
    header: 'Search Term',
    key: 'searchTerm',
    sortable: true,
    visible: true,
  },
  {
    cellFn: ({ completedAt }) => {
      return completedAt ? (
        <DateLabel date={completedAt} variant="long" />
      ) : (
        '-'
      );
    },
    header: 'Completed At',
    hideable: false,
    key: 'completedAt',
    sortable: true,
    visible: true,
  },
  // {
  //   header: '# Job Listings',
  //   hideable: false,
  //   key: 'totalJobs',
  //   sortable: true,
  //   visible: true,
  // },
  {
    cellFn: ({ jobSearchListings }) => {
      return jobSearchListings?.length ?? 0;
    },
    header: '# Job Listings',
  },
  {
    cellFn: ({ errorMessage, status }) => {
      return (
        <JobSearchStatusBadge status={status} errorMessage={errorMessage} />
      );
    },
    header: 'Status',
    key: 'status',
    sortable: true,
    visible: true,
  },

  {
    cellFn: ({ id }) => {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="size-8 p-0" variant="ghost">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
            // onClick={() => navigator.clipboard.writeText(payment.id)}
            >
              View search details
            </DropdownMenuItem>
            {/* <DropdownMenuSeparator /> */}
            {/* <DropdownMenuItem>View customer</DropdownMenuItem>
              <DropdownMenuItem>View payment details</DropdownMenuItem> */}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    header: 'Actions',
    sortable: false,
    visible: true,
  },
];

const JobSearchesReport = ({
  cacheKey,
  delete: deleteJobSearch,
  initialData,
  pagination,
  showColumnToggle = true,
  showExport = true,
  filters,
  include,
  sort = [{ direction: 'desc', field: 'createdAt' }],
  showPagination = true,
  showSearch = true,
  showSelectedCount = false,
}: {
  cacheKey?: string;
  delete?: (ids: string[]) => Promise<void>;
  dismiss?: (ids: string[]) => Promise<void>;
  filters?: Array<Filter<JobSearch>>;
  include?: Prisma.JobSearchInclude;
  initialData?: Array<JobSearchWithListings>;
  pagination?: Pagination;
  save?: (ids: string[]) => Promise<void>;
  showColumnToggle?: boolean;
  showExport?: boolean;
  showFilters?: boolean;
  showPagination?: boolean;
  showSearch?: boolean;
  showSelectedCount?: boolean;
  sort?: Array<Sort<JobSearch>>;
}) => {
  return (
    <>
      <Report<JobSearchWithListings>
        cacheKey={cacheKey}
        columns={columns}
        enableRowSelection={false}
        initialData={initialData}
        initialQuery={{
          filters,
          include,
          pagination,
          sort,
        }}
        model="job-searches"
        searchField="searchTerm"
        searchPlaceholder="Search by search term..."
        showColumnToggle={showColumnToggle}
        showExport={showExport}
        showPagination={showPagination}
        showSearch={showSearch}
        showSelectedCount={showSelectedCount}
      />
    </>
  );
};
JobSearchesReport.displayName = 'JobSearchesReport';

export { JobSearchesReport };
