import { NextResponse } from 'next/server';
import { failStuckLeads } from '@/lib/job-leads/fail-stuck';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await failStuckLeads();

  return NextResponse.json({
    success: true,
    ...result,
    timestamp: new Date().toISOString(),
  });
}
