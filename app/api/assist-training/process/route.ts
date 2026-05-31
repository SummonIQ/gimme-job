import { type NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db/client';
import { runTrainingSession } from '@/lib/assist-training/worker';

// POST — Background worker entry point (fire-and-forget from the main route)
export async function POST(req: NextRequest) {
  try {
    const { sessionId, dryRun, maxSteps, captureScreenshots } =
      (await req.json()) as {
        sessionId: string;
        dryRun?: boolean;
        maxSteps?: number;
        captureScreenshots?: boolean;
      };

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 },
      );
    }

    const session = await db.assistTrainingSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 },
      );
    }

    if (session.status !== 'pending') {
      return NextResponse.json(
        { error: 'Session already processed' },
        { status: 400 },
      );
    }

    // Run in background (non-blocking)
    runTrainingSession({
      sessionId: session.id,
      userId: session.userId,
      targetUrl: session.targetUrl,
      hostname: session.hostname,
      maxSteps: maxSteps ?? session.totalSteps ?? 15,
      dryRun: dryRun ?? true,
      captureScreenshots: captureScreenshots ?? false,
    }).catch(error => {
      console.error(
        `[AssistTraining] Background worker failed for ${sessionId}:`,
        error,
      );
    });

    return NextResponse.json({ success: true, message: 'Training started' });
  } catch (error) {
    console.error('[AssistTraining] Process route error:', error);
    return NextResponse.json(
      { error: 'Failed to start training' },
      { status: 500 },
    );
  }
}
