import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  confirmBurst,
  type BurstMode,
} from '@/lib/campaigns/confirm-burst';
import { SubmissionTier } from '@/generated/prisma/client';
import { getCurrentUser } from '@/lib/user/query';

const BurstModeSchema = z.enum([
  SubmissionTier.TARGETED,
  SubmissionTier.GENERIC,
  SubmissionTier.FIRE_AND_FORGET,
]);

const BodySchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1).max(200),
  mode: BurstModeSchema,
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await confirmBurst({
    leadIds: parsed.data.leadIds,
    mode: parsed.data.mode as BurstMode,
    userId: user.id,
  });

  return NextResponse.json({
    enqueued: result.enqueued,
    mode: result.mode,
    skipped: result.skipped,
    success: true,
    timestamp: new Date().toISOString(),
  });
}
