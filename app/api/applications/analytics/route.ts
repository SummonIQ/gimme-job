import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/server';
import { db } from '@/lib/db/client';
import { ApplicationStatus } from '@/generated/prisma/browser';
import { z } from 'zod';

const analyticsQuerySchema = z.object({
  timeframe: z
    .enum(['7d', '30d', '90d', '1y', 'all'])
    .optional()
    .default('30d'),
  type: z.enum(['overview', 'response-time']).optional().default('overview'),
  resumeId: z.string().optional(),
  resumeRevisionId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = analyticsQuerySchema.parse({
      timeframe: searchParams.get('timeframe') || '30d',
      type: searchParams.get('type') || 'overview',
      resumeId: searchParams.get('resumeId') || undefined,
      resumeRevisionId: searchParams.get('resumeRevisionId') || undefined,
    });

    // Calculate date range
    const now = new Date();
    let since: Date;

    switch (query.timeframe) {
      case '7d':
        since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        since = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        since = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        since = new Date(0); // All time
    }

    // Filter by createdAt rather than submittedAt — FAILED submission rows
    // never get a `submittedAt` set (the submit click didn't succeed), so
    // filtering on submittedAt makes the entire failure history invisible
    // to the dashboard and the success rate looks like 100%. createdAt
    // catches both SUBMITTED and FAILED rows in the time window.
    const whereClause = {
      userId: session.user.id,
      createdAt: query.timeframe !== 'all' ? { gte: since } : undefined,
      resumeId: query.resumeId,
      // Note: resumeRevisionId would need to be added to ApplicationSubmission model
    };

    // Get all applications in parallel
    const [
      totalApplications,
      statusDistribution,
      responseData,
      interviewData,
      offerData,
      timelineData,
    ] = await Promise.all([
      // Total applications
      db.applicationSubmission.count({
        where: whereClause,
      }),

      // Status distribution
      db.applicationSubmission.groupBy({
        by: ['status'],
        where: whereClause,
        _count: { status: true },
      }),

      // Response rate data
      db.applicationSubmission.findMany({
        where: {
          ...whereClause,
          responseReceivedAt: { not: null },
        },
        select: {
          daysToResponse: true,
          responseReceivedAt: true,
        },
      }),

      // Interview data
      db.applicationSubmission.findMany({
        where: {
          ...whereClause,
          interviewCount: { gt: 0 },
        },
        select: {
          interviewCount: true,
          status: true,
        },
      }),

      // Offer data
      db.applicationSubmission.findMany({
        where: {
          ...whereClause,
          status: {
            in: [
              ApplicationStatus.OFFER_RECEIVED,
              ApplicationStatus.OFFER_ACCEPTED,
              ApplicationStatus.OFFER_REJECTED,
            ],
          },
        },
        select: {
          status: true,
          daysToFinalOutcome: true,
        },
      }),

      // Timeline data for trend analysis
      db.applicationSubmission.findMany({
        where: whereClause,
        select: {
          createdAt: true,
          submittedAt: true,
          status: true,
          daysToResponse: true,
          daysToFinalOutcome: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Calculate metrics
    const totalResponses = responseData.length;
    const totalInterviews = interviewData.length;
    const totalOffers = offerData.length;

    const responseRate =
      totalApplications > 0 ? (totalResponses / totalApplications) * 100 : 0;
    const interviewRate =
      totalApplications > 0 ? (totalInterviews / totalApplications) * 100 : 0;
    const offerRate =
      totalApplications > 0 ? (totalOffers / totalApplications) * 100 : 0;

    // Average response time
    const avgResponseTime =
      responseData.length > 0
        ? responseData.reduce(
            (sum, app) => sum + (app.daysToResponse || 0),
            0,
          ) / responseData.length
        : 0;

    // Average time to offer
    const avgOfferTime =
      offerData.length > 0
        ? offerData.reduce(
            (sum, app) => sum + (app.daysToFinalOutcome || 0),
            0,
          ) / offerData.length
        : 0;

    // Success rate (offers / applications)
    const successRate = offerRate;

    // Conversion funnel
    const conversionFunnel = {
      applications: totalApplications,
      responses: totalResponses,
      interviews: totalInterviews,
      offers: totalOffers,
      responseRate,
      interviewRate,
      offerRate,
      successRate,
    };

    // Status breakdown for pie chart
    const statusBreakdown = statusDistribution.map(item => ({
      status: item.status,
      count: item._count.status,
      percentage:
        totalApplications > 0
          ? (item._count.status / totalApplications) * 100
          : 0,
    }));

    // Timeline trends (group by week). Use submittedAt when present, fall
    // back to createdAt so FAILED rows (which never get submittedAt) still
    // show up as application attempts in the weekly chart.
    const timelineTrends = timelineData.reduce(
      (acc, app) => {
        const reference = app.submittedAt ?? app.createdAt;
        if (!reference) return acc;

        const weekStart = new Date(reference);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];

        if (!acc[weekKey]) {
          acc[weekKey] = {
            week: weekKey,
            applications: 0,
            responses: 0,
            interviews: 0,
            offers: 0,
          };
        }

        acc[weekKey].applications++;
        if (app.daysToResponse !== null) acc[weekKey].responses++;
        if (
          app.status === ApplicationStatus.INTERVIEW_SCHEDULED ||
          app.status === ApplicationStatus.INTERVIEW_COMPLETED
        ) {
          acc[weekKey].interviews++;
        }
        if (
          app.status === ApplicationStatus.OFFER_RECEIVED ||
          app.status === ApplicationStatus.OFFER_ACCEPTED
        ) {
          acc[weekKey].offers++;
        }

        return acc;
      },
      {} as Record<string, any>,
    );

    // Return response-time specific data if requested
    if (query.type === 'response-time') {
      const responseTimes = responseData
        .map(r => r.daysToResponse || 0)
        .filter(d => d > 0);
      const interviewSchedulingTimes = interviewData
        .filter(i => i.status === ApplicationStatus.INTERVIEW_SCHEDULED)
        .map(() => Math.random() * 10 + 5); // Placeholder - would need actual field
      const offerDeliveryTimes = offerData
        .map(o => o.daysToFinalOutcome || 0)
        .filter(d => d > 0);

      // Calculate distribution
      const ranges = [
        { label: '0-1 days', min: 0, max: 1 },
        { label: '2-7 days', min: 2, max: 7 },
        { label: '1-2 weeks', min: 8, max: 14 },
        { label: '2-4 weeks', min: 15, max: 28 },
        { label: '1+ months', min: 29, max: Infinity },
      ];

      const distribution = ranges.map(range => {
        const count = responseTimes.filter(
          time => time >= range.min && time <= range.max,
        ).length;
        return {
          range: range.label,
          count,
          percentage:
            responseTimes.length > 0
              ? Math.round((count / responseTimes.length) * 100)
              : 0,
        };
      });

      const responseTimeMetrics = {
        avgFirstResponse:
          responseTimes.length > 0
            ? responseTimes.reduce((sum, t) => sum + t, 0) /
              responseTimes.length
            : 0,
        avgInterviewScheduling:
          interviewSchedulingTimes.length > 0
            ? interviewSchedulingTimes.reduce((sum, t) => sum + t, 0) /
              interviewSchedulingTimes.length
            : 0,
        avgOfferDelivery:
          offerDeliveryTimes.length > 0
            ? offerDeliveryTimes.reduce((sum, t) => sum + t, 0) /
              offerDeliveryTimes.length
            : 0,
        fastestResponse:
          responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
        slowestResponse:
          responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
        responseTimeDistribution: distribution,
      };

      return NextResponse.json(responseTimeMetrics);
    }

    const analytics = {
      summary: {
        totalApplications,
        responseRate: Math.round(responseRate * 100) / 100,
        interviewRate: Math.round(interviewRate * 100) / 100,
        offerRate: Math.round(offerRate * 100) / 100,
        successRate: Math.round(successRate * 100) / 100,
        avgResponseTime: Math.round(avgResponseTime * 10) / 10,
        avgOfferTime: Math.round(avgOfferTime * 10) / 10,
      },
      conversionFunnel,
      statusBreakdown,
      timelineTrends: Object.values(timelineTrends).sort(
        (a: any, b: any) =>
          new Date(a.week).getTime() - new Date(b.week).getTime(),
      ),
      timeframe: query.timeframe,
      dateRange: {
        start: since.toISOString(),
        end: now.toISOString(),
      },
    };

    return NextResponse.json(analytics);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.issues },
        { status: 400 },
      );
    }

    console.error('Error fetching application analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
