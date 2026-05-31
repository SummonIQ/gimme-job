import { JobProvider, JobSearch, JobSearchStatus } from '@/generated/prisma/browser';
import type { Metadata } from 'next';
import type { z } from 'zod';

import { JobSearchEditor } from '@/components/job-searches/job-search-editor';
import type { jobSearchFormSchema } from '@/components/job-searches/job-search-form';
import { JobSearchesReport } from '@/components/job-searches/job-searches-report';
import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { createJobSearch } from '@/lib/job-searches/create';
import { getReportData } from '@/lib/reporting';
import { getCurrentUser } from '@/lib/user/query';
import { ChevronDown } from 'lucide-react';

export const metadata: Metadata = {
  description: 'Search for and view job details.',
  title: 'Job Listings | Gimme Job',
};

export default async function JobSearchesPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  // Get saved searches
  const savedSearches = await getReportData({
    apiQuery: {
      include: {
        jobSearchListings: {
          select: {
            jobListingId: true,
          },
        },
      },
      filters: [
        { field: 'saved', operator: 'eq', value: true },
        {
          field: 'status',
          operator: 'in',
          value: [
            JobSearchStatus.QUEUED,
            JobSearchStatus.PROCESSING,
            JobSearchStatus.COMPLETED,
          ],
        },
      ],
      pagination: {
        count: 20,
        start: 0,
      },
      sort: [{ direction: 'desc', field: 'createdAt' }],
    },
    model: 'job-searches',
    userId: user.id,
  });

  // Get recent searches (all searches)
  const recentSearches = await getReportData({
    apiQuery: {
      include: {
        jobSearchListings: {
          select: {
            jobListingId: true,
          },
        },
      },
      filters: [
        {
          field: 'status',
          operator: 'in',
          value: [
            JobSearchStatus.QUEUED,
            JobSearchStatus.PROCESSING,
            JobSearchStatus.COMPLETED,
          ],
        },
      ],
      pagination: {
        count: 10,
        start: 0,
      },
      sort: [{ direction: 'desc', field: 'createdAt' }],
    },
    model: 'job-searches',
    userId: user?.id,
  });

  return (
    <Page name="job-searches" title="Job Searches">
      <PageHeader
        title="Job Searches"
        description="Search for and view job details."
        actions={
          <JobSearchEditor
            action={async (data: z.infer<typeof jobSearchFormSchema>) => {
              'use server';

              await createJobSearch({
                ...data,
                jobProvider: JobProvider.SERPAPI,
              });
            }}
          />
        }
      />
      <PageContent>
        <div className="space-y-6">
          {/* Saved Searches - Only show if there are saved searches */}
          {(savedSearches.data as JobSearch[]).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Saved Searches</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <JobSearchesReport
                  cacheKey="saved-job-searches"
                  include={{
                    jobSearchListings: {
                      select: {
                        jobListingId: true,
                      },
                    },
                  }}
                  initialData={savedSearches.data as JobSearch[]}
                  showPagination={false}
                  showSearch={false}
                  showSelectedCount={false}
                />
              </CardContent>
            </Card>
          )}

          {/* Recent Searches - Collapsible */}
          <Collapsible
            defaultOpen={(savedSearches.data as JobSearch[]).length === 0}
          >
            <Card>
              <CardHeader className="cursor-pointer">
                <CollapsibleTrigger className="flex w-full items-center justify-between group">
                  <CardTitle>Recent Searches</CardTitle>
                  <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="p-0">
                  <JobSearchesReport
                    cacheKey="recent-job-searches"
                    include={{
                      jobSearchListings: {
                        select: {
                          jobListingId: true,
                        },
                      },
                    }}
                    initialData={recentSearches.data as JobSearch[]}
                    showPagination={true}
                    showSearch={true}
                    showSelectedCount={false}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      </PageContent>
    </Page>
  );
}
