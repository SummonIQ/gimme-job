import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/query';
import { db } from '@/lib/db/client';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Update automation settings to enable automation
    const settings = await db.automationSettings.upsert({
      where: { userId: user.id },
      update: {
        isEnabled: true,
        isPaused: false,
        pauseReason: null,
        pausedAt: null,
      },
      create: {
        userId: user.id,
        isEnabled: true,
        isPaused: false,
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
        action: 'automation_started',
        actionType: 'info',
        metadata: {
          startedAt: new Date(),
        },
      },
    });

    return NextResponse.json({
      message: 'Automation started successfully',
      settings: {
        isEnabled: settings.isEnabled,
        isPaused: settings.isPaused,
        applicationsPerHour: settings.applicationsPerHour,
        applicationsPerDay: settings.applicationsPerDay,
      },
    });
  } catch (error) {
    console.error('Failed to start automation:', error);
    return NextResponse.json(
      { error: 'Failed to start automation' },
      { status: 500 }
    );
  }
}