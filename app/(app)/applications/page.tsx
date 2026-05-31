import {
  type ApplicationSubmission,
  type Prisma,
} from '@/generated/prisma/browser';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { ApplicationsReport } from '@/components/applications/applications-report';
import { Page, PageHeader } from '@/components/layout/page';
import { cacheTag } from '@/lib/cache/tag';
import { getReportData } from '@/lib/reporting';
import { getCurrentUser } from '@/lib/user/query';
import type { ApiQuery } from '@/types/reporting/query';

export const metadata: Metadata = {
  description: 'All job applications you have submitted.',
  title: 'Applications | Gimme Job',
};

const initialQuery: ApiQuery<
  ApplicationSubmission,
  Prisma.ApplicationSubmissionInclude
> = {
  pagination: { count: 25, start: 0 },
  sort: [{ direction: 'desc', field: 'createdAt' }],
};

async function getApplicationsReportData({ userId }: { userId: string }) {
  'use cache';
  cacheTag(`user:${userId}:report:applications`);
  const { data, pagination } = await getReportData({
    apiQuery: initialQuery,
    model: 'applications',
    userId,
  });
  return { data, totalCount: pagination.total };
}

export const experimental_ppr = true;

export default async function ApplicationsPage() {
  const user = await getCurrentUser();
  if (!user?.id) {
    redirect('/login');
  }
  const { data, totalCount } = await getApplicationsReportData({
    userId: user.id,
  });

  return (
    <Page name="applications">
      <PageHeader
        title="Applications"
        description="Every job application you've submitted, newest first."
      />
      <Suspense fallback={null}>
        <ApplicationsReport
          initialData={
            data as Parameters<typeof ApplicationsReport>[0]['initialData']
          }
          initialQuery={
            initialQuery as Parameters<
              typeof ApplicationsReport
            >[0]['initialQuery']
          }
          totalCount={totalCount}
          showColumnToggle={true}
          showPagination={true}
          showSearch={false}
        />
      </Suspense>
    </Page>
  );
}
