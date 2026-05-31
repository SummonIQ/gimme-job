import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/query';
import { db } from '@/lib/db/client';
import { getAutomationMetrics } from '@/lib/automation/analytics';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get automation settings
    const settings = await db.automationSettings.findUnique({
      where: { userId: user.id },
    });

    // Get scheduled applications count
    const totalScheduled = await db.automationScheduledApplication.count({
      where: {
        userId: user.id,
        status: 'scheduled',
      },
    });

    // Get completed applications count
    const totalCompleted = await db.applicationSubmission.count({
      where: {
        userId: user.id,
        wasAutomated: true,
        status: 'SUBMITTED',
      },
    });

    // Get success rate
    const totalAutomated = await db.applicationSubmission.count({
      where: {
        userId: user.id,
        wasAutomated: true,
      },
    });

    const successRate =
      totalAutomated > 0 ? (totalCompleted / totalAutomated) * 100 : 0;

    // Get last activity
    const lastActivity = await db.applicationSubmission.findFirst({
      where: {
        userId: user.id,
        wasAutomated: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get error count
    const errors = await db.automationAuditLog.count({
      where: {
        userId: user.id,
        actionType: 'error',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });

    // Get active platforms (default to all if automation is enabled)
    const platformsActive = settings?.isEnabled
      ? ['LinkedIn', 'Indeed', 'Glassdoor']
      : [];

    const systemStatus = {
      isRunning: settings?.isEnabled && !settings?.isPaused,
      totalScheduled,
      totalCompleted,
      successRate,
      lastActivity: lastActivity?.createdAt?.toISOString() || null,
      errors,
      platformsActive,
    };

    return NextResponse.json(systemStatus);
  } catch (error) {
    console.error('Failed to get automation status:', error);
    return NextResponse.json(
      { error: 'Failed to get automation status' },
      { status: 500 },
    );
  }
}
