import {
  JobFitAnalysis,
  JobLead,
  JobLeadStatus,
  JobListing,
  Prisma,
  Resume,
  ResumeRevision,
} from '@/generated/prisma/browser';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { JobLeadsReport } from '@/components/job-leads/job-leads-report';
import { Page } from '@/components/layout/page';
import { dismissJobLeads } from '@/lib/job-leads';
import { failStuckLeads } from '@/lib/job-leads/fail-stuck';
import { getReportData } from '@/lib/reporting';
import { getCurrentUser } from '@/lib/user/query';
import { ApiQuery } from '@/types/reporting/query';

export const metadata: Metadata = {
  description: 'View your job leads.',
  title: 'Leads | gimmejob',
};

export default async function JobLeadsPage() {
  const user = await getCurrentUser();

  if (!user?.id) {
    redirect('/login');
  }

  // Auto-fail leads stuck in analyzing/optimizing for >15 minutes
  await failStuckLeads();

  const initialQuery: ApiQuery<JobLead, Prisma.JobLeadInclude> = {
    filters: [
      {
        field: 'status',
        operator: 'in',
        // all statuses except REMOVED
        value: [
          ...Object.keys(JobLeadStatus).filter(
            status => status !== JobLeadStatus.REMOVED,
          ),
        ],
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

  const { data, pagination } = await getReportData({
    apiQuery: initialQuery,
    model: 'job-leads',
    userId: user.id,
  });

  // Apply type assertion to ensure the correct type
  const leads = data as (JobLead & {
    jobFitAnalysis: JobFitAnalysis;
    jobListing: JobListing;
    resumeRevisions: (ResumeRevision & { resume: Resume })[];
  })[];

  return (
    <Page title="Leads" description="View your job leads" name="leads">
      <JobLeadsReport
        dismiss={async ids => {
          'use server';
          await dismissJobLeads(ids);
        }}
        initialData={leads as any}
        initialQuery={initialQuery}
        isPaginationSticky={false}
        showPagination={true}
        showSearch={true}
        showSelectedCount={false}
        totalCount={pagination.total}
      />
    </Page>
  );
}
