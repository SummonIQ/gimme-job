import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ComprehensiveAutomationDashboard } from '@/components/automation/comprehensive-automation-dashboard';
import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { UpgradePrompt } from '@/components/subscription/upgrade-prompt';
import { hasActiveSubscription } from '@/lib/stripe/subscription';
import { getCurrentUser } from '@/lib/user/query';

export const metadata: Metadata = {
  title: 'Application Automation | gimme job',
  description:
    'Automate your job application process with intelligent workflows, scheduling, analytics, and error monitoring.',
};

export default async function AutomationPage() {
  const user = await getCurrentUser();
  const isProSubscriber = user ? await hasActiveSubscription(user.id) : false;

  return (
    <Page name="automation">
      <PageHeader
        title="Application Automation"
        description="Comprehensive automation platform with intelligent scheduling, multi-platform support, analytics, and error monitoring."
      />
      <PageContent>
        {!isProSubscriber ? (
          <div className="mx-auto max-w-md py-12">
            <UpgradePrompt
              feature="Automated Application Submission"
              description="Automate your job applications with intelligent scheduling, multi-platform support, and real-time analytics. Upgrade to Pro to unlock."
            />
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                  <p className="text-muted-foreground">
                    Loading automation dashboard...
                  </p>
                </div>
              </div>
            }
          >
            <ComprehensiveAutomationDashboard />
          </Suspense>
        )}
      </PageContent>
    </Page>
  );
}
