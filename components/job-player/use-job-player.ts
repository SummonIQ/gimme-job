import type { JobListing } from '@/generated/prisma/browser';
import { JobListingStatus } from '@/generated/prisma/browser';
import { useCallback, useMemo, useState } from 'react';

interface UseJobPlayerOptions {
  jobs: JobListing[];
  initialIndex?: number;
}

export function useJobPlayer({ jobs, initialIndex = 0 }: UseJobPlayerOptions) {
  const queue = useMemo(
    () => jobs.filter(job => job.status === JobListingStatus.UNREVIEWED),
    [jobs],
  );

  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.min(initialIndex, Math.max(0, queue.length - 1)),
  );
  const [direction, setDirection] = useState<1 | -1>(1);

  const currentJob = queue[currentIndex] ?? null;
  const totalCount = queue.length;
  const isAtEnd = currentIndex >= queue.length - 1;
  const isAtStart = currentIndex === 0;

  const next = useCallback(() => {
    setDirection(1);
    setCurrentIndex(prev => Math.min(prev + 1, queue.length - 1));
  }, [queue.length]);

  const previous = useCallback(() => {
    setDirection(-1);
    setCurrentIndex(prev => Math.max(prev - 1, 0));
  }, []);

  const markAsActedOn = useCallback(
    (_id: string) => {
      // The queue will re-filter on next render since the parent updates
      // job statuses via the custom event. For now, just advance.
      if (currentIndex < queue.length - 1) {
        setDirection(1);
        // Don't increment index - the acted-on job will be removed from queue
        // on re-render, so the same index will point to the next job
      }
    },
    [currentIndex, queue.length],
  );

  return {
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
  };
}
