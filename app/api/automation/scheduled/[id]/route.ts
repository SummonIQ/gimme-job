import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/query';
import { db } from '@/lib/db/client';

export async function DELETE(
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
        status: 'scheduled',
      },
    });

    if (!application) {
      return NextResponse.json(
        { error: 'Scheduled application not found or already processed' },
        { status: 404 }
      );
    }

    // Update status to cancelled
    await db.automationScheduledApplication.update({
      where: { id: applicationId },
      data: {
        status: 'cancelled',
        metadata: {
          ...(application.metadata as any || {}),
          cancelledAt: new Date(),
          cancelledBy: 'user',
        },
      },
    });

    // Log the cancellation
    await db.automationAuditLog.create({
      data: {
        userId: user.id,
        action: 'application_cancelled',
        actionType: 'warning',
        metadata: {
          applicationId,
          jobLeadId: application.jobLeadId,
          scheduledFor: application.scheduledFor,
          reason: 'User manually cancelled scheduled application',
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling scheduled application:', error);
    return NextResponse.json(
      { error: 'Failed to cancel scheduled application' },
      { status: 500 }
    );
  }
}