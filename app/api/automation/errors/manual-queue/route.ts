import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/query';
import { automationErrorHandler } from '@/lib/automation/error-handler';
import { db } from '@/lib/db/client';
import { subDays } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const priority = searchParams.get('priority');
    const platform = searchParams.get('platform');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Fetch manual intervention items from audit log
    const manualItems = await db.automationAuditLog.findMany({
      where: {
        userId: user.id,
        action: 'manual_intervention_required',
        createdAt: {
          gte: subDays(new Date(), 30), // Last 30 days
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // Also fetch related scheduled applications that need manual review
    const manualReviewApps = await db.automationScheduledApplication.findMany({
      where: {
        userId: user.id,
        status: 'manual_review',
      },
      include: {
        jobLead: {
          select: {
            title: true,
            jobListing: {
              select: {
                company: true,
                jobProvider: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Transform into queue items
    const queueItems = [
      ...manualItems.map(item => {
        const metadata = item.metadata as any;
        const errorLog = metadata.errorLog || {};
        const context = metadata.context || {};

        // Determine priority based on severity
        let priority = 'medium';
        if (errorLog.severity === 'critical') priority = 'high';
        else if (errorLog.severity === 'low') priority = 'low';

        return {
          id: item.id,
          jobTitle: context.metadata?.jobTitle || 'Unknown Job',
          company: context.metadata?.company || 'Unknown Company',
          platform: context.platform || 'Unknown',
          errorMessage: errorLog.message || 'Manual intervention required',
          queuedAt: item.createdAt.toISOString(),
          priority,
          applicationId: context.applicationId,
          jobLeadId: context.jobLeadId,
        };
      }),
      ...manualReviewApps.map(app => ({
        id: app.id,
        jobTitle: app.jobLead?.title || 'Unknown Job',
        company: app.jobLead?.jobListing?.company || 'Unknown Company',
        platform: app.jobLead?.jobListing?.jobProvider || 'Unknown',
        errorMessage:
          (app.metadata as any)?.manualReviewReason || 'Requires manual review',
        queuedAt: app.createdAt.toISOString(),
        priority: 'medium' as const,
        applicationId: app.id,
        jobLeadId: app.jobLeadId,
      })),
    ];

    // Sort by priority and date
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    queueItems.sort((a, b) => {
      const priorityDiff =
        priorityOrder[a.priority as keyof typeof priorityOrder] -
        priorityOrder[b.priority as keyof typeof priorityOrder];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.queuedAt).getTime() - new Date(a.queuedAt).getTime();
    });

    // Apply filters
    let filteredQueue = queueItems;

    if (priority) {
      filteredQueue = filteredQueue.filter(item => item.priority === priority);
    }

    if (platform) {
      filteredQueue = filteredQueue.filter(item =>
        item.platform.toLowerCase().includes(platform.toLowerCase()),
      );
    }

    return NextResponse.json({
      queue: filteredQueue.slice(0, limit),
      total: filteredQueue.length,
      offset,
      limit,
    });
  } catch (error) {
    console.error('Error fetching manual queue:', error);
    return NextResponse.json(
      { error: 'Failed to fetch manual queue' },
      { status: 500 },
    );
  }
}
