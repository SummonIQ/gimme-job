import { db } from '@/lib/db/client';
import { format, startOfDay, subDays, subMonths } from 'date-fns';
import type { PortfolioViewType } from '@/generated/prisma/browser';

interface AnalyticsMetrics {
  totalViews: number;
  uniqueVisitors: number;
  avgSessionDuration: number;
  bounceRate: number;
  topProjects: Array<{
    projectId: string;
    projectTitle: string;
    views: number;
  }>;
  topReferrers: Array<{
    referrer: string;
    views: number;
  }>;
  deviceBreakdown: {
    mobile: number;
    desktop: number;
    tablet: number;
  };
  locationBreakdown: Array<{
    location: string;
    views: number;
  }>;
  timeSeriesData: Array<{
    date: string;
    views: number;
    uniqueVisitors: number;
  }>;
}

interface ViewTrackingData {
  portfolioId: string;
  viewType: PortfolioViewType;
  visitorId?: string;
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
  location?: string;
  sessionDuration?: number;
  pagesViewed?: string[];
  projectsViewed?: string[];
  contactFormSubmitted?: boolean;
}

export class PortfolioAnalytics {

  /**
   * Track a portfolio view
   */
  async trackView(data: ViewTrackingData) {
    // Create the view record
    const view = await db.portfolioView.create({
      data: {
        portfolioId: data.portfolioId,
        viewType: data.viewType,
        visitorId: data.visitorId,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
        referrer: data.referrer,
        location: data.location,
        sessionDuration: data.sessionDuration,
        pagesViewed: data.pagesViewed || [],
        projectsViewed: data.projectsViewed || [],
        contactFormSubmitted: data.contactFormSubmitted || false
      }
    });

    // Increment portfolio view count
    await db.portfolio.update({
      where: { id: data.portfolioId },
      data: {
        viewCount: { increment: 1 },
        lastViewedAt: new Date()
      }
    });

    // Increment project view counts if any projects were viewed
    if (data.projectsViewed && data.projectsViewed.length > 0) {
      await db.portfolioProject.updateMany({
        where: {
          id: { in: data.projectsViewed }
        },
        data: {
          viewCount: { increment: 1 }
        }
      });
    }

    // Update daily analytics (async, don't wait)
    this.updateDailyAnalytics(data.portfolioId).catch(console.error);

    return view;
  }

  /**
   * Get analytics for a portfolio
   */
  async getAnalytics(portfolioId: string, days: number = 30): Promise<AnalyticsMetrics> {
    const startDate = startOfDay(subDays(new Date(), days));

    // Get basic metrics
    const [views, uniqueVisitors] = await Promise.all([
      db.portfolioView.count({
        where: {
          portfolioId,
          viewedAt: { gte: startDate }
        }
      }),
      db.portfolioView.groupBy({
        by: ['visitorId'],
        where: {
          portfolioId,
          viewedAt: { gte: startDate },
          visitorId: { not: null }
        },
        _count: true
      })
    ]);

    // Get session duration and bounce rate
    const sessionData = await db.portfolioView.findMany({
      where: {
        portfolioId,
        viewedAt: { gte: startDate },
        sessionDuration: { not: null }
      },
      select: {
        sessionDuration: true,
        pagesViewed: true
      }
    });

    const avgSessionDuration = sessionData.length > 0
      ? sessionData.reduce((sum, view) => sum + (view.sessionDuration || 0), 0) / sessionData.length
      : 0;

    const bounceRate = sessionData.length > 0
      ? sessionData.filter(view => view.pagesViewed.length <= 1).length / sessionData.length
      : 0;

    // Get top projects
    const projectViews = await db.portfolioView.findMany({
      where: {
        portfolioId,
        viewedAt: { gte: startDate },
        projectsViewed: { not: { equals: [] } }
      },
      select: { projectsViewed: true }
    });

    const projectViewCounts: Record<string, number> = {};
    projectViews.forEach(view => {
      view.projectsViewed.forEach(projectId => {
        projectViewCounts[projectId] = (projectViewCounts[projectId] || 0) + 1;
      });
    });

    const topProjectIds = Object.entries(projectViewCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id]) => id);

    const topProjects = await db.portfolioProject.findMany({
      where: { id: { in: topProjectIds } },
      select: { id: true, title: true }
    });

    const topProjectsWithViews = topProjects.map(project => ({
      projectId: project.id,
      projectTitle: project.title,
      views: projectViewCounts[project.id] || 0
    }));

    // Get top referrers
    const referrerData = await db.portfolioView.groupBy({
      by: ['referrer'],
      where: {
        portfolioId,
        viewedAt: { gte: startDate },
        referrer: { not: null }
      },
      _count: true,
      orderBy: { _count: { referrer: 'desc' } },
      take: 10
    });

    const topReferrers = referrerData.map(item => ({
      referrer: item.referrer || 'Direct',
      views: item._count
    }));

    // Get device breakdown (simplified from user agent)
    const deviceData = await db.portfolioView.findMany({
      where: {
        portfolioId,
        viewedAt: { gte: startDate },
        userAgent: { not: null }
      },
      select: { userAgent: true }
    });

    const deviceBreakdown = { mobile: 0, desktop: 0, tablet: 0 };
    deviceData.forEach(({ userAgent }) => {
      if (userAgent) {
        if (userAgent.includes('Mobile') || userAgent.includes('Android')) {
          deviceBreakdown.mobile++;
        } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
          deviceBreakdown.tablet++;
        } else {
          deviceBreakdown.desktop++;
        }
      }
    });

    // Get location breakdown
    const locationData = await db.portfolioView.groupBy({
      by: ['location'],
      where: {
        portfolioId,
        viewedAt: { gte: startDate },
        location: { not: null }
      },
      _count: true,
      orderBy: { _count: { location: 'desc' } },
      take: 10
    });

    const locationBreakdown = locationData.map(item => ({
      location: item.location || 'Unknown',
      views: item._count
    }));

    // Get time series data
    const timeSeriesData = await this.getTimeSeriesData(portfolioId, days);

    return {
      totalViews: views,
      uniqueVisitors: uniqueVisitors.length,
      avgSessionDuration,
      bounceRate,
      topProjects: topProjectsWithViews,
      topReferrers,
      deviceBreakdown,
      locationBreakdown,
      timeSeriesData
    };
  }

  /**
   * Get time series data for analytics charts
   */
  private async getTimeSeriesData(portfolioId: string, days: number) {
    const analytics = await db.portfolioAnalytics.findMany({
      where: {
        portfolioId,
        date: {
          gte: startOfDay(subDays(new Date(), days))
        }
      },
      orderBy: { date: 'asc' }
    });

    return analytics.map(day => ({
      date: format(day.date, 'MMM dd'),
      views: day.totalViews,
      uniqueVisitors: day.uniqueVisitors
    }));
  }

  /**
   * Update daily analytics aggregation
   */
  private async updateDailyAnalytics(portfolioId: string) {
    const today = startOfDay(new Date());

    // Get today's data
    const todayViews = await db.portfolioView.findMany({
      where: {
        portfolioId,
        viewedAt: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        }
      }
    });

    const totalViews = todayViews.length;
    const uniqueVisitors = new Set(
      todayViews.filter(v => v.visitorId).map(v => v.visitorId)
    ).size;

    const sessionsWithDuration = todayViews.filter(v => v.sessionDuration);
    const avgSessionDuration = sessionsWithDuration.length > 0
      ? sessionsWithDuration.reduce((sum, view) => sum + (view.sessionDuration || 0), 0) / sessionsWithDuration.length
      : 0;

    const bounceRate = todayViews.length > 0
      ? todayViews.filter(view => view.pagesViewed.length <= 1).length / todayViews.length
      : 0;

    // Get top projects for today
    const projectViews: Record<string, number> = {};
    todayViews.forEach(view => {
      view.projectsViewed.forEach(projectId => {
        projectViews[projectId] = (projectViews[projectId] || 0) + 1;
      });
    });

    const topProjects = Object.entries(projectViews)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id]) => id);

    // Get top referrers
    const referrers: Record<string, number> = {};
    todayViews.forEach(view => {
      if (view.referrer) {
        referrers[view.referrer] = (referrers[view.referrer] || 0) + 1;
      }
    });

    // Device breakdown
    const deviceTypes = { mobile: 0, desktop: 0, tablet: 0 };
    todayViews.forEach(({ userAgent }) => {
      if (userAgent) {
        if (userAgent.includes('Mobile') || userAgent.includes('Android')) {
          deviceTypes.mobile++;
        } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
          deviceTypes.tablet++;
        } else {
          deviceTypes.desktop++;
        }
      }
    });

    // Location breakdown
    const locations: Record<string, number> = {};
    todayViews.forEach(view => {
      if (view.location) {
        locations[view.location] = (locations[view.location] || 0) + 1;
      }
    });

    // Upsert daily analytics
    await db.portfolioAnalytics.upsert({
      where: {
        portfolioId_date: {
          portfolioId,
          date: today
        }
      },
      update: {
        totalViews,
        uniqueVisitors,
        avgSessionDuration: Math.round(avgSessionDuration),
        bounceRate,
        topProjects,
        topReferrers: referrers,
        deviceTypes,
        locationBreakdown: locations
      },
      create: {
        portfolioId,
        date: today,
        totalViews,
        uniqueVisitors,
        avgSessionDuration: Math.round(avgSessionDuration),
        bounceRate,
        topProjects,
        topReferrers: referrers,
        deviceTypes,
        locationBreakdown: locations
      }
    });
  }

  /**
   * Get portfolio performance comparison
   */
  async getPerformanceComparison(portfolioId: string) {
    const currentMonth = startOfDay(subDays(new Date(), 30));
    const previousMonth = startOfDay(subDays(new Date(), 60));

    const [currentPeriod, previousPeriod] = await Promise.all([
      this.getAnalytics(portfolioId, 30),
      db.portfolioView.count({
        where: {
          portfolioId,
          viewedAt: {
            gte: previousMonth,
            lt: currentMonth
          }
        }
      })
    ]);

    const viewsChange = previousPeriod > 0
      ? ((currentPeriod.totalViews - previousPeriod) / previousPeriod) * 100
      : currentPeriod.totalViews > 0 ? 100 : 0;

    return {
      currentPeriod: currentPeriod.totalViews,
      previousPeriod,
      changePercentage: Math.round(viewsChange * 100) / 100,
      isImprovement: viewsChange > 0
    };
  }

  /**
   * Track project interaction (clicks to external links)
   */
  async trackProjectInteraction(portfolioId: string, projectId: string, interactionType: 'github' | 'demo' | 'figma') {
    await db.portfolioProject.update({
      where: { id: projectId },
      data: { clickCount: { increment: 1 } }
    });

    // You could also create a separate interaction tracking table here
    // for more detailed analytics if needed
  }
}

export const portfolioAnalytics = new PortfolioAnalytics();