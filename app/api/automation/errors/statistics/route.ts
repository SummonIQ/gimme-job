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

    // Get statistics from error handler
    const stats = await automationErrorHandler.getErrorStatistics(user.id);

    // Get recent trend data
    const now = new Date();
    const dayAgo = subDays(now, 1);
    const weekAgo = subDays(now, 7);

    // Fetch error counts for trend analysis
    const [recentErrors, previousErrors] = await Promise.all([
      db.automationAuditLog.count({
        where: {
          userId: user.id,
          action: 'automation_error',
          createdAt: {
            gte: dayAgo,
          },
        },
      }),
      db.automationAuditLog.count({
        where: {
          userId: user.id,
          action: 'automation_error',
          createdAt: {
            gte: subDays(dayAgo, 1),
            lt: dayAgo,
          },
        },
      }),
    ]);

    // Determine trend
    let recentTrend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (recentErrors > previousErrors * 1.2) {
      recentTrend = 'increasing';
    } else if (recentErrors < previousErrors * 0.8) {
      recentTrend = 'decreasing';
    }

    // Get critical error count
    const criticalErrors = await db.automationAuditLog.count({
      where: {
        userId: user.id,
        action: 'automation_error',
        createdAt: {
          gte: weekAgo,
        },
        metadata: {
          path: ['severity'],
          equals: 'critical',
        },
      },
    });

    // Get manual intervention queue count
    const manualQueueCount = await db.automationAuditLog.count({
      where: {
        userId: user.id,
        action: 'manual_intervention_required',
        createdAt: {
          gte: weekAgo,
        },
      },
    });

    // Calculate category breakdown if not available from handler
    if (
      !stats.errorsByCategory ||
      Object.keys(stats.errorsByCategory).length === 0
    ) {
      const errorLogs = await db.automationAuditLog.findMany({
        where: {
          userId: user.id,
          action: 'automation_error',
          createdAt: {
            gte: weekAgo,
          },
        },
        select: {
          metadata: true,
        },
      });

      const categoryCount: Record<string, number> = {};
      const severityCount: Record<string, number> = {};

      errorLogs.forEach(log => {
        const metadata = log.metadata as any;
        const category = metadata.category || 'unknown';
        const severity = metadata.severity || 'medium';

        categoryCount[category] = (categoryCount[category] || 0) + 1;
        severityCount[severity] = (severityCount[severity] || 0) + 1;
      });

      stats.errorsByCategory = categoryCount;
      stats.errorsBySeverity = severityCount;
    }

    // Add critical count to severity breakdown
    if (!stats.errorsBySeverity) {
      stats.errorsBySeverity = {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      };
    }
    stats.errorsBySeverity.critical = criticalErrors;

    return NextResponse.json({
      ...stats,
      recentTrend,
      manualQueueCount,
      recentErrorCount: recentErrors,
      previousErrorCount: previousErrors,
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 },
    );
  }
}
