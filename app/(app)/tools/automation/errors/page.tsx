import { subDays } from 'date-fns';
import { unauthorized } from 'next/navigation';

import { automationErrorHandler } from '@/lib/automation/error-handler';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';

import PageClient from './page-client';

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const weekAgo = subDays(new Date(), 7);

  // Fetch initial data in parallel (same queries as the API routes)
  const [errorLogsRaw, stats, manualItems, manualReviewApps] =
    await Promise.all([
      db.automationAuditLog.findMany({
        where: {
          userId: user.id,
          action: 'automation_error',
          createdAt: { gte: weekAgo },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      automationErrorHandler.getErrorStatistics(user.id),
      db.automationAuditLog.findMany({
        where: {
          userId: user.id,
          action: 'manual_intervention_required',
          createdAt: { gte: subDays(new Date(), 30) },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      db.automationScheduledApplication.findMany({
        where: { userId: user.id, status: 'manual_review' },
        include: {
          jobLead: {
            select: {
              title: true,
              jobListing: {
                select: { company: true, jobProvider: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

  // Transform error logs
  const initialErrors = errorLogsRaw.map(log => {
    const metadata = log.metadata as any;
    return {
      id: metadata.id || log.id,
      timestamp: log.createdAt.toISOString(),
      category: metadata.category || 'unknown',
      severity: metadata.severity || 'medium',
      message: metadata.message || 'Error occurred',
      platform: metadata.context?.platform,
      jobTitle: metadata.context?.metadata?.jobTitle,
      company: metadata.context?.metadata?.company,
      attemptNumber: metadata.context?.attemptNumber,
      resolved: metadata.resolved || false,
      resolvedAt: metadata.resolvedAt,
      resolutionMethod: metadata.resolutionMethod,
      suggestedAction: metadata.resolution?.suggestedAction,
      isRetryable: metadata.resolution?.isRetryable || false,
      requiresUserAction: metadata.resolution?.requiresUserAction || false,
    };
  });

  // Transform manual queue
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const initialManualQueue = [
    ...manualItems.map(item => {
      const metadata = item.metadata as any;
      const errorLog = metadata.errorLog || {};
      const context = metadata.context || {};
      let priority: string = 'medium';
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
    })),
  ].sort((a, b) => {
    const diff =
      (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 1) -
      (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 1);
    if (diff !== 0) return diff;
    return new Date(b.queuedAt).getTime() - new Date(a.queuedAt).getTime();
  });

  return (
    <PageClient
      initialErrors={initialErrors}
      initialStatistics={stats}
      initialManualQueue={initialManualQueue}
    />
  );
}
