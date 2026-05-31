import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db/client';
import { revokeToken } from '@/lib/desktop-tokens';
import { getCurrentUser } from '@/lib/user/query';

const BodySchema = z.object({
  tokenId: z.string().min(1),
  reason: z.string().max(500).optional(),
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

  const existing = await db.desktopToken.findUnique({
    where: { id: parsed.data.tokenId },
  });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: 'Token not found' }, { status: 404 });
  }

  const revoked = await revokeToken(existing.id, { reason: parsed.data.reason });
  return NextResponse.json({
    id: revoked.id,
    revokedAt: revoked.revokedAt?.toISOString() ?? null,
  });
}
