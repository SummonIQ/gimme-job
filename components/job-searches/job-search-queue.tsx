'use client';

import { type JobSearch } from '@/generated/prisma/browser';
import { ScanSearch } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Progress } from '@/components/ui/progress';
import { ShimmerCard, ShimmerCardContent } from '@/components/ui/shimmer-card';
import { useEvent } from '@/hooks/use-event';
import { useUserChannel } from '@/hooks/use-user-channel';
import { cn } from '@/lib/css';
import { EventType } from '@/types/events';
import { DataEventType } from '@/types/events/data-update';
import type { JobSearchProgressPayload } from '@/types/job-search';

import { JobSearchStatusBadge } from './job-search-status-badge';

export interface JobSearchQueueProps {
  queue?: Array<JobSearch & { jobListingsCount?: number }>;
}

const JobSearchQueue = ({ queue: jobQueue }: JobSearchQueueProps) => {
  const router = useRouter();
  const userChannel = useUserChannel();
  const [queue, setQueue] = useState<
    Record<
      string,
      JobSearch & {
        jobListingsCount?: number;
      }
    >
  >(
    jobQueue
      ?.filter(jobSearch => jobSearch.progress < 100)
      ?.reduce(
        (acc, jobSearch) => {
          acc[jobSearch.id] = {
            ...jobSearch,
            jobListingsCount: jobSearch.jobListingsCount ?? 0,
          };
          return acc;
        },
        {} as Record<string, JobSearch & { jobListingsCount?: number }>,
      ) ?? {},
  );

  useEvent<{
    data: JobSearchProgressPayload;
    type: DataEventType.JOB_SEARCH_PROGRESS;
  }>(userChannel, EventType.DataUpdate, payload => {
    if (!payload || payload.type !== DataEventType.JOB_SEARCH_PROGRESS) return;

    const { id, jobListingsCount, progress } = payload.data;

    if (progress >= 100) {
      setQueue(prev => {
        const newQueue = { ...prev };
        delete newQueue[id];
        return newQueue;
      });
    } else {
      setQueue(prev => ({
        ...prev,
        [id]: {
          ...(prev[id] || {}),
          jobListingsCount,
          progress,
        },
      }));
    }

    router.refresh();
  });

  const visible = Object.keys(queue).length > 0;

  return (
    <ShimmerCard
      className={cn(
        'mb-4 border-blue-400/15 bg-background shadow-sm shadow-muted/80 duration-300 animate-in fade-in',
        !visible && 'hidden',
      )}
    >
      <ShimmerCardContent className="gap-2 p-2">
        <h3 className="pl-1.5 pt-0.5 text-center font-semibold text-muted-foreground/90">
          Job Search Queue
        </h3>
        <div className="flex w-full flex-col gap-2">
          {[...Object.entries(queue)].map(([jobSearchId, jobSearch]) => {
            // const jobSearch = jobQueue?.find(
            //   jobSearch => jobSearch.id === jobSearchId,
            // );

            // if (!jobSearch) return null;
            const searchProgress =
              queue[jobSearch.id]?.progress ?? jobSearch.progress;

            const roundedProgress = Math.ceil(searchProgress);

            return (
              <Link
                className=" flex w-full cursor-pointer flex-row rounded-md border border-border/50 bg-background px-4 py-3 shadow-sm ring-offset-0 transition-all duration-300 hover:border-transparent hover:shadow-md hover:shadow-blue-500/20 hover:ring-2 hover:ring-blue-500/40"
                href={`/jobs/${jobSearchId}`}
                key={jobSearchId}
              >
                <div className="-mt-1 flex items-start justify-center py-2">
                  <ScanSearch className="size-5 text-orange-500" />
                </div>

                <div className="flex flex-col border-r border-border/50 px-3.5 py-0.5 pr-6">
                  <h5 className="text-sm font-semibold text-foreground/75">
                    {jobSearch.searchTerm}
                  </h5>
                  <p className="text-pretty text-xs text-muted-foreground/70">
                    Started {new Date(jobSearch.createdAt).toLocaleString()}
                  </p>
                </div>

                <div className="flex flex-row items-center gap-2 border-r border-border/50 px-6">
                  <JobSearchStatusBadge
                    status={jobSearch.status}
                    errorMessage={jobSearch.errorMessage}
                  />
                </div>
                <div className="flex grow flex-col justify-center gap-1 pl-6">
                  <div className="flex flex-row items-center justify-between gap-1">
                    <p className="flex-nowrap text-xs font-medium text-muted-foreground">
                      <b>
                        {searchProgress
                          ? `${Math.ceil(searchProgress)}%`
                          : jobSearch.progress
                            ? `${jobSearch.progress * 100}%`
                            : '0%'}
                      </b>
                      {' complete'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <b>
                        {queue[jobSearch.id]?.jobListingsCount
                          ? queue[jobSearch.id]?.jobListingsCount
                          : (jobSearch.jobListingsCount ?? 0)}
                      </b>{' '}
                      job listings added
                    </p>
                  </div>
                  <Progress
                    className="h-2.5 [&>div]:bg-blue-500"
                    value={searchProgress}
                    // variant="default"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </ShimmerCardContent>
    </ShimmerCard>
  );
};
JobSearchQueue.displayName = 'JobSearchQueue';

export { JobSearchQueue };
