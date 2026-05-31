'use client';

import NumberFlow from '@number-flow/react';
import {
  Activity,
  Briefcase,
  ChevronRight,
  Database,
  FileText,
  Target,
  Users,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

import { AdminPageShell } from './_components/admin-page-shell';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminDashboardProps {
  userId: string;
  stats: {
    funnel: {
      totalListings: number;
      totalLeads: number;
      totalApplications: number;
      interviewCount: number;
      offerCount: number;
      listingToLeadRate: number;
      leadToAppRate: number;
      appToInterviewRate: number;
      interviewToOfferRate: number;
    };
    activity24h: {
      listings: number;
      leads: number;
      applications: number;
      resumes: number;
      notifications: number;
    };
    trends: {
      listings7d: number;
      listings30d: number;
      leads7d: number;
      applications7d: number;
    };
    pipeline: {
      leadsApplied: number;
      leadsDismissed: number;
      leadsActive: number;
    };
    resumeHealth: {
      totalResumes: number;
      analysesCompleted: number;
      analysesFailed: number;
      optimizationsCompleted: number;
      avgScore: number;
    };
    applications: {
      total: number;
      submitted: number;
      pending: number;
      failed: number;
      automated: number;
      manualCount: number;
    };
    users: {
      total: number;
      new7d: number;
      activeSessions: number;
      activeSubscriptions: number;
    };
    automation: {
      scheduledApps: number;
      auditLogs24h: number;
    };
    budget: {
      cycleStart: string;
      cycleEnd: string;
      jobsUsed: number;
      jobsLimit: number;
      requestsUsed: number;
      requestsLimit: number;
      projectedJobsUsed: number;
      projectedRequestsUsed: number;
    };
    providerDaily: Record<string, number>;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FunnelStage = ({
  count,
  label,
  rate,
  rateLabel,
  icon: Icon,
  href,
}: {
  count: number;
  label: string;
  rate?: number;
  rateLabel?: string;
  icon: typeof Database;
  href: string;
}) => (
  <Link
    href={href}
    className="group relative flex flex-1 flex-col items-center rounded-lg border border-border/60 bg-card p-4 transition-colors hover:border-primary/30 hover:bg-accent/30"
  >
    <div className="flex items-center gap-1.5">
      <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
      <NumberFlow
        value={count}
        className="font-mono text-2xl font-bold"
        format={{ useGrouping: true }}
      />
    </div>
    <span className="mt-0.5 text-xs text-muted-foreground">{label}</span>
    {rate !== undefined ? (
      <span className="mt-1 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        {rate}% {rateLabel}
      </span>
    ) : null}
  </Link>
);

const MiniStat = ({
  label,
  value,
  href,
}: {
  label: string;
  value: number | string;
  href?: string;
}) => {
  const inner = (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 transition-colors hover:border-primary/20">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="font-mono text-lg font-semibold leading-tight">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AdminDashboard = ({ userId: _userId, stats }: AdminDashboardProps) => {
  const jobsBudgetPercent =
    stats.budget.jobsLimit > 0
      ? Math.min(
          100,
          Math.round((stats.budget.jobsUsed / stats.budget.jobsLimit) * 100),
        )
      : 0;
  const requestsBudgetPercent =
    stats.budget.requestsLimit > 0
      ? Math.min(
          100,
          Math.round(
            (stats.budget.requestsUsed / stats.budget.requestsLimit) * 100,
          ),
        )
      : 0;

  return (
    <AdminPageShell
      title="Dashboard"
      description="Platform-wide funnel, health KPIs, and activity overview."
    >
      {/* ━━━━ PLATFORM FUNNEL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Platform Funnel</CardTitle>
          <CardDescription>
            End-to-end pipeline from ingestion to offers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-stretch gap-2">
            <FunnelStage
              count={stats.funnel.totalListings}
              label="Listings"
              icon={Database}
              href="/admin/listings"
            />
            <div className="flex items-center">
              <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
            </div>
            <FunnelStage
              count={stats.funnel.totalLeads}
              label="Leads"
              rate={stats.funnel.listingToLeadRate}
              rateLabel="conv"
              icon={Target}
              href="/admin/leads"
            />
            <div className="flex items-center">
              <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
            </div>
            <FunnelStage
              count={stats.funnel.totalApplications}
              label="Applications"
              rate={stats.funnel.leadToAppRate}
              rateLabel="conv"
              icon={Briefcase}
              href="/admin/applications"
            />
            <div className="flex items-center">
              <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
            </div>
            <FunnelStage
              count={stats.funnel.interviewCount}
              label="Interviews"
              rate={stats.funnel.appToInterviewRate}
              rateLabel="conv"
              icon={Activity}
              href="/admin/applications"
            />
            <div className="flex items-center">
              <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
            </div>
            <FunnelStage
              count={stats.funnel.offerCount}
              label="Offers"
              rate={stats.funnel.interviewToOfferRate}
              rateLabel="conv"
              icon={Zap}
              href="/admin/applications"
            />
          </div>
        </CardContent>
      </Card>

      {/* ━━━━ 24H ACTIVITY + TRENDS ━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>24h Activity</CardTitle>
            <CardDescription>
              Platform activity in the last 24 hours.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2">
              <MiniStat
                label="Listings"
                value={stats.activity24h.listings}
                href="/admin/listings"
              />
              <MiniStat
                label="Leads"
                value={stats.activity24h.leads}
                href="/admin/leads"
              />
              <MiniStat
                label="Applications"
                value={stats.activity24h.applications}
                href="/admin/applications"
              />
              <MiniStat
                label="Resumes"
                value={stats.activity24h.resumes}
                href="/admin/resumes"
              />
              <MiniStat
                label="Notifications"
                value={stats.activity24h.notifications}
                href="/admin/notifications"
              />
            </div>

            <Separator className="my-4" />

            {Object.keys(stats.providerDaily).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No provider activity in the last 24h. Run a scrape from Data →
                Job Listings → Manual tab to ingest listings.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(stats.providerDaily).map(
                  ([provider, count]) => (
                    <div
                      key={provider}
                      className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
                    >
                      <span className="text-xs font-medium">{provider}</span>
                      <span className="font-mono text-sm font-semibold">
                        {count.toLocaleString()}
                      </span>
                    </div>
                  ),
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>7-Day Trends</CardTitle>
            <CardDescription>
              Weekly volume across pipeline stages.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                {
                  label: 'Listings ingested',
                  value: stats.trends.listings7d,
                  total: stats.funnel.totalListings,
                  href: '/admin/listings',
                },
                {
                  label: 'Leads created',
                  value: stats.trends.leads7d,
                  total: stats.funnel.totalLeads,
                  href: '/admin/leads',
                },
                {
                  label: 'Applications submitted',
                  value: stats.trends.applications7d,
                  total: stats.funnel.totalApplications,
                  href: '/admin/applications',
                },
              ].map(row => {
                const pct =
                  row.total > 0
                    ? Math.min(100, Math.round((row.value / row.total) * 100))
                    : 0;
                return (
                  <Link
                    key={row.label}
                    href={row.href}
                    className="block space-y-1.5 rounded-lg border border-border/60 p-3 transition-colors hover:border-primary/20"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{row.label}</span>
                      <span className="font-mono text-muted-foreground">
                        {row.value.toLocaleString()}{' '}
                        <span className="text-xs">({pct}% of total)</span>
                      </span>
                    </div>
                    <Progress value={pct} />
                  </Link>
                );
              })}
            </div>

            <Separator className="my-4" />

            <div className="text-xs text-muted-foreground">
              30-day listings:{' '}
              <span className="font-mono font-medium text-foreground">
                {stats.trends.listings30d.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ━━━━ HEALTH INDICATORS ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Resume Health */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-orange-500" />
              <CardTitle>Resume Health</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <MiniStat
                label="Total Resumes"
                value={stats.resumeHealth.totalResumes}
                href="/admin/resumes"
              />
              <MiniStat
                label="Avg Score"
                value={
                  stats.resumeHealth.avgScore > 0
                    ? `${stats.resumeHealth.avgScore}/100`
                    : 'N/A'
                }
              />
              <MiniStat
                label="Analyses Done"
                value={stats.resumeHealth.analysesCompleted}
              />
              <MiniStat
                label="Optimizations"
                value={stats.resumeHealth.optimizationsCompleted}
              />
            </div>
            {stats.resumeHealth.analysesFailed > 0 ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs">
                <span className="font-medium text-red-600">
                  {stats.resumeHealth.analysesFailed} failed analyses
                </span>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Application Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-primary" />
              <CardTitle>Applications</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <MiniStat
                label="Submitted"
                value={stats.applications.submitted}
                href="/admin/applications"
              />
              <MiniStat label="Pending" value={stats.applications.pending} />
              <MiniStat
                label="Automated"
                value={stats.applications.automated}
                href="/admin/applications"
              />
              <MiniStat label="Manual" value={stats.applications.manualCount} />
            </div>
            {stats.applications.failed > 0 ? (
              <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs">
                <span className="font-medium text-orange-600">
                  {stats.applications.failed} in failure bucket
                </span>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Users & Platform */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-green-500" />
              <CardTitle>Users & Platform</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <MiniStat
                label="Total Users"
                value={stats.users.total}
                href="/admin/users"
              />
              <MiniStat label="New (7d)" value={stats.users.new7d} />
              <MiniStat
                label="Active Sessions"
                value={stats.users.activeSessions}
                href="/admin/user-activity"
              />
              <MiniStat
                label="Paid Subs"
                value={stats.users.activeSubscriptions}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ━━━━ AUTOMATION + BUDGET ━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Automation Health */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-500" />
              <CardTitle>Automation & Ops</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              <MiniStat
                label="Scheduled Queue"
                value={stats.automation.scheduledApps}
                href="/admin/applications"
              />
              <MiniStat
                label="Audit Logs (24h)"
                value={stats.automation.auditLogs24h}
              />
              <MiniStat
                label="Lead Pipeline"
                value={stats.pipeline.leadsActive}
                href="/admin/leads"
              />
            </div>

            <Separator className="my-4" />

            <div className="grid grid-cols-2 gap-2">
              <MiniStat
                label="Leads Applied"
                value={stats.pipeline.leadsApplied}
              />
              <MiniStat
                label="Leads Dismissed"
                value={stats.pipeline.leadsDismissed}
              />
            </div>
          </CardContent>
        </Card>

        {/* Fantastic Budget */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Fantastic Budget</CardTitle>
            <CardDescription className="text-xs">
              {new Date(stats.budget.cycleStart).toLocaleDateString()} –{' '}
              {new Date(stats.budget.cycleEnd).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Jobs</span>
                <span className="font-mono">
                  {stats.budget.jobsUsed.toLocaleString()} /{' '}
                  {stats.budget.jobsLimit.toLocaleString()}
                </span>
              </div>
              <Progress value={jobsBudgetPercent} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Requests</span>
                <span className="font-mono">
                  {stats.budget.requestsUsed.toLocaleString()} /{' '}
                  {stats.budget.requestsLimit.toLocaleString()}
                </span>
              </div>
              <Progress value={requestsBudgetPercent} />
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-2">
              <MiniStat
                label="Projected Jobs"
                value={stats.budget.projectedJobsUsed}
              />
              <MiniStat
                label="Projected Requests"
                value={stats.budget.projectedRequestsUsed}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminPageShell>
  );
};
AdminDashboard.displayName = 'AdminDashboard';

export { AdminDashboard };
