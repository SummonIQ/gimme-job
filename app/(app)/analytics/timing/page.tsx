import { ApplicationTimingAnalytics } from '@/components/analytics/application-timing-analytics';
import { Page, PageContent, PageHeader } from '@/components/layout/page';

export default function TimingPage() {
  return (
    <Page name="analytics-timing" title="Application Timing">
      <PageHeader
        title="Application Timing"
        description="Best times to apply"
      />
      <PageContent>
        <ApplicationTimingAnalytics />
      </PageContent>
    </Page>
  );
}
