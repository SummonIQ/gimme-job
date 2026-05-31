import { JobSearchPerformanceDashboard } from '@/components/analytics/job-search-performance-dashboard';
import { Page, PageContent, PageHeader } from '@/components/layout/page';

export default function PerformancePage() {
  return (
    <Page name="analytics-performance" title="Search Performance">
      <PageHeader
        title="Search Performance"
        description="Comprehensive search analytics"
      />
      <PageContent>
        <JobSearchPerformanceDashboard />
      </PageContent>
    </Page>
  );
}
