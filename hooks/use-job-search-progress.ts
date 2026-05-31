import { DataEventType } from '@/types/events';
import { JobSearchStatus } from '@/generated/prisma/browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useUserChannel } from './use-user-channel';

interface JobSearchProgressData {
  id: string;
  progress: number;
  status: JobSearchStatus;
  jobListingsCount: number;
  searchTerm: string;
}

interface UseJobSearchProgressReturn {
  activeSearches: Map<string, JobSearchProgressData>;
  isAnySearchActive: boolean;
}

/**
 * Hook to track active job search progress in real-time
 * Listens to the user's private channel for job search updates
 * Shows toast notifications for search progress
 */
export function useJobSearchProgress(): UseJobSearchProgressReturn {
  const channel = useUserChannel();
  const [activeSearches, setActiveSearches] = useState<
    Map<string, JobSearchProgressData>
  >(new Map());
  const toastIdsRef = useRef<Map<string, string | number>>(new Map());

  const handleDataUpdate = useCallback((data: any) => {
    if (
      data.type === DataEventType.JOB_SEARCH_PROGRESS ||
      data.type === DataEventType.JOB_SEARCH_UPDATED
    ) {
      const searchData: JobSearchProgressData = data.data;
      const toastId = `job-search-${searchData.id}`;

      if (searchData.status === JobSearchStatus.FAILED) {
        setActiveSearches(prev => {
          const updated = new Map(prev);
          updated.delete(searchData.id);
          return updated;
        });
        toastIdsRef.current.delete(searchData.id);
        return;
      }

      // Update the search state
      setActiveSearches(prev => {
        const updated = new Map(prev);
        updated.set(searchData.id, searchData);
        return updated;
      });

      // Handle toast notifications based on status
      if (searchData.status === JobSearchStatus.QUEUED) {
        toast.loading(`Searching for "${searchData.searchTerm}"...`, {
          id: toastId,
          description: 'Queued',
        });
        toastIdsRef.current.set(searchData.id, toastId);
      } else if (searchData.status === JobSearchStatus.PROCESSING) {
        toast.loading(`Searching for "${searchData.searchTerm}"...`, {
          id: toastId,
          description: `${searchData.progress}% complete${searchData.jobListingsCount > 0 ? ` • ${searchData.jobListingsCount} jobs found` : ''}`,
        });
        toastIdsRef.current.set(searchData.id, toastId);
      } else if (searchData.status === JobSearchStatus.COMPLETED) {
        toast.success(`Search complete: "${searchData.searchTerm}"`, {
          id: toastId,
          description: `Found ${searchData.jobListingsCount} jobs`,
          duration: 4000,
        });
        // Clean up after completion
        setTimeout(() => {
          setActiveSearches(current => {
            const next = new Map(current);
            next.delete(searchData.id);
            return next;
          });
          toastIdsRef.current.delete(searchData.id);
        }, 4000);
      }
    }
  }, []);

  useEffect(() => {
    if (!channel) return;

    channel.bind('data-update', handleDataUpdate);

    return () => {
      channel.unbind('data-update', handleDataUpdate);
    };
  }, [channel, handleDataUpdate]);

  const isAnySearchActive = Array.from(activeSearches.values()).some(
    search =>
      search.status === JobSearchStatus.PROCESSING ||
      search.status === JobSearchStatus.QUEUED,
  );

  return {
    activeSearches,
    isAnySearchActive,
  };
}
