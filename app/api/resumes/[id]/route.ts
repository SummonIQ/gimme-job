import { NextResponse, type NextRequest } from 'next/server';

import { db } from '@/lib/db/client';
import { invalidateResolverCacheSlice } from '@/lib/field-answer/cache';
import { getSessionUser } from '@/lib/user/query';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: resumeId } = await params;
  const body = await request.json();
  const { markdown } = body as { markdown?: string };

  if (!markdown || typeof markdown !== 'string') {
    return NextResponse.json(
      { error: 'Missing or invalid markdown field' },
      { status: 400 },
    );
  }

  const resume = await db.resume.findFirst({
    where: { id: resumeId, userId: user.id },
    select: { id: true },
  });

  if (!resume) {
    return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
  }

  await db.resume.update({
    where: { id: resumeId },
    data: { markdown },
  });
  invalidateResolverCacheSlice(user.id, 'resume');

  return NextResponse.json({ success: true });
}
