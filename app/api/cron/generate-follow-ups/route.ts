import { NextResponse } from 'next/server';
import { generateFollowUpDrafts } from '@/lib/follow-ups/scanner';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await generateFollowUpDrafts();
  logger.info('[CRON] generate-follow-ups', result);

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    ...result,
  });
}
