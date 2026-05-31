'use client';

import { MoreHorizontal } from 'lucide-react';

import { AnalyticsOverview } from '@/components/analytics/overview';
import { RecentApplications } from '@/components/dashboard/recent-applications';
import { SubmissionStats } from '@/components/dashboard/submission-stats';
import { Page } from '@/components/layout/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { Suspense } from 'react';

const DASHBOARD_LAYOUT_STORAGE_PREFIXES: readonly string[] = [
  'gimme-job.dashboard.onboarding.widgets',
  'gimme-job.dashboard.performance.widgets.v3',
];
const DASHBOARD_LAYOUT_STORAGE_SUFFIXES: readonly string[] = [
  '.order.v1',
  '.sizes.v1',
  '.rows.v1',
];

function resetDashboardLayout() {
  if (typeof window === 'undefined') return;
  for (const prefix of DASHBOARD_LAYOUT_STORAGE_PREFIXES) {
    for (const suffix of DASHBOARD_LAYOUT_STORAGE_SUFFIXES) {
      window.localStorage.removeItem(`${prefix}${suffix}`);
    }
  }
  window.location.reload();
}

export function DashboardClient() {
  return (
    <Page
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label="Dashboard options"
              className="size-8 rounded-full p-0"
              variant="outline"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={resetDashboardLayout}>
              Reset layout to default
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
      description="Welcome back. Here's a summary of your job search progress."
      name="dashboard"
      title="Dashboard"
    >
      <div className="space-y-6">
        <SubmissionStats timeframe="30d" />
        <RecentApplications limit={10} />
        <Suspense fallback={<DashboardOverviewSkeleton />}>
          <AnalyticsOverview timeframe="30d" />
        </Suspense>
      </div>
    </Page>
  );
}

function DashboardOverviewSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
        <div>
          <CardTitle className="text-lg font-medium">
            <div className="inline-block h-[1.125rem] w-[160px] animate-pulse rounded bg-muted" />
          </CardTitle>
          <CardDescription>
            <div className="inline-block h-[0.875rem] w-[260px] animate-pulse rounded bg-muted" />
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="card-content-blur space-y-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="metric-card-bg rounded-lg p-3" key={index}>
              <div className="mb-1.5 h-2.5 w-[80px] animate-pulse rounded bg-muted" />
              <div className="mb-1 h-7 w-[48px] animate-pulse rounded bg-muted" />
              <div className="h-3 w-[120px] animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="metric-card-bg rounded-lg p-3" key={index + 4}>
              <div className="mb-1.5 h-2.5 w-[90px] animate-pulse rounded bg-muted" />
              <div className="mb-1.5 h-7 w-[56px] animate-pulse rounded bg-muted" />
              <Progress className="h-1.5" value={0}>
                <div className="h-1.5 w-full animate-pulse rounded-full bg-muted" />
              </Progress>
              <div className="mt-1.5 h-3 w-[140px] animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="metric-card-bg rounded-lg p-3" key={index + 8}>
              <div className="mb-2.5 h-2.5 w-[100px] animate-pulse rounded bg-muted" />
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((__, rowIndex) => (
                  <div
                    className="flex items-center justify-between"
                    key={rowIndex}
                  >
                    <div className="h-[0.875rem] w-[120px] animate-pulse rounded bg-muted" />
                    <Badge variant="secondary">
                      <div className="inline-block h-[0.875rem] w-[80px] animate-pulse rounded bg-muted" />
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
