import {
  ApplicationStatus,
  GuidedApplicationStatus,
} from '@/generated/prisma/browser';

import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { db } from '@/lib/db/client';

import { AdminPageShell } from '../_components/admin-page-shell';
import { AdminStatCard } from '../_components/admin-stat-card';
import { requireAdminUser } from '../require-admin-user';

const statusLabels: Record<ApplicationStatus, string> = {
  PENDING: 'Pending',
  SUBMITTED: 'Submitted',
  FAILED: 'Failed',
  REJECTED: 'Rejected',
  UNDER_REVIEW: 'Under Review',
  INTERVIEW_REQUESTED: 'Interview Requested',
  INTERVIEW_SCHEDULED: 'Interview Scheduled',
  INTERVIEW_COMPLETED: 'Interview Completed',
  OFFER_RECEIVED: 'Offer Received',
  OFFER_ACCEPTED: 'Offer Accepted',
  OFFER_REJECTED: 'Offer Rejected',
  WITHDRAWN: 'Withdrawn',
  NOT_SELECTED: 'Not Selected',
};

const guidedStatusLabels: Record<GuidedApplicationStatus, string> = {
  DRAFT: 'Draft',
  IN_PROGRESS: 'In Progress',
  PAUSED: 'Paused',
  ANALYZING: 'Analyzing',
  READY_TO_SUBMIT: 'Ready to Submit',
  SUBMITTING: 'Submitting',
  SUBMITTED: 'Submitted',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
};

const guidedStatusColors: Record<GuidedApplicationStatus, string> = {
  DRAFT: 'bg-slate-400',
  IN_PROGRESS: 'bg-blue-400',
  PAUSED: 'bg-amber-400',
  ANALYZING: 'bg-indigo-400',
  READY_TO_SUBMIT: 'bg-emerald-400',
  SUBMITTING: 'bg-violet-400',
  SUBMITTED: 'bg-green-500',
  FAILED: 'bg-red-400',
  CANCELLED: 'bg-gray-400',
};

export default async function AdminApplicationsPage() {
  await requireAdminUser();

  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const [
    // Overall stats
    totalSubmissions,
    submittedCount,
    pendingCount,
    failedCount,
    submissions7d,
    interviewRequestedCount,
    interviewScheduledCount,
    interviewCompletedCount,
    offerReceivedCount,
    offerAcceptedCount,
    offerRejectedCount,
    withdrawnCount,
    underReviewCount,
    automatedCount,
    avgResponseTime,
    avgInterviewCount,
    statusDistribution,
    recentSubmissions,
    // AI Assist (Guided) stats
    totalGuided,
    guidedSubmitted,
    guidedFailed,
    guidedCancelled,
    guidedInProgress,
    guidedDraft,
    guided7d,
    guided30d,
    guidedStatusDist,
    guidedAvgSteps,
    guidedAvgProgress,
    guidedByProvider,
    recentGuided,
    // Automated stats
    automatedSubmissions,
    automatedFailed,
    automated7d,
    automatedByStatus,
    recentAutomated,
  ] = await Promise.all([
    // Overall
    db.applicationSubmission.count(),
    db.applicationSubmission.count({ where: { status: ApplicationStatus.SUBMITTED } }),
    db.applicationSubmission.count({ where: { status: ApplicationStatus.PENDING } }),
    db.applicationSubmission.count({
      where: { status: { in: [ApplicationStatus.FAILED, ApplicationStatus.REJECTED, ApplicationStatus.NOT_SELECTED] } },
    }),
    db.applicationSubmission.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    db.applicationSubmission.count({ where: { status: ApplicationStatus.INTERVIEW_REQUESTED } }),
    db.applicationSubmission.count({ where: { status: ApplicationStatus.INTERVIEW_SCHEDULED } }),
    db.applicationSubmission.count({ where: { status: ApplicationStatus.INTERVIEW_COMPLETED } }),
    db.applicationSubmission.count({ where: { status: ApplicationStatus.OFFER_RECEIVED } }),
    db.applicationSubmission.count({ where: { status: ApplicationStatus.OFFER_ACCEPTED } }),
    db.applicationSubmission.count({ where: { status: ApplicationStatus.OFFER_REJECTED } }),
    db.applicationSubmission.count({ where: { status: ApplicationStatus.WITHDRAWN } }),
    db.applicationSubmission.count({ where: { status: ApplicationStatus.UNDER_REVIEW } }),
    db.applicationSubmission.count({ where: { wasAutomated: true } }),
    db.applicationSubmission.aggregate({ _avg: { daysToResponse: true }, where: { daysToResponse: { not: null } } }),
    db.applicationSubmission.aggregate({ _avg: { interviewCount: true }, where: { interviewCount: { gt: 0 } } }),
    db.applicationSubmission.groupBy({ by: ['status'], _count: true }),
    db.applicationSubmission.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 15,
      select: {
        createdAt: true, id: true, wasAutomated: true, daysToResponse: true, interviewCount: true,
        jobLead: { select: { jobListing: { select: { company: true } }, title: true } },
        status: true, updatedAt: true, user: { select: { email: true } },
        guidedApplication: { select: { id: true, status: true, progress: true } },
      },
    }),
    // AI Assist
    db.guidedApplication.count(),
    db.guidedApplication.count({ where: { status: GuidedApplicationStatus.SUBMITTED } }),
    db.guidedApplication.count({ where: { status: GuidedApplicationStatus.FAILED } }),
    db.guidedApplication.count({ where: { status: GuidedApplicationStatus.CANCELLED } }),
    db.guidedApplication.count({ where: { status: GuidedApplicationStatus.IN_PROGRESS } }),
    db.guidedApplication.count({ where: { status: GuidedApplicationStatus.DRAFT } }),
    db.guidedApplication.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    db.guidedApplication.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.guidedApplication.groupBy({ by: ['status'], _count: true }),
    db.guidedApplication.aggregate({ _avg: { totalSteps: true }, where: { totalSteps: { not: null } } }),
    db.guidedApplication.aggregate({ _avg: { progress: true } }),
    db.guidedApplication.groupBy({ by: ['jobProvider'], _count: true, orderBy: { _count: { jobProvider: 'desc' } } }),
    db.guidedApplication.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 15,
      select: {
        id: true, status: true, company: true, jobTitle: true, jobProvider: true,
        progress: true, currentStep: true, totalSteps: true, errorMessage: true,
        createdAt: true, updatedAt: true, submittedAt: true, completedAt: true,
        user: { select: { email: true } },
      },
    }),
    // Automated
    db.applicationSubmission.count({ where: { wasAutomated: true } }),
    db.applicationSubmission.count({ where: { wasAutomated: true, status: ApplicationStatus.FAILED } }),
    db.applicationSubmission.count({ where: { wasAutomated: true, createdAt: { gte: sevenDaysAgo } } }),
    db.applicationSubmission.groupBy({ by: ['status'], _count: true, where: { wasAutomated: true } }),
    db.applicationSubmission.findMany({
      where: { wasAutomated: true },
      orderBy: { updatedAt: 'desc' },
      take: 15,
      select: {
        createdAt: true, id: true, status: true, errorMessage: true,
        jobLead: { select: { jobListing: { select: { company: true } }, title: true } },
        updatedAt: true, user: { select: { email: true } },
      },
    }),
  ]);

  // Derived stats
  const totalInterviews = interviewRequestedCount + interviewScheduledCount + interviewCompletedCount;
  const totalOffers = offerReceivedCount + offerAcceptedCount;
  const interviewRate = totalSubmissions > 0 ? Math.round((totalInterviews / totalSubmissions) * 100) : 0;
  const offerRate = totalSubmissions > 0 ? Math.round((totalOffers / totalSubmissions) * 100) : 0;
  const manualCount = totalSubmissions - automatedCount;
  const statusMap = statusDistribution.reduce((acc, row) => { acc[row.status] = row._count; return acc; }, {} as Record<string, number>);
  const avgRespDays = avgResponseTime._avg.daysToResponse ? `${avgResponseTime._avg.daysToResponse.toFixed(1)}d` : 'N/A';

  // Guided stats
  const guidedSuccessRate = totalGuided > 0 ? Math.round((guidedSubmitted / totalGuided) * 100) : 0;
  const guidedFailRate = totalGuided > 0 ? Math.round((guidedFailed / totalGuided) * 100) : 0;
  const guidedStatusMap = guidedStatusDist.reduce((acc, row) => { acc[row.status] = row._count; return acc; }, {} as Record<string, number>);
  const guidedAvgStepsVal = guidedAvgSteps._avg.totalSteps ? guidedAvgSteps._avg.totalSteps.toFixed(1) : 'N/A';
  const guidedAvgProgressVal = guidedAvgProgress._avg.progress ? `${Math.round(guidedAvgProgress._avg.progress)}%` : 'N/A';

  // Automated stats
  const automatedSuccessRate = automatedSubmissions > 0 ? Math.round(((automatedSubmissions - automatedFailed) / automatedSubmissions) * 100) : 0;
  const automatedStatusMap = automatedByStatus.reduce((acc, row) => { acc[row.status] = row._count; return acc; }, {} as Record<string, number>);

  return (
    <AdminPageShell
      title="Applications"
      description="Submission outcomes, AI Assist analytics, and automation metrics."
    >
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ai-assist">AI Assist</TabsTrigger>
          <TabsTrigger value="automated">Automated</TabsTrigger>
        </TabsList>

        {/* ===== OVERVIEW TAB ===== */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <AdminStatCard title="Total Submissions" value={totalSubmissions.toLocaleString()} helperText={`${submissions7d.toLocaleString()} in last 7d`} />
            <AdminStatCard title="Interview Rate" value={`${interviewRate}%`} helperText={`${totalInterviews.toLocaleString()} interviews`} />
            <AdminStatCard title="Offer Rate" value={`${offerRate}%`} helperText={`${totalOffers.toLocaleString()} offers`} />
            <AdminStatCard title="Avg Response" value={avgRespDays} helperText="days to first response" />
            <AdminStatCard title="AI Assist" value={totalGuided.toLocaleString()} helperText={`${guidedSubmitted} submitted`} />
            <AdminStatCard title="Automated" value={automatedCount.toLocaleString()} helperText={`${automatedSuccessRate}% success`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h2 className="text-lg font-semibold">Status Distribution</h2>
              <p className="mb-4 text-sm text-muted-foreground">Application counts per status.</p>
              <div className="space-y-2.5">
                {Object.values(ApplicationStatus).map(status => {
                  const count = statusMap[status] ?? 0;
                  const pct = totalSubmissions > 0 ? Math.max(2, Math.round((count / totalSubmissions) * 100)) : 0;
                  return (
                    <div key={status} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{statusLabels[status]}</span>
                        <span className="font-mono text-muted-foreground">{count.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted">
                        <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h2 className="mb-3 text-lg font-semibold">Submission Method</h2>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-border/60 p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">AI Assist</p>
                    <p className="font-mono text-lg font-semibold">{totalGuided.toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Automated</p>
                    <p className="font-mono text-lg font-semibold">{automatedCount.toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Manual</p>
                    <p className="font-mono text-lg font-semibold">{manualCount.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="mb-3 text-lg font-semibold">Interview & Offer Pipeline</h2>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Interview Requested', value: interviewRequestedCount },
                    { label: 'Interview Scheduled', value: interviewScheduledCount },
                    { label: 'Interview Completed', value: interviewCompletedCount },
                    { label: 'Under Review', value: underReviewCount },
                    { label: 'Offers Received', value: offerReceivedCount },
                    { label: 'Offers Accepted', value: offerAcceptedCount },
                    { label: 'Offers Rejected', value: offerRejectedCount },
                    { label: 'Withdrawn', value: withdrawnCount },
                  ].map(item => (
                    <div key={item.label} className="rounded-lg border border-border/60 p-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.label}</p>
                      <p className="font-mono text-lg font-semibold leading-tight">{item.value.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Submission Method Comparison */}
          <div>
            <h2 className="text-lg font-semibold">Submission Method Comparison</h2>
            <p className="mb-4 text-sm text-muted-foreground">Volume and success across methods.</p>
            <div className="space-y-4">
              {[
                { label: 'Automated', count: automatedSubmissions, failed: automatedFailed, color: 'bg-primary', failColor: 'bg-red-400' },
                { label: 'AI Assist', count: guidedSubmitted, failed: guidedFailed, color: 'bg-indigo-500', failColor: 'bg-red-400' },
                { label: 'Manual', count: Math.max(0, manualCount - guidedSubmitted), failed: 0, color: 'bg-slate-400', failColor: 'bg-red-400' },
              ].map(method => {
                const total = method.count + method.failed;
                const maxVal = Math.max(automatedSubmissions + automatedFailed, guidedSubmitted + guidedFailed, manualCount, 1);
                const barWidth = (total / maxVal) * 100;
                const successPortion = total > 0 ? (method.count / total) * 100 : 0;
                return (
                  <div key={method.label}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">{method.label}</span>
                      <div className="flex items-center gap-2 font-mono text-muted-foreground">
                        <span>{method.count.toLocaleString()}</span>
                        {method.failed > 0 && <span className="text-red-400">+{method.failed} failed</span>}
                      </div>
                    </div>
                    <div className="h-5 rounded-md overflow-hidden border border-border/40 bg-muted/20" style={{ width: `${Math.max(barWidth, 3)}%` }}>
                      <div className="flex h-full">
                        <div className={`${method.color} h-full`} style={{ width: `${successPortion}%` }} />
                        {method.failed > 0 && <div className={`${method.failColor} opacity-70 h-full`} style={{ width: `${100 - successPortion}%` }} />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            <p className="mb-4 text-sm text-muted-foreground">Latest application events.</p>
            {recentSubmissions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No submissions yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {recentSubmissions.map(s => (
                  <div key={s.id} className="rounded-lg border border-border/60 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-medium">{s.jobLead.title}</p>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge variant="outline">{statusLabels[s.status]}</Badge>
                        {s.guidedApplication ? (
                          <Badge variant="default" className="bg-indigo-500">AI Assist</Badge>
                        ) : s.wasAutomated ? (
                          <Badge variant="default">Auto</Badge>
                        ) : (
                          <Badge variant="secondary">Manual</Badge>
                        )}
                      </div>
                    </div>
                    {s.guidedApplication && (
                      <div className="mt-2 flex items-center gap-2">
                        <Progress value={s.guidedApplication.progress} className="h-1.5 flex-1" />
                        <span className="text-xs font-mono text-muted-foreground">{s.guidedApplication.progress}%</span>
                      </div>
                    )}
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{s.jobLead.jobListing?.company ?? '—'}</span>
                      <span>·</span>
                      <span>{s.user.email}</span>
                      <span>·</span>
                      <span>{new Date(s.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ===== AI ASSIST TAB ===== */}
        <TabsContent value="ai-assist" className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <AdminStatCard title="Total Sessions" value={totalGuided.toLocaleString()} helperText={`${guided7d} in 7d · ${guided30d} in 30d`} />
            <AdminStatCard title="Submitted" value={guidedSubmitted.toLocaleString()} helperText={`${guidedSuccessRate}% success rate`} />
            <AdminStatCard title="Failed" value={guidedFailed.toLocaleString()} helperText={`${guidedFailRate}% failure rate`} />
            <AdminStatCard title="In Progress" value={guidedInProgress.toLocaleString()} helperText={`${guidedDraft} drafts`} />
            <AdminStatCard title="Avg Steps" value={guidedAvgStepsVal} helperText="steps per application" />
            <AdminStatCard title="Avg Progress" value={guidedAvgProgressVal} helperText="completion at exit" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Status Funnel */}
            <div>
              <h2 className="text-lg font-semibold">AI Assist Funnel</h2>
              <p className="mb-4 text-sm text-muted-foreground">Session progression through stages.</p>
              <div className="space-y-2 rounded-xl border border-border p-4">
                {Object.values(GuidedApplicationStatus).map(status => {
                  const count = guidedStatusMap[status] ?? 0;
                  const pct = totalGuided > 0 ? (count / totalGuided) * 100 : 0;
                  const color = guidedStatusColors[status];
                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium">{guidedStatusLabels[status]}</span>
                        <span className="font-mono text-muted-foreground">{count.toLocaleString()} ({Math.round(pct)}%)</span>
                      </div>
                      <div className="h-6 rounded-md overflow-hidden border border-border/40 bg-muted/20" style={{ width: `${Math.max(pct, 3)}%` }}>
                        <div className={`${color} h-full rounded-md`} style={{ width: '100%' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* By Job Board */}
            <div className="space-y-6">
              <div>
                <h2 className="mb-3 text-lg font-semibold">By Job Board</h2>
                <div className="space-y-2">
                  {guidedByProvider.map(row => (
                    <div key={row.jobProvider ?? 'unknown'} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                      <span className="text-sm font-medium">{row.jobProvider ?? 'Unknown'}</span>
                      <Badge variant="secondary">{row._count.toLocaleString()} sessions</Badge>
                    </div>
                  ))}
                  {guidedByProvider.length === 0 && (
                    <p className="py-4 text-center text-sm text-muted-foreground">No data yet.</p>
                  )}
                </div>
              </div>

              <div>
                <h2 className="mb-3 text-lg font-semibold">Completion Analysis</h2>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Success Rate</p>
                    <p className="font-mono text-2xl font-bold text-green-500">{guidedSuccessRate}%</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Drop-off Rate</p>
                    <p className="font-mono text-2xl font-bold text-amber-500">
                      {totalGuided > 0 ? Math.round(((guidedCancelled + guidedDraft) / totalGuided) * 100) : 0}%
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Failure Rate</p>
                    <p className="font-mono text-2xl font-bold text-red-500">{guidedFailRate}%</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Active Now</p>
                    <p className="font-mono text-2xl font-bold text-blue-500">{guidedInProgress}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent AI Assist Sessions */}
          <div>
            <h2 className="text-lg font-semibold">Recent AI Assist Sessions</h2>
            <p className="mb-4 text-sm text-muted-foreground">Latest guided application sessions.</p>
            {recentGuided.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No AI Assist sessions yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {recentGuided.map(g => (
                  <a key={g.id} href={`/admin/applications/${g.id}`} className="rounded-lg border border-border/60 p-4 block hover:border-primary/30 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{g.jobTitle ?? 'Untitled'}</p>
                        <p className="text-xs text-muted-foreground">{g.company ?? '—'}</p>
                      </div>
                      <Badge variant="outline" className={g.status === 'SUBMITTED' ? 'border-green-500/40 text-green-500' : g.status === 'FAILED' ? 'border-red-500/40 text-red-500' : ''}>
                        {guidedStatusLabels[g.status]}
                      </Badge>
                    </div>
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Step {g.currentStep}{g.totalSteps ? `/${g.totalSteps}` : ''}</span>
                        <span>{g.progress}%</span>
                      </div>
                      <Progress value={g.progress} className="h-1.5" />
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{g.user.email}</span>
                      {g.jobProvider && <><span>·</span><span>{g.jobProvider}</span></>}
                      <span>·</span>
                      <span>{new Date(g.updatedAt).toLocaleDateString()}</span>
                    </div>
                    {g.errorMessage && (
                      <p className="mt-2 text-xs text-red-400 truncate">{g.errorMessage}</p>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ===== AUTOMATED TAB ===== */}
        <TabsContent value="automated" className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminStatCard title="Total Automated" value={automatedSubmissions.toLocaleString()} helperText={`${automated7d} in last 7d`} />
            <AdminStatCard title="Success Rate" value={`${automatedSuccessRate}%`} helperText={`${automatedSubmissions - automatedFailed} succeeded`} />
            <AdminStatCard title="Failed" value={automatedFailed.toLocaleString()} helperText={`${automatedSubmissions > 0 ? Math.round((automatedFailed / automatedSubmissions) * 100) : 0}% failure`} />
            <AdminStatCard title="% of All Apps" value={`${totalSubmissions > 0 ? Math.round((automatedSubmissions / totalSubmissions) * 100) : 0}%`} helperText={`of ${totalSubmissions} total`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h2 className="text-lg font-semibold">Automated Status Breakdown</h2>
              <p className="mb-4 text-sm text-muted-foreground">Outcome distribution for automated submissions.</p>
              <div className="space-y-2.5">
                {Object.values(ApplicationStatus).map(status => {
                  const count = automatedStatusMap[status] ?? 0;
                  if (count === 0) return null;
                  const pct = automatedSubmissions > 0 ? Math.max(2, Math.round((count / automatedSubmissions) * 100)) : 0;
                  return (
                    <div key={status} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{statusLabels[status]}</span>
                        <span className="font-mono text-muted-foreground">{count.toLocaleString()} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted">
                        <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold">Automation Performance</h2>
              <p className="mb-4 text-sm text-muted-foreground">Key metrics for automated submissions.</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Success Rate</p>
                  <p className="font-mono text-2xl font-bold text-green-500">{automatedSuccessRate}%</p>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Failure Rate</p>
                  <p className="font-mono text-2xl font-bold text-red-500">{automatedSubmissions > 0 ? Math.round((automatedFailed / automatedSubmissions) * 100) : 0}%</p>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">7-Day Volume</p>
                  <p className="font-mono text-2xl font-bold">{automated7d}</p>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">% of All Apps</p>
                  <p className="font-mono text-2xl font-bold">{totalSubmissions > 0 ? Math.round((automatedSubmissions / totalSubmissions) * 100) : 0}%</p>
                </div>
              </div>
              {automatedFailed > 0 && (
                <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                  <p className="text-xs font-medium text-red-500">
                    {automatedFailed} failed automation{automatedFailed !== 1 ? 's' : ''} — check error logs for details
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Automated */}
          <div>
            <h2 className="text-lg font-semibold">Recent Automated Submissions</h2>
            <p className="mb-4 text-sm text-muted-foreground">Latest automated application events.</p>
            {recentAutomated.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No automated submissions yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {recentAutomated.map(s => (
                  <div key={s.id} className="rounded-lg border border-border/60 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-medium">{s.jobLead.title}</p>
                      <Badge variant="outline" className={s.status === 'FAILED' ? 'border-red-500/40 text-red-500' : ''}>
                        {statusLabels[s.status]}
                      </Badge>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{s.jobLead.jobListing?.company ?? '—'}</span>
                      <span>·</span>
                      <span>{s.user.email}</span>
                      <span>·</span>
                      <span>{new Date(s.updatedAt).toLocaleDateString()}</span>
                    </div>
                    {s.errorMessage && (
                      <p className="mt-2 text-xs text-red-400 truncate">{s.errorMessage}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </AdminPageShell>
  );
}
