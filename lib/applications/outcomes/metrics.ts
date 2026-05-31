import { ApplicationStatus } from '@/generated/prisma/browser';
import { db } from '@/lib/db/client';
import { subDays, startOfDay, endOfDay } from 'date-fns';

export interface ApplicationMetrics {
  totalApplications: number;
  successRate: number;
  responseRate: number;
  interviewRate: number;
  offerRate: number;
  averageResponseTime: number;
  averageTimeToFinalOutcome: number;
  statusBreakdown: Record<ApplicationStatus, number>;
  conversionFunnel: ConversionFunnelStep[];
  performanceByPlatform: PlatformMetrics[];
  performanceByAutomation: AutomationMetrics;
  timeSeriesData: TimeSeriesMetric[];
}

export interface ConversionFunnelStep {
  stage: string;
  count: number;
  percentage: number;
  averageDaysToReach: number | null;
}

export interface PlatformMetrics {
  platform: string;
  applications: number;
  responseRate: number;
  interviewRate: number;
  successRate: number;
}

export interface AutomationMetrics {
  automated: {
    total: number;
    responseRate: number;
    successRate: number;
  };
  manual: {
    total: number;
    responseRate: number;
    successRate: number;
  };
}

export interface TimeSeriesMetric {
  date: Date;
  applications: number;
  responses: number;
  interviews: number;
  offers: number;
}

/**
 * Calculate comprehensive application metrics for a user
 */
export async function calculateApplicationMetrics(
  userId: string,
  dateRange: { startDate?: Date; endDate?: Date } = {}
): Promise<ApplicationMetrics> {
  const { startDate = subDays(new Date(), 30), endDate = new Date() } = dateRange;

  // Fetch all applications in date range
  const applications = await db.applicationSubmission.findMany({
    where: {
      userId,
      submittedAt: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      jobLead: {
        include: {
          jobListing: true
        }
      }
    }
  });

  const totalApplications = applications.length;

  if (totalApplications === 0) {
    return {
      totalApplications: 0,
      successRate: 0,
      responseRate: 0,
      interviewRate: 0,
      offerRate: 0,
      averageResponseTime: 0,
      averageTimeToFinalOutcome: 0,
      statusBreakdown: {} as Record<ApplicationStatus, number>,
      conversionFunnel: [],
      performanceByPlatform: [],
      performanceByAutomation: {
        automated: { total: 0, responseRate: 0, successRate: 0 },
        manual: { total: 0, responseRate: 0, successRate: 0 }
      },
      timeSeriesData: []
    };
  }

  // Calculate status breakdown
  const statusBreakdown = applications.reduce((acc, app) => {
    acc[app.status] = (acc[app.status] || 0) + 1;
    return acc;
  }, {} as Record<ApplicationStatus, number>);

  // Calculate response metrics
  const responsesReceived = applications.filter(app => app.responseReceivedAt).length;
  const responseRate = (responsesReceived / totalApplications) * 100;

  // Calculate interview metrics
  const interviewsScheduled = applications.filter(app => app.interviewCount > 0).length;
  const interviewRate = (interviewsScheduled / totalApplications) * 100;

  // Calculate offer metrics
  const offersReceived = applications.filter(app => 
    app.status === ApplicationStatus.OFFER_RECEIVED ||
    app.status === ApplicationStatus.OFFER_ACCEPTED ||
    app.status === ApplicationStatus.OFFER_REJECTED
  ).length;
  const offerRate = (offersReceived / totalApplications) * 100;

  // Calculate success rate (offers accepted)
  const successfulApplications = applications.filter(
    app => app.status === ApplicationStatus.OFFER_ACCEPTED
  ).length;
  const successRate = (successfulApplications / totalApplications) * 100;

  // Calculate average response times
  const responseTimes = applications
    .filter(app => app.daysToResponse !== null)
    .map(app => app.daysToResponse!);
  const averageResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((sum, days) => sum + days, 0) / responseTimes.length
    : 0;

  const finalOutcomeTimes = applications
    .filter(app => app.daysToFinalOutcome !== null)
    .map(app => app.daysToFinalOutcome!);
  const averageTimeToFinalOutcome = finalOutcomeTimes.length > 0
    ? finalOutcomeTimes.reduce((sum, days) => sum + days, 0) / finalOutcomeTimes.length
    : 0;

  // Build conversion funnel
  const conversionFunnel = buildConversionFunnel(applications);

  // Calculate platform metrics
  const performanceByPlatform = calculatePlatformMetrics(applications);

  // Calculate automation metrics
  const performanceByAutomation = calculateAutomationMetrics(applications);

  // Generate time series data
  const timeSeriesData = await generateTimeSeriesData(userId, startDate, endDate);

  return {
    totalApplications,
    successRate,
    responseRate,
    interviewRate,
    offerRate,
    averageResponseTime,
    averageTimeToFinalOutcome,
    statusBreakdown,
    conversionFunnel,
    performanceByPlatform,
    performanceByAutomation,
    timeSeriesData
  };
}

/**
 * Build conversion funnel data
 */
function buildConversionFunnel(applications: any[]): ConversionFunnelStep[] {
  const total = applications.length;
  
  const stages = [
    {
      stage: 'Applications Submitted',
      filter: () => true,
      daysField: null
    },
    {
      stage: 'Response Received',
      filter: (app: any) => app.responseReceivedAt !== null,
      daysField: 'daysToResponse'
    },
    {
      stage: 'Interview Scheduled',
      filter: (app: any) => app.interviewCount > 0,
      daysField: 'daysToResponse' // Approximate
    },
    {
      stage: 'Interview Completed',
      filter: (app: any) => app.status === ApplicationStatus.INTERVIEW_COMPLETED,
      daysField: 'daysToFinalOutcome'
    },
    {
      stage: 'Offer Received',
      filter: (app: any) => [
        ApplicationStatus.OFFER_RECEIVED,
        ApplicationStatus.OFFER_ACCEPTED,
        ApplicationStatus.OFFER_REJECTED
      ].includes(app.status),
      daysField: 'daysToFinalOutcome'
    },
    {
      stage: 'Offer Accepted',
      filter: (app: any) => app.status === ApplicationStatus.OFFER_ACCEPTED,
      daysField: 'daysToFinalOutcome'
    }
  ];

  return stages.map(stage => {
    const matchingApps = applications.filter(stage.filter);
    const count = matchingApps.length;
    const percentage = total > 0 ? (count / total) * 100 : 0;
    
    let averageDaysToReach = null;
    if (stage.daysField && matchingApps.length > 0) {
      const days = matchingApps
        .map(app => app[stage.daysField])
        .filter(d => d !== null);
      if (days.length > 0) {
        averageDaysToReach = days.reduce((sum, d) => sum + d, 0) / days.length;
      }
    }

    return {
      stage: stage.stage,
      count,
      percentage,
      averageDaysToReach
    };
  });
}

/**
 * Calculate metrics by platform
 */
function calculatePlatformMetrics(applications: any[]): PlatformMetrics[] {
  const platformGroups = applications.reduce((acc, app) => {
    const platform = app.jobLead?.jobListing?.jobProvider || 'OTHER';
    if (!acc[platform]) {
      acc[platform] = [];
    }
    acc[platform].push(app);
    return acc;
  }, {} as Record<string, any[]>);

  return Object.entries(platformGroups).map(([platform, apps]) => {
    const total = apps.length;
    const responses = apps.filter(app => app.responseReceivedAt).length;
    const interviews = apps.filter(app => app.interviewCount > 0).length;
    const successful = apps.filter(app => app.status === ApplicationStatus.OFFER_ACCEPTED).length;

    return {
      platform,
      applications: total,
      responseRate: total > 0 ? (responses / total) * 100 : 0,
      interviewRate: total > 0 ? (interviews / total) * 100 : 0,
      successRate: total > 0 ? (successful / total) * 100 : 0
    };
  });
}

/**
 * Calculate metrics by automation status
 */
function calculateAutomationMetrics(applications: any[]): AutomationMetrics {
  const automated = applications.filter(app => app.wasAutomated);
  const manual = applications.filter(app => !app.wasAutomated);

  const calculateRates = (apps: any[]) => {
    const total = apps.length;
    if (total === 0) {
      return { total: 0, responseRate: 0, successRate: 0 };
    }

    const responses = apps.filter(app => app.responseReceivedAt).length;
    const successful = apps.filter(app => app.status === ApplicationStatus.OFFER_ACCEPTED).length;

    return {
      total,
      responseRate: (responses / total) * 100,
      successRate: (successful / total) * 100
    };
  };

  return {
    automated: calculateRates(automated),
    manual: calculateRates(manual)
  };
}

/**
 * Generate time series data for charting
 */
async function generateTimeSeriesData(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<TimeSeriesMetric[]> {
  const data: TimeSeriesMetric[] = [];
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dayStart = startOfDay(currentDate);
    const dayEnd = endOfDay(currentDate);

    const dayApplications = await db.applicationSubmission.findMany({
      where: {
        userId,
        submittedAt: {
          gte: dayStart,
          lte: dayEnd
        }
      }
    });

    data.push({
      date: new Date(currentDate),
      applications: dayApplications.length,
      responses: dayApplications.filter(app => 
        app.responseReceivedAt && 
        app.responseReceivedAt >= dayStart && 
        app.responseReceivedAt <= dayEnd
      ).length,
      interviews: dayApplications.filter(app => 
        app.interviewCount > 0
      ).length,
      offers: dayApplications.filter(app => 
        [
          ApplicationStatus.OFFER_RECEIVED,
          ApplicationStatus.OFFER_ACCEPTED,
          ApplicationStatus.OFFER_REJECTED
        ].includes(app.status)
      ).length
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return data;
}