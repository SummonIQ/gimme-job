import { JobSearchMetrics } from '@/components/analytics/job-search-metrics';
import { Page, PageContent, PageHeader } from '@/components/layout/page';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function JobSearchesPage() {
  return (
    <Page name="analytics-job-searches" title="Job Searches">
      <PageHeader
        title="Job Searches"
        description="Search effectiveness metrics"
      />
      <PageContent>
        <div className="p-8">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Search Success Rate</CardTitle>
                <CardDescription>
                  Performance of your job searches over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <JobSearchMetrics />
              </CardContent>
            </Card>
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Top Search Terms</CardTitle>
                <CardDescription>
                  Most frequently used search terms and their effectiveness
                </CardDescription>
              </CardHeader>
              <CardContent>
                <JobSearchMetrics type="search-terms" />
              </CardContent>
            </Card>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
