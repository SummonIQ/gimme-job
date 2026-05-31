'use server';

import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db/client';
import { FollowUpDraftStatus } from '@/generated/prisma/client';
import { getCurrentUser } from '@/lib/user/query';

async function requireOwnership(draftId: string) {
  const user = await getCurrentUser();
  if (!user?.id) {
    throw new Error('Unauthorized');
  }
  const draft = await db.followUpDraft.findUnique({
    where: { id: draftId },
  });
  if (!draft || draft.userId !== user.id) {
    throw new Error('Draft not found');
  }
  return draft;
}

export async function updateFollowUpDraftBody(
  draftId: string,
  bodyMarkdown: string,
  subject?: string,
) {
  const draft = await requireOwnership(draftId);

  await db.followUpDraft.update({
    data: {
      bodyMarkdown,
      subject: subject?.trim() ? subject.trim() : draft.subject,
    },
    where: { id: draftId },
  });

  revalidatePath('/follow-ups');
}

export async function markFollowUpDraftSent(draftId: string, now = new Date()) {
  await requireOwnership(draftId);

  await db.followUpDraft.update({
    data: {
      reviewedAt: now,
      sentAt: now,
      status: FollowUpDraftStatus.SENT,
    },
    where: { id: draftId },
  });

  revalidatePath('/follow-ups');
}

export async function dismissFollowUpDraft(
  draftId: string,
  now = new Date(),
) {
  await requireOwnership(draftId);

  await db.followUpDraft.update({
    data: {
      reviewedAt: now,
      status: FollowUpDraftStatus.DISMISSED,
    },
    where: { id: draftId },
  });

  revalidatePath('/follow-ups');
}
