'use client';

import type { JobLead } from '@/generated/prisma/browser';
import { ChevronUp, Replace, TrashIcon } from 'lucide-react';
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

interface JobLeadsBulkActionBarProps {
  dismiss?: (ids: Array<string>) => Promise<void>;
  resetSelectedJobs?: () => void;
  selectedJobLeads: Record<string, JobLead>;
}

const JobLeadsBulkActionBar = ({
  dismiss,
  selectedJobLeads = {},
  resetSelectedJobs,
}: JobLeadsBulkActionBarProps) => {
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [isDismissing, startDismissTransition] = useTransition();
  const router = useRouter();

  const selectedCount = Object.keys(selectedJobLeads).length;
  const hasRowSelections = selectedCount > 0;

  const handleDismiss = async () => {
    if (dismiss) {
      startDismissTransition(async () => {
        await dismiss(Object.keys(selectedJobLeads));
        setTimeout(() => router.refresh(), 1500);
        resetSelectedJobs?.();
      });
    }
  };

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
            <DropdownMenuItem
              className="cursor-pointer text-sm font-semibold text-red-500 hover:!bg-red-500/90 hover:!text-white"
              onClick={handleDismiss}
            >
              <TrashIcon className="!size-3.5" />
              <span>Dismiss ({selectedCount})</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="hidden md:flex items-center gap-1 px-2">
        <Button
          className="text-red-500 hover:bg-red-500/10 hover:text-red-400"
          disabled={!dismiss}
          onClick={handleDismiss}
          size="sm"
          type="button"
          variant="ghost"
        >
          <TrashIcon className="!size-3.5" />
          <span className="text-xs font-medium">
            Dismiss ({selectedCount})
          </span>
        </Button>
      </div>
    </FloatingActionBar>
  );
};

JobLeadsBulkActionBar.displayName = 'JobLeadsBulkActionBar';

export { JobLeadsBulkActionBar };
