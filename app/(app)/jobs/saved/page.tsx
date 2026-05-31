import { JobListing } from '@/generated/prisma/browser';
import type { Metadata } from 'next';

import { JobListingsReport } from '@/components/job-listings/job-listings-report';
import { Page } from '@/components/layout/page';
import { createJobLeads } from '@/lib/job-leads';
import { dismissJobListings } from '@/lib/job-listings/dismiss';
import { unsaveJobListings } from '@/lib/job-listings/save';
import { getReportData } from '@/lib/reporting';
import { getCurrentUser } from '@/lib/user/query';

export const metadata: Metadata = {
  description: 'View saved job listings',
  title: 'Saved Jobs | Gimme Job',
};

export default async function SavedJobListingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const jobListings = await getReportData({
    apiQuery: {
      filters: [
        {
          field: 'saved',
          operator: 'eq',
          value: true,
        },
      ],
      pagination: {
        count: 10,
        start: 0,
      },
      sort: [{ direction: 'desc', field: 'updatedAt' }],
    },
    model: 'job-listings',
    userId: user.id,
  });

  return (
    <Page
      name="saved-jobs"
      title="Saved Jobs"
      description="View and manage Job listings you have saved."
    >
      <JobListingsReport
        addToLeads={async ids => {
          'use server';
          await createJobLeads(ids);
        }}
        cacheKey="saved"
        dismiss={async ids => {
          'use server';
          await dismissJobListings(ids);
        }}
        filters={[
          {
            field: 'saved',
            operator: 'eq',
            value: true,
          },
        ]}
        initialData={jobListings.data as JobListing[]}
        pagination={{
          count: 10,
          start: 0,
        }}
        showExport={false}
        sort={[{ direction: 'desc', field: 'updatedAt' }]}
        unsave={async ids => {
          'use server';
          await unsaveJobListings(ids);
        }}
      />
    </Page>
  );
}
