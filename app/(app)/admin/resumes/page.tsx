import { ResumeAnalysisStatus, ResumeOptimizationStatus } from '@/generated/prisma/browser';

import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { db } from '@/lib/db/client';

import { AdminPageShell } from '../_components/admin-page-shell';
import { AdminStatCard } from '../_components/admin-stat-card';
import { requireAdminUser } from '../require-admin-user';

export default async function AdminResumesPage() {
  await requireAdminUser();

  const now = Date.now();
  const day7 = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [
    totalResumes,
    totalRevisions,
    resumesCreated7d,
    // Analysis metrics
    totalAnalyses,
    analysesCompleted,
    analysesQueued,
    analysesFailed,
    avgScore,
    scoreDistribution,
    // Optimization metrics
    totalOptimizations,
    optimizationsCompleted,
    optimizationsFailed,
    avgScoreDelta,
    // Performance metrics
    totalPerfMetrics,
    avgResponseRate,
    avgInterviewRate,
    // Recent analyses
    recentAnalyses,
  ] = await Promise.all([
    db.resume.count(),
    db.resumeRevision.count(),
    db.resume.count({ where: { createdAt: { gte: day7 } } }),
    // analyses
    db.resumeAnalysis.count(),
    db.resumeAnalysis.count({
      where: { status: ResumeAnalysisStatus.COMPLETED },
    }),
    db.resumeAnalysis.count({
      where: {
        status: {
          in: [ResumeAnalysisStatus.QUEUED, ResumeAnalysisStatus.ANALYZING],
        },
      },
    }),
    db.resumeAnalysis.count({
      where: { status: ResumeAnalysisStatus.FAILED },
    }),
    db.resumeAnalysis.aggregate({
      _avg: { score: true },
      where: { status: ResumeAnalysisStatus.COMPLETED, score: { not: null } },
    }),
    db.resumeAnalysis.groupBy({
      by: ['status'],
      _count: true,
    }),
    // optimizations
    db.resumeOptimization.count(),
    db.resumeOptimization.count({
      where: { status: ResumeOptimizationStatus.COMPLETED },
    }),
    db.resumeOptimization.count({
      where: { status: ResumeOptimizationStatus.FAILED },
    }),
    db.resumeOptimization.aggregate({
      _avg: { scoreDelta: true },
      where: {
        status: ResumeOptimizationStatus.COMPLETED,
        scoreDelta: { not: null },
      },
    }),
    // performance
    db.resumePerformanceMetric.count(),
    db.resumePerformanceMetric.aggregate({
      _avg: { responseRate: true },
      where: { totalApplications: { gt: 0 } },
    }),
    db.resumePerformanceMetric.aggregate({
      _avg: { interviewRate: true },
      where: { totalApplications: { gt: 0 } },
    }),
    // recent
    db.resumeAnalysis.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: {
        createdAt: true,
        id: true,
        score: true,
        status: true,
        resume: {
          select: {
            name: true,
          },
        },
        user: {
          select: {
            email: true,
          },
        },
      },
    }),
  ]);

  const analysisRate =
    totalAnalyses > 0
      ? Math.round((analysesCompleted / totalAnalyses) * 100)
      : 0;

  const optimizationRate =
    totalOptimizations > 0
      ? Math.round((optimizationsCompleted / totalOptimizations) * 100)
      : 0;

  const avgScoreValue = Math.round(avgScore._avg.score ?? 0);
  const avgDelta = avgScoreDelta._avg.scoreDelta
    ? `+${avgScoreDelta._avg.scoreDelta.toFixed(1)}`
    : 'N/A';
  const avgRespRate = avgResponseRate._avg.responseRate
    ? `${(avgResponseRate._avg.responseRate * 100).toFixed(1)}%`
    : 'N/A';
  const avgIntRate = avgInterviewRate._avg.interviewRate
    ? `${(avgInterviewRate._avg.interviewRate * 100).toFixed(1)}%`
    : 'N/A';

  const statusMap = scoreDistribution.reduce(
    (acc, row) => {
      acc[row.status] = row._count;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <AdminPageShell
      title="Resumes"
      description="Analysis scores, optimization deltas, and ATS readiness across all users."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <AdminStatCard
          title="Total Resumes"
          value={totalResumes.toLocaleString()}
          helperText={`${totalRevisions.toLocaleString()} revisions`}
        />
        <AdminStatCard
          title="New (7d)"
          value={resumesCreated7d.toLocaleString()}
        />
        <AdminStatCard
          title="Avg ATS Score"
          value={avgScoreValue > 0 ? `${avgScoreValue}/100` : 'N/A'}
          helperText={`${analysesCompleted.toLocaleString()} scored`}
        />
        <AdminStatCard
          title="Avg Score Delta"
          value={avgDelta}
          helperText="after optimization"
        />
        <AdminStatCard
          title="Avg Response Rate"
          value={avgRespRate}
          helperText={`${totalPerfMetrics.toLocaleString()} tracked`}
        />
        <AdminStatCard title="Avg Interview Rate" value={avgIntRate} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Analysis Pipeline */}
        <div>
          <h2 className="text-lg font-semibold">Analysis Pipeline</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Resume analysis completion and failure rates.
          </p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Total', value: totalAnalyses },
              { label: 'Completed', value: analysesCompleted },
              { label: 'Queued', value: analysesQueued },
              { label: 'Failed', value: analysesFailed },
            ].map(item => (
              <div
                key={item.label}
                className="rounded-lg border border-border/60 p-2.5"
              >
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {item.label}
                </p>
                <p className="font-mono text-lg font-semibold leading-tight">
                  {item.value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Completion rate</span>
              <span className="font-mono">{analysisRate}%</span>
            </div>
            <Progress value={analysisRate} />
          </div>

          {Object.keys(statusMap).length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Status breakdown
              </p>
              {Object.entries(statusMap).map(([status, count]) => {
                const pct =
                  totalAnalyses > 0
                    ? Math.max(2, Math.round((count / totalAnalyses) * 100))
                    : 0;
                return (
                  <div key={status} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span>{status}</span>
                      <span className="font-mono text-muted-foreground">
                        {count.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* Optimization Pipeline */}
        <div>
          <h2 className="text-lg font-semibold">Optimization Pipeline</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Resume optimization throughput and score improvements.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Total', value: totalOptimizations },
              { label: 'Completed', value: optimizationsCompleted },
              { label: 'Failed', value: optimizationsFailed },
            ].map(item => (
              <div
                key={item.label}
                className="rounded-lg border border-border/60 p-2.5"
              >
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {item.label}
                </p>
                <p className="font-mono text-lg font-semibold leading-tight">
                  {item.value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Completion rate</span>
              <span className="font-mono">{optimizationRate}%</span>
            </div>
            <Progress value={optimizationRate} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Avg Score Delta
              </p>
              <p className="font-mono text-lg font-semibold leading-tight text-emerald-600">
                {avgDelta}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Performance Tracked
              </p>
              <p className="font-mono text-lg font-semibold leading-tight">
                {totalPerfMetrics.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Analyses */}
      <div>
        <h2 className="text-lg font-semibold">Recent Analyses</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Latest 15 resume analyses across all users.
        </p>

        {recentAnalyses.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No resume analyses yet. Analyses are created when users upload a
            resume and request an ATS score.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {recentAnalyses.map(analysis => (
              <div
                key={analysis.id}
                className="rounded-lg border border-border/60 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-medium">
                    {analysis.resume?.name ?? '—'}
                  </p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {analysis.score !== null ? (
                      <span
                        className={`font-mono text-sm font-semibold ${
                          analysis.score >= 80
                            ? 'text-emerald-600'
                            : analysis.score >= 60
                              ? 'text-orange-600'
                              : 'text-red-500'
                        }`}
                      >
                        {analysis.score}/100
                      </span>
                    ) : null}
                    <Badge
                      variant={
                        analysis.status === 'COMPLETED'
                          ? 'default'
                          : analysis.status === 'FAILED'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {analysis.status}
                    </Badge>
                  </div>
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{analysis.user.email}</span>
                  <span>·</span>
                  <span>
                    {new Date(analysis.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminPageShell>
  );
}
