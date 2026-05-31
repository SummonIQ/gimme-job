import { InterviewPerformanceTracker } from '@/components/analytics/interview-performance-tracker';
import { Page, PageContent, PageHeader } from '@/components/layout/page';

export default function InterviewsPage() {
  return (
    <Page name="analytics-interviews" title="Interview Performance">
      <PageHeader
        title="Interview Performance"
        description="Track your interview success and identify areas for improvement"
      />
      <PageContent>
        <InterviewPerformanceTracker />
      </PageContent>
    </Page>
  );
}
