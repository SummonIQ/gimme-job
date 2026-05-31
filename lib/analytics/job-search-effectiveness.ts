import { db } from '@/lib/db/client';
import { ApplicationStatus, JobProvider } from '@/generated/prisma/browser';
import {
  differenceInDays,
  differenceInHours,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns';

export interface SearchStrategyMetrics {
  strategy: string;
  totalSearches: number;
  totalJobsFound: number;
  totalApplications: number;
  successfulApplications: number;
  successRate: number;
  averageJobsPerSearch: number;
  averageTimeToApplication: number; // hours
  topKeywords: Array<{
    keyword: string;
    frequency: number;
    successRate: number;
  }>;
  platforms: Array<{ platform: JobProvider; usage: number; successRate: number }>;
  effectiveness: 'high' | 'medium' | 'low';
}

export interface ApplicationTimingMetrics {
  timeSlot: string; // e.g., "9-10 AM", "Monday", "Week 1"
  totalApplications: number;
  successfulApplications: number;
  successRate: number;
  averageResponseTime: number; // days
  platforms: Record<JobProvider, { applications: number; successRate: number }>;
  recommendation: 'optimal' | 'good' | 'suboptimal';
}

export interface PlatformROIMetrics {
  platform: JobProvider;
  totalSearches: number;
  totalJobsFound: number;
  qualityScore: number; // based on job relevance and requirements match
  totalApplications: number;
  successfulApplications: number;
  successRate: number;
  averageTimeInvested: number; // hours per application
  roi: number; // success rate / time invested
  costEffectiveness: 'excellent' | 'good' | 'fair' | 'poor';
  trends: {
    searchVolumeTrend: 'increasing' | 'stable' | 'decreasing';
    successRateTrend: 'improving' | 'stable' | 'declining';
  };
}

export interface KeywordPerformanceMetrics {
  keyword: string;
  searchFrequency: number;
  totalJobsFound: number;
  relevantJobsFound: number;
  relevanceScore: number; // relevant jobs / total jobs
  totalApplications: number;
  successfulApplications: number;
  successRate: number;
  platforms: Record<JobProvider, { searches: number; jobsFound: number }>;
  relatedKeywords: string[];
  optimization: 'expand' | 'revise' | 'maintain' | 'replace';
}

export interface EffectivenessSummary {
  period: 'week' | 'month';
  dateRange: { start: Date; end: Date };
  overview: {
    totalSearches: number;
    totalJobsFound: number;
    totalApplications: number;
    successfulApplications: number;
    overallSuccessRate: number;
    timeInvested: number; // total hours
    efficiency: number; // successful applications per hour
  };
  topStrategies: SearchStrategyMetrics[];
  bestTimings: ApplicationTimingMetrics[];
  topPlatforms: PlatformROIMetrics[];
  keywordInsights: KeywordPerformanceMetrics[];
  recommendations: Array<{
    type: 'strategy' | 'timing' | 'platform' | 'keyword';
    priority: 'high' | 'medium' | 'low';
    action: string;
    expectedImpact: string;
  }>;
  improvements: {
    comparedToPrevious: {
      successRateChange: number;
      efficiencyChange: number;
      volumeChange: number;
    };
    trends: Array<{
      metric: string;
      direction: 'up' | 'down' | 'stable';
      percentage: number;
    }>;
  };
}

export class JobSearchEffectivenessAnalyzer {
  /**
   * Analyze search strategies effectiveness
   */
  static async analyzeSearchStrategies(
    userId: string,
    dateRange: { start: Date; end: Date },
  ): Promise<SearchStrategyMetrics[]> {
    // Get job searches with associated job leads and applications
    const searches = await db.jobSearch.findMany({
      where: {
        userId,
        createdAt: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
      include: {
        jobLeads: {
          include: {
            applicationSubmissions: true,
            jobListing: true,
          },
        },
      },
    });

    // Group searches by strategy (keywords, location, etc.)
    const strategyGroups = new Map<string, typeof searches>();

    for (const search of searches) {
      const strategy = this.categorizeSearchStrategy(search);
      if (!strategyGroups.has(strategy)) {
        strategyGroups.set(strategy, []);
      }
      strategyGroups.get(strategy)!.push(search);
    }

    const metrics: SearchStrategyMetrics[] = [];

    for (const [strategy, strategySearches] of strategyGroups) {
      const totalSearches = strategySearches.length;
      const allJobLeads = strategySearches.flatMap(s => s.jobLeads);
      const totalJobsFound = allJobLeads.length;

      const applications = allJobLeads.flatMap(j => j.applicationSubmissions);
      const totalApplications = applications.length;
      const successfulApplications = applications.filter(
        a =>
          a.status === ApplicationStatus.SUBMITTED ||
          a.status === ApplicationStatus.UNDER_REVIEW ||
          a.status === ApplicationStatus.INTERVIEW_REQUESTED,
      ).length;

      const successRate =
        totalApplications > 0
          ? (successfulApplications / totalApplications) * 100
          : 0;
      const averageJobsPerSearch =
        totalSearches > 0 ? totalJobsFound / totalSearches : 0;

      // Calculate average time to application
      const timeToApplications = applications
        .filter(a => a.submittedAt)
        .map(a => {
          const jobLead = allJobLeads.find(j => j.id === a.jobLeadId);
          if (jobLead && a.submittedAt) {
            return differenceInHours(a.submittedAt, jobLead.createdAt);
          }
          return null;
        })
        .filter(t => t !== null) as number[];

      const averageTimeToApplication =
        timeToApplications.length > 0
          ? timeToApplications.reduce((sum, time) => sum + time, 0) /
            timeToApplications.length
          : 0;

      // Extract keywords and their performance
      const keywordMap = new Map<
        string,
        { frequency: number; applications: number; successes: number }
      >();

      for (const search of strategySearches) {
        const keywords = this.extractKeywords(
          search.query || search.jobTitle || '',
        );
        for (const keyword of keywords) {
          if (!keywordMap.has(keyword)) {
            keywordMap.set(keyword, {
              frequency: 0,
              applications: 0,
              successes: 0,
            });
          }
          const stats = keywordMap.get(keyword)!;
          stats.frequency++;

          // Count applications and successes for jobs from this search with this keyword
          const relatedJobLeads = search.jobLeads.filter(j =>
            (j.jobTitle + ' ' + (j.description || ''))
              .toLowerCase()
              .includes(keyword.toLowerCase()),
          );
          const relatedApplications = relatedJobLeads.flatMap(
            j => j.applicationSubmissions,
          );
          stats.applications += relatedApplications.length;
          stats.successes += relatedApplications.filter(
            a =>
              a.status === ApplicationStatus.SUBMITTED ||
              a.status === ApplicationStatus.UNDER_REVIEW ||
              a.status === ApplicationStatus.INTERVIEW_REQUESTED,
          ).length;
        }
      }

      const topKeywords = Array.from(keywordMap.entries())
        .map(([keyword, stats]) => ({
          keyword,
          frequency: stats.frequency,
          successRate:
            stats.applications > 0
              ? (stats.successes / stats.applications) * 100
              : 0,
        }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10);

      // Platform usage analysis
      const platformMap = new Map<
        JobProvider,
        { usage: number; applications: number; successes: number }
      >();

      for (const jobLead of allJobLeads) {
        const platform = jobLead.jobListing?.jobProvider || JobProvider.OTHER;
        if (!platformMap.has(platform)) {
          platformMap.set(platform, {
            usage: 0,
            applications: 0,
            successes: 0,
          });
        }
        const stats = platformMap.get(platform)!;
        stats.usage++;
        stats.applications += jobLead.applicationSubmissions.length;
        stats.successes += jobLead.applicationSubmissions.filter(
          a =>
            a.status === ApplicationStatus.SUBMITTED ||
            a.status === ApplicationStatus.UNDER_REVIEW ||
            a.status === ApplicationStatus.INTERVIEW_REQUESTED,
        ).length;
      }

      const platforms = Array.from(platformMap.entries())
        .map(([platform, stats]) => ({
          platform,
          usage: stats.usage,
          successRate:
            stats.applications > 0
              ? (stats.successes / stats.applications) * 100
              : 0,
        }))
        .sort((a, b) => b.usage - a.usage);

      // Determine effectiveness
      let effectiveness: 'high' | 'medium' | 'low' = 'low';
      if (successRate >= 15 && averageJobsPerSearch >= 5) {
        effectiveness = 'high';
      } else if (successRate >= 8 || averageJobsPerSearch >= 3) {
        effectiveness = 'medium';
      }

      metrics.push({
        strategy,
        totalSearches,
        totalJobsFound,
        totalApplications,
        successfulApplications,
        successRate,
        averageJobsPerSearch,
        averageTimeToApplication,
        topKeywords,
        platforms,
        effectiveness,
      });
    }

    return metrics.sort((a, b) => b.successRate - a.successRate);
  }

  /**
   * Analyze application timing effectiveness
   */
  static async analyzeApplicationTiming(
    userId: string,
    dateRange: { start: Date; end: Date },
  ): Promise<ApplicationTimingMetrics[]> {
    const applications = await db.applicationSubmission.findMany({
      where: {
        userId,
        submittedAt: {
          gte: dateRange.start,
          lte: dateRange.end,
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

    // Group by different time slots
    const timeSlots = new Map<string, typeof applications>();

    for (const app of applications) {
      if (!app.submittedAt) continue;

      const submittedAt = app.submittedAt;
      const hour = submittedAt.getHours();
      const dayOfWeek = submittedAt.getDay();
      const weekOfMonth = Math.ceil(submittedAt.getDate() / 7);

      // Categorize by hour ranges
      const hourSlot = `${hour}-${hour + 1} ${hour < 12 ? 'AM' : 'PM'}`;
      const daySlot = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ][dayOfWeek];
      const weekSlot = `Week ${weekOfMonth}`;

      for (const slot of [hourSlot, daySlot, weekSlot]) {
        if (!timeSlots.has(slot)) {
          timeSlots.set(slot, []);
        }
        timeSlots.get(slot)!.push(app);
      }
    }

    const timingMetrics: ApplicationTimingMetrics[] = [];

    for (const [timeSlot, slotApplications] of timeSlots) {
      const totalApplications = slotApplications.length;
      const successfulApplications = slotApplications.filter(
        a =>
          a.status === ApplicationStatus.SUBMITTED ||
          a.status === ApplicationStatus.UNDER_REVIEW ||
          a.status === ApplicationStatus.INTERVIEW_REQUESTED,
      ).length;

      const successRate =
        totalApplications > 0
          ? (successfulApplications / totalApplications) * 100
          : 0;

      // Calculate average response time
      const responseTimes = slotApplications
        .filter(
          a =>
            a.submittedAt &&
            a.updatedAt &&
            a.status !== ApplicationStatus.PENDING,
        )
        .map(a => differenceInDays(a.updatedAt, a.submittedAt!))
        .filter(days => days >= 0);

      const averageResponseTime =
        responseTimes.length > 0
          ? responseTimes.reduce((sum, days) => sum + days, 0) /
            responseTimes.length
          : 0;

      // Platform breakdown
      const platformStats: Record<
        string,
        { applications: number; successes: number }
      > = {};

      for (const app of slotApplications) {
        const platform = app.jobLead.jobListing?.jobProvider || JobProvider.OTHER;
        if (!platformStats[platform]) {
          platformStats[platform] = { applications: 0, successes: 0 };
        }
        platformStats[platform].applications++;
        if (
          app.status === ApplicationStatus.SUBMITTED ||
          app.status === ApplicationStatus.UNDER_REVIEW ||
          app.status === ApplicationStatus.INTERVIEW_REQUESTED
        ) {
          platformStats[platform].successes++;
        }
      }

      const platforms = Object.fromEntries(
        Object.entries(platformStats).map(([platform, stats]) => [
          platform as JobProvider,
          {
            applications: stats.applications,
            successRate:
              stats.applications > 0
                ? (stats.successes / stats.applications) * 100
                : 0,
          },
        ]),
      ) as Record<JobProvider, { applications: number; successRate: number }>;

      // Determine recommendation
      let recommendation: 'optimal' | 'good' | 'suboptimal' = 'suboptimal';
      if (successRate >= 20) {
        recommendation = 'optimal';
      } else if (successRate >= 10) {
        recommendation = 'good';
      }

      if (totalApplications >= 5) {
        // Only include slots with meaningful data
        timingMetrics.push({
          timeSlot,
          totalApplications,
          successfulApplications,
          successRate,
          averageResponseTime,
          platforms,
          recommendation,
        });
      }
    }

    return timingMetrics.sort((a, b) => b.successRate - a.successRate);
  }

  /**
   * Analyze platform ROI and effectiveness
   */
  static async analyzePlatformROI(
    userId: string,
    dateRange: { start: Date; end: Date },
  ): Promise<PlatformROIMetrics[]> {
    // Get all job searches and applications grouped by platform
    const jobLeads = await db.jobLead.findMany({
      where: {
        userId,
        createdAt: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
      include: {
        jobListing: true,
        applicationSubmissions: true,
        jobSearch: true,
      },
    });

    const platformStats = new Map<
      JobProvider,
      {
        searches: Set<string>;
        jobsFound: number;
        applications: number;
        successes: number;
        totalTimeInvested: number;
        qualityScores: number[];
      }
    >();

    for (const jobLead of jobLeads) {
      const platform = jobLead.jobListing?.jobProvider || JobProvider.OTHER;

      if (!platformStats.has(platform)) {
        platformStats.set(platform, {
          searches: new Set(),
          jobsFound: 0,
          applications: 0,
          successes: 0,
          totalTimeInvested: 0,
          qualityScores: [],
        });
      }

      const stats = platformStats.get(platform)!;

      if (jobLead.jobSearchId) {
        stats.searches.add(jobLead.jobSearchId);
      }
      stats.jobsFound++;
      stats.applications += jobLead.applicationSubmissions.length;
      stats.successes += jobLead.applicationSubmissions.filter(
        a =>
          a.status === ApplicationStatus.SUBMITTED ||
          a.status === ApplicationStatus.UNDER_REVIEW ||
          a.status === ApplicationStatus.INTERVIEW_REQUESTED,
      ).length;

      // Estimate time invested (rough calculation)
      const timePerJobReview = 5; // minutes
      const timePerApplication = 15; // minutes
      stats.totalTimeInvested += timePerJobReview;
      stats.totalTimeInvested +=
        jobLead.applicationSubmissions.length * timePerApplication;

      // Calculate quality score based on requirements match and salary
      const qualityScore = this.calculateJobQualityScore(jobLead);
      stats.qualityScores.push(qualityScore);
    }

    const platformMetrics: PlatformROIMetrics[] = [];

    for (const [platform, stats] of platformStats) {
      const totalSearches = stats.searches.size;
      const totalJobsFound = stats.jobsFound;
      const totalApplications = stats.applications;
      const successfulApplications = stats.successes;
      const successRate =
        totalApplications > 0
          ? (successfulApplications / totalApplications) * 100
          : 0;
      const averageTimeInvested = stats.totalTimeInvested / 60; // convert to hours
      const roi =
        averageTimeInvested > 0 ? successRate / averageTimeInvested : 0;
      const qualityScore =
        stats.qualityScores.length > 0
          ? stats.qualityScores.reduce((sum, score) => sum + score, 0) /
            stats.qualityScores.length
          : 0;

      // Determine cost effectiveness
      let costEffectiveness: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
      if (roi >= 5 && successRate >= 15) {
        costEffectiveness = 'excellent';
      } else if (roi >= 2 && successRate >= 10) {
        costEffectiveness = 'good';
      } else if (roi >= 1 || successRate >= 5) {
        costEffectiveness = 'fair';
      }

      // Calculate trends (compare with previous period)
      const previousPeriodStart = new Date(dateRange.start);
      previousPeriodStart.setDate(
        previousPeriodStart.getDate() -
          differenceInDays(dateRange.end, dateRange.start),
      );
      const previousPeriodEnd = dateRange.start;

      const trends = await this.calculatePlatformTrends(
        userId,
        platform,
        { start: previousPeriodStart, end: previousPeriodEnd },
        { start: dateRange.start, end: dateRange.end },
      );

      platformMetrics.push({
        platform,
        totalSearches,
        totalJobsFound,
        qualityScore,
        totalApplications,
        successfulApplications,
        successRate,
        averageTimeInvested,
        roi,
        costEffectiveness,
        trends,
      });
    }

    return platformMetrics.sort((a, b) => b.roi - a.roi);
  }

  /**
   * Analyze keyword performance across searches
   */
  static async analyzeKeywordPerformance(
    userId: string,
    dateRange: { start: Date; end: Date },
  ): Promise<KeywordPerformanceMetrics[]> {
    const jobSearches = await db.jobSearch.findMany({
      where: {
        userId,
        createdAt: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
      include: {
        jobLeads: {
          include: {
            applicationSubmissions: true,
            jobListing: true,
          },
        },
      },
    });

    const keywordMap = new Map<
      string,
      {
        searchFrequency: number;
        totalJobsFound: number;
        relevantJobsFound: number;
        applications: number;
        successes: number;
        platforms: Map<JobProvider, { searches: number; jobsFound: number }>;
      }
    >();

    for (const search of jobSearches) {
      const keywords = this.extractKeywords(
        search.query || search.jobTitle || '',
      );

      for (const keyword of keywords) {
        if (!keywordMap.has(keyword)) {
          keywordMap.set(keyword, {
            searchFrequency: 0,
            totalJobsFound: 0,
            relevantJobsFound: 0,
            applications: 0,
            successes: 0,
            platforms: new Map(),
          });
        }

        const stats = keywordMap.get(keyword)!;
        stats.searchFrequency++;
        stats.totalJobsFound += search.jobLeads.length;

        // Count relevant jobs (those that contain the keyword in title/description)
        const relevantJobs = search.jobLeads.filter(job =>
          (job.jobTitle + ' ' + (job.description || ''))
            .toLowerCase()
            .includes(keyword.toLowerCase()),
        );
        stats.relevantJobsFound += relevantJobs.length;

        // Count applications and successes for relevant jobs
        const applications = relevantJobs.flatMap(
          job => job.applicationSubmissions,
        );
        stats.applications += applications.length;
        stats.successes += applications.filter(
          a =>
            a.status === ApplicationStatus.SUBMITTED ||
            a.status === ApplicationStatus.UNDER_REVIEW ||
            a.status === ApplicationStatus.INTERVIEW_REQUESTED,
        ).length;

        // Platform breakdown
        for (const job of search.jobLeads) {
          const platform = job.jobListing?.jobProvider || JobProvider.OTHER;
          if (!stats.platforms.has(platform)) {
            stats.platforms.set(platform, { searches: 0, jobsFound: 0 });
          }
          const platformStats = stats.platforms.get(platform)!;
          platformStats.searches++;
          platformStats.jobsFound++;
        }
      }
    }

    const keywordMetrics: KeywordPerformanceMetrics[] = [];

    for (const [keyword, stats] of keywordMap) {
      if (stats.searchFrequency < 2) continue; // Filter out rarely used keywords

      const relevanceScore =
        stats.totalJobsFound > 0
          ? (stats.relevantJobsFound / stats.totalJobsFound) * 100
          : 0;
      const successRate =
        stats.applications > 0
          ? (stats.successes / stats.applications) * 100
          : 0;

      const platforms = Object.fromEntries(
        Array.from(stats.platforms.entries()).map(
          ([platform, platformStats]) => [platform, platformStats],
        ),
      ) as Record<JobProvider, { searches: number; jobsFound: number }>;

      // Determine optimization recommendation
      let optimization: 'expand' | 'revise' | 'maintain' | 'replace' =
        'maintain';
      if (successRate >= 15 && relevanceScore >= 70) {
        optimization = 'expand';
      } else if (successRate >= 10 && relevanceScore >= 50) {
        optimization = 'maintain';
      } else if (relevanceScore < 30) {
        optimization = 'revise';
      } else if (successRate < 5) {
        optimization = 'replace';
      }

      // Find related keywords
      const relatedKeywords = this.findRelatedKeywords(
        keyword,
        Array.from(keywordMap.keys()),
      );

      keywordMetrics.push({
        keyword,
        searchFrequency: stats.searchFrequency,
        totalJobsFound: stats.totalJobsFound,
        relevantJobsFound: stats.relevantJobsFound,
        relevanceScore,
        totalApplications: stats.applications,
        successfulApplications: stats.successes,
        successRate,
        platforms,
        relatedKeywords,
        optimization,
      });
    }

    return keywordMetrics.sort((a, b) => b.searchFrequency - a.searchFrequency);
  }

  /**
   * Generate comprehensive effectiveness summary
   */
  static async generateEffectivenessSummary(
    userId: string,
    period: 'week' | 'month',
  ): Promise<EffectivenessSummary> {
    const now = new Date();
    const dateRange = {
      start: period === 'week' ? startOfWeek(now) : startOfMonth(now),
      end: period === 'week' ? endOfWeek(now) : endOfMonth(now),
    };

    const previousDateRange = {
      start:
        period === 'week'
          ? startOfWeek(subWeeks(now, 1))
          : startOfMonth(subMonths(now, 1)),
      end:
        period === 'week'
          ? endOfWeek(subWeeks(now, 1))
          : endOfMonth(subMonths(now, 1)),
    };

    // Run all analyses
    const [strategies, timings, platforms, keywords] = await Promise.all([
      this.analyzeSearchStrategies(userId, dateRange),
      this.analyzeApplicationTiming(userId, dateRange),
      this.analyzePlatformROI(userId, dateRange),
      this.analyzeKeywordPerformance(userId, dateRange),
    ]);

    // Calculate overview metrics
    const overview = await this.calculateOverviewMetrics(userId, dateRange);
    const previousOverview = await this.calculateOverviewMetrics(
      userId,
      previousDateRange,
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      strategies,
      timings,
      platforms,
      keywords,
    );

    // Calculate improvements
    const improvements = {
      comparedToPrevious: {
        successRateChange:
          overview.overallSuccessRate -
          (previousOverview.overallSuccessRate || 0),
        efficiencyChange:
          overview.efficiency - (previousOverview.efficiency || 0),
        volumeChange:
          overview.totalApplications -
          (previousOverview.totalApplications || 0),
      },
      trends: this.calculateTrends(overview, previousOverview),
    };

    return {
      period,
      dateRange,
      overview,
      topStrategies: strategies.slice(0, 5),
      bestTimings: timings
        .filter(t => t.recommendation === 'optimal')
        .slice(0, 5),
      topPlatforms: platforms.slice(0, 5),
      keywordInsights: keywords.slice(0, 10),
      recommendations,
      improvements,
    };
  }

  // Helper methods
  private static categorizeSearchStrategy(search: any): string {
    const keywords = this.extractKeywords(
      search.query || search.jobTitle || '',
    );
    const location = search.location || 'any location';
    const experienceLevel = search.experienceLevel || 'any level';

    if (keywords.length === 0) return 'general search';
    if (keywords.length === 1) return `single keyword: ${keywords[0]}`;
    if (keywords.length <= 3)
      return `focused search: ${keywords.slice(0, 2).join(', ')}`;
    return 'broad keyword search';
  }

  private static extractKeywords(text: string): string[] {
    // Simple keyword extraction - can be enhanced with NLP
    const stopWords = new Set([
      'and',
      'or',
      'the',
      'in',
      'at',
      'for',
      'with',
      'by',
      'as',
      'is',
    ]);
    return text
      .toLowerCase()
      .split(/[\s,.-]+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 10); // Limit keywords
  }

  private static calculateJobQualityScore(jobLead: any): number {
    let score = 50; // Base score

    // Boost for salary range
    if (jobLead.salaryMin && jobLead.salaryMax) {
      score += 20;
    }

    // Boost for detailed description
    if (jobLead.description && jobLead.description.length > 200) {
      score += 15;
    }

    // Boost for company information
    if (jobLead.companyName && jobLead.companyName !== 'Unknown') {
      score += 15;
    }

    return Math.min(score, 100);
  }

  private static async calculatePlatformTrends(
    userId: string,
    platform: JobProvider,
    previousPeriod: { start: Date; end: Date },
    currentPeriod: { start: Date; end: Date },
  ): Promise<{
    searchVolumeTrend: 'increasing' | 'stable' | 'decreasing';
    successRateTrend: 'improving' | 'stable' | 'declining';
  }> {
    // Simplified trend calculation
    return {
      searchVolumeTrend: 'stable',
      successRateTrend: 'stable',
    };
  }

  private static findRelatedKeywords(
    keyword: string,
    allKeywords: string[],
  ): string[] {
    // Simple similarity check - can be enhanced with semantic analysis
    return allKeywords
      .filter(
        k => k !== keyword && (k.includes(keyword) || keyword.includes(k)),
      )
      .slice(0, 5);
  }

  private static async calculateOverviewMetrics(
    userId: string,
    dateRange: { start: Date; end: Date },
  ): Promise<EffectivenessSummary['overview']> {
    const [searches, applications] = await Promise.all([
      db.jobSearch.count({
        where: {
          userId,
          createdAt: { gte: dateRange.start, lte: dateRange.end },
        },
      }),
      db.applicationSubmission.findMany({
        where: {
          userId,
          createdAt: { gte: dateRange.start, lte: dateRange.end },
        },
        include: { jobLead: true },
      }),
    ]);

    const jobsFound = await db.jobLead.count({
      where: {
        userId,
        createdAt: { gte: dateRange.start, lte: dateRange.end },
      },
    });

    const successfulApplications = applications.filter(
      a =>
        a.status === ApplicationStatus.SUBMITTED ||
        a.status === ApplicationStatus.UNDER_REVIEW ||
        a.status === ApplicationStatus.INTERVIEW_REQUESTED,
    ).length;

    const overallSuccessRate =
      applications.length > 0
        ? (successfulApplications / applications.length) * 100
        : 0;
    const timeInvested = (searches * 30 + applications.length * 15) / 60; // Estimated hours
    const efficiency =
      timeInvested > 0 ? successfulApplications / timeInvested : 0;

    return {
      totalSearches: searches,
      totalJobsFound: jobsFound,
      totalApplications: applications.length,
      successfulApplications,
      overallSuccessRate,
      timeInvested,
      efficiency,
    };
  }

  private static generateRecommendations(
    strategies: SearchStrategyMetrics[],
    timings: ApplicationTimingMetrics[],
    platforms: PlatformROIMetrics[],
    keywords: KeywordPerformanceMetrics[],
  ): EffectivenessSummary['recommendations'] {
    const recommendations: EffectivenessSummary['recommendations'] = [];

    // Strategy recommendations
    const topStrategy = strategies[0];
    if (topStrategy && topStrategy.effectiveness === 'high') {
      recommendations.push({
        type: 'strategy',
        priority: 'high',
        action: `Focus more on "${topStrategy.strategy}" approach`,
        expectedImpact: `Could improve success rate by up to ${Math.round((topStrategy.successRate - 10) / 2)}%`,
      });
    }

    // Timing recommendations
    const optimalTiming = timings.find(t => t.recommendation === 'optimal');
    if (optimalTiming) {
      recommendations.push({
        type: 'timing',
        priority: 'medium',
        action: `Apply more during ${optimalTiming.timeSlot}`,
        expectedImpact: `${Math.round(optimalTiming.successRate)}% success rate in this time slot`,
      });
    }

    // Platform recommendations
    const topPlatform = platforms[0];
    if (topPlatform && topPlatform.costEffectiveness === 'excellent') {
      recommendations.push({
        type: 'platform',
        priority: 'high',
        action: `Increase usage of ${topPlatform.platform}`,
        expectedImpact: `ROI of ${topPlatform.roi.toFixed(1)} with ${topPlatform.successRate.toFixed(1)}% success rate`,
      });
    }

    // Keyword recommendations
    const expandKeywords = keywords
      .filter(k => k.optimization === 'expand')
      .slice(0, 3);
    for (const keyword of expandKeywords) {
      recommendations.push({
        type: 'keyword',
        priority: 'medium',
        action: `Expand searches using "${keyword.keyword}"`,
        expectedImpact: `${keyword.successRate.toFixed(1)}% success rate with this keyword`,
      });
    }

    return recommendations.slice(0, 8); // Limit recommendations
  }

  private static calculateTrends(
    current: EffectivenessSummary['overview'],
    previous: EffectivenessSummary['overview'],
  ): EffectivenessSummary['improvements']['trends'] {
    const trends: EffectivenessSummary['improvements']['trends'] = [];

    const successRateChange =
      current.overallSuccessRate - (previous.overallSuccessRate || 0);
    trends.push({
      metric: 'Success Rate',
      direction:
        successRateChange > 1
          ? 'up'
          : successRateChange < -1
            ? 'down'
            : 'stable',
      percentage: Math.abs(successRateChange),
    });

    const volumeChange =
      ((current.totalApplications - (previous.totalApplications || 0)) /
        (previous.totalApplications || 1)) *
      100;
    trends.push({
      metric: 'Application Volume',
      direction:
        volumeChange > 5 ? 'up' : volumeChange < -5 ? 'down' : 'stable',
      percentage: Math.abs(volumeChange),
    });

    const efficiencyChange = current.efficiency - (previous.efficiency || 0);
    trends.push({
      metric: 'Efficiency',
      direction:
        efficiencyChange > 0.1
          ? 'up'
          : efficiencyChange < -0.1
            ? 'down'
            : 'stable',
      percentage: Math.abs(efficiencyChange * 100),
    });

    return trends;
  }
}
