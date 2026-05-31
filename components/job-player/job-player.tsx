'use client';

import type { JobListing } from '@/generated/prisma/browser';
import { JobListingStatus } from '@/generated/prisma/browser';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, PartyPopper } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalTitle,
} from '@/components/ui/modal';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { dismissJobListings } from '@/lib/job-listings/dismiss';
import { JobPlayerContent } from './job-player-content';
import { JobPlayerControls } from './job-player-controls';
import { useJobPlayer } from './use-job-player';

interface JobPlayerProps {
  jobs: JobListing[];
  open: boolean;
  onClose: () => void;
  initialIndex?: number;
}

export function JobPlayer({
  jobs,
  open,
  onClose,
  initialIndex = 0,
}: JobPlayerProps) {
  const {
    queue,
    currentIndex,
    currentJob,
    totalCount,
    isAtEnd,
    isAtStart,
    direction,
    next,
    previous,
    markAsActedOn,
  } = useJobPlayer({ jobs, initialIndex });

  const [isAddingToLeads, setIsAddingToLeads] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  const isActionPending = isAddingToLeads || isDismissing;

  const handleAddToLeads = useCallback(async () => {
    if (!currentJob || isActionPending) return;

    setIsAddingToLeads(true);
    try {
      const response = await fetch('/api/jobs/add-to-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentJob),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add to leads');
      }
      window.dispatchEvent(
        new CustomEvent('job-listing-updated', {
          detail: {
            id: currentJob.id,
            status: JobListingStatus.ADDED_TO_LEADS,
          },
        }),
      );
      markAsActedOn(currentJob.id);
      toast.success('Added to job leads!');
    } catch (error) {
      console.error('Failed to add to leads:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to add to job leads.',
      );
    } finally {
      setIsAddingToLeads(false);
    }
  }, [currentJob, isActionPending, markAsActedOn]);

  const handleDismiss = useCallback(async () => {
    if (!currentJob || isActionPending) return;

    setIsDismissing(true);
    try {
      await dismissJobListings([currentJob.id]);
      window.dispatchEvent(
        new CustomEvent('job-listing-updated', {
          detail: {
            id: currentJob.id,
            status: JobListingStatus.DISMISSED,
          },
        }),
      );
      markAsActedOn(currentJob.id);
      toast.success('Job dismissed');
    } catch (error) {
      console.error('Failed to dismiss job:', error);
      toast.error('Failed to dismiss job.');
    } finally {
      setIsDismissing(false);
    }
  }, [currentJob, isActionPending, markAsActedOn]);

  const handleSkip = useCallback(() => {
    if (!isAtEnd) {
      next();
    }
  }, [isAtEnd, next]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (isActionPending) {
        // Allow Escape but block other shortcuts during actions
        if (e.key !== 'Escape') return;
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'n':
          e.preventDefault();
          handleSkip();
          break;
        case 'ArrowLeft':
        case 'p':
          e.preventDefault();
          previous();
          break;
        case 'a':
        case 'Enter':
          e.preventDefault();
          handleAddToLeads();
          break;
        case 'd':
          e.preventDefault();
          handleDismiss();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    open,
    isActionPending,
    handleSkip,
    previous,
    handleAddToLeads,
    handleDismiss,
  ]);

  const isEmpty = totalCount === 0;

  return (
    <Modal open={open} onOpenChange={onClose}>
      <ModalContent
        className="flex h-[min(92vh,900px)] w-[min(1180px,calc(100vw-1rem))] max-w-none flex-col overflow-hidden rounded-3xl border-border/70 bg-background p-0 shadow-[0_28px_90px_-34px_rgba(0,0,0,0.75)] ring-1 ring-white/40 dark:border-white/10 dark:bg-[#101014] dark:ring-white/5 sm:w-[min(1180px,calc(100vw-2rem))]"
        closeActions={
          currentJob ? (
            <>
              <Button
                disabled={isAtStart}
                onClick={previous}
                size="icon"
                variant="outline"
                className="border-border/70 bg-background/70 shadow-xs dark:border-white/10 dark:bg-white/[0.04]"
                aria-label="Previous"
              >
                <ChevronLeft />
              </Button>
              <Button
                disabled={isAtEnd}
                onClick={next}
                size="icon"
                variant="outline"
                className="border-border/70 bg-background/70 shadow-xs dark:border-white/10 dark:bg-white/[0.04]"
                aria-label="Next"
              >
                <ChevronRight />
              </Button>
            </>
          ) : null
        }
      >
        <VisuallyHidden>
          <ModalTitle>
            {currentJob ? `${currentJob.title} - Job Player` : 'Job Player'}
          </ModalTitle>
        </VisuallyHidden>
        {isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 bg-background p-8 text-center dark:bg-[#101014]">
            <div className="flex size-16 items-center justify-center rounded-2xl border border-border/60 bg-background/80 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
              <PartyPopper className="size-8 text-primary/80" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-semibold tracking-tight">
                All caught up!
              </h3>
              <p className="text-sm text-muted-foreground">
                No unreviewed jobs to go through.
              </p>
            </div>
            <Button
              className="rounded-full"
              variant="outline"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        ) : currentJob ? (
          <>
            <div className="relative shrink-0 overflow-hidden border-b border-border/70 px-4 pb-4 pt-5 pr-40 dark:border-white/10 sm:px-6 sm:pt-6 sm:pr-44">
              <div className="flex min-w-0 items-start gap-4">
                {currentJob.companyLogoUrl ? (
                  <img
                    alt={`${currentJob.company ?? 'Company'} logo`}
                    className="size-12 shrink-0 rounded-xl border border-border/60 bg-muted/40 object-contain p-1.5 shadow-xs dark:border-white/10 dark:bg-white/[0.04]"
                    loading="lazy"
                    src={currentJob.companyLogoUrl}
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-xl font-semibold leading-tight tracking-tight text-foreground">
                    {currentJob.title}
                  </h2>
                  <p className="truncate text-lg font-medium text-muted-foreground">
                    {currentJob.company ?? 'Review this job'}
                  </p>
                </div>
              </div>
            </div>

            <ModalBody className="min-h-0 flex-1 overflow-hidden bg-muted/20 p-0 dark:bg-[#0d0d11]">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  className="h-full min-h-0"
                  key={currentJob.id}
                  initial={{ opacity: 0, x: direction * 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -40 }}
                  transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                >
                  <JobPlayerContent job={currentJob} />
                </motion.div>
              </AnimatePresence>
            </ModalBody>

            <ModalFooter className="relative border-t border-border/70 bg-background/95 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-[#101014]/95 sm:px-6">
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="rounded-full px-2 text-xs font-medium tabular-nums text-muted-foreground">
                  {currentIndex + 1} of {totalCount}
                </span>
              </div>
              <div className="relative z-10 w-full">
                <JobPlayerControls
                  isAddingToLeads={isAddingToLeads}
                  isDismissing={isDismissing}
                  isAlreadyInLeads={
                    currentJob.status === JobListingStatus.ADDED_TO_LEADS
                  }
                  isAtEnd={isAtEnd}
                  isAtStart={isAtStart}
                  totalCount={totalCount}
                  onAddToLeads={handleAddToLeads}
                  onDismiss={handleDismiss}
                  onSkip={handleSkip}
                />
              </div>
            </ModalFooter>
          </>
        ) : null}
      </ModalContent>
    </Modal>
  );
}
