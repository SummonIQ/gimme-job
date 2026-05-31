import { db } from '@/lib/db/client';
import { getAssistTrainingHostnameInsight } from '@/lib/assist-training/insights';
import { notFound } from 'next/navigation';

/**
 * Loads all data needed to render a training session detail view.
 * Shared between the full page route and the intercepted modal route
 * so they stay in lockstep.
 */
export async function fetchAssistTrainingSessionDetail(id: string) {
  const [session, observations, rules] = await Promise.all([
    db.assistTrainingSession.findUnique({
      where: { id },
    }),
    db.aTSFieldObservation.findMany({
      where: { sessionId: id },
      orderBy: { stepIndex: 'asc' },
    }),
    db.assistTrainingSession
      .findUnique({ where: { id }, select: { hostname: true } })
      .then(s =>
        s
          ? db.aTSRule.findMany({
              where: { hostname: s.hostname },
              orderBy: { stepIndex: 'asc' },
            })
          : [],
      ),
  ]);

  if (!session) notFound();

  const [hostnameInsight, activeFlow, relatedSessions] = await Promise.all([
    getAssistTrainingHostnameInsight(session.hostname),
    db.applicationFlowDefinition.findFirst({
      include: {
        steps: {
          orderBy: { stepIndex: 'asc' },
          select: {
            averageConfidence: true,
            enabledRuleCount: true,
            labels: true,
            metadata: true,
            primarySelector: true,
            selectors: true,
            stepIndex: true,
            stepLabel: true,
          },
        },
      },
      orderBy: [{ version: 'desc' }, { updatedAt: 'desc' }],
      where: {
        hostname: session.hostname,
        status: {
          in: ['ACTIVE', 'EMPTY', 'DISABLED'],
        },
      },
    }),
    db.assistTrainingSession.findMany({
      orderBy: { startedAt: 'desc' },
      select: {
        completedAt: true,
        id: true,
        observationsCreated: true,
        progress: true,
        rulesPromoted: true,
        startedAt: true,
        status: true,
        targetUrl: true,
      },
      take: 6,
      where: {
        hostname: session.hostname,
        userId: session.userId,
      },
    }),
  ]);

  return {
    activeFlow: activeFlow
      ? {
          ...activeFlow,
          createdAt: activeFlow.createdAt.toISOString(),
          lastCompiledAt: activeFlow.lastCompiledAt.toISOString(),
          updatedAt: activeFlow.updatedAt.toISOString(),
        }
      : null,
    hostnameInsight,
    relatedSessions: relatedSessions.map(relatedSession => ({
      ...relatedSession,
      completedAt: relatedSession.completedAt?.toISOString() ?? null,
      startedAt: relatedSession.startedAt.toISOString(),
    })),
    session: {
      ...session,
      stepLogs: session.stepLogs as Record<string, unknown>[],
      startedAt: session.startedAt.toISOString(),
      completedAt: session.completedAt?.toISOString() ?? null,
    },
    observations: observations.map(o => ({
      ...o,
      createdAt: undefined,
      sessionId: undefined,
      fieldConstraints: o.fieldConstraints as Record<string, unknown> | null,
    })),
    rules: rules.map(r => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
    userId: session.userId,
  };
}
