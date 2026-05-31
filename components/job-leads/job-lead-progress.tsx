import { JobLeadStatus } from '@/generated/prisma/browser';
import { cn } from '@/lib/css';
export type JobLeadProgressProps = {
  className?: string;
  status: JobLeadStatus;
};

export function JobLeadProgress({ className, status }: JobLeadProgressProps) {
  return (
    <div
      className={cn(
        'mb-4 flex w-full items-center gap-x-2 rounded-md border border-border/70 p-5 pb-8 shadow-sm drop-shadow-lg',
        className,
      )}
    >
      <div className="relative flex flex-col gap-y-1">
        <div
          className={cn(
            'flex size-3 shrink-0 rounded-full',
            status === JobLeadStatus.APPLIED
              ? 'bg-yellow-400'
              : 'bg-gray-400/30',
          )}
        />

        <div
          className={cn(
            'absolute top-full pt-1.5 text-xs font-semibold',
            status === JobLeadStatus.APPLIED
              ? 'text-yellow-400'
              : 'text-gray-400',
          )}
        >
          Applied
        </div>
      </div>

      <div
        className={cn(
          'h-1.5 w-1/3 rounded-full bg-gradient-to-r from-10%',
          status === JobLeadStatus.APPLIED
            ? 'from-yellow-400/30'
            : 'from-gray-400/30',
          status === JobLeadStatus.INTERVIEW_SCHEDULED
            ? 'to-orange-400/50'
            : 'to-gray-400/30',
        )}
      />

      <div className="relative flex flex-col gap-y-1">
        <div
          className={cn(
            'flex size-3 shrink-0 rounded-full bg-blue-400',
            status === JobLeadStatus.INTERVIEW_SCHEDULED
              ? 'bg-orange-400'
              : 'bg-gray-400/30',
          )}
        />

        <div
          className={cn(
            'absolute left-0.5 top-full pt-1.5 text-xs font-semibold text-nowrap',
            status === JobLeadStatus.INTERVIEW_SCHEDULED
              ? 'text-orange-400'
              : 'text-gray-400/70',
          )}
        >
          Interview Scheduled
        </div>
      </div>

      <div
        className={cn(
          'h-1.5 w-1/3 rounded-full bg-gradient-to-r from-10%',
          status === JobLeadStatus.INTERVIEW_SCHEDULED
            ? 'from-orange-400/40'
            : 'from-gray-400/30',
          status === JobLeadStatus.INTERVIEW_COMPLETED
            ? 'to-blue-400/30'
            : 'to-gray-400/30',
        )}
      />

      <div className="relative flex flex-col gap-y-1">
        <div
          className={cn(
            'flex size-3 shrink-0 rounded-full',
            status === JobLeadStatus.INTERVIEW_COMPLETED
              ? 'bg-blue-400'
              : 'bg-gray-400/30',
          )}
        />

        <div
          className={cn(
            'absolute left-0 top-full pt-1.5 text-xs font-semibold',
            status === JobLeadStatus.INTERVIEW_COMPLETED
              ? 'text-blue-400'
              : 'text-gray-400/70',
          )}
        >
          Interview Completed
        </div>
      </div>

      <div
        className={cn(
          'h-1.5 w-1/3 rounded-full bg-gradient-to-r from-0%',
          status === JobLeadStatus.INTERVIEW_COMPLETED
            ? 'from-green-400/20  '
            : 'from-gray-400/30',
          status === JobLeadStatus.OFFER
            ? 'to-primary/30'
            : 'to-gray-400/30',
        )}
      />

      <div className="relative flex flex-col gap-y-1">
        <div
          className={cn(
            'flex size-3 shrink-0 rounded-full bg-primary',
            status === JobLeadStatus.OFFER
              ? 'bg-primary'
              : 'bg-gray-400/30',
          )}
        />

        <div
          className={cn(
            'absolute right-0 top-full pt-1.5 text-xs font-semibold text-nowrap',
            status === JobLeadStatus.OFFER
              ? 'text-primary'
              : 'text-gray-400/70',
          )}
        >
          Offer
        </div>
      </div>
    </div>
  );
}
