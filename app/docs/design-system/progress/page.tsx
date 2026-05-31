import { JobLeadStatus } from '@/generated/prisma/browser';

import { JobLeadProgress } from '@/components/job-leads/job-lead-progress';
import {
  Page,
  PageActions,
  PageContent,
  PageDescription,
  PageHeader,
  PageSummary,
  PageTitle,
} from '@/components/layout/page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThemeModeToggle } from '@/components/ui/theme-mode-toggle';

export default function ProgressTrackerPage() {
  const jobLeadStatuses = Object.values(JobLeadStatus);

  return (
    <Page>
      <PageHeader>
        <PageSummary>
          <PageTitle>Progress Tracker</PageTitle>
          <PageDescription>
            Visual progress indicators for multi-step workflows
          </PageDescription>
        </PageSummary>
        <PageActions>
          <div className="flex flex-row items-center gap-2">
            <span className="text-xs text-muted-foreground">Theme:</span>
            <ThemeModeToggle />
          </div>
        </PageActions>
      </PageHeader>
      <PageContent className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Job Lead Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="preview">
              <TabsList>
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="code">Code</TabsTrigger>
              </TabsList>
              <TabsContent value="preview">
                <div className="space-y-6 mt-4">
                  {jobLeadStatuses.map(status => (
                    <div key={status} className="space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">
                        Status: {status}
                      </div>
                      <JobLeadProgress status={status} />
                    </div>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="code">
                <div className="bg-muted p-4 rounded-lg mt-4">
                  <pre className="text-sm overflow-x-auto">
{`import { JobLeadProgress } from '@/components/job-leads/job-lead-progress';
import { JobLeadStatus } from '@/generated/prisma/browser';

<JobLeadProgress status={JobLeadStatus.APPLIED} />
<JobLeadProgress status={JobLeadStatus.INTERVIEWING} />
<JobLeadProgress status={JobLeadStatus.OFFER_RECEIVED} />`}
                  </pre>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded">
                <code className="font-mono text-sm">status: JobLeadStatus</code> - Current status
                of the job lead
              </div>
              <p className="text-sm text-muted-foreground">
                The progress tracker automatically highlights the current step and all previous
                steps in the workflow.
              </p>
            </div>
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
