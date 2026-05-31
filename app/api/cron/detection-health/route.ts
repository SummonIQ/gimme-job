import { NextResponse } from 'next/server';

import { db } from '@/lib/db/client';
import {
  analyzeHostHealth,
  applyDetectionHealthActions,
  loadHostSignals,
} from '@/lib/runtime-safety/detection-health';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  // Scan every user that has runtime activity in the last 24h. Keeps the
  // cron self-contained — no --user flag needed.
  const activeUsers = await db.applicationRuntimeEvent.groupBy({
    by: ['userId'],
    where: {
      createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    },
  });

  const summaries: Array<Record<string, unknown>> = [];
  for (const { userId } of activeUsers) {
    const signals = await loadHostSignals({ now, userId });
    for (const sig of signals) {
      const verdict = analyzeHostHealth(sig);
      if (verdict.triggered.length === 0) continue;
      const result = await applyDetectionHealthActions({
        now,
        userId,
        verdict,
      });
      summaries.push({
        family: result.family,
        hostname: result.hostname,
        overrideIds: result.overrideIds,
        posturesFlipped: result.posturesFlipped,
        triggered: verdict.triggered.map(t => t.type),
        userId,
      });
    }
  }

  logger.info('[CRON] detection-health', {
    affectedHosts: summaries.length,
  });

  return NextResponse.json({
    actions: summaries,
    success: true,
    timestamp: now.toISOString(),
  });
}
