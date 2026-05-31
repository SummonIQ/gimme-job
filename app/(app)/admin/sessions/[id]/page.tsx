import { notFound } from 'next/navigation';

import { SessionReview } from '@/components/session-replay/session-review';
import { db } from '@/lib/db/client';

import { AdminPageShell } from '../../_components/admin-page-shell';
import { requireAdminUser } from '../../require-admin-user';
import {
  bulkApproveTrivialCandidatesAction,
  reviewRulePromotionCandidateAction,
} from '../actions';
import { getUrlHostname } from '../_lib/hostname';

interface AdminRuntimeSessionDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AdminRuntimeSessionDetailPage({
  params,
}: AdminRuntimeSessionDetailPageProps) {
  await requireAdminUser();

  const { id } = await params;
  const session = await db.applicationRuntimeSession.findUnique({
    select: {
      currentStepIndex: true,
      currentUrl: true,
      events: {
        orderBy: { createdAt: 'asc' },
        select: {
          actionType: true,
          createdAt: true,
          errorMessage: true,
          eventType: true,
          fieldLabel: true,
          fieldName: true,
          id: true,
          selector: true,
          source: true,
          stepIndex: true,
          success: true,
          url: true,
        },
        take: 250,
      },
      guidedApplication: {
        select: {
          applicationUrl: true,
          company: true,
          jobTitle: true,
        },
      },
      id: true,
      mode: true,
      replayArtifacts: {
        orderBy: { createdAt: 'desc' },
        select: {
          createdAt: true,
          id: true,
          screenshotUrls: true,
          sizeBytes: true,
        },
        take: 12,
      },
      startedAt: true,
      status: true,
      updatedAt: true,
      userId: true,
    },
    where: { id },
  });

  if (!session) {
    notFound();
  }

  const hostname =
    getUrlHostname(session.currentUrl) ??
    getUrlHostname(session.guidedApplication.applicationUrl);
  const candidates = hostname
    ? await db.rulePromotionCandidate.findMany({
        orderBy: [{ confidence: 'desc' }, { updatedAt: 'desc' }],
        select: {
          actionType: true,
          confidence: true,
          failureCount: true,
          fieldLabel: true,
          fieldName: true,
          hostname: true,
          id: true,
          observationCount: true,
          promotionStatus: true,
          stableSelector: true,
          successCount: true,
          updatedAt: true,
          userOverrideCount: true,
        },
        take: 50,
        where: {
          hostname,
          userId: session.userId,
        },
      })
    : [];

  return (
    <AdminPageShell
      description="Inspect replay events, screenshots, and selector promotion candidates."
      title="Runtime Session Review"
    >
      <SessionReview
        bulkApproveAction={bulkApproveTrivialCandidatesAction}
        reviewCandidateAction={reviewRulePromotionCandidateAction}
        session={{
          artifacts: session.replayArtifacts.map(artifact => ({
            createdAt: artifact.createdAt.toISOString(),
            id: artifact.id,
            screenshotUrls: artifact.screenshotUrls,
            sizeBytes: artifact.sizeBytes,
          })),
          candidates: candidates.map(candidate => ({
            ...candidate,
            updatedAt: candidate.updatedAt.toISOString(),
          })),
          company: session.guidedApplication.company,
          currentStepIndex: session.currentStepIndex,
          currentUrl: session.currentUrl,
          events: session.events.map(event => ({
            ...event,
            createdAt: event.createdAt.toISOString(),
            source: event.source.toString(),
          })),
          hostname,
          id: session.id,
          jobTitle: session.guidedApplication.jobTitle,
          mode: session.mode,
          startedAt: session.startedAt.toISOString(),
          status: session.status,
          updatedAt: session.updatedAt.toISOString(),
        }}
      />
    </AdminPageShell>
  );
}
