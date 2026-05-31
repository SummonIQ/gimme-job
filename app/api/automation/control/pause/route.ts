import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/query';
import { db } from '@/lib/db/client';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { reason = 'User requested pause' } = await request.json().catch(() => ({}));

    // Update automation settings to pause automation
    const settings = await db.automationSettings.upsert({
      where: { userId: user.id },
      update: {
        isPaused: true,
        pauseReason: reason,
        pausedAt: new Date(),
      },
      create: {
        userId: user.id,
        isEnabled: false,
        isPaused: true,
        pauseReason: reason,
        pausedAt: new Date(),
        applicationsPerHour: 5,
        applicationsPerDay: 25,
        minIntervalMinutes: 15,
        scheduleWeekdaysOnly: true,
        scheduleBusinessHoursOnly: true,
        preferredStartHour: 9,
        preferredEndHour: 17,
        userTimezone: 'America/New_York',
      },
    });

    // Create audit log entry
    await db.automationAuditLog.create({
      data: {
        userId: user.id,
        action: 'automation_paused',
        actionType: 'warning',
        metadata: {
          pausedAt: new Date(),
          reason,
        },
      },
    });

    return NextResponse.json({
      message: 'Automation paused successfully',
      settings: {
        isEnabled: settings.isEnabled,
        isPaused: settings.isPaused,
        pauseReason: settings.pauseReason,
        pausedAt: settings.pausedAt,
      },
    });
  } catch (error) {
    console.error('Failed to pause automation:', error);
    return NextResponse.json(
      { error: 'Failed to pause automation' },
      { status: 500 }
    );
  }
}