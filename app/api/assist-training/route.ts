import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { after } from 'next/server';

import { isAdminUser } from '@/lib/admin/scrape-service';
import { getAssistTrainingHostnameInsights } from '@/lib/assist-training/insights';
import { runTrainingSession } from '@/lib/assist-training/worker';
import { db } from '@/lib/db/client';
import { enqueueJob, JobType } from '@/lib/pipeline/durable-queue';
import { getCurrentUser } from '@/lib/user/query';

const createSessionSchema = z.object({
  captureScreenshots: z.boolean().default(false),
  disableJavascript: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  maxDurationMin: z.number().min(1).max(15).default(5),
  maxStepsPerUrl: z.number().min(1).max(30).default(15),
  mobileViewport: z.boolean().default(false),
  urls: z.array(z.string().url()).min(1).max(50),
});

// POST — Create training sessions for one or more URLs
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isAdminUser(user.email)) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json();
    const {
      urls,
      dryRun,
      maxStepsPerUrl,
      maxDurationMin,
      captureScreenshots,
      disableJavascript,
      mobileViewport,
    } = createSessionSchema.parse(body);

    const sessions = [];

    for (const url of urls) {
      let hostname = '';
      try {
        hostname = new URL(url).hostname;
      } catch {
        continue;
      }

      const session = await db.assistTrainingSession.create({
        data: {
          userId: user.id,
          targetUrl: url,
          hostname,
          totalSteps: maxStepsPerUrl,
          status: 'pending',
        },
      });

      sessions.push(session);

      const trainingConfig = {
        captureScreenshots,
        disableJavascript,
        dryRun,
        sessionId: session.id,
        hostname,
        maxSteps: maxStepsPerUrl,
        maxDurationMin,
        mobileViewport,
        targetUrl: url,
        userId: user.id,
      };

      // Enqueue for durable processing (survives cold starts, retries on failure)
      await enqueueJob({
        type: JobType.TRAIN_SESSION,
        payload: trainingConfig,
        deduplicationKey: `train:${session.id}`,
        userId: user.id,
        priority: 5,
        maxRetries: 2,
      });

      // Optimistic immediate run via after() — best-effort fast path
      after(async () => {
        try {
          await runTrainingSession(trainingConfig);
        } catch (err) {
          console.error('[AssistTraining] Optimistic after() failed (queue will retry):', err);
        }
      });
    }

    return NextResponse.json({ sessions }, { status: 201 });
  } catch (error: unknown) {
    console.error('[AssistTraining] Create error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to create training sessions' },
      { status: 500 },
    );
  }
}

// GET — List training sessions
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isAdminUser(user.email)) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    // Auto-fail sessions stuck in running/pending for more than 10 minutes
    const STALE_THRESHOLD_MS = 10 * 60 * 1000;
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS);
    await db.assistTrainingSession
      .updateMany({
        where: {
          status: { in: ['running', 'pending'] },
          startedAt: { lt: staleThreshold },
        },
        data: {
          status: 'failed',
          completedAt: new Date(),
          error: `Session timed out (stuck for >${STALE_THRESHOLD_MS / 60000}m)`,
        },
      })
      .catch(err =>
        console.warn('[AssistTraining] Stale session cleanup error:', err),
      );

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limit = Math.min(
      parseInt(searchParams.get('limit') ?? '20', 10),
      100,
    );

    const sessions = await db.assistTrainingSession.findMany({
      where: {
        userId: user.id,
        ...(status ? { status } : {}),
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
    const hostnameInsights = await getAssistTrainingHostnameInsights(
      sessions.map(session => session.hostname),
    );

    // Summary stats
    const stats = await db.assistTrainingSession.groupBy({
      by: ['status'],
      where: { userId: user.id },
      _count: { id: true },
    });

    return NextResponse.json({ hostnameInsights, sessions, stats });
  } catch (error) {
    console.error('[AssistTraining] List error:', error);
    return NextResponse.json(
      { error: 'Failed to list sessions' },
      { status: 500 },
    );
  }
}
