'use client';

import { Bookmark, ChevronDown, Loader2, MapPin, Search, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/css';
import { Button } from '../ui/button';

interface SavedSearch {
  id: string;
  searchTerm: string;
  location?: string | null;
  metadata?: {
    filters?: Record<string, unknown>;
  } | null;
}

const savedSearchToFilters = (search: SavedSearch): Record<string, unknown> => {
  const f = (search.metadata?.filters ?? {}) as Record<string, unknown>;
  const rawLocation = String(f.location || search.location || '');
  const isRemote = Boolean(f.remote) || rawLocation.toLowerCase() === 'remote';
  return {
    search: f.search || search.searchTerm || '',
    location: isRemote ? '' : rawLocation,
    jobType: f.jobType || 'any',
    postedWithin: f.postedWithin || 'any',
    minSalary: f.minSalary || '',
    maxSalary: f.maxSalary || '',
    remote: isRemote,
    savedOnly: Boolean(f.savedOnly),
    excludeApplied: Boolean(f.excludeApplied),
    excludeDismissed: f.excludeDismissed !== false,
    excludeLeads: Boolean(f.excludeLeads),
    view: (f.view as JobView) || 'all',
  };
};

export type JobView = 'all' | 'saved' | 'dismissed' | 'searches';

export interface JobSearchFiltersData {
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
  view: JobView;
}

interface JobSearchFiltersProps {
  onFilterChange: (filters: Partial<JobSearchFiltersData>) => void;
  onReset: () => void;
  result: {
    count: number;
    total: number;
  } | null;
  values: JobSearchFiltersData;
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
    <div className="relative border-b border-border/30 last:border-b-0 dark:border-white/5">
      <div
        className={cn(
          'group flex w-full items-center justify-between py-5 px-4 md:px-6',
          className,
        )}
      >
        <button
          className="flex flex-1 items-center text-left text-base font-medium text-foreground dark:text-foreground/85 transition-colors hover:text-muted-foreground"
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
                'w-4 h-4 opacity-40 transition-[transform,opacity] duration-300 group-hover:opacity-100',
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
              'space-y-4 px-4 md:px-6 pb-6 pt-1 transition',
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
    className={cn(
      'text-sm cursor-default',
      checked
        ? '[&>span]:text-foreground [&>span]:font-semibold'
        : '[&>span]:text-muted-foreground',
    )}
    label={label}
    onCheckedChange={onChange}
    size="w-4 h-4"
  />
);

export function JobSearchFilters({
  onFilterChange,
  onReset,
  result,
  values,
}: JobSearchFiltersProps) {
  const [displayCounts, setDisplayCounts] = useState({
    count: 0,
    total: 0,
  });

  // Saved searches state
  const [savedSearches, setSavedSearches] = useState<Array<SavedSearch>>([]);
  const [isLoadingSearches, setIsLoadingSearches] = useState(false);
  const [deletingSearchId, setDeletingSearchId] = useState<string | null>(null);

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

  useEffect(() => {
    loadSavedSearches();
  }, [loadSavedSearches]);

  const handleDeleteSearch = useCallback(
    async (e: React.MouseEvent, searchId: string) => {
      e.stopPropagation();
      setDeletingSearchId(searchId);
      try {
        const response = await fetch(`/api/job-searches/${searchId}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          await loadSavedSearches();
          window.dispatchEvent(new Event('saved-searches:changed'));
        }
      } catch (error) {
        console.error('Failed to delete saved search:', error);
      } finally {
        setDeletingSearchId(null);
      }
    },
    [loadSavedSearches],
  );

  useEffect(() => {
    const handleSavedSearchesChanged = () => {
      loadSavedSearches();
    };

    window.addEventListener(
      'saved-searches:changed',
      handleSavedSearchesChanged,
    );
    return () => {
      window.removeEventListener(
        'saved-searches:changed',
        handleSavedSearchesChanged,
      );
    };
  }, [loadSavedSearches]);

  return (
    <div className="flex flex-col h-full">
      {/* Results Info - Commented out for now
      <div className="relative border-b border-border bg-background/45">
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
      */}

      {/* Filters */}
      <div className="flex-1 overflow-y-auto">
        <div className="">
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
                <div className="space-y-1.5">
                  {savedSearches.map(search => {
                    const metaFilters = (search.metadata?.filters ?? {}) as Record<
                      string,
                      unknown
                    >;
                    const rawLoc = String(
                      search.location ?? metaFilters.location ?? '',
                    );
                    const isRemote =
                      Boolean(metaFilters.remote) ||
                      rawLoc.toLowerCase() === 'remote';
                    const displayLocation = isRemote
                      ? 'Remote'
                      : rawLoc.trim();
                    return (
                      <div
                        key={search.id}
                        className="group relative flex w-full items-stretch overflow-hidden rounded-lg border border-border/40 bg-background/60 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset] transition-all hover:border-border/70 hover:bg-background hover:shadow-sm dark:border-white/5 dark:bg-zinc-950 dark:hover:border-white/10 dark:hover:bg-zinc-900"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            onFilterChange(savedSearchToFilters(search))
                          }
                          className="flex flex-1 items-center gap-2.5 px-2.5 py-2 text-left min-w-0"
                        >
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                            <Search className="size-3.5" strokeWidth={2.25} />
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col leading-tight">
                            <span className="text-[13px] font-semibold text-foreground truncate">
                              {search.searchTerm}
                            </span>
                            {displayLocation && (
                              <span className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] text-muted-foreground truncate">
                                <MapPin className="size-3 shrink-0 opacity-70" />
                                <span className="truncate">{displayLocation}</span>
                              </span>
                            )}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={e => handleDeleteSearch(e, search.id)}
                          disabled={deletingSearchId === search.id}
                          className="flex shrink-0 items-center justify-center px-2 text-muted-foreground/60 opacity-0 transition-all group-hover:opacity-100 hover:text-destructive"
                          aria-label={`Delete saved search: ${search.searchTerm}`}
                        >
                          {deletingSearchId === search.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CollapsibleSection>

          <CollapsibleSection defaultOpen title="Quick Filters">
            <div className="flex flex-col space-y-3">
              <CheckboxField
                checked={values.remote}
                label="Remote Only"
                onChange={checked => onFilterChange({ remote: checked })}
              />
              <CheckboxField
                checked={values.savedOnly}
                label="Saved Jobs Only"
                onChange={checked => onFilterChange({ savedOnly: checked })}
              />
              <CheckboxField
                checked={values.excludeApplied}
                label="Exclude Applied"
                onChange={checked =>
                  onFilterChange({ excludeApplied: checked })
                }
              />
              <CheckboxField
                checked={values.excludeDismissed}
                label="Exclude Dismissed"
                onChange={checked =>
                  onFilterChange({ excludeDismissed: checked })
                }
              />
              <CheckboxField
                checked={values.excludeLeads}
                label="Exclude Leads"
                onChange={checked => onFilterChange({ excludeLeads: checked })}
              />
            </div>
          </CollapsibleSection>

          <CollapsibleSection defaultOpen title="Job Details">
            <div className="space-y-4">
              <FormField label="Job Type">
                <Select
                  onValueChange={jobType => onFilterChange({ jobType })}
                  value={values.jobType}
                >
                  <SelectTrigger className="border border-border bg-background/95 dark:border-white/10 dark:bg-[#15151a]">
                    <SelectValue placeholder="Any type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="fulltime">Full-time</SelectItem>
                    <SelectItem value="parttime">Part-time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="internship">Internship</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Posted Within">
                <Select
                  onValueChange={postedWithin =>
                    onFilterChange({ postedWithin })
                  }
                  value={values.postedWithin}
                >
                  <SelectTrigger className="border border-border bg-background/95 dark:border-white/10 dark:bg-[#15151a]">
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

          <CollapsibleSection
            className="relative"
            defaultOpen={true}
            title="Location"
          >
            <FormField label="City">
              <div className="relative w-full">
                <Input
                  className="pr-10 dark:border-white/10 dark:bg-[#15151a]"
                  onChange={e => onFilterChange({ location: e.target.value })}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  placeholder="City, state, or zip"
                  value={values.location}
                />
                {values.location && (
                  <Button
                    className="absolute! right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                    onClick={() => onFilterChange({ location: '' })}
                    size="sm"
                    variant="ghost"
                  >
                    <X className="h-3 w-3" />
                  </Button>
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
                  <Input
                    className="peer pl-6 dark:border-white/10 dark:bg-[#15151a]"
                    min="0"
                    onChange={e =>
                      onFilterChange({ minSalary: e.target.value })
                    }
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                      }
                    }}
                    placeholder="50,000"
                    step="10000"
                    type="number"
                    value={values.minSalary}
                  />
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-foreground peer-placeholder-shown:text-muted-foreground/55">
                    $
                  </span>
                </div>
              </FormField>
            </div>
          </CollapsibleSection>
        </div>
      </div>
    </div>
  );
}
