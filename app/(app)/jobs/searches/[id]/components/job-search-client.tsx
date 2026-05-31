'use client';

import {
  JobSearchForm,
  JobSearchFormData,
} from '@/components/job-search/job-search-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { ViewMode, ViewModeToggle } from '@/components/ui/view-mode-toggle';
import { formatLocationLabel } from '@/lib/utils';
import { JobListing, JobListingStatus } from '@/generated/prisma/browser';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Briefcase,
  Building2,
  CheckCircle2,
  DollarSign,
  Loader2,
  MapPin,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface JobSearchClientProps {
  listings: JobListing[];
  searchTerm: string;
  location?: string | null;
}

const formatListingDescription = (
  description: string | null | undefined,
): string | null =>
  description
    ? description
        .slice(0, 900)
        .replace(/<[^>]*>/g, '')
        .replace(/&[^;]+;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || null
    : null;

const resultBadgeBaseClassName =
  'px-1.5 pt-[4px] pb-[4px] text-xs font-medium rounded-md border-x-0 border-t border-b border-t-white/15 border-b-black/25';

const formatJobTypeBadgeLabel = (
  jobType: JobListing['jobType'] | null | undefined,
): string | null => {
  if (!jobType || jobType === 'UNKNOWN') {
    return null;
  }

  switch (jobType) {
    case 'FULL_TIME':
      return 'Fulltime';
    case 'PART_TIME':
      return 'Part-time';
    case 'FULL_TIME_AND_PART_TIME':
      return 'Fulltime/Part-time';
    case 'CONTRACT':
      return 'Contract';
    case 'INTERNSHIP':
      return 'Internship';
    default:
      return null;
  }
};

export function JobSearchClient({
  listings: initialListings,
  searchTerm,
  location,
}: JobSearchClientProps) {
  const [listings, setListings] = useState(initialListings);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-refresh when search completes
  const refreshListings = useCallback(async () => {
    setIsRefreshing(true);
    try {
      window.location.reload();
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Update listings when initialListings changes (after router.refresh())
  useEffect(() => {
    setListings(initialListings);
  }, [initialListings]);
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [statusFilter, setStatusFilter] = useState<JobListingStatus | 'all'>(
    'all',
  );
  const [remoteFilter, setRemoteFilter] = useState<boolean | 'all'>('all');

  // Search form state
  const [searchFormData, setSearchFormData] = useState<JobSearchFormData>({
    search: searchTerm || '',
    location: location || '',
    remote: false,
    jobType: 'any',
    postedWithin: 'any',
    minSalary: '',
    maxSalary: '',
    savedOnly: false,
    excludeApplied: false,
    excludeDismissed: false,
    excludeLeads: false,
  });

  const handleSearchFormChange = (filters: Partial<JobSearchFormData>) => {
    setSearchFormData(prev => ({ ...prev, ...filters }));
  };

  const handleSearchFormReset = () => {
    setSearchFormData({
      search: '',
      location: '',
      remote: false,
      jobType: 'any',
      postedWithin: 'any',
      minSalary: '',
      maxSalary: '',
      savedOnly: false,
      excludeApplied: false,
      excludeDismissed: false,
      excludeLeads: false,
    });
  };

  const handleSearch = (filters: Partial<JobSearchFormData>) => {
    // This will be handled by the JobSearchForm component
    // which navigates to the new search results
  };

  // Filter listings
  const filteredListings = useMemo(() => {
    return listings.filter(listing => {
      if (statusFilter !== 'all' && listing.status !== statusFilter)
        return false;
      if (remoteFilter !== 'all' && listing.remote !== remoteFilter)
        return false;
      return true;
    });
  }, [listings, statusFilter, remoteFilter]);

  const stats = useMemo(() => {
    return {
      total: listings.length,
      unreviewed: listings.filter(l => l.status === JobListingStatus.UNREVIEWED)
        .length,
      dismissed: listings.filter(l => l.status === JobListingStatus.DISMISSED)
        .length,
      addedToLeads: listings.filter(
        l => l.status === JobListingStatus.ADDED_TO_LEADS,
      ).length,
      remote: listings.filter(l => l.remote === true).length,
    };
  }, [listings]);

  return (
    <div className="flex flex-1 flex-col h-full">
      {/* Search Form - Full Width at Top */}
      <div className="border-b border-border rounded-b-none rounded-xl bg-background/95 backdrop-blur-sm shadow-sm px-4 py-4 flex-shrink-0 dark:border-white/[0.07] dark:bg-[#18181d]/90">
        <JobSearchForm
          hideOtherFilters={true}
          value={searchFormData}
          onChange={handleSearchFormChange}
          onSearch={handleSearch}
          onReset={handleSearchFormReset}
          result={{
            count: filteredListings.length,
            total: listings.length,
          }}
        />
      </div>

      {/* Sidebar and Results Below */}
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1"
        autoSaveId="job-search-layout"
      >
        {/* Sidebar Filters */}
        <ResizablePanel
          defaultSize={20}
          minSize={15}
          maxSize={30}
          className="min-w-[240px]"
        >
          <div className="h-full overflow-y-auto bg-zinc-100/80 dark:bg-[#151519]">
            <JobSearchForm
              hideSearchBar
              value={searchFormData}
              onChange={handleSearchFormChange}
              onSearch={handleSearch}
              onReset={handleSearchFormReset}
              result={{
                count: filteredListings.length,
                total: listings.length,
              }}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle
          withHandle
          className="bg-border/50 hover:bg-border transition-colors"
        />

        {/* Results */}
        <ResizablePanel defaultSize={80}>
          <div className="relative flex h-full flex-col overflow-hidden bg-background dark:bg-[#1b1b20]">
            {/* Results Header */}
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, transform: 'translateY(-100%)' }}
                animate={{ opacity: 1, transform: 'translateY(0%)' }}
                exit={{ opacity: 0, transform: 'translateY(-100%)' }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="border-b border-border bg-zinc-50/90 backdrop-blur-sm shadow-sm dark:border-white/[0.07] dark:bg-[#18181d]"
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {filteredListings.length}{' '}
                      {filteredListings.length === 1 ? 'result' : 'results'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ViewModeToggle
                      value={viewMode}
                      onChange={setViewMode}
                      availableViews={['card', 'table']}
                      defaultView="card"
                    />
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Results Content */}
            <div className="flex-1 overflow-y-auto bg-muted/20 dark:bg-[#1c1c22]">
              <div className="px-4 py-4">
                {filteredListings.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-full text-center py-12"
                  >
                    {isRefreshing ? (
                      <>
                        <Loader2 className="h-12 w-12 text-primary mb-4 animate-spin" />
                        <h3 className="text-lg font-semibold mb-2">
                          Refreshing...
                        </h3>
                        <p className="text-muted-foreground mb-2">
                          Loading latest database results.
                        </p>
                      </>
                    ) : (
                      <>
                        <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">
                          No jobs found
                        </h3>
                        <p className="text-muted-foreground mb-4">
                          Try adjusting your filters to see more results.
                        </p>
                        <Button
                          variant="outline"
                          onClick={refreshListings}
                          disabled={isRefreshing}
                        >
                          <RefreshCw
                            className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`}
                          />
                          Refresh Results
                        </Button>
                      </>
                    )}
                  </motion.div>
                ) : viewMode === 'card' ? (
                  <div className="grid gap-4">
                    <AnimatePresence mode="popLayout">
                      {filteredListings.map((listing, index) => {
                        const description: string | null =
                          formatListingDescription(listing.description);
                        const jobTypeLabel = formatJobTypeBadgeLabel(
                          listing.jobType,
                        );

                        return (
                          <motion.div
                            key={listing.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{
                              duration: 0.2,
                              delay: index * 0.05,
                              ease: [0.4, 0, 0.2, 1],
                            }}
                          >
                            <Card className="hover:shadow-md transition-shadow">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <Link
                                      href={`/jobs/${listing.id}`}
                                      className="font-medium hover:underline line-clamp-2"
                                    >
                                      {listing.title}
                                    </Link>

                                    <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                                      {listing.company && (
                                        <div className="flex items-center gap-1">
                                          <Building2 className="h-4 w-4" />
                                          {listing.company}
                                        </div>
                                      )}
                                      {listing.location && (
                                        <div className="flex items-center gap-1">
                                          <MapPin className="h-4 w-4" />
                                          {formatLocationLabel(
                                            listing.location,
                                          )}
                                        </div>
                                      )}
                                      {listing.salary && (
                                        <div className="flex items-center gap-1">
                                          <DollarSign className="h-4 w-4" />
                                          {listing.salary}
                                        </div>
                                      )}
                                    </div>

                                    {description && (
                                      <p className="mt-3 text-sm text-muted-foreground/75 line-clamp-3 leading-relaxed">
                                        {description}
                                      </p>
                                    )}

                                    <div className="flex flex-wrap gap-2 mt-3">
                                      {listing.remote && (
                                        <Badge
                                          className={`${resultBadgeBaseClassName} bg-teal-500/10 text-teal-700 hover:bg-teal-500/20 dark:text-teal-300`}
                                        >
                                          Remote
                                        </Badge>
                                      )}
                                      {jobTypeLabel && (
                                        <Badge
                                          className={`${resultBadgeBaseClassName} bg-indigo-500/10 text-indigo-700 hover:bg-indigo-500/20 dark:text-indigo-300`}
                                        >
                                          {jobTypeLabel}
                                        </Badge>
                                      )}
                                      {listing.status ===
                                        JobListingStatus.ADDED_TO_LEADS && (
                                        <Badge
                                          className={`${resultBadgeBaseClassName} bg-green-500/10 text-green-700 hover:bg-green-500/20 dark:text-green-300`}
                                        >
                                          <CheckCircle2 className="h-3 w-3 mr-1" />
                                          Added to Leads
                                        </Badge>
                                      )}
                                      {listing.status ===
                                        JobListingStatus.DISMISSED && (
                                        <Badge
                                          className={`${resultBadgeBaseClassName} bg-red-500/10 text-red-700 hover:bg-red-500/20 dark:text-red-300`}
                                        >
                                          <XCircle className="h-3 w-3 mr-1" />
                                          Dismissed
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div className="border rounded-lg">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium">
                            Title
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium">
                            Company
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium">
                            Location
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredListings.map((listing, index) => {
                          const description: string | null =
                            formatListingDescription(listing.description);

                          return (
                            <motion.tr
                              key={listing.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: index * 0.03 }}
                              className="border-t hover:bg-muted/50"
                            >
                              <td className="px-4 py-3">
                                <Link
                                  href={`/jobs/${listing.id}`}
                                  className="hover:underline"
                                >
                                  {listing.title}
                                </Link>
                                {description && (
                                  <p className="mt-1 text-xs text-muted-foreground/75 line-clamp-2">
                                    {description}
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {listing.company}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {formatLocationLabel(listing.location)}
                              </td>
                              <td className="px-4 py-3">
                                <Badge
                                  variant={
                                    listing.status ===
                                    JobListingStatus.ADDED_TO_LEADS
                                      ? 'default'
                                      : 'secondary'
                                  }
                                >
                                  {listing.status.replace('_', ' ')}
                                </Badge>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
