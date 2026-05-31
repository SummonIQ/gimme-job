import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { archiveStaleDesktopSubmitRequests } from '@/lib/pipeline/durable-queue';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await archiveStaleDesktopSubmitRequests();

  logger.info('[CRON] archive-stale-queue-items', {
    archived: result.archived,
    cutoff: result.cutoff.toISOString(),
  });

  return NextResponse.json({
    archived: result.archived,
    cutoff: result.cutoff.toISOString(),
    success: true,
    timestamp: new Date().toISOString(),
  });
}
