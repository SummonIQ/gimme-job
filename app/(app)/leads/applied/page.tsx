import { JobLead, JobLeadStatus, Prisma } from '@/generated/prisma/browser';
import type { Metadata } from 'next';

import { JobLeadsReport } from '@/components/job-leads/job-leads-report';
import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { Card, CardContent } from '@/components/ui/card';
import { dismissJobLeads } from '@/lib/job-leads';
import { getReportData } from '@/lib/reporting';
import { getCurrentUser } from '@/lib/user/query';
import { ApiQuery } from '@/types/reporting/query';

export const metadata: Metadata = {
  description: 'View your job leads.',
  title: 'Leads | Gimme Job',
};

export default async function JobLeadsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const initialQuery: ApiQuery<JobLead, Prisma.JobLeadInclude> = {
    filters: [
      {
        field: 'status',
        operator: 'in',
        // all statuses except DISMISSED
        value: [JobLeadStatus.APPLIED],
      },
    ],
    include: {
      applicationSubmissions: true,
      jobFitAnalysis: true,
      jobListing: true,
      optimization: true,
    },
    pagination: {
      count: 10,
      start: 0,
    },
    sort: [{ direction: 'desc', field: 'createdAt' }],
  };

  const { data: leads } = await getReportData({
    apiQuery: initialQuery,
    model: 'job-leads',
    userId: user.id,
    cacheKey: 'applied',
  });

  return (
    <Page name="applied-leads" title="Applied Leads">
      <PageHeader
        title="Applied Leads"
        description="Leads that you have applied to."
      />
      <PageContent>
        <Card>
          <CardContent className="bg-accent/30 p-2 md:p-2">
            <JobLeadsReport
              dismiss={async ids => {
                'use server';
                await dismissJobLeads(ids);
              }}
              initialData={leads as any}
              initialQuery={initialQuery}
              showPagination={true}
              showSearch={true}
              showSelectedCount={false}
            />
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
