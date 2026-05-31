import { JobListing, JobListingStatus } from '@/generated/prisma/browser';
import type { Metadata } from 'next';

import { JobListingsReport } from '@/components/job-listings/job-listings-report';
import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { Card, CardContent } from '@/components/ui/card';
import { undismissJobListings } from '@/lib/job-listings/dismiss';
import { getReportData } from '@/lib/reporting';
import { getCurrentUser } from '@/lib/user/query';

export const metadata: Metadata = {
  description: 'View dismissed job listings',
  title: 'Dismissed Jobs | Gimme Job',
};

export default async function DismissedJobListingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const jobListings = await getReportData({
    apiQuery: {
      filters: [
        {
          field: 'status',
          operator: 'eq',
          value: JobListingStatus.DISMISSED,
        },
      ],
    },
    cacheKey: `dismissed`,
    model: 'job-listings',
    userId: user.id,
  });

  return (
    <Page name="dismissed-jobs" title="Dismissed Jobs">
      <PageHeader
        title="Dismissed Jobs"
        description="A list of Job listings you have dismissed."
      />
      <PageContent>
        <Card>
          <CardContent className="bg-accent/30 p-2 md:p-2">
            <JobListingsReport
              cacheKey="dismissed"
              filters={[
                {
                  field: 'status',
                  operator: 'eq',
                  value: JobListingStatus.DISMISSED,
                },
              ]}
              initialData={jobListings.data as JobListing[]}
              undismiss={async ids => {
                'use server';
                await undismissJobListings(ids);
              }}
            />
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
