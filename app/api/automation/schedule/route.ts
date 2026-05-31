import {
  AutomationScheduler,
  createScheduledApplications,
} from '@/lib/automation/scheduling';
import { db } from '@/lib/db/client';
import {
  requireAuth,
  validateRequestBody,
  withApiErrorHandling,
} from '@/lib/errors/api';
import { getCurrentUser } from '@/lib/user/query';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const scheduleSchema = z.object({
  jobLeadIds: z.array(z.string()).min(1),
});

const handlePOST = async (request: NextRequest): Promise<NextResponse> => {
  const user = await getCurrentUser();
  requireAuth(user);

  const body = await request.json();
  const { jobLeadIds } = validateRequestBody<z.infer<typeof scheduleSchema>>(
    body,
    scheduleSchema,
  );

  // Get user's automation settings
  const settings = await db.automationSettings.findUnique({
    where: { userId: user!.id },
  });

  if (!settings || !settings.isEnabled || settings.isPaused) {
    return NextResponse.json(
      {
        error: 'Automation is not enabled or is paused',
        userMessage: 'Please enable automation in settings before scheduling.',
      },
      { status: 400 },
    );
  }

  // Check if smart scheduling is enabled
  if (!settings.enableSmartScheduling) {
    return NextResponse.json(
      {
        error: 'Smart scheduling is not enabled',
        userMessage: 'Enable smart scheduling in your automation settings.',
      },
      { status: 400 },
    );
  }

  // Create scheduler instance
  const scheduler = new AutomationScheduler(user!.id, settings);

  // Schedule applications
  const scheduledApplications =
    await scheduler.scheduleApplications(jobLeadIds);

  if (scheduledApplications.length === 0) {
    return NextResponse.json(
      {
        error: 'No applications could be scheduled',
        userMessage:
          'All selected jobs have already been applied to or cannot be scheduled.',
      },
      { status: 400 },
    );
  }

  // Save to database
  await createScheduledApplications(user!.id, scheduledApplications);

  // Log the scheduling action
  await db.automationAuditLog.create({
    data: {
      userId: user!.id,
      action: 'applications_scheduled',
      actionType: 'success',
      metadata: {
        count: scheduledApplications.length,
        jobLeadIds,
      },
    },
  });

  return NextResponse.json({
    success: true,
    scheduled: scheduledApplications.length,
    applications: scheduledApplications,
  });
};

// Get scheduled applications
const handleGET = async (request: NextRequest): Promise<NextResponse> => {
  const user = await getCurrentUser();
  requireAuth(user);

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'scheduled';
  const limit = parseInt(searchParams.get('limit') || '20');

  const scheduledApplications =
    await db.automationScheduledApplication.findMany({
      where: {
        userId: user!.id,
        status,
      },
      include: {
        jobLead: {
          select: {
            id: true,
            title: true,
            status: true,
            jobListing: {
              select: {
                id: true,
                title: true,
                company: true,
                location: true,
                salary: true,
                jobType: true,
                remote: true,
                source: true,
                jobProvider: true,
                jobProviderUrl: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: [{ scheduledFor: 'asc' }, { priority: 'desc' }],
      take: limit,
    });

  return NextResponse.json({
    success: true,
    applications: scheduledApplications,
    total: scheduledApplications.length,
  });
};

export const POST = withApiErrorHandling(handlePOST);
export const GET = withApiErrorHandling(handleGET);
