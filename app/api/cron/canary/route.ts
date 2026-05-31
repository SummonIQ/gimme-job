import { NextResponse } from 'next/server';

import { runCanary } from '@/lib/cron/canary';
import { logger } from '@/lib/logger';

async function handleCanaryRequest(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runCanary();

  logger.info('[CRON] canary', {
    baselinePath: result.baselinePath,
    enqueuedCount: result.enqueuedCount,
    generatedAt: result.generatedAt.toISOString(),
    regressionExitCode: result.regressionExitCode,
    reportPath: result.reportPath,
  });

  return NextResponse.json({
    baselinePath: result.baselinePath,
    enqueuedCount: result.enqueuedCount,
    families: result.families,
    generatedAt: result.generatedAt.toISOString(),
    regressionExitCode: result.regressionExitCode,
    reportPath: result.reportPath,
    success: true,
  });
}

export async function GET(request: Request) {
  return handleCanaryRequest(request);
}

export async function POST(request: Request) {
  return handleCanaryRequest(request);
}
