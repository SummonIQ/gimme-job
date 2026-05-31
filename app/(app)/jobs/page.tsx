import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { JobSearchClient } from '@/components/job-search/job-search-client';
import { Page } from '@/components/layout/page';
import { isJobSearchSort, searchJobListings } from '@/lib/job-listings/search';
import { getCurrentUser } from '@/lib/user/query';
import { JobsPageActions } from './page-actions';

export const metadata: Metadata = {
  description: 'Search for and view job details.',
  title: 'Jobs | Gimme Job',
};


export default async function JobListingsPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = (await getCurrentUser())!;

  // Get user's location from cookie if available
  const cookieStore = await cookies();
  const rawUserLocation = cookieStore.get('user_location')?.value;
  const userLocation = rawUserLocation
    ? decodeURIComponent(rawUserLocation)
    : undefined;

  const sp = await searchParamsPromise;
  const search = sp.search ?? '';
  const location = sp.location || userLocation || '';
  const remote = sp.remote === 'true';
  const rawSort = sp.sort;

  // Server-side initial data fetch — users see results immediately
  const initialResult = await searchJobListings({
    userId: user.id,
    search,
    location: remote ? '' : location,
    jobType: sp.jobType || 'any',
    postedWithin: sp.postedWithin || 'any',
    remote,
    savedOnly: sp.savedOnly === 'true',
    dismissedOnly: sp.dismissedOnly === 'true',
    excludeApplied: sp.excludeApplied === 'true',
    excludeDismissed: sp.excludeDismissed !== 'false',
    excludeLeads: sp.excludeLeads === 'true',
    minSalary: sp.minSalary ?? '',
    maxSalary: sp.maxSalary ?? '',
    sort: isJobSearchSort(rawSort) ? rawSort : 'recent',
    page: parseInt(sp.page || '1'),
    pageSize: parseInt(sp.pageSize || '25'),
  });

  return (
    <Page
      name="jobs-search"
      description="Find, track, and apply to jobs that match your career goals."
      title="Jobs"
      actions={<JobsPageActions />}
      card
    >
      <JobSearchClient
        initialData={initialResult.data}
        initialLocation={userLocation}
        initialTotal={initialResult.pageInfo.total}
      />
    </Page>
  );
}
