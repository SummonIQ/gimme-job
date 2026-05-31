import { NextResponse } from 'next/server';
import { z } from 'zod';

import { isAdminUser } from '@/lib/admin/scrape-service';
import { embedFormFieldFeedback } from '@/lib/ai/embeddings';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';

const REJECT_REASONS = [
  'WRONG_VALUE',
  'WRONG_OPTION',
  'WRONG_FORMAT',
  'MISSED_FIELD',
  'HIDDEN_FIELD',
  'UNRELATED_FIELD',
  'CAPTCHA_FIELD',
  'DUPLICATE_INFO',
  'WRONG_INTERPRETATION',
  'OTHER',
] as const;
const STATUSES = ['approved', 'rejected'] as const;

const requestSchema = z.object({
  applicationUrl: z.string().optional(),
  feedback: z.string(),
  fieldLabel: z.string().min(1),
  fieldSelector: z.string().optional(),
  fieldType: z.string().optional(),
  filledValue: z.string().optional(),
  hostname: z.string().min(1),
  rejectReason: z.enum(REJECT_REASONS).nullish(),
  snapshotId: z.string().optional(),
  status: z.enum(STATUSES).nullish(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await isAdminUser(user.email))) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 403 });
  }

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : String(error),
        error: 'INVALID_REQUEST',
      },
      { status: 400 },
    );
  }

  let ownerUserId = user.id;
  if (body.snapshotId) {
    const snapshot = await db.localFormSnapshot.findUnique({
      select: { userId: true },
      where: { id: body.snapshotId },
    });
    if (!snapshot) {
      return NextResponse.json(
        { error: 'SNAPSHOT_NOT_FOUND' },
        { status: 404 },
      );
    }
    ownerUserId = snapshot.userId;
  }

  const trimmedFeedback = body.feedback.trim();
  const status = body.status ?? null;
  const rejectReason = status === 'rejected' ? (body.rejectReason ?? null) : null;
  const hasAnySignal =
    Boolean(trimmedFeedback) || Boolean(status) || Boolean(rejectReason);

  if (!hasAnySignal) {
    await db.formFieldFeedback.deleteMany({
      where: {
        fieldLabel: body.fieldLabel,
        hostname: body.hostname,
        userId: ownerUserId,
      },
    });
    return NextResponse.json({ deleted: true });
  }

  const existing = await db.formFieldFeedback.findFirst({
    where: {
      fieldLabel: body.fieldLabel,
      hostname: body.hostname,
      userId: ownerUserId,
    },
  });

  const data = {
    applicationUrl: body.applicationUrl ?? existing?.applicationUrl ?? null,
    feedback: trimmedFeedback,
    fieldSelector: body.fieldSelector ?? existing?.fieldSelector ?? null,
    fieldType: body.fieldType ?? existing?.fieldType ?? null,
    filledValue: body.filledValue ?? existing?.filledValue ?? null,
    rejectReason,
    snapshotId: body.snapshotId ?? existing?.snapshotId ?? null,
    status,
  };

  if (existing) {
    const updated = await db.formFieldFeedback.update({
      data,
      where: { id: existing.id },
    });
    void embedFormFieldFeedback(updated.id).catch(error => {
      console.warn('[admin/form-feedback] embed failed', error);
    });
    return NextResponse.json({ id: updated.id });
  }

  const created = await db.formFieldFeedback.create({
    data: {
      ...data,
      fieldLabel: body.fieldLabel,
      hostname: body.hostname,
      userId: ownerUserId,
    },
  });
  void embedFormFieldFeedback(created.id).catch(error => {
    console.warn('[admin/form-feedback] embed failed', error);
  });
  return NextResponse.json({ id: created.id });
}
