import { SessionList } from '@/components/session-replay/session-list';
import { db } from '@/lib/db/client';

import { AdminPageShell } from '../_components/admin-page-shell';
import { requireAdminUser } from '../require-admin-user';

import { getUrlHostname } from './_lib/hostname';

export default async function AdminRuntimeSessionsPage() {
  await requireAdminUser();

  const sessions = await db.applicationRuntimeSession.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      _count: {
        select: {
          events: true,
          replayArtifacts: true,
        },
      },
      completedAt: true,
      currentUrl: true,
      guidedApplication: {
        select: {
          applicationUrl: true,
          company: true,
          jobTitle: true,
          lastScreenshotUrl: true,
        },
      },
      id: true,
      mode: true,
      replayArtifacts: {
        orderBy: { createdAt: 'desc' },
        select: {
          screenshotUrls: true,
        },
        take: 1,
      },
      startedAt: true,
      status: true,
      updatedAt: true,
    },
    take: 50,
  });

  return (
    <AdminPageShell
      description="Replay artifacts and promotion candidates for supervised runtime sessions."
      title="Runtime Sessions"
    >
      <SessionList
        sessions={sessions.map(session => {
          const hostname =
            getUrlHostname(session.currentUrl) ??
            getUrlHostname(session.guidedApplication.applicationUrl);
          const lastReplayScreenshot =
            session.replayArtifacts[0]?.screenshotUrls[0] ?? null;

          return {
            artifactCount: session._count.replayArtifacts,
            company: session.guidedApplication.company,
            completedAt: session.completedAt?.toISOString() ?? null,
            currentUrl: session.currentUrl,
            eventCount: session._count.events,
            hostname,
            id: session.id,
            jobTitle: session.guidedApplication.jobTitle,
            lastScreenshotUrl:
              lastReplayScreenshot ??
              session.guidedApplication.lastScreenshotUrl ??
              null,
            mode: session.mode,
            startedAt: session.startedAt.toISOString(),
            status: session.status,
            updatedAt: session.updatedAt.toISOString(),
          };
        })}
      />
    </AdminPageShell>
  );
}
