import {
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AutomationApprovalQueue } from '@/components/automation/automation-approval-queue';
import { AutomationAuditLog } from '@/components/automation/automation-audit-log';
import { AutomationEmergencyControls } from '@/components/automation/automation-emergency-controls';
import { AutomationSafetySettings } from '@/components/automation/automation-safety-settings';
import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export const metadata: Metadata = {
  title: 'Automation Safety Controls | gimme job',
  description:
    'Comprehensive safety controls and monitoring for application automation.',
};

export default function AutomationSafetyPage() {
  return (
    <Page name="automation-safety">
      <PageHeader
        title="Automation Safety Controls"
        description="Comprehensive safety controls, approval workflows, and monitoring to ensure responsible automation practices."
      />
      <PageContent>
        <Separator className="mb-6 bg-border/60" orientation="horizontal" />

        {/* Safety Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Safety Status</p>
                  <p className="text-lg font-semibold text-green-600">
                    Protected
                  </p>
                </div>
                <ShieldCheck className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Pending Approvals
                  </p>
                  <p className="text-lg font-semibold">0</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Audit Log Entries
                  </p>
                  <p className="text-lg font-semibold">24h</p>
                </div>
                <FileText className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Safety Settings & Emergency Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Safety Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Safety Settings
                </CardTitle>
                <CardDescription>
                  Configure comprehensive safety measures and filtering controls
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<div>Loading safety settings...</div>}>
                  <AutomationSafetySettings />
                </Suspense>
              </CardContent>
            </Card>

            {/* Application Approval Queue */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Application Approval Queue
                </CardTitle>
                <CardDescription>
                  Review and approve applications before they are submitted
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<div>Loading approval queue...</div>}>
                  <AutomationApprovalQueue />
                </Suspense>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Emergency Controls & Status */}
          <div className="space-y-6">
            {/* Emergency Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Emergency Controls
                </CardTitle>
                <CardDescription>
                  Immediate controls to pause or stop automation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<div>Loading emergency controls...</div>}>
                  <AutomationEmergencyControls settings={null} />
                </Suspense>
              </CardContent>
            </Card>

            {/* Safety Features Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Active Safety Features</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">User Approval Required</span>
                  <Badge variant="secondary">Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Duplicate Prevention</span>
                  <Badge variant="secondary">Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Rate Limiting</span>
                  <Badge variant="secondary">10/hour</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Emergency Stop</span>
                  <Badge variant="outline">Ready</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Audit Logging</span>
                  <Badge variant="secondary">Active</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Audit Log Section */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Audit Log & Monitoring
              </CardTitle>
              <CardDescription>
                Complete history of all automation actions and safety decisions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div>Loading audit log...</div>}>
                <AutomationAuditLog />
              </Suspense>
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </Page>
  );
}
