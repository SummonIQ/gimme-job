import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/query';
import { db } from '@/lib/db/client';
import { AutomationScheduler, createScheduledApplications } from '@/lib/automation/scheduling';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobLeadIds, options = {} } = await request.json();

    if (!jobLeadIds || !Array.isArray(jobLeadIds) || jobLeadIds.length === 0) {
      return NextResponse.json(
        { error: 'Job lead IDs are required' },
        { status: 400 }
      );
    }

    // Get user's automation settings
    const settings = await db.automationSettings.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        isEnabled: false,
        applicationsPerHour: 5,
        applicationsPerDay: 25,
        minIntervalMinutes: 15,
        scheduleWeekdaysOnly: true,
        scheduleBusinessHoursOnly: true,
        preferredStartHour: 9,
        preferredEndHour: 17,
        userTimezone: 'America/New_York',
        ...options.settingsOverride,
      },
    });

    // Initialize scheduler
    const scheduler = new AutomationScheduler(user.id, settings);

    // Schedule the applications
    const scheduledApplications = await scheduler.scheduleApplications(jobLeadIds);

    // Save scheduled applications to database
    if (scheduledApplications.length > 0) {
      await createScheduledApplications(user.id, scheduledApplications);
    }

    return NextResponse.json({
      message: `Successfully scheduled ${scheduledApplications.length} applications`,
      scheduled: scheduledApplications,
      settings: {
        applicationsPerHour: settings.applicationsPerHour,
        applicationsPerDay: settings.applicationsPerDay,
        businessHoursOnly: settings.scheduleBusinessHoursOnly,
        weekdaysOnly: settings.scheduleWeekdaysOnly,
      },
    });
  } catch (error) {
    console.error('Failed to batch schedule applications:', error);
    return NextResponse.json(
      { error: 'Failed to schedule applications' },
      { status: 500 }
    );
  }
}