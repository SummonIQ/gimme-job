import { NextResponse } from 'next/server';

import { isAdminUser } from '@/lib/admin/scrape-service';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await isAdminUser(user.email))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const url = new URL(request.url);
  const limitParam = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const sessions = await db.scrapeSession.findMany({
    orderBy: { startedAt: 'desc' },
    select: {
      city: true,
      country: true,
      finishedAt: true,
      globalDateRange: true,
      globalMaxPages: true,
      id: true,
      mode: true,
      providersRequested: true,
      remote: true,
      scrapeId: true,
      searchTerm: true,
      startedAt: true,
      stateCode: true,
      status: true,
      trigger: true,
    },
    take: limit,
    where: { userId: user.id },
  });

  return NextResponse.json({ sessions });
}
