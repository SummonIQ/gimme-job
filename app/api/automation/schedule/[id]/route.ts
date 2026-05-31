import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/server';
import { db } from '@/lib/db/client';

interface Params {
  params: Promise<{
    id: string;
  }>;
}

// Cancel a scheduled application
export async function DELETE(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Find the scheduled application
    const scheduledApp = await db.automationScheduledApplication.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!scheduledApp) {
      return NextResponse.json(
        { error: 'Scheduled application not found' },
        { status: 404 },
      );
    }

    if (scheduledApp.status !== 'scheduled') {
      return NextResponse.json(
        { error: 'Can only cancel scheduled applications' },
        { status: 400 },
      );
    }

    // Update status to cancelled
    await db.automationScheduledApplication.update({
      where: { id },
      data: {
        status: 'cancelled',
        updatedAt: new Date(),
      },
    });

    // Log the action
    await db.automationAuditLog.create({
      data: {
        userId: session.user.id,
        action: 'scheduled_application_cancelled',
        actionType: 'success',
        metadata: {
          scheduledApplicationId: id,
          jobLeadId: scheduledApp.jobLeadId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling scheduled application:', error);
    return NextResponse.json(
      { error: 'Failed to cancel scheduled application' },
      { status: 500 },
    );
  }
}

// Update scheduled time
export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { scheduledFor } = body;

    if (!scheduledFor) {
      return NextResponse.json(
        { error: 'scheduledFor is required' },
        { status: 400 },
      );
    }

    // Find the scheduled application
    const scheduledApp = await db.automationScheduledApplication.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!scheduledApp) {
      return NextResponse.json(
        { error: 'Scheduled application not found' },
        { status: 404 },
      );
    }

    if (scheduledApp.status !== 'scheduled') {
      return NextResponse.json(
        { error: 'Can only reschedule scheduled applications' },
        { status: 400 },
      );
    }

    // Update scheduled time
    const updated = await db.automationScheduledApplication.update({
      where: { id },
      data: {
        scheduledFor: new Date(scheduledFor),
        updatedAt: new Date(),
      },
      include: {
        jobLead: {
          include: {
            jobListing: true,
          },
        },
      },
    });

    // Log the action
    await db.automationAuditLog.create({
      data: {
        userId: session.user.id,
        action: 'scheduled_application_rescheduled',
        actionType: 'success',
        metadata: {
          scheduledApplicationId: id,
          oldTime: scheduledApp.scheduledFor,
          newTime: scheduledFor,
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error rescheduling application:', error);
    return NextResponse.json(
      { error: 'Failed to reschedule application' },
      { status: 500 },
    );
  }
}
