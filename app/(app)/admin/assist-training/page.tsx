import { db } from '@/lib/db/client';

import { AdminPageShell } from '../_components/admin-page-shell';
import { requireAdminUser } from '../require-admin-user';

import { AssistTrainingClient } from './_components/assist-training-client';

export default async function AdminAssistTrainingPage() {
  await requireAdminUser();

  const [totalSessions, completedSessions, failedSessions, runningSessions, recentSessions] =
    await Promise.all([
      db.assistTrainingSession.count(),
      db.assistTrainingSession.count({ where: { status: 'completed' } }),
      db.assistTrainingSession.count({ where: { status: 'failed' } }),
      db.assistTrainingSession.count({
        where: { status: { in: ['pending', 'running'] } },
      }),
      db.assistTrainingSession.findMany({
        orderBy: { startedAt: 'desc' },
        take: 30,
        select: {
          id: true,
          status: true,
          targetUrl: true,
          hostname: true,
          atsSystemName: true,
          totalSteps: true,
          completedSteps: true,
          progress: true,
          observationsCreated: true,
          rulesPromoted: true,
          error: true,
          stepLogs: true,
          startedAt: true,
          completedAt: true,
        },
      }),
    ]);

  const totalObservations = recentSessions.reduce(
    (sum, s) => sum + s.observationsCreated,
    0,
  );
  const totalRulesPromoted = recentSessions.reduce(
    (sum, s) => sum + s.rulesPromoted,
    0,
  );

  return (
    <AdminPageShell
      title="Training"
      description="Vision-driven automated training pipeline. Navigates application pages with GPT-4o Vision to build field observations, rules, and application flows."
    >
      <AssistTrainingClient
        initialHostnameInsights={{}}
        initialSessions={recentSessions.map(s => ({
          ...s,
          stepLogs: s.stepLogs as Record<string, unknown>[],
          startedAt: s.startedAt.toISOString(),
          completedAt: s.completedAt?.toISOString() ?? null,
        }))}
        initialStats={{
          total: totalSessions,
          completed: completedSessions,
          failed: failedSessions,
          running: runningSessions,
          observations: totalObservations,
          rulesPromoted: totalRulesPromoted,
        }}
      />
    </AdminPageShell>
  );
}
