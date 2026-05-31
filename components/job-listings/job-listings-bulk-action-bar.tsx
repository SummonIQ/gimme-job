'use client';

import { type JobListing, JobListingStatus } from '@/generated/prisma/browser';
import {
  CheckCircle,
  ChevronUp,
  Replace,
  StarIcon,
  StarOff,
  TrashIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { FloatingActionBar } from '@/components/ui/floating-action-bar';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface BulkJobListingActionBarProps {
  addToLeads?: (ids: string[]) => Promise<void>;
  dismiss?: (ids: string[]) => Promise<void>;
  resetSelectedJobs?: () => void;
  save?: (ids: string[]) => Promise<void>;
  selectedJobs: Record<string, JobListing>;
  undismiss?: (ids: string[]) => Promise<void>;
  unsave?: (ids: string[]) => Promise<void>;
}

export const BulkJobListingActionBar = ({
  addToLeads,
  save,
  dismiss,
  undismiss,
  selectedJobs = {},
  resetSelectedJobs,
  unsave,
}: BulkJobListingActionBarProps) => {
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [isDismissPending, startDismissTransition] = useTransition();
  const [isUndismissPending, startUndismissTransition] = useTransition();
  const [isAddToLeadsPending, startAddToLeadsTransition] = useTransition();
  const [isSavePending, startSaveTransition] = useTransition();
  const [isUnsavePending, startUnsaveTransition] = useTransition();
  const router = useRouter();

  const selectedCount = Object.keys(selectedJobs).length;
  const hasRowSelections = selectedCount > 0;

  const handleDismiss = async () => {
    if (dismiss) {
      startDismissTransition(async () => {
        await dismiss(Object.keys(selectedJobs));
        setTimeout(() => router.refresh(), 1500);
        resetSelectedJobs?.();
      });
    }
  };

  const handleUndismiss = async () => {
    if (undismiss) {
      startUndismissTransition(async () => {
        await undismiss(Object.keys(selectedJobs));
        setTimeout(() => router.refresh(), 1500);
        resetSelectedJobs?.();
      });
    }
  };

  const handleAddToLeads = async () => {
    if (addToLeads) {
      startAddToLeadsTransition(async () => {
        await addToLeads(Object.keys(selectedJobs));
        setTimeout(() => router.refresh(), 1500);
        resetSelectedJobs?.();
      });
    }
  };

  const handleSave = async () => {
    if (save) {
      startSaveTransition(async () => {
        await save(Object.keys(selectedJobs));
        setTimeout(() => router.refresh(), 1500);
        resetSelectedJobs?.();
      });
    }
  };

  const handleUnsave = async () => {
    if (unsave) {
      startUnsaveTransition(async () => {
        await unsave(Object.keys(selectedJobs));
        setTimeout(() => router.refresh(), 1500);
        resetSelectedJobs?.();
      });
    }
  };

  const canAddToLeads =
    addToLeads &&
    Object.values(selectedJobs).some(
      job => job.status === JobListingStatus.UNREVIEWED,
    );
  const canDismiss =
    dismiss &&
    Object.values(selectedJobs).some(
      job => job.status === JobListingStatus.UNREVIEWED,
    );
  const canUndismiss =
    undismiss &&
    Object.values(selectedJobs).some(
      job => job.status === JobListingStatus.DISMISSED,
    );
  const canSave = save && Object.values(selectedJobs).some(job => !job.saved);
  const canUnsave =
    unsave && Object.values(selectedJobs).some(job => job.saved);

  const getAddToLeadsCount = () =>
    Object.values(selectedJobs).filter(
      job => job.status === JobListingStatus.UNREVIEWED,
    ).length;

  const getDismissCount = () =>
    Object.values(selectedJobs).filter(
      job => job.status === JobListingStatus.UNREVIEWED,
    ).length;

  const getUndismissCount = () =>
    Object.values(selectedJobs).filter(
      job => job.status === JobListingStatus.DISMISSED,
    ).length;

  return (
    <FloatingActionBar count={selectedCount} open={hasRowSelections}>
      <div className="px-2 md:hidden">
        <DropdownMenu
          modal={false}
          onOpenChange={setActionsMenuOpen}
          open={actionsMenuOpen}
        >
          <DropdownMenuTrigger asChild>
            <Button
              className="h-8 text-sm font-semibold text-foreground/75"
              onMouseEnter={() => setActionsMenuOpen(true)}
              size="sm"
              variant="outline"
            >
              <Replace className="!size-3.5" />
              Actions
              <ChevronUp className="ml-2 size-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            onMouseLeave={() => setActionsMenuOpen(false)}
          >
            {canAddToLeads && (
              <DropdownMenuItem
                className="cursor-pointer text-sm font-semibold text-green-500 hover:!bg-green-500/90 hover:!text-white"
                onClick={handleAddToLeads}
              >
                <CheckCircle className="!size-3.5" />
                <span>Add to leads ({getAddToLeadsCount()})</span>
              </DropdownMenuItem>
            )}

            {canDismiss && (
              <DropdownMenuItem
                className="cursor-pointer text-sm font-semibold text-red-500 hover:!bg-red-500/90 hover:!text-white"
                onClick={handleDismiss}
              >
                <TrashIcon className="!size-3.5" />
                <span>Dismiss ({getDismissCount()})</span>
              </DropdownMenuItem>
            )}

            {canUndismiss && (
              <DropdownMenuItem
                className="cursor-pointer text-sm font-semibold text-green-500 hover:!bg-green-500/90 hover:!text-white"
                onClick={handleUndismiss}
              >
                <CheckCircle className="!size-3.5" />
                <span>Undismiss ({getUndismissCount()})</span>
              </DropdownMenuItem>
            )}

            {canSave && (
              <DropdownMenuItem
                className="cursor-pointer text-sm font-semibold text-yellow-500 hover:!bg-yellow-500/90 hover:!text-white"
                onClick={handleSave}
              >
                <StarIcon className="!size-3.5" />
                <span>
                  Save (
                  {
                    Object.values(selectedJobs).filter(job => !job.saved)
                      .length
                  }
                  )
                </span>
              </DropdownMenuItem>
            )}

            {canUnsave && (
              <DropdownMenuItem
                className="cursor-pointer text-sm font-semibold text-muted-foreground hover:!bg-muted"
                onClick={handleUnsave}
              >
                <StarOff className="!size-3.5" />
                <span>
                  Unsave (
                  {
                    Object.values(selectedJobs).filter(job => job.saved)
                      .length
                  }
                  )
                </span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="hidden md:flex items-center gap-1 px-2">
        {canAddToLeads && (
          <Button
            className="text-green-500 hover:bg-green-500/10 hover:text-green-400"
            onClick={handleAddToLeads}
            size="sm"
            type="button"
            variant="ghost"
          >
            <CheckCircle className="!size-3.5" />
            <span className="text-xs font-medium">
              Add to Leads ({getAddToLeadsCount()})
            </span>
          </Button>
        )}

        {canDismiss && (
          <Button
            className="text-red-500 hover:bg-red-500/10 hover:text-red-400"
            onClick={handleDismiss}
            size="sm"
            type="button"
            variant="ghost"
          >
            <TrashIcon className="!size-3.5" />
            <span className="text-xs font-medium">
              Dismiss ({getDismissCount()})
            </span>
          </Button>
        )}

        {canSave && (
          <Button
            className="text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-400"
            onClick={handleSave}
            size="sm"
            type="button"
            variant="ghost"
          >
            <StarIcon className="!size-3.5" />
            <span className="text-xs font-medium">
              Save (
              {
                Object.values(selectedJobs).filter(job => !job.saved)
                  .length
              }
              )
            </span>
          </Button>
        )}

        {canUnsave && (
          <Button
            className="text-muted-foreground hover:bg-muted/50"
            onClick={handleUnsave}
            size="sm"
            type="button"
            variant="ghost"
          >
            <StarOff className="!size-3.5" />
            <span className="text-xs font-medium">
              Unsave (
              {
                Object.values(selectedJobs).filter(job => job.saved)
                  .length
              }
              )
            </span>
          </Button>
        )}
      </div>
    </FloatingActionBar>
  );
};

BulkJobListingActionBar.displayName = 'BulkJobListingActionBar';
