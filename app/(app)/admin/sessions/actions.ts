'use server';

import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db/client';

import { requireAdminUser } from '../require-admin-user';

import { getUrlHostname } from './_lib/hostname';

const REVIEWABLE_PROMOTION_STATUSES = [
  'CANDIDATE',
  'NEEDS_REVIEW',
  'OBSERVATION',
  'PROMOTED_READY',
  'PROMOTION_SKIPPED',
  'REVIEWING',
] as const;

type ReviewDecision = 'approve' | 'reject';

export async function reviewRulePromotionCandidateAction(formData: FormData) {
  await requireAdminUser();

  const candidateId = getRequiredFormValue(formData, 'candidateId');
  const sessionId = getRequiredFormValue(formData, 'sessionId');
  const decision = getReviewDecision(formData);

  await db.rulePromotionCandidate.update({
    data: {
      promotionStatus:
        decision === 'approve' ? 'OWNER_APPROVED' : 'OWNER_REJECTED',
    },
    where: { id: candidateId },
  });

  revalidateSessionRoutes(sessionId);
}

export async function bulkApproveTrivialCandidatesAction(formData: FormData) {
  await requireAdminUser();

  const sessionId = getRequiredFormValue(formData, 'sessionId');
  const session = await db.applicationRuntimeSession.findUnique({
    select: {
      currentUrl: true,
      guidedApplication: {
        select: {
          applicationUrl: true,
        },
      },
      userId: true,
    },
    where: { id: sessionId },
  });

  if (!session) {
    throw new Error('Runtime session not found.');
  }

  const hostname =
    getUrlHostname(session.currentUrl) ??
    getUrlHostname(session.guidedApplication.applicationUrl);

  if (!hostname) {
    throw new Error('Runtime session does not have a reviewable hostname.');
  }

  await db.rulePromotionCandidate.updateMany({
    data: {
      promotionStatus: 'OWNER_APPROVED',
    },
    where: {
      confidence: {
        gte: 0.65,
      },
      failureCount: 0,
      hostname,
      promotionStatus: {
        in: [...REVIEWABLE_PROMOTION_STATUSES],
      },
      successCount: {
        gt: 0,
      },
      userId: session.userId,
    },
  });

  revalidateSessionRoutes(sessionId);
}

function getRequiredFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing ${key}.`);
  }

  return value.trim();
}

function getReviewDecision(formData: FormData): ReviewDecision {
  const decision = getRequiredFormValue(formData, 'decision');

  if (decision !== 'approve' && decision !== 'reject') {
    throw new Error('Invalid review decision.');
  }

  return decision;
}

function revalidateSessionRoutes(sessionId: string) {
  revalidatePath('/admin/sessions');
  revalidatePath(`/admin/sessions/${sessionId}`);
}
