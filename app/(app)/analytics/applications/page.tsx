import { Activity, BarChart3, PieChart, Target } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ApplicationMetricsOverview } from '@/components/analytics/application-metrics-overview';
import { ApplicationTimeline } from '@/components/analytics/application-timeline';
import { ConversionFunnel } from '@/components/analytics/conversion-funnel';
import { OutcomeDistribution } from '@/components/analytics/outcome-distribution';
import { PlatformComparison } from '@/components/analytics/platform-comparison';
import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export const metadata: Metadata = {
  title: 'Application Analytics | gimme job',
  description:
    'Track your job application performance with detailed analytics and insights.',
};

export default function ApplicationAnalyticsPage() {
  return (
    <Page name="application-analytics" title="Application Analytics">
      <PageHeader
        title="Application Analytics"
        description="Track your job application outcomes, response rates, and conversion metrics to optimize your job search strategy."
      />

      <PageContent>
        <Separator className="mb-6 bg-border/60" orientation="horizontal" />

        {/* Key Metrics Overview */}
        <Suspense fallback={<div>Loading metrics...</div>}>
          <ApplicationMetricsOverview />
        </Suspense>

        {/* Main Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Conversion Funnel */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Application Conversion Funnel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div>Loading funnel...</div>}>
                <ConversionFunnel />
              </Suspense>
            </CardContent>
          </Card>

          {/* Platform Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Performance by Platform
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div>Loading platform data...</div>}>
                <PlatformComparison />
              </Suspense>
            </CardContent>
          </Card>

          {/* Outcome Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Outcome Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div>Loading outcomes...</div>}>
                <OutcomeDistribution />
              </Suspense>
            </CardContent>
          </Card>

          {/* Application Timeline */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Application Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div>Loading timeline...</div>}>
                <ApplicationTimeline />
              </Suspense>
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </Page>
  );
}
