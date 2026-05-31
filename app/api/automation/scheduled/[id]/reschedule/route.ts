import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/query';
import { db } from '@/lib/db/client';
import { IntelligentScheduler } from '@/lib/automation/intelligent-scheduler';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: applicationId } = await params;

    // Get the scheduled application
    const application = await db.automationScheduledApplication.findFirst({
      where: {
        id: applicationId,
        userId: user.id,
      },
    });

    if (!application) {
      return NextResponse.json(
        { error: 'Scheduled application not found' },
        { status: 404 }
      );
    }

    // Get user's automation settings
    const settings = await db.automationSettings.findUnique({
      where: { userId: user.id },
    });

    if (!settings) {
      return NextResponse.json(
        { error: 'Automation settings not configured' },
        { status: 400 }
      );
    }

    // Use intelligent scheduler to reschedule
    const scheduler = new IntelligentScheduler(user.id, settings);
    const newScheduledTime = await scheduler.rescheduleFailedApplication(
      applicationId,
      'Manual reschedule requested'
    );

    if (!newScheduledTime) {
      return NextResponse.json(
        { error: 'Unable to find a suitable reschedule slot' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      newScheduledTime: newScheduledTime.toISOString(),
    });
  } catch (error) {
    console.error('Error rescheduling application:', error);
    return NextResponse.json(
      { error: 'Failed to reschedule application' },
      { status: 500 }
    );
  }
}