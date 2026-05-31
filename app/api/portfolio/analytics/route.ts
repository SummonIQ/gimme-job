import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/query';
import { portfolioAnalytics } from '@/lib/portfolio/portfolio-analytics';
import { db } from '@/lib/db/client';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const portfolioId = searchParams.get('portfolioId');
    const days = parseInt(searchParams.get('days') || '30');

    if (!portfolioId) {
      return NextResponse.json(
        { error: 'Portfolio ID is required' },
        { status: 400 }
      );
    }

    // Verify user owns the portfolio
    const portfolio = await db.portfolio.findFirst({
      where: {
        id: portfolioId,
        userId: user.id
      }
    });

    if (!portfolio) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    // Get analytics data
    const [analytics, performanceComparison] = await Promise.all([
      portfolioAnalytics.getAnalytics(portfolioId, days),
      portfolioAnalytics.getPerformanceComparison(portfolioId)
    ]);

    return NextResponse.json({
      success: true,
      analytics,
      performanceComparison,
      period: `${days} days`
    });

  } catch (error) {
    console.error('Failed to fetch portfolio analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      portfolioId,
      viewType = 'PUBLIC_VIEW',
      visitorId,
      userAgent,
      ipAddress,
      referrer,
      location,
      sessionDuration,
      pagesViewed = [],
      projectsViewed = [],
      contactFormSubmitted = false
    } = body;

    if (!portfolioId) {
      return NextResponse.json(
        { error: 'Portfolio ID is required' },
        { status: 400 }
      );
    }

    // Verify portfolio exists
    const portfolio = await db.portfolio.findUnique({
      where: { id: portfolioId },
      select: { id: true, status: true }
    });

    if (!portfolio) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    // Only track views for published portfolios (allow private for direct shares)
    if (portfolio.status === 'ARCHIVED') {
      return NextResponse.json({ error: 'Portfolio is archived' }, { status: 403 });
    }

    // Track the view
    const view = await portfolioAnalytics.trackView({
      portfolioId,
      viewType,
      visitorId,
      userAgent,
      ipAddress,
      referrer,
      location,
      sessionDuration,
      pagesViewed,
      projectsViewed,
      contactFormSubmitted
    });

    return NextResponse.json({
      success: true,
      viewId: view.id,
      message: 'View tracked successfully'
    });

  } catch (error) {
    console.error('Failed to track portfolio view:', error);
    return NextResponse.json(
      { error: 'Failed to track view' },
      { status: 500 }
    );
  }
}