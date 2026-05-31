import { NextResponse } from 'next/server';

import { isAdminUser } from '@/lib/admin/scrape-service';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || !(await isAdminUser(user.email))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await context.params;
  const session = await db.scrapeSession.findFirst({
    include: {
      events: {
        orderBy: { sequence: 'asc' },
        select: {
          emittedAt: true,
          id: true,
          kind: true,
          payload: true,
          sequence: true,
        },
      },
    },
    where: { id, userId: user.id },
  });

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json({ session });
}
