'use client';

import { JobListing, JobListingStatus } from '@/generated/prisma/browser';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bookmark,
  Briefcase,
  CirclePlus,
  Loader2,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { JobListingCard } from '@/components/job-listings/job-listing-card';
import { JobListingsReport } from '@/components/job-listings/job-listings-report';
import { Pagination } from '@/components/job-search/pagination';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { ViewMode } from '@/components/ui/view-mode-toggle';
import { cn } from '@/lib/css';
import { createJobLeads } from '@/lib/job-leads/create';
import {
  dismissJobListings,
  undismissJobListings,
} from '@/lib/job-listings/dismiss';
import { saveLiveJobListings } from '@/lib/job-listings/live';

interface JobSearchResultsProps {
  currentPage: number;
  isSelectedAll: boolean;
  loading: boolean;
  onChangeCurrentPage: (page: number) => void;
  onChangePageSize: (pageSize: number) => void;
  onClearSelection: () => void;
  onJobClick?: (job: JobListing) => void;
  onSelect: (job: JobListing) => void;
  onSelectAll: () => void;
  onSortChange: (sort: JobSearchSort) => void;
  onViewModeChange: (mode: ViewMode) => void;
  pageSize: number;
  result: {
    data: JobListing[];
    pageInfo: {
      count: number;
      pageCount: number;
      total: number;
    };
  } | null;
  selected: Record<string, JobListing>;
  selectedCount: number;
  sort: JobSearchSort;
  viewMode: ViewMode;
}

type JobSearchSort = 'recent' | 'oldest' | 'added' | 'company' | 'title';

export function JobSearchResults({
  currentPage,
  isSelectedAll,
  loading,
  onChangeCurrentPage,
  onChangePageSize,
  onClearSelection,
  onJobClick,
  onSelect,
  onSelectAll,
  onSortChange,
  onViewModeChange,
  pageSize,
  result,
  selected,
  selectedCount,
  sort,
  viewMode,
}: JobSearchResultsProps) {
  const topRef = useRef<HTMLDivElement | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isAddingLeads, setIsAddingLeads] = useState(false);

  const hasResults = !!result?.data && result.data.length > 0;
  const hasSelectableResults = hasResults;
  const showSkeleton = loading && !hasResults;

  const handleChangePage = (page: number) => {
    topRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
    onChangeCurrentPage(page);
  };

  const handleChangePageSize = (nextPageSize: number) => {
    topRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
    onChangePageSize(nextPageSize);
  };

  const handleJobClick = (job: JobListing) => {
    onJobClick?.(job);
  };

  const handleBulkSave = async () => {
    if (selectedCount === 0) return;

    setIsSaving(true);
    try {
      await saveLiveJobListings(Object.values(selected));
      toast.success(
        `Saved ${selectedCount} job${selectedCount > 1 ? 's' : ''}`,
      );
      onClearSelection();
    } catch (error) {
      toast.error('Failed to save jobs');
      console.error('Error saving jobs:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkDismiss = async () => {
    if (selectedCount === 0) return;

    setIsDismissing(true);
    try {
      const ids = Object.keys(selected);
      await dismissJobListings(ids);
      toast.success(
        `Dismissed ${selectedCount} job${selectedCount > 1 ? 's' : ''}`,
      );
      onClearSelection();
    } catch (error) {
      toast.error('Failed to dismiss jobs');
      console.error('Error dismissing jobs:', error);
    } finally {
      setIsDismissing(false);
    }
  };

  const handleBulkRestore = async () => {
    if (selectedCount === 0) return;

    setIsRestoring(true);
    try {
      const ids = Object.keys(selected);
      await undismissJobListings(ids);
      toast.success(
        `Restored ${selectedCount} job${selectedCount > 1 ? 's' : ''}`,
      );
      onClearSelection();
    } catch (error) {
      toast.error('Failed to restore jobs');
      console.error('Error restoring jobs:', error);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleBulkAddAsLead = async () => {
    if (selectedCount === 0) return;

    setIsAddingLeads(true);
    try {
      const ids = Object.keys(selected);
      await createJobLeads(ids);
      for (const id of ids) {
        window.dispatchEvent(
          new CustomEvent('job-listing-updated', {
            detail: { id, status: JobListingStatus.ADDED_TO_LEADS },
          }),
        );
      }
      toast.success(
        `Added ${selectedCount} job${selectedCount > 1 ? 's' : ''} as lead${selectedCount > 1 ? 's' : ''}`,
      );
      onClearSelection();
    } catch (error) {
      toast.error('Failed to add jobs as leads');
      console.error('Error adding jobs as leads:', error);
    } finally {
      setIsAddingLeads(false);
    }
  };

  return (
    <div className="relative flex h-full min-h-full flex-col overflow-hidden">
      <div ref={topRef} />
      {/* Inline loading indicator (sort / view-mode / count moved to the
          search-bar row in the parent JobSearchClient). */}
      {loading && result?.data && result.data.length > 0 && (
        <div className="pointer-events-none sticky top-0 z-10 flex justify-center py-2">
          <div className="flex items-center gap-2 rounded-full border border-border/50 bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1">
        {showSkeleton ? (
          <div className="divide-y divide-border/50">
            {[...Array(6)].map((_, i) => (
              <div className="py-4 px-4" key={i}>
                <div className="pl-8 flex flex-col">
                  {/* Title */}
                  <Skeleton className="h-5 w-3/5 rounded" />
                  {/* Meta row */}
                  <div className="flex items-center gap-4 py-3">
                    <Skeleton className="h-4 w-28 rounded" />
                    <Skeleton className="h-4 w-24 rounded" />
                    <Skeleton className="h-4 w-20 rounded" />
                  </div>
                  {/* Description lines */}
                  <div className="space-y-2">
                    <Skeleton className="h-3.5 w-full rounded" />
                    <Skeleton className="h-3.5 w-full rounded" />
                    <Skeleton className="h-3.5 w-4/5 rounded" />
                  </div>
                  {/* Badges row */}
                  <div className="flex items-center gap-2 pt-5">
                    <Skeleton className="h-5 w-14 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : hasResults ? (
          viewMode === 'card' ? (
            <div
              className={cn(
                'transition-opacity duration-200',
                loading && 'opacity-60 pointer-events-none',
              )}
            >
              {result.data.map(job => (
                <JobListingCard
                  isSelected={!!selected[job.id]}
                  job={job}
                  key={job.id}
                  onClick={() => handleJobClick(job)}
                  onSelect={() => onSelect(job)}
                />
              ))}
            </div>
          ) : (
            <div
              className={cn(
                'h-full transition-opacity duration-200',
                loading && 'opacity-60 pointer-events-none',
              )}
            >
              <JobListingsReport
                initialData={result.data}
                showPostedAt={true}
                showPagination={false}
                showSearch={false}
              />
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <Briefcase className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No jobs found</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Try adjusting your filters or search criteria to find more
              opportunities.
            </p>
          </div>
        )}
      </div>

      {result?.data && result.data.length > 0 && (
        <div className="border-t border-border/50 bg-background/95 p-4 -mx-4 sm:-mx-6 px-4 sm:px-6 rounded-b-2xl">
          <Pagination
            currentPage={currentPage}
            onPageChange={handleChangePage}
            onPageSizeChange={handleChangePageSize}
            pageSize={pageSize}
            totalPages={result.pageInfo?.pageCount ?? 1}
          />
        </div>
      )}

      {/* Floating Action Bar */}
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 max-w-[calc(100vw-2rem)] safe-bottom"
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{
              duration: 0.28,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <div className="flex items-center gap-1 rounded-2xl border border-border/40 bg-background/80 px-1.5 py-1.5 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)_inset] backdrop-blur-xl">
              <div className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5">
                <span className="text-sm font-bold tabular-nums text-primary">
                  {selectedCount}
                </span>
                <span className="text-xs text-primary/70">selected</span>
              </div>

              <div className="mx-0.5 h-5 w-px bg-border/50" />

              <Button
                className="h-8 gap-1.5 rounded-xl px-3 text-xs"
                disabled={isSaving}
                onClick={handleBulkSave}
                size="sm"
                variant="ghost"
              >
                <Bookmark className="size-3.5" />
                Save
              </Button>

              <Button
                className="h-8 gap-1.5 rounded-xl px-3 text-xs"
                disabled={isAddingLeads}
                onClick={handleBulkAddAsLead}
                size="sm"
                variant="ghost"
              >
                <CirclePlus className="size-3.5" />
                Add to Leads
              </Button>

              {(() => {
                const selectedJobs = Object.values(selected);
                const hasDismissed = selectedJobs.some(
                  j => j.status === JobListingStatus.DISMISSED,
                );
                const hasNonDismissed = selectedJobs.some(
                  j => j.status !== JobListingStatus.DISMISSED,
                );

                return (
                  <>
                    {hasNonDismissed && (
                      <Button
                        className="h-8 gap-1.5 rounded-xl px-3 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={isDismissing}
                        onClick={handleBulkDismiss}
                        size="sm"
                        variant="ghost"
                      >
                        <Trash2 className="size-3.5" />
                        Dismiss
                      </Button>
                    )}

                    {hasDismissed && (
                      <Button
                        className="h-8 gap-1.5 rounded-xl px-3 text-xs"
                        disabled={isRestoring}
                        onClick={handleBulkRestore}
                        size="sm"
                        variant="ghost"
                      >
                        <RotateCcw className="size-3.5" />
                        Restore
                      </Button>
                    )}
                  </>
                );
              })()}

              <div className="mx-0.5 h-5 w-px bg-border/50" />

              <Button
                className="size-7 rounded-full text-muted-foreground hover:text-foreground"
                onClick={onClearSelection}
                size="icon"
                variant="ghost"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
