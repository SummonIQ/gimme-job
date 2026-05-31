import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/query';
import { automationErrorHandler } from '@/lib/automation/error-handler';
import { db } from '@/lib/db/client';
import { addMinutes } from 'date-fns';
import { IntelligentScheduler } from '@/lib/automation/intelligent-scheduler';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { errorId, applicationId, immediate = false } = body;

    if (!errorId && !applicationId) {
      return NextResponse.json(
        { error: 'Either errorId or applicationId is required' },
        { status: 400 },
      );
    }

    // If we have an applicationId, schedule for retry
    if (applicationId) {
      // Fetch the scheduled application
      const scheduledApp = await db.automationScheduledApplication.findUnique({
        where: {
          id: applicationId,
          userId: user.id,
        },
        include: {
          jobLead: {
            include: {
              jobListing: true,
            },
          },
        },
      });

      if (!scheduledApp) {
        return NextResponse.json(
          { error: 'Application not found' },
          { status: 404 },
        );
      }

      // Determine retry time
      let retryAt: Date;
      if (immediate) {
        retryAt = new Date(); // Retry immediately
      } else {
        // Use exponential backoff for retry timing
        const attemptCount = scheduledApp.attemptCount || 0;
        const baseDelay = 15; // Base 15 minutes
        const delayMultiplier = Math.pow(2, attemptCount); // Exponential backoff
        const delayMinutes = Math.min(baseDelay * delayMultiplier, 240); // Max 4 hours
        retryAt = addMinutes(new Date(), delayMinutes);
      }

      // Update the scheduled application
      await db.automationScheduledApplication.update({
        where: { id: applicationId },
        data: {
          status: 'scheduled',
          scheduledFor: retryAt,
          attemptCount: (scheduledApp.attemptCount || 0) + 1,
          metadata: {
            ...((scheduledApp.metadata as any) || {}),
            retriedAt: new Date(),
            retryReason: 'Manual retry requested',
          },
        },
      });

      // Log the retry action
      await db.automationAuditLog.create({
        data: {
          userId: user.id,
          action: 'manual_retry',
          actionType: 'info',
          metadata: {
            applicationId,
            retryAt: retryAt.toISOString(),
            immediate,
            jobTitle: scheduledApp.jobLead.title,
            company: scheduledApp.jobLead.jobListing.company,
          },
        },
      });

      return NextResponse.json({
        success: true,
        applicationId,
        retryAt: retryAt.toISOString(),
        message: immediate
          ? 'Application scheduled for immediate retry'
          : `Application scheduled for retry at ${retryAt.toLocaleString()}`,
      });
    }

    // If we only have errorId, try to find associated application
    if (errorId) {
      // Find the error log
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

      if (!errorLog) {
        return NextResponse.json(
          { error: 'Error log not found' },
          { status: 404 },
        );
      }

      const metadata = errorLog.metadata as any;
      const context = metadata.context || {};

      if (context.applicationId) {
        // Recursively call with applicationId
        return POST(
          new NextRequest(request.url, {
            method: 'POST',
            body: JSON.stringify({
              applicationId: context.applicationId,
              immediate,
            }),
          }),
        );
      }

      // If no applicationId, try to create a new scheduled application from job lead
      if (context.jobLeadId) {
        const jobLead = await db.jobLead.findUnique({
          where: {
            id: context.jobLeadId,
            userId: user.id,
          },
          include: {
            jobListing: true,
          },
        });

        if (!jobLead) {
          return NextResponse.json(
            { error: 'Job lead not found' },
            { status: 404 },
          );
        }

        // Create new scheduled application with simple delay
        const retryDelay = immediate ? 0 : 15; // 15 minutes default delay
        const scheduledFor = addMinutes(new Date(), retryDelay);

        const newScheduledApp = await db.automationScheduledApplication.create({
          data: {
            userId: user.id,
            jobLeadId: jobLead.id,
            status: 'scheduled',
            scheduledFor,
            attemptCount: 1,
            metadata: {
              retryFromError: errorId,
              originalError: metadata.message,
            },
          },
        });

        return NextResponse.json({
          success: true,
          applicationId: newScheduledApp.id,
          retryAt: newScheduledApp.scheduledFor.toISOString(),
          message: `New application scheduled for retry`,
        });
      }

      return NextResponse.json(
        { error: 'Cannot retry: no application or job lead found' },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error('Error scheduling retry:', error);
    return NextResponse.json(
      { error: 'Failed to schedule retry' },
      { status: 500 },
    );
  }
}
