import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/query';
import { automationErrorHandler } from '@/lib/automation/error-handler';
import { db } from '@/lib/db/client';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { errorId, resolutionMethod = 'manual', notes } = body;

    if (!errorId) {
      return NextResponse.json(
        { error: 'errorId is required' },
        { status: 400 },
      );
    }

    // Resolve error in handler
    await automationErrorHandler.resolveError(errorId, resolutionMethod);

    // Also update in database
    const errorLog = await db.automationAuditLog.findFirst({
      where: {
        userId: user.id,
        OR: [
          { id: errorId },
          {
            metadata: {
              path: ['id'],
              equals: errorId,
            },
          },
        ],
      },
    });

    if (errorLog) {
      const metadata = errorLog.metadata as any;

      // Update the metadata to mark as resolved
      await db.automationAuditLog.update({
        where: { id: errorLog.id },
        data: {
          metadata: {
            ...metadata,
            resolved: true,
            resolvedAt: new Date(),
            resolutionMethod,
            resolutionNotes: notes,
          },
        },
      });

      // If there's an associated application, update its status
      const context = metadata.context || {};
      if (context.applicationId) {
        const scheduledApp = await db.automationScheduledApplication.findUnique(
          {
            where: {
              id: context.applicationId,
              userId: user.id,
            },
          },
        );

        if (scheduledApp && scheduledApp.status === 'manual_review') {
          await db.automationScheduledApplication.update({
            where: { id: context.applicationId },
            data: {
              status: 'resolved',
              metadata: {
                ...((scheduledApp.metadata as any) || {}),
                resolvedAt: new Date(),
                resolutionMethod,
                resolutionNotes: notes,
              },
            },
          });
        }
      }

      // Remove from manual intervention queue if present
      if (context.applicationId || context.jobLeadId) {
        await db.automationAuditLog.deleteMany({
          where: {
            userId: user.id,
            action: 'manual_intervention_required',
            metadata: {
              path: [
                'context',
                context.applicationId ? 'applicationId' : 'jobLeadId',
              ],
              equals: context.applicationId || context.jobLeadId,
            },
          },
        });
      }

      // Log resolution action
      await db.automationAuditLog.create({
        data: {
          userId: user.id,
          action: 'error_resolved',
          actionType: 'success',
          metadata: {
            errorId,
            resolutionMethod,
            notes,
            resolvedAt: new Date(),
            originalError: metadata.message,
          },
        },
      });

      // Send notification about resolution
      await db.notification.create({
        data: {
          userId: user.id,
          title: 'Error Resolved',
          message: `Error for ${metadata.context?.metadata?.jobTitle || 'application'} has been resolved`,
          type: 'AUTOMATION',
          metadata: {
            errorId,
            resolutionMethod,
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Error marked as resolved',
        errorId,
        resolutionMethod,
      });
    }

    return NextResponse.json({ error: 'Error log not found' }, { status: 404 });
  } catch (error) {
    console.error('Error resolving:', error);
    return NextResponse.json(
      { error: 'Failed to resolve error' },
      { status: 500 },
    );
  }
}
