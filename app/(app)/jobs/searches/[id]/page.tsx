import { Page } from '@/components/layout/page';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';
import { formatDistanceToNow } from 'date-fns';
import { notFound } from 'next/navigation';
import { JobSearchClient } from './components/job-search-client';

export default async function JobSearchDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    return notFound();
  }

  const { id } = await params;

  const jobSearch = await db.jobSearch.findUnique({
    where: {
      id,
      userId: user.id,
    },
  });

  if (!jobSearch) {
    return notFound();
  }

  const listings = await db.jobListing.findMany({
    where: {
      userId: user.id,
      title: {
        contains: jobSearch.searchTerm,
        mode: 'insensitive',
      },
      ...(jobSearch.location
        ? {
            location: {
              contains: jobSearch.location,
              mode: 'insensitive',
            },
          }
        : {}),
    },
    orderBy: [{ postedAt: 'desc' }, { createdAt: 'desc' }],
  });

  return (
    <Page
      name="job-search-details"
      title={jobSearch.searchTerm}
      description={`${jobSearch.location || 'Any location'} • Created ${formatDistanceToNow(new Date(jobSearch.createdAt), { addSuffix: true })} • ${listings.length} jobs found`}
      fullWidth
    >
      <JobSearchClient
        listings={listings}
        searchTerm={jobSearch.searchTerm}
        location={jobSearch.location}
      />
    </Page>
  );
}
