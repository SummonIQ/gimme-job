'use client';

import type { JobListing } from '@/generated/prisma/browser';
import { JobListingStatus } from '@/generated/prisma/browser';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { ViewMode } from '@/components/ui/view-mode-toggle';
import { SlidersHorizontal } from 'lucide-react';
import { useGeolocation } from '@/hooks/use-geolocation';
import { useJobSearchProgress } from '@/hooks/use-job-search-progress';
import { JobPlayer } from '@/components/job-player/job-player';
import { JobSearchBar } from './job-search-bar';
import type { JobSearchFiltersData } from './job-search-filters';
import { JobSearchFilters } from './job-search-filters';
import { JobSearchResults } from './job-search-results';

interface JobSearchClientProps {
  initialData?: JobListing[];
  initialTotal?: number;
  initialLocation?: string;
}

export interface JobSearchFormData extends JobSearchFiltersData {
  search: string;
}

type JobSearchSort = 'recent' | 'oldest' | 'added' | 'company' | 'title';

const isJobSearchSort = (value: string | null): value is JobSearchSort => {
  return (
    value === 'recent' ||
    value === 'oldest' ||
    value === 'added' ||
    value === 'company' ||
    value === 'title'
  );
};

const getDefaultFilters = (): JobSearchFormData => ({
  excludeApplied: false,
  excludeDismissed: true,
  excludeLeads: false,
  jobType: 'any',
  location: '',
  maxSalary: '',
  minSalary: '',
  postedWithin: 'any',
  remote: false,
  savedOnly: false,
  search: '',
  view: 'all',
});

const normalizeFilters = (
  filters: JobSearchFormData,
  patch?: Partial<JobSearchFormData>,
): JobSearchFormData => {
  const next = { ...filters };

  // When toggling remote ON, clear location
  if (patch && 'remote' in patch && patch.remote === true) {
    next.location = '';
    return next;
  }

  // When toggling remote OFF, restore last stored location
  if (patch && 'remote' in patch && patch.remote === false && !next.location) {
    const storedLocation = getStoredLocation();
    if (storedLocation) {
      next.location = storedLocation;
    }
  }

  if (next.remote) {
    next.location = '';
    return next;
  }

  if (patch && 'location' in patch) {
    const raw = typeof patch.location === 'string' ? patch.location : '';
    if (raw.trim()) {
      next.remote = false;
      // Store location when user selects one
      storeLocation(raw.trim());
    }
  }

  return next;
};

const DEFAULT_PAGE_SIZE = 25;

const LOCATION_STORAGE_KEY = 'job-search:last-location';
const RECENT_LOCATIONS_KEY = 'job-search:recent-locations';
const MAX_RECENT_LOCATIONS = 5;

const getStoredLocation = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(LOCATION_STORAGE_KEY);
  } catch {}
  return null;
};

const storeLocation = (location: string): void => {
  if (typeof window === 'undefined' || !location.trim()) return;
  try {
    localStorage.setItem(LOCATION_STORAGE_KEY, location);
    // Also add to recent locations
    const recent = getRecentLocations();
    const filtered = recent.filter(
      l => l.toLowerCase() !== location.toLowerCase(),
    );
    const updated = [location, ...filtered].slice(0, MAX_RECENT_LOCATIONS);
    localStorage.setItem(RECENT_LOCATIONS_KEY, JSON.stringify(updated));
  } catch {}
};

const getRecentLocations = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(RECENT_LOCATIONS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.every(s => typeof s === 'string')) {
      return parsed;
    }
  } catch {}
  return [];
};

const getDefaultPagination = () => ({
  currentPage: 1,
  pageSize: DEFAULT_PAGE_SIZE,
});

export function JobSearchClient({
  initialData = [],
  initialTotal = 0,
  initialLocation,
}: JobSearchClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const getInitialFilters = useCallback((): JobSearchFormData => {
    const defaultFilters = getDefaultFilters();
    const params = Object.fromEntries(searchParams.entries());

    const initial: JobSearchFormData = {
      ...defaultFilters,
      excludeApplied: params.excludeApplied === 'true',
      excludeDismissed: params.excludeDismissed !== 'false',
      excludeLeads: params.excludeLeads === 'true',
      jobType: params.jobType || defaultFilters.jobType,
      location: params.location || initialLocation || defaultFilters.location,
      maxSalary: params.maxSalary || defaultFilters.maxSalary,
      minSalary: params.minSalary || defaultFilters.minSalary,
      postedWithin: params.postedWithin || defaultFilters.postedWithin,
      remote: params.remote === 'true',
      savedOnly: params.savedOnly === 'true',
      search: params.search || defaultFilters.search,
    };

    return normalizeFilters(initial, {
      location: initial.location,
      ...(initial.remote ? { remote: true } : {}),
    });
  }, [searchParams, initialLocation]);

  const [filters, setFilters] = useState<JobSearchFormData>(getInitialFilters);
  const [pagination, setPagination] = useState(() => {
    const page = searchParams.get('page');
    const pageSize = searchParams.get('pageSize');
    return {
      currentPage: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : DEFAULT_PAGE_SIZE,
    };
  });
  const filtersRef = useRef<JobSearchFormData>(filters);
  const paginationRef = useRef(pagination);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);
  useEffect(() => {
    paginationRef.current = pagination;
  }, [pagination]);

  const hasNormalizedInitialUrlRef = useRef(false);

  const [sort, setSort] = useState<JobSearchSort>(() => {
    const raw = searchParams.get('sort');
    return isJobSearchSort(raw) ? raw : 'recent';
  });
  const [selected, setSelected] = useState<Record<string, JobListing>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  const { activeSearches, isAnySearchActive } = useJobSearchProgress();
  const {
    location: detectedLocation,
    requestLocation,
    hasPermission,
  } = useGeolocation();
  const [result, setResult] = useState<{
    data: JobListing[];
    pageInfo: {
      count: number;
      pageCount: number;
      total: number;
    };
  } | null>({
    data: initialData,
    pageInfo: {
      count: initialData.length,
      pageCount: Math.ceil(initialTotal / DEFAULT_PAGE_SIZE),
      total: initialTotal,
    },
  });

  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const locationAttemptedRef = useRef(false);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const streamingPollTimerRef = useRef<number | null>(null);
  const lastProviderErrorRef = useRef<string>('');

  const buildSearchParams = useCallback(
    (
      searchFilters: JobSearchFormData,
      searchPagination: typeof pagination,
      options?: {
        includeCount?: boolean;
        knownPageCount?: number;
        knownTotal?: number;
        noCache?: boolean;
        sort?: JobSearchSort;
      },
    ) => {
      const normalizedFilters = normalizeFilters(searchFilters);
      const sortToUse = options?.sort ?? sort;
      const params = new URLSearchParams({
        page: searchPagination.currentPage.toString(),
        pageSize: searchPagination.pageSize.toString(),
        ...Object.fromEntries(
          Object.entries(normalizedFilters).filter(
            ([, v]) => v !== '' && v !== false,
          ),
        ),
      });

      if (sortToUse !== 'recent') {
        params.set('sort', sortToUse);
      }

      if (options?.includeCount === false) {
        params.set('includeCount', 'false');
        if (typeof options.knownTotal === 'number') {
          params.set('knownTotal', options.knownTotal.toString());
        }
        if (typeof options.knownPageCount === 'number') {
          params.set('knownPageCount', options.knownPageCount.toString());
        }
      }

      if (options?.noCache) {
        params.set('noCache', 'true');
      }

      return params;
    },
    [sort],
  );

  const fetchJobs = useCallback(
    async (
      searchFilters: JobSearchFormData,
      searchPagination: typeof pagination,
      options?: {
        includeCount?: boolean;
        knownPageCount?: number;
        knownTotal?: number;
        noCache?: boolean;
        sort?: JobSearchSort;
      },
    ) => {
      const params = buildSearchParams(
        searchFilters,
        searchPagination,
        options,
      );
      const url = `/api/jobs?${params.toString()}`;

      fetchAbortRef.current?.abort();
      const controller = new AbortController();
      fetchAbortRef.current = controller;

      setLoading(true);
      try {
        const response = await fetch(url, { signal: controller.signal });
        const data = await response.json();

        setResult(data);
        const providerErrors = Array.isArray((data as any)?.errors)
          ? ((data as any).errors as Array<{
              provider?: string;
              message?: string;
            }>)
          : [];
        if (providerErrors.length > 0) {
          const nextKey = providerErrors
            .map(
              error => `${error.provider ?? 'unknown'}:${error.message ?? ''}`,
            )
            .join('|');
          if (nextKey && nextKey !== lastProviderErrorRef.current) {
            lastProviderErrorRef.current = nextKey;
            providerErrors.forEach(error => {
              const providerLabel = error.provider ?? 'provider';
              const message =
                error.message ?? 'Request failed. Please try again.';
              toast.error(`${providerLabel}: ${message}`);
            });
          }
        }
      } catch (error) {
        if ((error as any)?.name === 'AbortError') return;
        console.error('Failed to fetch jobs:', error);
      } finally {
        setLoading(false);
      }
    },
    [buildSearchParams],
  );

  // Auto-refresh results when searches complete
  useEffect(() => {
    if (!isAnySearchActive && activeSearches.size > 0) {
      // A search just completed, refresh the results
      fetchJobs(filters, pagination);
    }
  }, [isAnySearchActive, activeSearches.size, fetchJobs, filters, pagination]);

  useEffect(() => {
    if (streamingPollTimerRef.current) {
      window.clearInterval(streamingPollTimerRef.current);
      streamingPollTimerRef.current = null;
    }
  }, []);

  const initialFetchDoneRef = useRef(false);
  useEffect(() => {
    if (initialFetchDoneRef.current) return;

    const rawSearchParam = searchParams.get('search') || '';
    const hasSearchParam = !!rawSearchParam.trim();

    const locationToUse = filters.remote
      ? ''
      : filters.location || initialLocation || '';
    const filtersWithLocation = locationToUse
      ? { ...filters, location: locationToUse }
      : filters;

    if (
      hasSearchParam ||
      locationToUse ||
      filters.remote ||
      hasPermission === false
    ) {
      initialFetchDoneRef.current = true;
      fetchJobs(filtersWithLocation, pagination, { noCache: true });
    }
  }, [
    filters,
    initialLocation,
    fetchJobs,
    pagination,
    searchParams,
    hasPermission,
  ]);

  // Detect user's location on mount if no location is set
  useEffect(() => {
    // Skip if we've already attempted location detection or have initial location from server
    if (locationAttemptedRef.current || initialLocation) return;

    const hasLocationParam = searchParams.get('location');
    const hasSearchParam = searchParams.get('search');

    // Only auto-detect location if there are no search params at all (fresh page load)
    if (
      !hasLocationParam &&
      !hasSearchParam &&
      !filters.location &&
      !filters.remote &&
      hasPermission !== false
    ) {
      locationAttemptedRef.current = true;

      // Try to get location if we have permission or it hasn't been asked yet
      if (detectedLocation) {
        console.log('🌍 Using cached location:', detectedLocation);
        initialFetchDoneRef.current = true;
        const nextFilters = { ...filters, location: detectedLocation };
        const nextPagination = { ...pagination, currentPage: 1 };
        setFilters(nextFilters);
        setPagination(nextPagination);
        fetchJobs(nextFilters, nextPagination, { noCache: true });
        return;
      }

      requestLocation();
    }
  }, [
    searchParams,
    hasPermission,
    detectedLocation,
    requestLocation,
    filters.location,
    filters.remote,
    initialLocation,
    fetchJobs,
    filters,
    pagination,
  ]);

  const updateURL = useCallback(
    (
      newFilters: JobSearchFormData,
      newPagination: typeof pagination,
      sortOverride?: JobSearchSort,
    ) => {
      const params = new URLSearchParams();
      const defaultFilters = getDefaultFilters();
      const sortToUse = sortOverride ?? sort;

      if (newFilters.search) params.set('search', newFilters.search);
      if (newFilters.location && !newFilters.remote)
        params.set('location', newFilters.location);
      if (newFilters.jobType !== defaultFilters.jobType)
        params.set('jobType', newFilters.jobType);
      if (newFilters.postedWithin !== defaultFilters.postedWithin)
        params.set('postedWithin', newFilters.postedWithin);
      if (newFilters.minSalary) params.set('minSalary', newFilters.minSalary);
      if (newFilters.maxSalary) params.set('maxSalary', newFilters.maxSalary);
      if (newFilters.remote) params.set('remote', 'true');
      if (newFilters.savedOnly) params.set('savedOnly', 'true');
      if (newFilters.view === 'dismissed') params.set('dismissedOnly', 'true');
      if (newFilters.excludeApplied) params.set('excludeApplied', 'true');
      if (newFilters.excludeDismissed !== true)
        params.set('excludeDismissed', 'false');
      if (newFilters.excludeLeads) params.set('excludeLeads', 'true');

      if (sortToUse !== 'recent') {
        params.set('sort', sortToUse);
      }

      if (newPagination.currentPage > 1)
        params.set('page', newPagination.currentPage.toString());
      if (newPagination.pageSize !== DEFAULT_PAGE_SIZE)
        params.set('pageSize', newPagination.pageSize.toString());

      const queryString = params.toString().replace(/\+/g, '%20');

      // Avoid App Router navigation (which can remount expensive client trees).
      // We only want the URL to reflect current client state.
      const nextUrl = `/jobs${queryString ? `?${queryString}` : ''}`;
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', nextUrl);
      }
    },
    [sort],
  );

  useEffect(() => {
    if (hasNormalizedInitialUrlRef.current) return;
    hasNormalizedInitialUrlRef.current = true;
    updateURL(filtersRef.current, pagination);
  }, [pagination, updateURL]);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const defaultFilters = getDefaultFilters();
      const rawNextFilters: JobSearchFormData = {
        ...defaultFilters,
        excludeApplied: params.get('excludeApplied') === 'true',
        excludeDismissed: params.get('excludeDismissed') !== 'false',
        excludeLeads: params.get('excludeLeads') === 'true',
        jobType: params.get('jobType') || defaultFilters.jobType,
        location:
          params.get('location') || initialLocation || defaultFilters.location,
        maxSalary: params.get('maxSalary') || defaultFilters.maxSalary,
        minSalary: params.get('minSalary') || defaultFilters.minSalary,
        postedWithin: params.get('postedWithin') || defaultFilters.postedWithin,
        remote: params.get('remote') === 'true',
        savedOnly: params.get('savedOnly') === 'true',
        search: params.get('search') || defaultFilters.search,
      };

      const rawSort = params.get('sort');
      const nextSort = isJobSearchSort(rawSort) ? rawSort : 'recent';

      const nextFilters = normalizeFilters(rawNextFilters, {
        location: rawNextFilters.location,
        remote: rawNextFilters.remote,
      });

      const page = params.get('page');
      const pageSize = params.get('pageSize');
      const nextPagination = {
        currentPage: page ? parseInt(page) : 1,
        pageSize: pageSize ? parseInt(pageSize) : DEFAULT_PAGE_SIZE,
      };

      setSort(nextSort);
      updateURL(nextFilters, nextPagination, nextSort);

      const filtersChanged =
        JSON.stringify(nextFilters) !== JSON.stringify(filtersRef.current);
      const paginationChanged =
        nextPagination.currentPage !== paginationRef.current.currentPage ||
        nextPagination.pageSize !== paginationRef.current.pageSize;

      filtersRef.current = nextFilters;
      setFilters(nextFilters);
      setPagination(nextPagination);

      if (filtersChanged || paginationChanged) {
        setSelected({});
        fetchJobs(nextFilters, nextPagination, { sort: nextSort });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [fetchJobs, initialLocation, updateURL]);

  const handleFiltersChange = useCallback(
    (newFilters: Partial<JobSearchFormData>) => {
      const updatedFilters = normalizeFilters(
        { ...filtersRef.current, ...newFilters },
        newFilters,
      );
      const newPagination = { ...pagination, currentPage: 1 };

      filtersRef.current = updatedFilters;
      setFilters(updatedFilters);
      setPagination(newPagination);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Debounce filter changes and update URL
      debounceTimerRef.current = setTimeout(() => {
        updateURL(updatedFilters, newPagination);
        fetchJobs(updatedFilters, newPagination);
      }, 500);
    },
    [filters, pagination, updateURL, fetchJobs],
  );

  // Listen for events from PageHeader actions
  useEffect(() => {
    const handlePlayerOpen = () => setPlayerOpen(true);
    const handleViewChange = (e: Event) => {
      const view = (e as CustomEvent).detail as string;
      if (view === 'saved') {
        handleFiltersChange({
          view: 'saved',
          savedOnly: true,
          excludeDismissed: true,
        });
      } else if (view === 'dismissed') {
        handleFiltersChange({
          view: 'dismissed',
          savedOnly: false,
          excludeDismissed: false,
        });
      } else {
        handleFiltersChange({
          view: 'all',
          savedOnly: false,
          excludeDismissed: true,
        });
      }
    };
    window.addEventListener('job-player:open', handlePlayerOpen);
    window.addEventListener('job-view:change', handleViewChange);
    return () => {
      window.removeEventListener('job-player:open', handlePlayerOpen);
      window.removeEventListener('job-view:change', handleViewChange);
    };
  }, [handleFiltersChange]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleJobListingUpdated = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          id: string;
          status: JobListingStatus;
        }>
      ).detail;
      if (!detail) return;

      setResult(prev => {
        if (!prev) return prev;
        let nextData = prev.data.map(job =>
          job.id === detail.id ? { ...job, status: detail.status } : job,
        );
        // When excludeLeads is active, remove items that were just added to leads
        if (
          filtersRef.current.excludeLeads &&
          detail.status === JobListingStatus.ADDED_TO_LEADS
        ) {
          nextData = nextData.filter(job => job.id !== detail.id);
        }
        return { ...prev, data: nextData };
      });

      setSelected(prev => {
        if (!prev[detail.id]) return prev;
        return {
          ...prev,
          [detail.id]: {
            ...prev[detail.id],
            status: detail.status,
          },
        };
      });
    };

    window.addEventListener('job-listing-updated', handleJobListingUpdated);
    return () =>
      window.removeEventListener(
        'job-listing-updated',
        handleJobListingUpdated,
      );
  }, []);

  const handleResetSearch = () => {
    const defaultFilters = getDefaultFilters();
    const defaultPagination = getDefaultPagination();

    const locationToUse =
      filters.location || initialLocation || detectedLocation || '';
    const nextFilters = locationToUse
      ? { ...defaultFilters, location: locationToUse }
      : defaultFilters;

    setFilters(nextFilters);
    setPagination(defaultPagination);
    setSelected({});
    setSort('recent');
    updateURL(nextFilters, defaultPagination, 'recent');

    fetchJobs(nextFilters, defaultPagination, {
      noCache: true,
      sort: 'recent',
    });
  };

  const handleSubmitSearch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const currentFilters = filtersRef.current;

    const nextPagination = { ...pagination, currentPage: 1 };
    setPagination(nextPagination);
    updateURL(currentFilters, nextPagination);

    (async () => {
      setSearching(true);
      try {
        await fetchJobs(currentFilters, nextPagination, { noCache: true });
      } finally {
        setSearching(false);
      }
    })();
  }, [pagination, fetchJobs, updateURL]);

  const handleSortChange = (nextSort: JobSearchSort) => {
    setSort(nextSort);

    const nextPagination = { ...pagination, currentPage: 1 };
    setPagination(nextPagination);
    setSelected({});
    updateURL(filtersRef.current, nextPagination, nextSort);
    fetchJobs(filtersRef.current, nextPagination, {
      noCache: true,
      sort: nextSort,
    });
  };

  const handleSelectionChange = (job: JobListing) => {
    setSelected(prev => {
      if (prev[job.id]) {
        const { [job.id]: _, ...rest } = prev;
        return rest;
      } else {
        return { ...prev, [job.id]: job };
      }
    });
  };

  const handleSelectAll = () => {
    if (!result?.data) return;

    const allSelected = result.data.every(j => selected[j.id]);

    if (allSelected) {
      setSelected({});
    } else {
      const newSelected = result.data.reduce(
        (acc, job) => {
          acc[job.id] = job;
          return acc;
        },
        {} as Record<string, JobListing>,
      );
      setSelected(newSelected);
    }
  };

  const handleClearSelection = () => {
    setSelected({});
  };

  const handlePageChange = (page: number) => {
    const newPagination = { ...pagination, currentPage: page };
    setPagination(newPagination);
    updateURL(filters, newPagination);

    const knownTotal = result?.pageInfo.total;
    const knownPageCount = result?.pageInfo.pageCount;
    fetchJobs(
      filters,
      newPagination,
      typeof knownTotal === 'number' && typeof knownPageCount === 'number'
        ? { includeCount: false, knownTotal, knownPageCount }
        : undefined,
    );
  };

  const handlePageSizeChange = (pageSize: number) => {
    const newPagination = { currentPage: 1, pageSize };
    setPagination(newPagination);
    updateURL(filters, newPagination);

    const knownTotal = result?.pageInfo.total;
    fetchJobs(
      filters,
      newPagination,
      typeof knownTotal === 'number'
        ? {
            includeCount: false,
            knownTotal,
            knownPageCount: Math.ceil(knownTotal / pageSize),
          }
        : undefined,
    );
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
  };

  const selectedCount = Object.keys(selected).length;
  const isSelectedAll = result?.data
    ? result.data.every(j => selected[j.id])
    : false;

  return (
    <div className="flex flex-col h-full min-h-full w-full overflow-hidden rounded-2xl border-y border-border/30 bg-white dark:bg-[#15151a]">
      {/* Search Bar */}
      <div className="px-2.5 pt-2.5 pb-0 shrink-0">
        <JobSearchBar
          location={filters.location}
          onLocationChange={location => handleFiltersChange({ location })}
          onRemoteChange={remote => handleFiltersChange({ remote })}
          onSubmit={handleSubmitSearch}
          remote={filters.remote}
          search={filters.search}
          onSearchChange={search => handleFiltersChange({ search })}
          resultCount={result?.pageInfo?.total ?? null}
          sort={sort}
          onSortChange={handleSortChange}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
        />
      </div>

      {/* Mobile Filter Button */}
      <div className="md:hidden px-2.5 pt-2">
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              <SlidersHorizontal className="size-4" />
              Filters
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[320px] p-0 overflow-y-auto">
            <SheetHeader className="px-4 pt-4 pb-2">
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <JobSearchFilters
              onFilterChange={handleFiltersChange}
              onReset={handleResetSearch}
              result={
                result?.pageInfo
                  ? {
                      count: result.pageInfo.count,
                      total: result.pageInfo.total,
                    }
                  : null
              }
              values={filters}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content with Sidebar and Results */}
      <div className="flex-1 w-full px-2.5 pt-2.5 overflow-hidden">
        <div className="flex gap-0 h-full rounded-t-lg border-x-0 border-b-0 border-t border-t-border/30 dark:border-t-white/10 overflow-clip isolate bg-white dark:bg-zinc-900 shadow-lg shadow-black/10 dark:shadow-black/25">
          {/* Sidebar - Hidden on mobile, fixed width on desktop */}
          <div className="hidden w-80 flex-col overflow-y-auto overflow-x-hidden bg-muted/20 dark:bg-[#0f0f12] md:flex">
            <JobSearchFilters
              onFilterChange={handleFiltersChange}
              onReset={handleResetSearch}
              result={
                result?.pageInfo
                  ? {
                      count: result.pageInfo.count,
                      total: result.pageInfo.total,
                    }
                  : null
              }
              values={filters}
            />
          </div>

          {/* Results - Takes remaining space */}
          <div className="flex-1 h-full bg-white dark:bg-zinc-900">
            <JobSearchResults
              currentPage={pagination.currentPage}
              isSelectedAll={isSelectedAll}
              loading={loading || searching}
              onChangeCurrentPage={handlePageChange}
              onChangePageSize={handlePageSizeChange}
              onClearSelection={handleClearSelection}
              onJobClick={job => {
                const encodedId = encodeURIComponent(job.id);
                sessionStorage.setItem(`job-${encodedId}`, JSON.stringify(job));
                router.push(`/jobs/${encodedId}`);
              }}
              onSelect={handleSelectionChange}
              onSelectAll={handleSelectAll}
              onSortChange={handleSortChange}
              onViewModeChange={handleViewModeChange}
              pageSize={pagination.pageSize}
              result={result}
              selected={selected}
              selectedCount={selectedCount}
              sort={sort}
              viewMode={viewMode}
            />
          </div>
        </div>
      </div>

      <JobPlayer
        jobs={result?.data ?? []}
        open={playerOpen}
        onClose={() => setPlayerOpen(false)}
      />
    </div>
  );
}
