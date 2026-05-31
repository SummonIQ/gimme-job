import { Activity } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AutomationAnalyticsDashboard } from '@/components/automation/automation-analytics-dashboard';
import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { Separator } from '@/components/ui/separator';

export const metadata: Metadata = {
  title: 'Automation Analytics | gimme job',
  description:
    'Track your automation performance, success rates, and ROI with comprehensive analytics.',
};

export default function AutomationAnalyticsPage() {
  return (
    <Page name="automation-analytics">
      <PageHeader
        title="Automation Analytics"
        description="Monitor your automation performance with real-time metrics, platform insights, and ROI tracking."
      />
      <PageContent>
        <Separator className="mb-6 bg-border/60" orientation="horizontal" />

        <Suspense
          fallback={
            <div className="flex items-center justify-center h-64">
              <Activity className="h-8 w-8 animate-pulse text-muted-foreground" />
            </div>
          }
        >
          <AutomationAnalyticsDashboard />
        </Suspense>
      </PageContent>
    </Page>
  );
}
