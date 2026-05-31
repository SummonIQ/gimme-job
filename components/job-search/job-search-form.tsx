'use client';

import NumberFlow from '@number-flow/react';
import { useAnalytics } from '@summoniq/signalsplash-client-sdk/react';
import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Loader2,
  MapPin,
  Search,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { redirectIfUnauthorized } from '@/lib/auth/redirect-if-unauthorized';
import { createJobSearch } from '@/lib/job-searches/create';
import { cn } from '@/lib/utils';
import {
  SEARCH_HEADER_INPUT_CLASS,
  SEARCH_HEADER_LOCATION_CLASS,
  SearchHeaderButton,
} from './search-header-controls';

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
  searchTerm: string;
  location?: string | null;
  metadata?: {
    filters?: Record<string, unknown>;
  } | null;
}

const buildSavedSearchUrl = (search: SavedSearch): string => {
  const params = new URLSearchParams();
  const filters = search.metadata?.filters;

  if (!filters || typeof filters !== 'object') {
    if (search.searchTerm) params.set('search', search.searchTerm);
    if (search.location) params.set('location', search.location);
    const qs = params.toString();
    return qs ? `/jobs?${qs}` : '/jobs';
  }

  const f = filters as Record<string, unknown>;
  if (f.search || search.searchTerm)
    params.set('search', String(f.search || search.searchTerm));
  if (f.location && !f.remote) params.set('location', String(f.location));
  if (f.jobType && f.jobType !== 'any')
    params.set('jobType', String(f.jobType));
  if (f.postedWithin && f.postedWithin !== 'any')
    params.set('postedWithin', String(f.postedWithin));
  if (f.minSalary) params.set('minSalary', String(f.minSalary));
  if (f.maxSalary) params.set('maxSalary', String(f.maxSalary));
  if (f.remote) params.set('remote', 'true');
  if (f.savedOnly) params.set('savedOnly', 'true');
  if (f.excludeApplied) params.set('excludeApplied', 'true');
  if (f.excludeDismissed === false) params.set('excludeDismissed', 'false');
  if (f.excludeLeads) params.set('excludeLeads', 'true');

  const qs = params.toString();
  return qs ? `/jobs?${qs}` : '/jobs';
};

export interface JobSearchFormData {
  excludeApplied: boolean;
  excludeDismissed: boolean;
  excludeLeads: boolean;
  jobType: string;
  location: string;
  maxSalary: string;
  minSalary: string;
  postedWithin: string;
  remote: boolean;
  savedOnly: boolean;
  search: string;
}

interface JobSearchFormProps {
  hideOtherFilters?: boolean;
  hideSearchBar?: boolean;
  onChange: (filters: Partial<JobSearchFormData>) => void;
  onReset: () => void;
  onSearch: (filters: Partial<JobSearchFormData>) => void;
  result: {
    count: number;
    total: number;
  } | null;
  value: JobSearchFormData;
}

interface CollapsibleSectionProps {
  actionButton?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
  storageKey?: string;
  title: string;
}

const CollapsibleSection = ({
  actionButton,
  className,
  children,
  defaultOpen = true,
  storageKey,
  title,
}: CollapsibleSectionProps) => {
  const key =
    storageKey || `job-search:${title.toLowerCase().replace(/\s+/g, '-')}`;
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        setIsOpen(raw === 'true');
      }
    } catch {}
  }, [key]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, String(isOpen));
    } catch {}
  }, [isOpen, key]);

  return (
    <div className="relative border-b border-border last:border-b-0 dark:border-white/[0.07]">
      <div
        className={cn(
          'flex w-full items-center justify-between bg-background/90 px-4 py-3 dark:bg-[#151519]',
          className,
        )}
      >
        <button
          className="flex flex-1 items-center text-left text-base font-medium text-foreground transition-colors hover:text-muted-foreground"
          onClick={() => setIsOpen(!isOpen)}
          type="button"
        >
          <span>{title}</span>
        </button>
        <div className="flex items-center gap-2">
          {actionButton && (
            <div onClick={e => e.stopPropagation()}>{actionButton}</div>
          )}
          <button
            className="p-1 flex items-center"
            onClick={() => setIsOpen(!isOpen)}
            type="button"
          >
            <ChevronDown
              className={cn(
                'w-4 h-4 transition-transform duration-300',
                isOpen && 'rotate-180',
              )}
            />
          </button>
        </div>
      </div>
      <div
        className={cn(
          'grid transition-[grid-template-rows] ease-[cubic-bezier(0.4,0,0.2,1)]',
          isOpen
            ? 'grid-rows-[1fr] duration-500'
            : 'grid-rows-[0fr] duration-300',
        )}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              'space-y-4 bg-background/90 px-4 pb-4 pt-2 transition dark:bg-[#151519]',
              isOpen
                ? 'opacity-100 translate-y-0 duration-500 delay-75'
                : 'opacity-0 -translate-y-2 duration-200 delay-0',
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

const FormField = ({
  children,
  className = '',
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
}) => (
  <div className={cn('space-y-1.5', className)}>
    <Label className="text-sm font-medium">{label}</Label>
    {children}
  </div>
);

const CheckboxField = ({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) => (
  <Checkbox
    checked={checked}
    className="text-sm"
    label={label}
    onCheckedChange={onChange}
  />
);

export function JobSearchForm({
  hideOtherFilters = false,
  hideSearchBar = false,
  onChange,
  onReset,
  onSearch,
  result,
  value,
}: JobSearchFormProps) {
  const [displayCounts, setDisplayCounts] = useState({
    count: 0,
    total: 0,
  });

  // Local state for text inputs that should only search on Enter/Search button
  const [localSearch, setLocalSearch] = useState(value.search);
  const [localLocation, setLocalLocation] = useState(value.location);
  const [localMinSalary, setLocalMinSalary] = useState(value.minSalary);
  const [localMaxSalary, setLocalMaxSalary] = useState(value.maxSalary);

  // Animated placeholder state for vertical cycling
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
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

  // Vertical cycling animation effect
  useEffect(() => {
    if (!localSearch && !isFocused) {
      // Cycle through job titles every 3 seconds
      const interval = setInterval(() => {
        setPlaceholderIndex(prev => (prev + 1) % JOB_TITLES.length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [localSearch, isFocused]);

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
        setLocationResults(data.results || []);
      } catch (error: any) {
        // Don't show error if request was cancelled
        if (error.name !== 'AbortError') {
          console.error('Failed to search locations:', error);
          setLocationResults([]);
        }
      } finally {
        setIsLoadingLocations(false);
      }
    }, 400); // Slightly longer debounce for better perceived performance

    return () => {
      clearTimeout(timer);
      controller.abort(); // Cancel ongoing request when input changes
    };
  }, [locationInputValue]);

  // Sync local state when external value changes (e.g., reset)
  useEffect(() => {
    setLocalSearch(value.search);
    setLocalLocation(value.location);
    setLocalMinSalary(value.minSalary);
    setLocalMaxSalary(value.maxSalary);
  }, [value.search, value.location, value.minSalary, value.maxSalary]);

  useEffect(() => {
    if (result) {
      setDisplayCounts({
        count: result.count,
        total: result.total,
      });
    }
  }, [result]);

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
  const isCurrentSearchSaved = savedSearches.some(
    search =>
      search.searchTerm.toLowerCase().trim() ===
        localSearch.toLowerCase().trim() &&
      (search.location?.toLowerCase().trim() || '') ===
        (localLocation?.toLowerCase().trim() || ''),
  );

  const handleSaveSearch = async () => {
    if (!localSearch || localSearch.trim() === '') {
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
          searchTerm: localSearch,
          location: localLocation || null,
          filters: {
            search: localSearch,
            location: localLocation || '',
            remote: value.remote,
            jobType: value.jobType,
            postedWithin: value.postedWithin,
            minSalary: localMinSalary || value.minSalary,
            maxSalary: localMaxSalary || value.maxSalary,
            savedOnly: value.savedOnly,
            excludeApplied: value.excludeApplied,
            excludeDismissed: value.excludeDismissed,
            excludeLeads: value.excludeLeads,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save search');
      }

      const savedSearch = await response.json();

      toast({
        title: 'Search saved',
        description: 'Your search has been saved successfully.',
      });

      // Refresh the saved searches list
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
    const savedSearch = savedSearches.find(
      search =>
        search.searchTerm.toLowerCase().trim() ===
          localSearch.toLowerCase().trim() &&
        (search.location?.toLowerCase().trim() || '') ===
          (localLocation?.toLowerCase().trim() || ''),
    );

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

      // Refresh the saved searches list
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

  const handleSearch = async () => {
    const trimmedSearch = localSearch.trim();
    const trimmedLocation = localLocation.trim();
    if (!trimmedSearch && !trimmedLocation && !value.remote) {
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
      // Trigger job scraping via createJobSearch
      const result = await createJobSearch({
        searchTerm: trimmedSearch || 'jobs',
        location: trimmedLocation || undefined,
        remote: value.remote,
        jobProvider: 'SERPAPI' as any,
        provider: 'SERPAPI',
        saveSearch: false,
      });

      if (result.success) {
        track('job_search_started', {
          location: trimmedLocation || '',
          remote: value.remote,
          search_term: trimmedSearch || 'jobs',
          surface: 'job_search_form',
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

  // If showing only the search bar (top of page)
  if (hideOtherFilters) {
    return (
      <div className="w-full flex items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            size="default"
            className={cn(
              SEARCH_HEADER_INPUT_CLASS,
              'pl-10',
              localSearch ? 'pr-8' : 'pr-3',
            )}
            onChange={e => setLocalSearch(e.target.value)}
            onBlur={() => setIsFocused(false)}
            onFocus={() => setIsFocused(true)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
              }
            }}
            placeholder={
              localSearch || isFocused
                ? 'Search jobs by title, keywords, company...'
                : ''
            }
            value={localSearch}
          />
          {!localSearch && !isFocused && (
            <div className="absolute left-10 top-1/2 -translate-y-1/2 pointer-events-none overflow-hidden h-4">
              <div className="text-sm text-muted-foreground leading-4">
                <span className="inline-block relative h-4 w-44">
                  {JOB_TITLES.map((title, index) => (
                    <span
                      key={title}
                      className={cn(
                        'absolute left-0 top-0 whitespace-nowrap transition-all duration-500',
                        index === placeholderIndex
                          ? 'opacity-100 translate-y-0'
                          : index ===
                              (placeholderIndex - 1 + JOB_TITLES.length) %
                                JOB_TITLES.length
                            ? 'opacity-0 translate-y-full'
                            : 'opacity-0 -translate-y-full',
                      )}
                    >
                      {title}
                    </span>
                  ))}
                </span>
              </div>
            </div>
          )}
          {localSearch && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 inline-flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => {
                setLocalSearch('');
                onSearch({ search: '' });
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Popover open={locationOpen} onOpenChange={setLocationOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="default"
              role="combobox"
              aria-expanded={locationOpen}
              className={cn(
                'w-64 justify-between pl-0 pr-2 font-medium',
                SEARCH_HEADER_LOCATION_CLASS,
              )}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <MapPin className="h-4 w-4 shrink-0 opacity-50" />
                <span className="truncate text-sm">
                  {localLocation
                    ? COMMON_LOCATIONS.find(
                        loc =>
                          loc.label.toLowerCase() ===
                          localLocation.toLowerCase(),
                      )?.label || localLocation
                    : 'Select location...'}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Search or type location..."
                className="focus-visible:ring-0 focus-visible:ring-offset-0"
                value={locationInputValue}
                onValueChange={setLocationInputValue}
                onKeyDown={e => {
                  if (e.key === 'Enter' && locationInputValue.trim()) {
                    e.preventDefault();
                    setLocalLocation(locationInputValue.trim());
                    setLocationOpen(false);
                    setLocationInputValue('');
                  }
                }}
              />
              <CommandList>
                {isLoadingLocations ? (
                  <div className="py-6 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <CommandEmpty>
                      <div className="py-6 text-center text-sm">
                        <p className="text-muted-foreground">
                          No location found.
                        </p>
                        {locationInputValue && (
                          <p className="mt-2 text-xs">
                            Press{' '}
                            <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted rounded">
                              Enter
                            </kbd>{' '}
                            to use "{locationInputValue}"
                          </p>
                        )}
                      </div>
                    </CommandEmpty>

                    {/* Recent locations shown first */}
                    {(!locationInputValue || locationInputValue.length < 2) &&
                      (() => {
                        const recentLocs = getRecentLocations();
                        if (recentLocs.length === 0) return null;
                        return (
                          <CommandGroup heading="Recent">
                            {recentLocs.map(loc => (
                              <CommandItem
                                key={`recent-${loc}`}
                                value={loc}
                                onSelect={currentValue => {
                                  setLocalLocation(
                                    currentValue === localLocation
                                      ? ''
                                      : currentValue,
                                  );
                                  setLocationOpen(false);
                                  setLocationInputValue('');
                                }}
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    localLocation.toLowerCase() ===
                                      loc.toLowerCase()
                                      ? 'opacity-100'
                                      : 'opacity-0',
                                  )}
                                />
                                {loc}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        );
                      })()}

                    {/* Common locations shown when no search or as quick options */}
                    {(!locationInputValue || locationInputValue.length < 2) && (
                      <CommandGroup heading="Quick Options">
                        {COMMON_LOCATIONS.map(location => (
                          <CommandItem
                            key={location.value}
                            value={location.label}
                            onSelect={currentValue => {
                              setLocalLocation(
                                currentValue === localLocation
                                  ? ''
                                  : currentValue,
                              );
                              setLocationOpen(false);
                              setLocationInputValue('');
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                localLocation.toLowerCase() ===
                                  location.label.toLowerCase()
                                  ? 'opacity-100'
                                  : 'opacity-0',
                              )}
                            />
                            {location.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}

                    {/* Search results from Nominatim */}
                    {locationResults.length > 0 && (
                      <CommandGroup heading="Search Results">
                        {locationResults.map((location, index) => (
                          <CommandItem
                            key={`${location.value}-${index}`}
                            value={location.label}
                            onSelect={currentValue => {
                              setLocalLocation(currentValue);
                              setLocationOpen(false);
                              setLocationInputValue('');
                            }}
                          >
                            <MapPin className="mr-2 h-4 w-4 opacity-50" />
                            <span className="truncate">{location.label}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-2">
          <SearchHeaderButton
            className="px-6"
            onClick={handleSearch}
            type="button"
            disabled={isSearching || isSavingSearch || !localSearch}
          >
            {isSearching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Search
              </>
            )}
          </SearchHeaderButton>
          <SearchHeaderButton
            className={cn(
              'px-3 text-amber-600 bg-secondary/80!',
              'hover:bg-secondary/70 border border-t-white/20',
              'border-b border-b-black/80 shadow-lg shadow-amber-500/5',
              'relative overflow-hidden',
              'transition-all duration-300 ease-in-out',
              isCurrentSearchSaved && 'text-amber-500',
            )}
            onClick={() =>
              isCurrentSearchSaved ? handleUnsaveSearch() : handleSaveSearch()
            }
            type="button"
            variant="secondary"
            disabled={isSavingSearch || !localSearch}
          >
            <span
              className="absolute inset-0 bg-gradient-to-br from-black/5 via-transparent to-black/25 pointer-events-none"
              aria-hidden
            />
            {isSavingSearch ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isCurrentSearchSaved ? 'Unsaving...' : 'Saving...'}
              </>
            ) : isCurrentSearchSaved ? (
              <>
                <Bookmark className="h-4 w-4 fill-amber-600 text-amber-600 drop-shadow-sm" />
                Saved
              </>
            ) : (
              <>
                <Bookmark className="size-4 stroke-2.5 text-amber-600 drop-shadow-sm" />
                Save
              </>
            )}
          </SearchHeaderButton>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Results Info */}
      {!hideSearchBar && (
        <div className="relative border-b border-border">
          <div className="space-y-3 p-4">
            <div className="text-sm text-muted-foreground">
              <p className="font-medium">
                <NumberFlow
                  animated
                  className="text-foreground/75 font-extrabold [&::part(suffix)]:ml-[0.0625em] [&::part(suffix)]:font-normal [&::part(suffix)]:text-xs [&::part(suffix)]:text-muted-foreground"
                  value={displayCounts.count}
                />{' '}
                results
              </p>
              <p className="text-muted-foreground">
                Total:{' '}
                <NumberFlow
                  animated
                  className="text-foreground/75 font-extrabold [&::part(suffix)]:ml-[0.0625em] [&::part(suffix)]:font-normal [&::part(suffix)]:text-xs [&::part(suffix)]:text-muted-foreground"
                  value={displayCounts.total}
                />
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                className="w-fit"
                onClick={onReset}
                size="sm"
                variant="secondary"
              >
                Reset
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex-1 overflow-y-auto">
        {!hideSearchBar && (
          <CollapsibleSection defaultOpen title="Search">
            <FormField label="Job Title or Keywords">
              <div className="relative">
                <Input
                  className="pr-8 text-lg md:text-xl focus-visible:ring-primary focus-visible:ring-offset-background"
                  onChange={e => setLocalSearch(e.target.value)}
                  onBlur={() => setIsFocused(false)}
                  onFocus={() => setIsFocused(true)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                  placeholder={
                    localSearch || isFocused
                      ? 'e.g. Software Engineer, React, Python... (or "all")'
                      : ''
                  }
                  size={24}
                  value={localSearch}
                />
                {!localSearch && !isFocused && (
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none overflow-hidden h-5">
                    <div className="text-sm text-muted-foreground">
                      Search for{' '}
                      <span className="inline-block relative h-5 w-44 align-bottom">
                        {JOB_TITLES.map((title, index) => (
                          <span
                            key={title}
                            className={cn(
                              'absolute left-0 top-0 whitespace-nowrap transition-all duration-500',
                              index === placeholderIndex
                                ? 'opacity-100 translate-y-0'
                                : index ===
                                    (placeholderIndex - 1 + JOB_TITLES.length) %
                                      JOB_TITLES.length
                                  ? 'opacity-0 translate-y-full'
                                  : 'opacity-0 -translate-y-full',
                            )}
                          >
                            {title}
                          </span>
                        ))}
                      </span>
                      ...
                    </div>
                  </div>
                )}
                {localSearch && (
                  <Button
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => {
                      setLocalSearch('');
                      onSearch({ search: '' });
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </FormField>
            <Button className="w-full" onClick={handleSearch} size="sm">
              Search
            </Button>
          </CollapsibleSection>
        )}

        <div className="bg-background/45 p-3">
          <CollapsibleSection
            className="rounded-t-lg"
            defaultOpen
            title="Saved Searches"
          >
            <div className="space-y-3">
              {isLoadingSearches ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : savedSearches.length === 0 ? (
                <div className="py-6 text-center">
                  <Bookmark className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-xs font-medium text-foreground mb-0.5">
                    No saved searches yet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Save your searches to access them later
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {savedSearches.map(search => (
                    <Link
                      key={search.id}
                      href={buildSavedSearchUrl(search)}
                      className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-accent/80 transition-all duration-200 group"
                    >
                      <div className="flex-shrink-0 w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Search className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-medium truncate text-foreground group-hover:text-primary transition-colors">
                          {search.searchTerm}
                        </span>
                        {search.location && (
                          <span className="text-xs text-muted-foreground truncate">
                            {search.location}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleSection>

          <CollapsibleSection defaultOpen title="Quick Filters">
            <div className="flex flex-col space-y-3">
              <CheckboxField
                checked={value.remote}
                label="Remote Only"
                onChange={checked => onChange({ remote: checked })}
              />
              <CheckboxField
                checked={value.savedOnly}
                label="Saved Jobs Only"
                onChange={checked => onChange({ savedOnly: checked })}
              />
              <CheckboxField
                checked={value.excludeApplied}
                label="Exclude Applied"
                onChange={checked => onChange({ excludeApplied: checked })}
              />
              <CheckboxField
                checked={value.excludeDismissed}
                label="Exclude Dismissed"
                onChange={checked => onChange({ excludeDismissed: checked })}
              />
            </div>
          </CollapsibleSection>

          <CollapsibleSection defaultOpen title="Job Details">
            <div className="space-y-4">
              <FormField label="Job Type">
                <Select
                  onValueChange={jobType => onChange({ jobType })}
                  value={value.jobType}
                >
                  <SelectTrigger className="border border-border bg-background/95 dark:bg-background/60">
                    <SelectValue placeholder="Any type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="fulltime">Full-time</SelectItem>
                    <SelectItem value="parttime">Part-time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="internship">Internship</SelectItem>
                    <SelectItem value="temporary">Temporary</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Posted Within">
                <Select
                  onValueChange={postedWithin => onChange({ postedWithin })}
                  value={value.postedWithin}
                >
                  <SelectTrigger className="border border-border bg-background/95 dark:bg-background/60">
                    <SelectValue placeholder="Any time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any time</SelectItem>
                    <SelectItem value="1">Last 24 hours</SelectItem>
                    <SelectItem value="3">Last 3 days</SelectItem>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="14">Last 14 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          </CollapsibleSection>

          <CollapsibleSection defaultOpen={true} title="Location">
            <FormField label="Location">
              <div className="relative flex items-center">
                <Input
                  className="pr-10 w-full"
                  onChange={e => setLocalLocation(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                  placeholder="City, state, or zip"
                  value={localLocation}
                />
                {localLocation && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 flex items-center justify-center rounded-md hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => {
                      setLocalLocation('');
                      onSearch({ location: '' });
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </FormField>
          </CollapsibleSection>

          <CollapsibleSection
            className="rounded-b-lg"
            defaultOpen={true}
            title="Salary Range"
          >
            <div className="space-y-4">
              <FormField label="Minimum Salary">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    className="pl-7"
                    min="0"
                    onChange={e => setLocalMinSalary(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearch();
                      }
                    }}
                    placeholder="50,000"
                    step="10000"
                    type="number"
                    value={localMinSalary}
                  />
                </div>
              </FormField>
              <FormField label="Maximum Salary">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    className="pl-7"
                    min="0"
                    onChange={e => setLocalMaxSalary(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearch();
                      }
                    }}
                    placeholder="150,000"
                    step="10000"
                    type="number"
                    value={localMaxSalary}
                  />
                </div>
              </FormField>
            </div>
          </CollapsibleSection>
        </div>
      </div>
    </div>
  );
}
