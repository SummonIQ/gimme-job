import { JobListingStatus } from '@/generated/prisma/browser';
import { Ban, Loader2, PlusCircle, SkipForward } from 'lucide-react';

import { JobListingStatusBadge } from '@/components/job-listings/job-listing-status-badge';
import { Button } from '@/components/ui/button';

interface JobPlayerControlsProps {
  isAddingToLeads: boolean;
  isDismissing: boolean;
  isAlreadyInLeads: boolean;
  isAtEnd: boolean;
  isAtStart: boolean;
  totalCount: number;
  onAddToLeads: () => void;
  onDismiss: () => void;
  onSkip: () => void;
}

export function JobPlayerControls({
  isAddingToLeads,
  isDismissing,
  isAlreadyInLeads,
  isAtEnd,
  isAtStart,
  totalCount,
  onAddToLeads,
  onDismiss,
  onSkip,
}: JobPlayerControlsProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Button
        disabled={isDismissing || isAddingToLeads}
        onClick={onDismiss}
        size="sm"
        variant="outline"
        className="rounded-full border-red-600/50 bg-red-600/10 text-red-600 hover:bg-red-600/20 hover:text-red-600 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-500 dark:hover:bg-red-500/20 dark:hover:text-red-500"
      >
        {isDismissing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Dismissing...
          </>
        ) : (
          <>
            <Ban className="h-4 w-4" />
            Dismiss
          </>
        )}
      </Button>

      <div className="flex items-center gap-2">
        <Button
          disabled={isAtEnd && isAtStart && totalCount <= 1}
          onClick={onSkip}
          size="sm"
          variant="ghost"
          className="rounded-full"
        >
          <SkipForward className="h-4 w-4" />
          Skip
        </Button>

        {isAlreadyInLeads ? (
          <JobListingStatusBadge
            status={JobListingStatus.ADDED_TO_LEADS}
            variant="outline"
          />
        ) : (
          <Button
            disabled={isAddingToLeads || isDismissing}
            onClick={onAddToLeads}
            size="sm"
            className="rounded-full"
          >
            {isAddingToLeads ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <PlusCircle className="h-4 w-4" />
                Add to Leads
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
