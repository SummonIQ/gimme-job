'use client';

import {
  Prisma,
  type Resume,
  ResumeOptimizationStatus,
} from '@/generated/prisma/browser';
import { StarFilledIcon } from '@radix-ui/react-icons';
import { Loader2, MoreHorizontal, Trash } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { Report } from '@/components/data/report';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEvent } from '@/hooks/use-event';
import { useUserChannel } from '@/hooks/use-user-channel';
import {
  isTerminalResumeOptimizationStatus,
  mergeResumeOptimizationProgressState,
} from '@/lib/resumes/optimization-state';
import { QueueState } from '@/types/data';
import type {
  WithOptionalResumeAnalysis,
  WithOptionalResumeOptimization,
  WithOptionalResumeRevisions,
} from '@/types/domain/resume';
import { DataEventType, EventType } from '@/types/events';
import { ApiQuery } from '@/types/reporting/query';
import { ReportColumn } from '@/types/reporting/report';
import { ResumeOptimizationProgressPayload } from '@/types/resumes/events';

import { ResumeOptimizationStatusBadge } from './resume-optimization-status-badge';
export const DateLabel = dynamic(
  () => import('@/components/data/date-label').then(mod => mod.DateLabel),
  { ssr: false },
);

export function ResumesReport({
  cacheKey,
  defaultResumeId,
  deleteResume,
  initialData,
  initialQuery,
  showColumnToggle = false,
  showExport = false,
  showPagination = true,
  showSearch = true,
  showSelectedCount = false,
}: {
  cacheKey?: string;
  defaultResumeId?: string;
  deleteResume: (resumeId: string) => Promise<void>;
  initialData?: Array<
    WithOptionalResumeOptimization<WithOptionalResumeAnalysis<Resume>>
  >;
  initialQuery?: ApiQuery<Resume, Prisma.ResumeInclude>;
  showColumnToggle?: boolean;
  showExport?: boolean;
  showPagination?: boolean;
  showSearch?: boolean;
  showSelectedCount?: boolean;
}) {
  type ResumeQueueEntry = QueueState<ResumeOptimizationStatus>[string] & {
    emittedAt?: string;
    sequence?: number;
  };

  const router = useRouter();
  const userChannel = useUserChannel();
  const latestSequenceByResumeId = useRef<Record<string, number>>({});
  const [queue, setQueue] = useState<Record<string, ResumeQueueEntry>>(
    initialData
      ?.filter(resume => resume.optimization?.progress !== 100)
      .reduce((acc, resume) => {
        acc[resume.id as string] = {
          createdAt: resume.createdAt,
          name: resume?.name ?? '',
          progress: resume.optimization?.progress ?? 0,
          status:
            resume.optimization?.status ?? ResumeOptimizationStatus.QUEUED,
          updatedAt: resume.updatedAt,
        };
        return acc;
      }, {} as QueueState<ResumeOptimizationStatus>) ?? {},
  );

  useEffect(() => {
    if (!initialData?.length) return;

    setQueue(prev => {
      let changed = false;
      const nextQueue = { ...prev };

      for (const resume of initialData) {
        const queuedState = nextQueue[resume.id];
        if (!queuedState) continue;

        const hasAnalysisScore = typeof resume.analysis?.score === 'number';
        const hasOptimizationScore =
          typeof resume.optimization?.score === 'number';
        const isFailed =
          resume.optimization?.status === ResumeOptimizationStatus.FAILED;

        if (isFailed || (hasAnalysisScore && hasOptimizationScore)) {
          delete nextQueue[resume.id];
          changed = true;
        }
      }

      return changed ? nextQueue : prev;
    });
  }, [initialData]);

  const handleResumeOptimizationEvent = useCallback(
    (payload?: {
      data: ResumeOptimizationProgressPayload;
      type: DataEventType.RESUME_OPTIMIZATION_PROGRESS;
    }) => {
      if (!payload) return;
      if (payload.type !== DataEventType.RESUME_OPTIMIZATION_PROGRESS) return;

      const { id, progress, status, name, sequence } = payload.data;
      if (!id) return;
      const hasSequence = typeof sequence === 'number';
      if (hasSequence) {
        const latestSequence = latestSequenceByResumeId.current[id] ?? -1;
        if (sequence < latestSequence) {
          return;
        }
        latestSequenceByResumeId.current[id] = sequence;
      }
      const isTerminalStatus = isTerminalResumeOptimizationStatus(status);

      if (progress >= 100 || isTerminalStatus) {
        startTransition(() => {
          setQueue(prev => ({
            ...prev,
            [id]: {
              ...prev[id],
              createdAt: prev[id]?.createdAt ?? new Date(),
              emittedAt: payload.data.emittedAt,
              name,
              progress: 100,
              sequence,
              status,
              updatedAt: new Date(),
            },
          }));
        });
        router.refresh();
        window.setTimeout(() => {
          router.refresh();
        }, 1500);
        return;
      }

      // When analysis completes (status transitions to ANALYZED), refresh
      // server data so the Score column can display the analysis score.
      if (status === ResumeOptimizationStatus.ANALYZED) {
        router.refresh();
      }

      startTransition(() => {
        setQueue(prev => {
          const previous = prev[id];
          const previousProgress = previous?.progress ?? 0;
          const previousStatus =
            previous?.status ?? ResumeOptimizationStatus.QUEUED;
          const mergedState = mergeResumeOptimizationProgressState({
            incomingProgress: progress,
            incomingStatus: status,
            previousProgress,
            previousStatus,
          });

          if (
            previous &&
            mergedState.progress === previousProgress &&
            mergedState.status === previousStatus &&
            name === previous.name
          ) {
            return prev;
          }

          const newQueue = { ...prev };
          newQueue[id] = {
            ...previous,
            createdAt: previous?.createdAt ?? new Date(),
            emittedAt: payload.data.emittedAt,
            name,
            progress: mergedState.progress,
            sequence,
            status: mergedState.status,
            updatedAt: new Date(),
          };
          return newQueue;
        });
      });
    },
    [router],
  );

  useEvent<{
    data: ResumeOptimizationProgressPayload;
    type: DataEventType.RESUME_OPTIMIZATION_PROGRESS;
  }>(userChannel, EventType.DataUpdate, handleResumeOptimizationEvent);

  const columns: Array<
    ReportColumn<
      WithOptionalResumeAnalysis<
        WithOptionalResumeOptimization<WithOptionalResumeRevisions<Resume>>
      >
    >
  > = [
    {
      align: 'left',
      cellFn: ({ name, id }) => {
        return (
          <Link
            className="group flex flex-row items-center"
            href={`/profile/resumes/${id}`}
          >
            <h4 className="flex items-center gap-0 text-sm font-semibold underline-offset-4">
              <span className="flex items-center group-hover:underline">
                {name}
              </span>

              {id === defaultResumeId && (
                <Badge
                  className="ml-3 gap-x-1 rounded-full bg-yellow-500/10 px-2.5 pt-[4px] pb-[4px] border-x-0 border-t border-b border-t-yellow-600/25 border-b-[hsl(48,96%,5%)]"
                  variant="outline"
                >
                  <StarFilledIcon className="size-[14px] text-yellow-500/70" />
                  <span className="font-bold leading-normal tracking-normal text-yellow-500/85">
                    Default
                  </span>
                </Badge>
              )}
            </h4>
          </Link>
        );
      },
      className: 'min-w-[280px] md:min-w-[360px]',
      header: 'Name',
      key: 'name',
      sortable: true,
    },
    {
      align: 'center',
      cellFn: ({ analysis, id }) => {
        const queuedState = queue[id];
        const hasScore = typeof analysis?.score === 'number';

        if (hasScore) {
          return (
            <div className="flex w-full items-center justify-center font-mono font-semibold">
              <div className="flex items-center gap-0.5">
                <span>{analysis.score}</span>
                <span>%</span>
              </div>
            </div>
          );
        }

        if (queuedState) {
          return (
            <div className="flex w-full items-center justify-center">
              <Loader2 className="size-4 animate-spin text-muted-foreground/50" />
            </div>
          );
        }

        return (
          <div className="flex w-full items-center justify-center font-mono font-semibold">
            <span className="text-muted-foreground/70">N/A</span>
          </div>
        );
      },
      className: 'w-[112px] min-w-[112px]',
      header: 'Score',
      sortable: true,
    },
    {
      align: 'center',
      cellFn: ({ optimization, id }) => {
        const queuedState = queue[id];
        const hasScore = typeof optimization?.score === 'number';

        if (hasScore) {
          return (
            <div className="flex w-full items-center justify-center font-mono font-semibold">
              <div className="flex items-center gap-0.5">
                <span>{optimization.score}</span>
                <span>%</span>
              </div>
            </div>
          );
        }

        if (queuedState) {
          return (
            <div className="flex w-full items-center justify-center">
              <Loader2 className="size-4 animate-spin text-muted-foreground/50" />
            </div>
          );
        }

        return (
          <div className="flex w-full items-center justify-center font-mono font-semibold">
            <span className="text-muted-foreground/70">N/A</span>
          </div>
        );
      },
      className: 'w-[112px] min-w-[112px]',
      header: 'New Score',
      sortable: true,
    },
    {
      align: 'center',
      cellFn: ({ optimization, id }) => {
        const queuedState = queue[id];
        const status =
          queuedState?.status ??
          optimization?.status ??
          ResumeOptimizationStatus.QUEUED;

        return (
          <ResumeOptimizationStatusBadge status={status} variant="outline" />
        );
      },
      className: 'w-[112px] min-w-[112px]',
      header: 'Status',
      sortable: true,
    },
    // {
    //   align: 'left',
    //   cellFn: ({ analysis, id }) => {
    //     const status = analysis?.status ?? ResumeAnalysisStatus.QUEUED;

    //     if (queue[id]) {
    //       const analysisProgress = queue[id];
    //       return (
    //         <div className="flex w-full flex-col justify-center space-y-0.5">
    //           <span className="flex flex-row items-center justify-between px-0.5 text-xs">
    //             <ResumeAnalysisStatusBadge status={status} />
    //             <span className="font-medium">
    //               {analysisProgress.progress}%
    //             </span>
    //           </span>
    //           <Progress
    //             className="h-2 [&>div]:bg-primary"
    //             value={analysisProgress.progress}
    //           />
    //         </div>
    //       );
    //     }

    //     return <ResumeAnalysisStatusBadge status={status} />;
    //   },
    //   className: 'min-w-[140px]',
    //   header: 'Analysis',
    //   sortable: true,
    // },

    {
      cellFn: ({ createdAt }) => {
        return (
          <p className="text-xs font-light leading-relaxed text-muted-foreground">
            <DateLabel date={createdAt} />
          </p>
        );
      },
      className: 'min-w-[120px] md:min-w-[160px]',
      header: 'Upload Date',
      key: 'createdAt',
      sortable: true,
    },

    {
      align: 'center',
      cellFn: ({ id }) => {
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="size-7 rounded-full p-0 hover:bg-foreground/10"
                variant="ghost"
              >
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs text-muted-foreground/50">
                Actions
              </DropdownMenuLabel>
              <DropdownMenuItem
                className="cursor-pointer text-xs font-bold text-primary hover:!bg-primary/10 hover:!text-primary"
                // onClick={() => navigator.clipboard.writeText(payment.id)}
              >
                <StarFilledIcon className="size-4" />
                Set as default
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-xs font-bold text-red-500 hover:!bg-red-500/10 hover:!text-red-500"
                onClick={async () => {
                  await deleteResume(id);

                  router.refresh();
                }}
              >
                <Trash className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      className: 'w-12 min-w-[48px]',
      header: '',
      sortable: false,
      visible: true,
    },
  ];

  return (
    <Report<Resume, Prisma.ResumeInclude>
      cacheKey={cacheKey}
      columns={columns}
      initialData={initialData}
      initialQuery={initialQuery}
      model="resumes"
      searchField="name"
      searchPlaceholder="Search resumes..."
      showColumnToggle={showColumnToggle}
      showExport={showExport}
      showPagination={showPagination}
      showSearch={showSearch}
      showSelectedCount={showSelectedCount}
    />
  );
}
