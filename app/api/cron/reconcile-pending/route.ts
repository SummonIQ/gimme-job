import { NextResponse } from 'next/server';
import { reconcilePendingSubmissions } from '@/lib/cron/reconcile';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await reconcilePendingSubmissions();

  logger.info('[CRON] reconcile-pending', {
    cutoff: result.cutoff.toISOString(),
    transitioned: result.transitioned,
  });

  return NextResponse.json({
    cutoff: result.cutoff.toISOString(),
    success: true,
    timestamp: new Date().toISOString(),
    transitioned: result.transitioned,
    transitionedIds: result.transitionedIds,
  });
}
