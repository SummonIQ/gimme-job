import { LinkedInAutomationDashboard } from '@/components/automation/linkedin-automation-dashboard';
import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { LinkedInConnectionDashboard } from '@/components/linkedin/linkedin-connection-dashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getCurrentUser } from '@/lib/user/query';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'LinkedIn Automation | Gimme Job',
  description:
    'Automate your LinkedIn job applications and connection outreach',
};

export default async function LinkedInAutomationPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <Page name="linkedin-automation">
      <PageHeader
        title="LinkedIn Automation"
        description="Automate your LinkedIn job applications and connection outreach"
      />
      <PageContent>
        <Tabs defaultValue="applications" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="applications">Job Applications</TabsTrigger>
            <TabsTrigger value="connections">Connection Outreach</TabsTrigger>
          </TabsList>

          <TabsContent value="applications" className="space-y-6">
            <LinkedInAutomationDashboard />
          </TabsContent>

          <TabsContent value="connections" className="space-y-6">
            <LinkedInConnectionDashboard />
          </TabsContent>
        </Tabs>
      </PageContent>
    </Page>
  );
}
