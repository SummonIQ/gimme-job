'use client';

import { useAnalytics } from '@summoniq/signalsplash-client-sdk/react';
import { Bookmark, Check, Loader2, MapPin } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { RotatingText } from '@/components/ui/rotating-text';

import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxGroup,
  ComboboxItem,
} from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ViewMode } from '@/components/ui/view-mode-toggle';
import { ViewModeToggle } from '@/components/ui/view-mode-toggle';
import { useToast } from '@/hooks/use-toast';
import { redirectIfUnauthorized } from '@/lib/auth/redirect-if-unauthorized';
import { cn } from '@/lib/css';
import { createJobSearch } from '@/lib/job-searches/create';

// Job titles for animated placeholder - diverse range of common jobs
const JOB_TITLES = [
  'Software Engineer',
  'Cashier',
  'Nurse',
  'Teacher',
  'Budtender',
  'Barista',
  'Warehouse Worker',
  'Retail Associate',
  'Restaurant Server',
  'Delivery Driver',
  'Electrician',
  'Plumber',
  'Data Scientist',
  'Customer Service Rep',
  'Administrative Assistant',
  'Construction Worker',
  'Dental Hygienist',
  'Hair Stylist',
  'Security Guard',
  'Truck Driver',
];

// Common locations for autocomplete
const COMMON_LOCATIONS = [
  { value: 'remote', label: 'Remote' },
  { value: 'san-francisco-ca', label: 'San Francisco, CA' },
  { value: 'new-york-ny', label: 'New York, NY' },
  { value: 'los-angeles-ca', label: 'Los Angeles, CA' },
  { value: 'chicago-il', label: 'Chicago, IL' },
  { value: 'boston-ma', label: 'Boston, MA' },
  { value: 'seattle-wa', label: 'Seattle, WA' },
  { value: 'austin-tx', label: 'Austin, TX' },
  { value: 'denver-co', label: 'Denver, CO' },
  { value: 'portland-or', label: 'Portland, OR' },
  { value: 'miami-fl', label: 'Miami, FL' },
  { value: 'atlanta-ga', label: 'Atlanta, GA' },
  { value: 'dallas-tx', label: 'Dallas, TX' },
  { value: 'philadelphia-pa', label: 'Philadelphia, PA' },
  { value: 'phoenix-az', label: 'Phoenix, AZ' },
  { value: 'san-diego-ca', label: 'San Diego, CA' },
  { value: 'washington-dc', label: 'Washington, DC' },
];

const RECENT_LOCATIONS_KEY = 'job-search:recent-locations';
const JOB_SEARCH_CONTROL_SURFACE_CLASS =
  'bg-white hover:bg-white dark:bg-zinc-950 dark:hover:bg-zinc-950 border border-gray-200 dark:border-x-0 dark:border-b-border/40 dark:border-t-zinc-800 shadow-xs';
const JOB_SEARCH_SAVED_ITEM_SURFACE_CLASS =
  'bg-background/60 hover:bg-background dark:bg-[#101015] dark:hover:bg-[#15151b] border border-border/40 dark:border-white/[0.06] dark:hover:border-white/10 shadow-xs';

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

interface SavedSearch {
  id: string;
  remote?: boolean;
  searchTerm: string;
  location?: string | null;
  metadata?: {
    filters?: Record<string, unknown>;
  } | null;
}

type JobSearchBarSort = 'recent' | 'oldest' | 'added' | 'company' | 'title';

interface JobSearchBarProps {
  location: string;
  onLocationChange: (location: string) => void;
  onRemoteChange?: (remote: boolean) => void;
  onSubmit?: () => void;
  remote?: boolean;
  search: string;
  onSearchChange: (search: string) => void;
  resultCount?: number | null;
  sort?: JobSearchBarSort;
  onSortChange?: (sort: JobSearchBarSort) => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
}

export function JobSearchBar({
  location,
  onLocationChange,
  onRemoteChange,
  onSubmit,
  remote = false,
  search,
  onSearchChange,
  resultCount,
  sort,
  onSortChange,
  viewMode,
  onViewModeChange,
}: JobSearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);

  // Location combobox state
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationInputValue, setLocationInputValue] = useState('');
  const [locationResults, setLocationResults] = useState<
    Array<{ label: string; value: string }>
  >([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);

  // Saved searches state
  const [savedSearches, setSavedSearches] = useState<Array<SavedSearch>>([]);
  const [isLoadingSearches, setIsLoadingSearches] = useState(false);
  const [isSavingSearch, setIsSavingSearch] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const { track } = useAnalytics();
  const { toast } = useToast();

  const matchesCurrentSearch = useCallback(
    (savedSearch: SavedSearch): boolean => {
      const normalizedSavedRemote = savedSearch.remote ?? false;
      const metaFilters = (savedSearch.metadata?.filters ?? {}) as Record<
        string,
        unknown
      >;

      const normalize = (v: unknown) => {
        const s = String(v ?? '').trim();
        try {
          return decodeURIComponent(s).toLowerCase();
        } catch {
          return s.toLowerCase();
        }
      };

      const savedLocation = normalize(
        savedSearch.location ?? metaFilters.location ?? '',
      );
      const savedSearchTerm = normalize(
        metaFilters.search ?? savedSearch.searchTerm ?? '',
      );

      const currentSearch = normalize(search);
      const currentLocation = normalize(location ?? '');

      // Treat location "remote" as equivalent to remote: true with empty location
      const savedIsRemote =
        normalizedSavedRemote ||
        Boolean(metaFilters.remote) ||
        savedLocation === 'remote';
      const savedLocationNormalized =
        savedLocation === 'remote' ? '' : savedLocation;

      const matches =
        savedSearchTerm === currentSearch &&
        savedLocationNormalized === currentLocation &&
        savedIsRemote === remote;

      console.log('[SavedSearch Match]', {
        savedSearchTerm,
        currentSearch,
        savedLocation,
        currentLocation,
        savedRemote: normalizedSavedRemote,
        currentRemote: remote,
        matches,
      });

      return matches;
    },
    [location, remote, search],
  );

  // Debounced location search with request cancellation
  useEffect(() => {
    if (!locationInputValue || locationInputValue.length < 2) {
      setLocationResults([]);
      setIsLoadingLocations(false);
      return;
    }

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setIsLoadingLocations(true);
      try {
        const response = await fetch(
          `/api/locations/search?q=${encodeURIComponent(locationInputValue)}`,
          { signal: controller.signal },
        );

        if (!response.ok) throw new Error('Search failed');

        const data = await response.json();
        console.log('[Location Search] API response:', data);
        setLocationResults(data.results || []);
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Failed to search locations:', error);
          setLocationResults([]);
        }
      } finally {
        setIsLoadingLocations(false);
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [locationInputValue]);

  const loadSavedSearches = useCallback(async () => {
    setIsLoadingSearches(true);
    try {
      const response = await fetch('/api/job-searches');
      if (response.ok) {
        const data = await response.json();
        setSavedSearches(data.slice(0, 10) || []);
      }
    } catch (error) {
      console.error('Failed to load searches:', error);
    } finally {
      setIsLoadingSearches(false);
    }
  }, []);

  // Load saved searches on mount
  useEffect(() => {
    loadSavedSearches();
  }, [loadSavedSearches]);

  // Check if current search is already saved
  const isCurrentSearchSaved = savedSearches.some(savedSearch =>
    matchesCurrentSearch(savedSearch),
  );

  const handleSaveSearch = async () => {
    if (!search || search.trim() === '') {
      toast({
        title: 'Search term required',
        description: 'Please enter a search term before saving.',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingSearch(true);
    try {
      const response = await fetch('/api/job-searches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          searchTerm: search,
          location: location || null,
          remote,
          filters: {
            location: location || '',
            remote,
            search,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save search');
      }

      toast({
        title: 'Search saved',
        description: 'Your search has been saved successfully.',
      });

      await loadSavedSearches();

      window.dispatchEvent(new Event('saved-searches:changed'));
    } catch (error) {
      console.error('Failed to save search:', error);
      toast({
        title: 'Failed to save search',
        description:
          error instanceof Error
            ? error.message
            : 'An error occurred while saving your search.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingSearch(false);
    }
  };

  const handleUnsaveSearch = async () => {
    const savedSearch = savedSearches.find(s => matchesCurrentSearch(s));

    if (!savedSearch) return;

    setIsSavingSearch(true);
    try {
      const response = await fetch(`/api/job-searches/${savedSearch.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to unsave search');
      }

      toast({
        title: 'Search unsaved',
        description: 'Your search has been removed from saved searches.',
      });

      await loadSavedSearches();

      window.dispatchEvent(new Event('saved-searches:changed'));
    } catch (error) {
      console.error('Failed to unsave search:', error);
      toast({
        title: 'Failed to unsave search',
        description:
          error instanceof Error
            ? error.message
            : 'An error occurred while removing your search.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingSearch(false);
    }
  };

  const handleSearchClick = async () => {
    if (onSubmit) {
      onSubmit();
      return;
    }

    // Allow search if there's a search term OR a location
    if (
      (!search || search.trim() === '') &&
      (!location || location.trim() === '')
    ) {
      toast({
        title: 'Search criteria required',
        description:
          'Please enter a job title, keywords, or select a location.',
        variant: 'destructive',
      });
      return;
    }

    setIsSearching(true);
    try {
      // Use empty string for search term if only location is provided
      const searchTerm = search?.trim() || '';
      const result = await createJobSearch({
        searchTerm: searchTerm,
        location: location || undefined,
        remote: remote,
        jobProvider: 'SERPAPI' as any,
        provider: 'SERPAPI',
        saveSearch: false,
      });

      if (result.success) {
        track('job_search_started', {
          location: location || '',
          remote,
          search_term: searchTerm,
          surface: 'job_search_bar',
        });
        toast({
          title: 'Job search started',
          description:
            'Finding jobs matching your criteria. This may take a few minutes.',
        });

        if (result.jobSearchId) {
          window.location.href = `/jobs/searches/${result.jobSearchId}`;
        }
      } else {
        const redirected: boolean = await redirectIfUnauthorized(result.error);
        if (redirected) return;
        throw new Error(result.error || 'Failed to start job search');
      }
    } catch (error) {
      const redirected: boolean = await redirectIfUnauthorized(error);
      if (redirected) return;
      console.error('Failed to start job search:', error);
      toast({
        title: 'Failed to start search',
        description:
          error instanceof Error
            ? error.message
            : 'An error occurred while starting the search.',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="grid min-h-11 flex-1 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
      <div className="flex items-center gap-3">
        <Button
          aria-label={isCurrentSearchSaved ? 'Unsave search' : 'Save search'}
          title={isCurrentSearchSaved ? 'Unsave search' : 'Save search'}
          className={cn(
            'h-11 gap-2 px-4 text-sm text-muted-foreground hover:text-foreground rounded-2xl',
            JOB_SEARCH_SAVED_ITEM_SURFACE_CLASS,
            'disabled:opacity-100 disabled:text-muted-foreground/55',
            isCurrentSearchSaved &&
              'text-amber-600 hover:text-amber-600 dark:text-amber-500 dark:hover:text-amber-400',
          )}
          onClick={() =>
            isCurrentSearchSaved ? handleUnsaveSearch() : handleSaveSearch()
          }
          type="button"
          variant="ghost"
          disabled={isSavingSearch || !search}
          size="lg"
        >
          {isSavingSearch ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {isCurrentSearchSaved ? 'Unsaving...' : 'Saving...'}
            </>
          ) : isCurrentSearchSaved ? (
            <>
              <Bookmark className="h-4 w-4 fill-amber-500 text-amber-500" />
              Saved
            </>
          ) : (
            <>
              <Bookmark className="size-3.5 stroke-[2.5] text-muted-foreground/90" />
              Save
            </>
          )}
        </Button>
        <span
          aria-hidden="true"
          className="h-6 w-px bg-border/45 dark:bg-white/10"
        />
      </div>

      <div className="flex min-w-0 items-center gap-x-2.5">
        <div className="relative min-w-0 flex-1">
          <Input
            type="search"
            size="lg"
            className={cn(
              'text-base rounded-2xl',
              JOB_SEARCH_CONTROL_SURFACE_CLASS,
              search && 'dark:text-foreground/90',
            )}
            onChange={e => onSearchChange(e.target.value)}
            onBlur={() => setIsFocused(false)}
            onFocus={() => setIsFocused(true)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearchClick();
              }
            }}
            placeholder={
              search || isFocused
                ? 'Search jobs by title, keywords, company...'
                : ''
            }
            value={search}
          />

          {!search && !isFocused && (
            <RotatingText
              items={JOB_TITLES}
              size="default"
              className="absolute left-9 top-1/2 -translate-y-1/2 w-44 text-muted-foreground/55"
            />
          )}

          {typeof resultCount === 'number' && (
            <div
              className={cn(
                'absolute inset-y-0 flex items-center pointer-events-none',
                search ? 'right-10' : 'right-2.5',
              )}
            >
              <span className="inline-flex h-5 items-center gap-1.5 rounded-full border border-border/60 bg-transparent px-2.5 text-[13px] font-medium leading-none text-muted-foreground dark:border-white/10">
                <span className="tabular-nums text-foreground/85">
                  {resultCount.toLocaleString()}
                </span>
                results
              </span>
            </div>
          )}
        </div>

        <Combobox
          open={locationOpen}
          onOpenChange={setLocationOpen}
          size="lg"
          placeholder="Select location..."
          searchPlaceholder="Search or type location..."
          icon={<MapPin className="size-full" />}
          hasValue={!!(location || remote)}
          displayValue={
            remote
              ? 'Remote'
              : location
                ? COMMON_LOCATIONS.find(
                    loc => loc.label.toLowerCase() === location.toLowerCase(),
                  )?.label || location
                : undefined
          }
          search={locationInputValue}
          onSearchChange={setLocationInputValue}
          onCustomSubmit={value => {
            onRemoteChange?.(false);
            onLocationChange(value);
          }}
          loading={isLoadingLocations}
          emptyMessage="No location found."
          contentWidth="w-64"
          contentAlign="start"
          className="w-40 shrink-0 sm:w-52"
          triggerClassName={cn(
            'text-base rounded-2xl',
            JOB_SEARCH_CONTROL_SURFACE_CLASS,
            '[&>span:last-child]:pr-1.5',
          )}
        >
          {/* Recent locations shown first */}
          {(!locationInputValue || locationInputValue.length < 2) &&
            (() => {
              const recentLocs = getRecentLocations();
              if (recentLocs.length === 0) return null;
              return (
                <ComboboxGroup heading="Recent">
                  {recentLocs.map(loc => (
                    <ComboboxItem
                      key={`recent-${loc}`}
                      value={loc}
                      onSelect={() => {
                        const selected =
                          loc.toLowerCase() === location.toLowerCase()
                            ? ''
                            : loc;
                        console.log(
                          '[Location Select] Recent location selected:',
                          { raw: loc, resolved: selected },
                        );
                        onRemoteChange?.(false);
                        onLocationChange(selected);
                        setLocationOpen(false);
                        setLocationInputValue('');
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          location.toLowerCase() === loc.toLowerCase()
                            ? 'opacity-100'
                            : 'opacity-0',
                        )}
                      />
                      {loc}
                    </ComboboxItem>
                  ))}
                </ComboboxGroup>
              );
            })()}

          {(!locationInputValue || locationInputValue.length < 2) && (
            <ComboboxGroup heading="Quick Options">
              {COMMON_LOCATIONS.map(loc => (
                <ComboboxItem
                  key={loc.value}
                  value={loc.label}
                  onSelect={() => {
                    console.log('[Location Select] Quick option selected:', {
                      value: loc.value,
                      label: loc.label,
                    });
                    if (loc.value === 'remote') {
                      onRemoteChange?.(!remote);
                      onLocationChange('');
                    } else {
                      onRemoteChange?.(false);
                      onLocationChange(
                        loc.label.toLowerCase() === location.toLowerCase()
                          ? ''
                          : loc.label,
                      );
                    }
                    setLocationOpen(false);
                    setLocationInputValue('');
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      (
                        loc.value === 'remote'
                          ? remote
                          : location.toLowerCase() === loc.label.toLowerCase()
                      )
                        ? 'opacity-100'
                        : 'opacity-0',
                    )}
                  />
                  {loc.label}
                </ComboboxItem>
              ))}
            </ComboboxGroup>
          )}

          {locationResults.length > 0 && (
            <ComboboxGroup heading="Search Results">
              {locationResults.map((loc, index) => (
                <ComboboxItem
                  key={`${loc.value}-${index}`}
                  value={loc.label}
                  onSelect={currentValue => {
                    console.log('[Location Select] Search result selected:', {
                      currentValue,
                      raw: loc,
                    });
                    onRemoteChange?.(false);
                    onLocationChange(currentValue);
                    setLocationOpen(false);
                    setLocationInputValue('');
                  }}
                >
                  <MapPin className="mr-2 h-4 w-4 opacity-50" />
                  <span className="truncate">{loc.label}</span>
                </ComboboxItem>
              ))}
            </ComboboxGroup>
          )}
        </Combobox>
      </div>

      {(sort || viewMode) && (
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="mr-1 h-6 w-px bg-border/45 dark:bg-white/10"
          />
          {sort && onSortChange && (
            <Select
              value={sort}
              onValueChange={v => onSortChange(v as JobSearchBarSort)}
            >
              <SelectTrigger
                className={cn(
                  'h-11 w-auto px-5 text-sm gap-2 rounded-2xl text-muted-foreground hover:text-foreground',
                  JOB_SEARCH_SAVED_ITEM_SURFACE_CLASS,
                )}
              >
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="recent">Most recent</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="added">Recently added</SelectItem>
                <SelectItem value="company">Company (A–Z)</SelectItem>
                <SelectItem value="title">Title (A–Z)</SelectItem>
              </SelectContent>
            </Select>
          )}
          {viewMode && onViewModeChange && (
            <ViewModeToggle
              availableViews={['card', 'table']}
              className={cn('h-11', JOB_SEARCH_SAVED_ITEM_SURFACE_CLASS)}
              defaultView="card"
              onChange={onViewModeChange}
              value={viewMode}
            />
          )}
        </div>
      )}
    </div>
  );
}
