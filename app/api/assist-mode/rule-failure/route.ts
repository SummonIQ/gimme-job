import { NextResponse, type NextRequest } from 'next/server';

import { maybeAutoEnqueueTraining } from '@/lib/assist-training/auto-enqueue';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';

const AUTO_DISABLE_THRESHOLD = 3;

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as {
      hostname?: string;
      selector?: string;
      stepIndex?: number;
    };

    if (!body.hostname || !body.selector) {
      return NextResponse.json(
        { error: 'hostname and selector are required' },
        { status: 400 },
      );
    }

    // Find the matching enabled rule
    const rule = await db.aTSRule.findFirst({
      where: {
        hostname: body.hostname,
        stableSelector: body.selector,
        enabled: true,
      },
      select: { id: true, consecutiveFailures: true },
    });

    if (!rule) {
      return NextResponse.json({ ok: true, found: false });
    }

    const newFailures = rule.consecutiveFailures + 1;
    const shouldDisable = newFailures >= AUTO_DISABLE_THRESHOLD;

    await db.aTSRule.update({
      where: { id: rule.id },
      data: {
        consecutiveFailures: newFailures,
        ...(shouldDisable ? { enabled: false } : {}),
      },
    });

    // Active learning: when a rule is auto-disabled due to repeated
    // failures, auto-enqueue a training run for this hostname so the
    // system can re-learn.
    if (shouldDisable) {
      void maybeAutoEnqueueTraining({
        hostname: body.hostname,
        targetUrl: `https://${body.hostname}`,
        userId: user.id,
        failureReason: `Rule for "${body.selector}" auto-disabled after ${AUTO_DISABLE_THRESHOLD} consecutive failures.`,
      });
    }

    return NextResponse.json({
      ok: true,
      consecutiveFailures: newFailures,
      disabled: shouldDisable,
    });
  } catch (error) {
    console.error('Rule failure reporting error:', error);
    return NextResponse.json(
      { error: 'Failed to report rule failure' },
      { status: 500 },
    );
  }
}
