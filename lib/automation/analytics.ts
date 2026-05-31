import { db } from '@/lib/db/client';
import { 
  startOfDay, 
  startOfWeek, 
  startOfMonth, 
  endOfDay, 
  endOfWeek, 
  endOfMonth,
  subDays,
  subWeeks,
  subMonths,
  differenceInMinutes,
  differenceInHours,
  format
} from 'date-fns';
import type { ApplicationStatus } from '@/generated/prisma/browser';

export interface AutomationMetrics {
  totalAutomated: number;
  totalManual: number;
  successRate: number;
  failureRate: number;
  pendingCount: number;
  averageProcessingTime: number; // in minutes
  platformBreakdown: PlatformMetrics[];
  timeBreakdown: TimeMetrics[];
  roiMetrics: ROIMetrics;
  recentActivity: RecentActivity[];
  alerts: AutomationAlert[];
}

export interface PlatformMetrics {
  platform: string;
  totalSubmissions: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  averageTime: number; // in minutes
}

export interface TimeMetrics {
  hour: number;
  dayOfWeek: number;
  submissions: number;
  successRate: number;
}

export interface ROIMetrics {
  totalTimeSaved: number; // in hours
  applicationsPerHour: number;
  costPerApplication: number; // if applicable
  totalApplicationsAutomated: number;
  averageTimePerManualApplication: number; // in minutes
}

export interface RecentActivity {
  id: string;
  jobTitle: string;
  companyName: string;
  platform: string;
  status: ApplicationStatus;
  submittedAt: Date | null;
  processingTime: number | null;
  errorMessage: string | null;
}

export interface AutomationAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  metadata?: any;
}

export class AutomationAnalytics {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Get comprehensive automation metrics
   */
  async getMetrics(dateRange: 'day' | 'week' | 'month' = 'week'): Promise<AutomationMetrics> {
    const startDate = this.getStartDate(dateRange);
    const endDate = new Date();

    // Get all submissions in date range
    const submissions = await db.applicationSubmission.findMany({
      where: {
        userId: this.userId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        jobLead: {
          include: {
            jobListing: true,
          },
        },
      },
    });

    // Calculate basic metrics
    const automated = submissions.filter(s => s.wasAutomated);
    const manual = submissions.filter(s => !s.wasAutomated);
    const successful = automated.filter(s => s.status === 'SUBMITTED');
    const failed = automated.filter(s => s.status === 'FAILED');
    const pending = automated.filter(s => s.status === 'PENDING');

    // Calculate processing times
    const processingTimes = automated
      .filter(s => s.submittedAt && s.createdAt)
      .map(s => differenceInMinutes(s.submittedAt!, s.createdAt));

    const averageProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
      : 0;

    // Get platform breakdown
    const platformBreakdown = await this.getPlatformBreakdown(automated);

    // Get time breakdown
    const timeBreakdown = this.getTimeBreakdown(successful);

    // Calculate ROI metrics
    const roiMetrics = await this.calculateROI(automated.length, manual.length);

    // Get recent activity
    const recentActivity = await this.getRecentActivity();

    // Check for alerts
    const alerts = await this.checkForAlerts(submissions);

    return {
      totalAutomated: automated.length,
      totalManual: manual.length,
      successRate: automated.length > 0 ? (successful.length / automated.length) * 100 : 0,
      failureRate: automated.length > 0 ? (failed.length / automated.length) * 100 : 0,
      pendingCount: pending.length,
      averageProcessingTime,
      platformBreakdown,
      timeBreakdown,
      roiMetrics,
      recentActivity,
      alerts,
    };
  }

  /**
   * Get platform-specific metrics
   */
  private async getPlatformBreakdown(submissions: any[]): Promise<PlatformMetrics[]> {
    const platformMap = new Map<string, {
      total: number;
      success: number;
      failed: number;
      times: number[];
    }>();

    submissions.forEach(submission => {
      const platform = this.detectPlatform(submission);
      
      if (!platformMap.has(platform)) {
        platformMap.set(platform, { total: 0, success: 0, failed: 0, times: [] });
      }

      const data = platformMap.get(platform)!;
      data.total++;
      
      if (submission.status === 'SUBMITTED') {
        data.success++;
        if (submission.submittedAt && submission.createdAt) {
          data.times.push(differenceInMinutes(submission.submittedAt, submission.createdAt));
        }
      } else if (submission.status === 'FAILED') {
        data.failed++;
      }
    });

    const metrics: PlatformMetrics[] = [];
    
    platformMap.forEach((data, platform) => {
      metrics.push({
        platform,
        totalSubmissions: data.total,
        successCount: data.success,
        failureCount: data.failed,
        successRate: data.total > 0 ? (data.success / data.total) * 100 : 0,
        averageTime: data.times.length > 0 
          ? data.times.reduce((a, b) => a + b, 0) / data.times.length 
          : 0,
      });
    });

    return metrics.sort((a, b) => b.totalSubmissions - a.totalSubmissions);
  }

  /**
   * Analyze submission timing patterns
   */
  private getTimeBreakdown(successfulSubmissions: any[]): TimeMetrics[] {
    const timeMap = new Map<string, { submissions: number; successes: number }>();

    successfulSubmissions.forEach(submission => {
      if (submission.submittedAt) {
        const hour = submission.submittedAt.getHours();
        const dayOfWeek = submission.submittedAt.getDay();
        const key = `${dayOfWeek}-${hour}`;

        if (!timeMap.has(key)) {
          timeMap.set(key, { submissions: 0, successes: 0 });
        }

        const data = timeMap.get(key)!;
        data.submissions++;
        data.successes++;
      }
    });

    const metrics: TimeMetrics[] = [];

    timeMap.forEach((data, key) => {
      const [dayOfWeek, hour] = key.split('-').map(Number);
      metrics.push({
        hour,
        dayOfWeek,
        submissions: data.submissions,
        successRate: 100, // All are successful in this case
      });
    });

    return metrics;
  }

  /**
   * Calculate ROI metrics
   */
  private async calculateROI(automatedCount: number, manualCount: number): Promise<ROIMetrics> {
    // Average time for manual application (industry standard: 30-45 minutes)
    const avgManualTime = 30; // minutes
    const totalTimeSaved = (automatedCount * avgManualTime) / 60; // convert to hours

    // Get submission rate
    const recentSubmissions = await db.applicationSubmission.count({
      where: {
        userId: this.userId,
        wasAutomated: true,
        createdAt: {
          gte: subDays(new Date(), 7), // Last 7 days
        },
      },
    });

    const hoursInWeek = 7 * 24;
    const applicationsPerHour = recentSubmissions / hoursInWeek;

    return {
      totalTimeSaved,
      applicationsPerHour,
      costPerApplication: 0, // Can be calculated if there's a cost model
      totalApplicationsAutomated: automatedCount,
      averageTimePerManualApplication: avgManualTime,
    };
  }

  /**
   * Get recent automation activity
   */
  private async getRecentActivity(limit = 10): Promise<RecentActivity[]> {
    const submissions = await db.applicationSubmission.findMany({
      where: {
        userId: this.userId,
        wasAutomated: true,
      },
      include: {
        jobLead: {
          include: {
            jobListing: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return submissions.map(submission => ({
      id: submission.id,
      jobTitle: submission.jobLead.jobListing.title,
      companyName: submission.jobLead.jobListing.companyName || 'Unknown Company',
      platform: this.detectPlatform(submission),
      status: submission.status,
      submittedAt: submission.submittedAt,
      processingTime: submission.submittedAt && submission.createdAt
        ? differenceInMinutes(submission.submittedAt, submission.createdAt)
        : null,
      errorMessage: submission.errorMessage,
    }));
  }

  /**
   * Check for automation alerts
   */
  private async checkForAlerts(submissions: any[]): Promise<AutomationAlert[]> {
    const alerts: AutomationAlert[] = [];

    // Check for high failure rate
    const recentFailures = submissions.filter(
      s => s.wasAutomated && s.status === 'FAILED' && 
      s.createdAt >= subHours(new Date(), 1)
    );

    if (recentFailures.length >= 3) {
      alerts.push({
        id: 'high-failure-rate',
        type: 'error',
        title: 'High Failure Rate Detected',
        message: `${recentFailures.length} applications failed in the last hour`,
        timestamp: new Date(),
        metadata: { failures: recentFailures.length },
      });
    }

    // Check for platform-specific issues
    const platformFailures = new Map<string, number>();
    recentFailures.forEach(failure => {
      const platform = this.detectPlatform(failure);
      platformFailures.set(platform, (platformFailures.get(platform) || 0) + 1);
    });

    platformFailures.forEach((count, platform) => {
      if (count >= 2) {
        alerts.push({
          id: `platform-issue-${platform}`,
          type: 'warning',
          title: `${platform} Platform Issues`,
          message: `Multiple failures detected on ${platform}`,
          timestamp: new Date(),
          metadata: { platform, count },
        });
      }
    });

    // Check automation settings
    const settings = await db.automationSettings.findUnique({
      where: { userId: this.userId },
    });

    if (settings && settings.isPaused) {
      alerts.push({
        id: 'automation-paused',
        type: 'info',
        title: 'Automation Paused',
        message: settings.pauseReason || 'Automation is currently paused',
        timestamp: settings.pausedAt || new Date(),
      });
    }

    return alerts;
  }

  /**
   * Detect platform from submission data
   */
  private detectPlatform(submission: any): string {
    // Check submission URL
    if (submission.submissionUrl) {
      if (submission.submissionUrl.includes('linkedin.com')) return 'LinkedIn';
      if (submission.submissionUrl.includes('indeed.com')) return 'Indeed';
      if (submission.submissionUrl.includes('glassdoor.com')) return 'Glassdoor';
      if (submission.submissionUrl.includes('ziprecruiter.com')) return 'ZipRecruiter';
    }

    // Check job listing source
    if (submission.jobLead?.jobListing?.url) {
      const url = submission.jobLead.jobListing.url;
      if (url.includes('linkedin.com')) return 'LinkedIn';
      if (url.includes('indeed.com')) return 'Indeed';
      if (url.includes('glassdoor.com')) return 'Glassdoor';
      if (url.includes('ziprecruiter.com')) return 'ZipRecruiter';
    }

    // Check metadata
    if (submission.metadata?.platform) {
      return submission.metadata.platform;
    }

    return 'Other';
  }

  /**
   * Get start date based on range
   */
  private getStartDate(range: 'day' | 'week' | 'month'): Date {
    switch (range) {
      case 'day':
        return startOfDay(new Date());
      case 'week':
        return startOfWeek(new Date());
      case 'month':
        return startOfMonth(new Date());
    }
  }

  /**
   * Get historical comparison data
   */
  async getHistoricalComparison(periods = 4): Promise<any> {
    const comparisons = [];
    
    for (let i = 0; i < periods; i++) {
      const startDate = startOfWeek(subWeeks(new Date(), i));
      const endDate = endOfWeek(subWeeks(new Date(), i));

      const submissions = await db.applicationSubmission.count({
        where: {
          userId: this.userId,
          wasAutomated: true,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      const successful = await db.applicationSubmission.count({
        where: {
          userId: this.userId,
          wasAutomated: true,
          status: 'SUBMITTED',
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      comparisons.push({
        week: format(startDate, 'MMM d'),
        total: submissions,
        successful,
        successRate: submissions > 0 ? (successful / submissions) * 100 : 0,
      });
    }

    return comparisons.reverse();
  }
}

// Utility function to get metrics
export async function getAutomationMetrics(
  userId: string,
  dateRange: 'day' | 'week' | 'month' = 'week'
): Promise<AutomationMetrics> {
  const analytics = new AutomationAnalytics(userId);
  return analytics.getMetrics(dateRange);
}

// Utility function to get historical data
export async function getHistoricalData(
  userId: string,
  periods = 4
): Promise<any> {
  const analytics = new AutomationAnalytics(userId);
  return analytics.getHistoricalComparison(periods);
}

// Import for missing function
import { subHours } from 'date-fns';