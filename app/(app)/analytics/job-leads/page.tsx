import { JobLeadMetrics } from '@/components/analytics/job-lead-metrics';
import { Page, PageContent, PageHeader } from '@/components/layout/page';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function JobLeadsPage() {
  return (
    <Page name="analytics-job-leads" title="Job Applications">
      <PageHeader
        title="Job Applications"
        description="Application status and tracking"
      />
      <PageContent>
        <div className="p-8">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Application Status Distribution</CardTitle>
                <CardDescription>
                  Track the status of your job applications over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <JobLeadMetrics />
              </CardContent>
            </Card>
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Top Companies</CardTitle>
                <CardDescription>
                  Companies you've applied to most frequently
                </CardDescription>
              </CardHeader>
              <CardContent>
                <JobLeadMetrics type="companies" />
              </CardContent>
            </Card>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
