import { Bell, Calendar, Clock, Shield } from 'lucide-react';
import type { Metadata } from 'next';

import { AutomationNotificationSettings } from '@/components/automation/automation-notification-settings';
import { AutomationRateLimitSettings } from '@/components/automation/automation-rate-limit-settings';
import { AutomationSafetySettings } from '@/components/automation/automation-safety-settings';
import { AutomationSchedulingSettings } from '@/components/automation/automation-scheduling-settings';
import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { Separator } from '@/components/ui/separator';

export const metadata: Metadata = {
  title: 'Automation Settings | gimme job',
  description:
    'Configure automation safety controls, rate limits, and notification preferences.',
};

export default function AutomationSettingsPage() {
  return (
    <Page name="automation-settings">
      <PageHeader
        title="Automation Settings"
        description="Configure safety controls, rate limits, and notification preferences for your application automation."
      />
      <PageContent>
        <Separator className="mb-6 bg-border/60" orientation="horizontal" />

        <div className="space-y-8">
          {/* Safety Controls */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Safety Controls</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Configure safety measures to prevent unwanted applications and
              ensure responsible automation.
            </p>
            <AutomationSafetySettings />
          </section>

          <Separator />

          {/* Rate Limiting */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Rate Limiting</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Set limits on how many applications can be submitted per hour and
              per day.
            </p>
            <AutomationRateLimitSettings />
          </section>

          <Separator />

          {/* Scheduling Settings */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Smart Scheduling</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Configure intelligent scheduling to optimize application
              submission timing.
            </p>
            <AutomationSchedulingSettings />
          </section>

          <Separator />

          {/* Notifications */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Bell className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Notifications</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Configure how and when you want to be notified about automation
              activity.
            </p>
            <AutomationNotificationSettings />
          </section>
        </div>
      </PageContent>
    </Page>
  );
}
