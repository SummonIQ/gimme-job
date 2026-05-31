import { ResumeMetrics } from '@/components/analytics/resume-metrics';
import { Page, PageContent, PageHeader } from '@/components/layout/page';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function ResumesPage() {
  return (
    <Page name="analytics-resumes" title="Resume Performance">
      <PageHeader
        title="Resume Performance"
        description="Resume optimization and scores"
      />
      <PageContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Resume Optimization Scores</CardTitle>
              <CardDescription>
                Track improvements in your resume optimization scores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResumeMetrics />
            </CardContent>
          </Card>
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Top Performing Resumes</CardTitle>
              <CardDescription>
                Resumes with the highest optimization scores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResumeMetrics type="top-performing" />
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </Page>
  );
}
