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
  subHours,
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  format,
  eachDayOfInterval,
  eachHourOfInterval,
  isSameDay,
  isWithinInterval
} from 'date-fns';
import type { ApplicationStatus, ApplicationSubmission, JobListing } from '@/generated/prisma/browser';
import { getSchedulingAnalytics } from './intelligent-scheduler';

// Enhanced metrics interfaces
export interface EnhancedAutomationMetrics {
  // Core metrics
  totalAutomated: number;
  totalManual: number;
  successRate: number;
  failureRate: number;
  pendingCount: number;
  averageProcessingTime: number;
  
  // Enhanced platform metrics
  platformBreakdown: EnhancedPlatformMetrics[];
  platformComparison: PlatformComparisonMetrics;
  
  // Timing analytics
  timeBreakdown: TimeMetrics[];
  timingEffectiveness: TimingEffectivenessMetrics;
  optimalTimingAnalysis: OptimalTimingAnalysis;
  
  // Enhanced ROI
  roiMetrics: EnhancedROIMetrics;
  costSavings: CostSavingsMetrics;
  
  // Performance tracking
  performanceMetrics: PerformanceMetrics;
  successFactors: SuccessFactorAnalysis;
  
  // Activity and alerts
  recentActivity: EnhancedRecentActivity[];
  alerts: EnhancedAutomationAlert[];
  anomalies: AnomalyDetection[];
  
  // Scheduling integration
  schedulingMetrics?: SchedulingMetrics;
}

export interface EnhancedPlatformMetrics {
  platform: string;
  totalSubmissions: number;
  successCount: number;
  failureCount: number;
  pendingCount: number;
  successRate: number;
  failureRate: number;
  averageTime: number;
  medianTime: number;
  minTime: number;
  maxTime: number;
  errorTypes: Record<string, number>;
  hourlyDistribution: number[];
  weeklyTrend: number[];
  costPerSubmission: number;
  responseRate: number; // % of applications that received responses
  interviewRate: number; // % that led to interviews
}

export interface PlatformComparisonMetrics {
  bestPerforming: string;
  worstPerforming: string;
  platformRankings: Array<{
    platform: string;
    score: number; // Composite score based on multiple factors
    successRate: number;
    speed: number;
    reliability: number;
    responseRate: number;
  }>;
  recommendations: string[];
}

export interface TimingEffectivenessMetrics {
  bestHours: number[];
  worstHours: number[];
  bestDays: number[];
  worstDays: number[];
  peakPerformanceWindows: Array<{
    day: number;
    startHour: number;
    endHour: number;
    successRate: number;
    submissionCount: number;
  }>;
  timezoneOptimization: {
    currentTimezone: string;
    recommendedTimezone?: string;
    potentialImprovement: number;
  };
}

export interface OptimalTimingAnalysis {
  platformSpecificWindows: Record<string, {
    optimalHours: number[];
    optimalDays: number[];
    avoidHours: number[];
    avoidDays: number[];
  }>;
  competitionAnalysis: {
    lowCompetitionWindows: Array<{ day: number; hour: number; competitionLevel: number }>;
    highCompetitionWindows: Array<{ day: number; hour: number; competitionLevel: number }>;
  };
  visibilityScores: Array<{
    hour: number;
    day: number;
    score: number;
    reasoning: string;
  }>;
}

export interface EnhancedROIMetrics {
  totalTimeSaved: number;
  applicationsPerHour: number;
  costPerApplication: number;
  totalApplicationsAutomated: number;
  averageTimePerManualApplication: number;
  
  // New ROI metrics
  dollarValueSaved: number; // Based on hourly rate
  efficiencyGain: number; // % improvement over manual
  breakEvenPoint: Date | null; // When automation pays for itself
  projectedMonthlySavings: number;
  automationUtilization: number; // % of capacity being used
  scalabilityFactor: number; // How much more can be automated
}

export interface CostSavingsMetrics {
  directCosts: {
    timeSaved: number;
    dollarValue: number;
  };
  indirectCosts: {
    reducedStress: number; // Qualitative score
    improvedConsistency: number;
    betterCoverage: number;
  };
  opportunityCosts: {
    additionalApplications: number;
    fasterResponseTime: number;
    improvedTargeting: number;
  };
}

export interface PerformanceMetrics {
  trend: 'improving' | 'stable' | 'declining';
  trendPercentage: number;
  weekOverWeekGrowth: number;
  monthOverMonthGrowth: number;
  performanceScore: number; // 0-100
  reliabilityScore: number; // 0-100
  efficiencyScore: number; // 0-100
  
  bottlenecks: Array<{
    type: string;
    impact: 'high' | 'medium' | 'low';
    description: string;
    recommendation: string;
  }>;
}

export interface SuccessFactorAnalysis {
  topSuccessFactors: Array<{
    factor: string;
    correlation: number;
    description: string;
  }>;
  failurePatterns: Array<{
    pattern: string;
    frequency: number;
    preventable: boolean;
    solution: string;
  }>;
  improvementOpportunities: Array<{
    area: string;
    currentPerformance: number;
    potential: number;
    effort: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
  }>;
}

export interface EnhancedRecentActivity {
  id: string;
  jobTitle: string;
  companyName: string;
  platform: string;
  status: ApplicationStatus;
  submittedAt: Date | null;
  processingTime: number | null;
  errorMessage: string | null;
  
  // Enhanced fields
  optimalityScore?: number;
  competitionLevel?: string;
  estimatedResponseTime?: number;
  similarApplicationsCount: number;
  successProbability?: number;
}

export interface EnhancedAutomationAlert {
  id: string;
  type: 'critical' | 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  severity: number; // 1-10
  actionRequired: boolean;
  suggestedAction?: string;
  autoResolve?: boolean;
  metadata?: any;
}

export interface AnomalyDetection {
  id: string;
  type: string;
  description: string;
  detectedAt: Date;
  severity: 'high' | 'medium' | 'low';
  metrics: {
    expected: number;
    actual: number;
    deviation: number;
  };
  recommendation: string;
}

export interface SchedulingMetrics {
  totalScheduled: number;
  optimalSlots: number;
  suboptimalSlots: number;
  averageOptimalityScore: number;
  schedulingEfficiency: number;
  upcomingOptimalWindows: Array<{
    time: Date;
    score: number;
    platform?: string;
  }>;
}

export class EnhancedAutomationAnalytics {
  private userId: string;
  private cache: Map<string, { data: any; timestamp: Date }> = new Map();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Get comprehensive enhanced metrics
   */
  async getEnhancedMetrics(
    dateRange: 'day' | 'week' | 'month' = 'week'
  ): Promise<EnhancedAutomationMetrics> {
    const cacheKey = `metrics-${dateRange}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const startDate = this.getStartDate(dateRange);
    const endDate = new Date();

    // Fetch all submissions with related data
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
            jobFitAnalysis: true,
          },
        },
        outcomeEvents: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate all metrics
    const [
      platformBreakdown,
      platformComparison,
      timingEffectiveness,
      optimalTimingAnalysis,
      roiMetrics,
      costSavings,
      performanceMetrics,
      successFactors,
      anomalies,
      schedulingMetrics,
    ] = await Promise.all([
      this.getEnhancedPlatformBreakdown(submissions),
      this.getPlatformComparison(submissions),
      this.getTimingEffectiveness(submissions),
      this.getOptimalTimingAnalysis(submissions),
      this.getEnhancedROI(submissions),
      this.getCostSavings(submissions),
      this.getPerformanceMetrics(submissions, dateRange),
      this.getSuccessFactors(submissions),
      this.detectAnomalies(submissions),
      this.getSchedulingMetrics(),
    ]);

    // Basic calculations
    const automated = submissions.filter(s => s.wasAutomated);
    const manual = submissions.filter(s => !s.wasAutomated);
    const successful = automated.filter(s => s.status === 'SUBMITTED');
    const failed = automated.filter(s => s.status === 'FAILED');
    const pending = automated.filter(s => s.status === 'PENDING');

    const processingTimes = automated
      .filter(s => s.submittedAt && s.createdAt)
      .map(s => differenceInMinutes(s.submittedAt!, s.createdAt));

    const avgProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
      : 0;

    const metrics: EnhancedAutomationMetrics = {
      totalAutomated: automated.length,
      totalManual: manual.length,
      successRate: automated.length > 0 ? (successful.length / automated.length) * 100 : 0,
      failureRate: automated.length > 0 ? (failed.length / automated.length) * 100 : 0,
      pendingCount: pending.length,
      averageProcessingTime: avgProcessingTime,
      platformBreakdown,
      platformComparison,
      timeBreakdown: this.getTimeBreakdown(successful),
      timingEffectiveness,
      optimalTimingAnalysis,
      roiMetrics,
      costSavings,
      performanceMetrics,
      successFactors,
      recentActivity: await this.getEnhancedRecentActivity(),
      alerts: await this.getEnhancedAlerts(submissions),
      anomalies,
      schedulingMetrics,
    };

    this.setCache(cacheKey, metrics);
    return metrics;
  }

  /**
   * Get enhanced platform breakdown with detailed metrics
   */
  private async getEnhancedPlatformBreakdown(
    submissions: any[]
  ): Promise<EnhancedPlatformMetrics[]> {
    const platformMap = new Map<string, any>();

    for (const submission of submissions) {
      const platform = this.detectPlatform(submission);
      
      if (!platformMap.has(platform)) {
        platformMap.set(platform, {
          total: 0,
          success: 0,
          failed: 0,
          pending: 0,
          times: [],
          errors: {},
          hourlyDist: new Array(24).fill(0),
          weeklyTrend: [],
          responses: 0,
          interviews: 0,
        });
      }

      const data = platformMap.get(platform)!;
      data.total++;

      // Status tracking
      switch (submission.status) {
        case 'SUBMITTED':
          data.success++;
          if (submission.submittedAt && submission.createdAt) {
            data.times.push(differenceInMinutes(submission.submittedAt, submission.createdAt));
          }
          break;
        case 'FAILED':
          data.failed++;
          const errorType = submission.errorMessage || 'Unknown';
          data.errors[errorType] = (data.errors[errorType] || 0) + 1;
          break;
        case 'PENDING':
          data.pending++;
          break;
      }

      // Track responses and interviews
      if (submission.responseReceivedAt) {
        data.responses++;
      }
      if (submission.interviewCount > 0) {
        data.interviews++;
      }

      // Hourly distribution
      if (submission.submittedAt) {
        const hour = submission.submittedAt.getHours();
        data.hourlyDist[hour]++;
      }
    }

    // Calculate metrics for each platform
    const metrics: EnhancedPlatformMetrics[] = [];
    
    for (const [platform, data] of platformMap.entries()) {
      const times = data.times.sort((a: number, b: number) => a - b);
      const medianTime = times.length > 0
        ? times[Math.floor(times.length / 2)]
        : 0;

      metrics.push({
        platform,
        totalSubmissions: data.total,
        successCount: data.success,
        failureCount: data.failed,
        pendingCount: data.pending,
        successRate: data.total > 0 ? (data.success / data.total) * 100 : 0,
        failureRate: data.total > 0 ? (data.failed / data.total) * 100 : 0,
        averageTime: times.length > 0 
          ? times.reduce((a: number, b: number) => a + b, 0) / times.length 
          : 0,
        medianTime,
        minTime: times.length > 0 ? times[0] : 0,
        maxTime: times.length > 0 ? times[times.length - 1] : 0,
        errorTypes: data.errors,
        hourlyDistribution: data.hourlyDist,
        weeklyTrend: await this.getPlatformWeeklyTrend(platform),
        costPerSubmission: this.calculateCostPerSubmission(platform, data.total),
        responseRate: data.total > 0 ? (data.responses / data.total) * 100 : 0,
        interviewRate: data.total > 0 ? (data.interviews / data.total) * 100 : 0,
      });
    }

    return metrics.sort((a, b) => b.totalSubmissions - a.totalSubmissions);
  }

  /**
   * Compare platform performance
   */
  private async getPlatformComparison(
    submissions: any[]
  ): Promise<PlatformComparisonMetrics> {
    const platformMetrics = await this.getEnhancedPlatformBreakdown(submissions);
    
    // Calculate composite scores
    const rankings = platformMetrics.map(pm => {
      const successScore = pm.successRate;
      const speedScore = pm.averageTime > 0 ? Math.max(0, 100 - pm.averageTime) : 0;
      const reliabilityScore = 100 - pm.failureRate;
      const responseScore = pm.responseRate;
      
      const compositeScore = (
        successScore * 0.3 +
        speedScore * 0.2 +
        reliabilityScore * 0.3 +
        responseScore * 0.2
      );

      return {
        platform: pm.platform,
        score: compositeScore,
        successRate: successScore,
        speed: speedScore,
        reliability: reliabilityScore,
        responseRate: responseScore,
      };
    }).sort((a, b) => b.score - a.score);

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (rankings.length > 0) {
      const best = rankings[0];
      const worst = rankings[rankings.length - 1];
      
      if (best.score > 70) {
        recommendations.push(`Focus more applications on ${best.platform} for best results`);
      }
      
      if (worst.score < 30 && worst.platform !== 'Other') {
        recommendations.push(`Consider reducing or optimizing ${worst.platform} submissions`);
      }
      
      // Check for platform-specific issues
      platformMetrics.forEach(pm => {
        if (pm.failureRate > 30) {
          recommendations.push(`Investigate high failure rate on ${pm.platform}`);
        }
        if (pm.responseRate < 5 && pm.totalSubmissions > 10) {
          recommendations.push(`${pm.platform} has low response rate - review application quality`);
        }
      });
    }

    return {
      bestPerforming: rankings[0]?.platform || 'None',
      worstPerforming: rankings[rankings.length - 1]?.platform || 'None',
      platformRankings: rankings,
      recommendations,
    };
  }

  /**
   * Analyze timing effectiveness
   */
  private async getTimingEffectiveness(
    submissions: any[]
  ): Promise<TimingEffectivenessMetrics> {
    const timeStats = new Map<string, { success: number; total: number }>();
    
    // Analyze by hour and day
    submissions.forEach(sub => {
      if (sub.submittedAt) {
        const hour = sub.submittedAt.getHours();
        const day = sub.submittedAt.getDay();
        
        const hourKey = `h-${hour}`;
        const dayKey = `d-${day}`;
        
        // Initialize if needed
        [hourKey, dayKey].forEach(key => {
          if (!timeStats.has(key)) {
            timeStats.set(key, { success: 0, total: 0 });
          }
          const stat = timeStats.get(key)!;
          stat.total++;
          if (sub.status === 'SUBMITTED') {
            stat.success++;
          }
        });
      }
    });

    // Calculate best/worst times
    const hourStats = Array.from({ length: 24 }, (_, i) => {
      const stat = timeStats.get(`h-${i}`) || { success: 0, total: 0 };
      return {
        hour: i,
        successRate: stat.total > 0 ? (stat.success / stat.total) * 100 : 0,
        count: stat.total,
      };
    }).sort((a, b) => b.successRate - a.successRate);

    const dayStats = Array.from({ length: 7 }, (_, i) => {
      const stat = timeStats.get(`d-${i}`) || { success: 0, total: 0 };
      return {
        day: i,
        successRate: stat.total > 0 ? (stat.success / stat.total) * 100 : 0,
        count: stat.total,
      };
    }).sort((a, b) => b.successRate - a.successRate);

    // Find peak performance windows
    const peakWindows = this.findPeakWindows(submissions);

    // Get user's automation settings for timezone
    const settings = await db.automationSettings.findUnique({
      where: { userId: this.userId },
    });

    return {
      bestHours: hourStats.slice(0, 3).map(s => s.hour),
      worstHours: hourStats.slice(-3).map(s => s.hour),
      bestDays: dayStats.slice(0, 3).map(s => s.day),
      worstDays: dayStats.slice(-3).map(s => s.day),
      peakPerformanceWindows: peakWindows,
      timezoneOptimization: {
        currentTimezone: settings?.userTimezone || 'America/New_York',
        recommendedTimezone: undefined, // Could analyze based on job locations
        potentialImprovement: 0,
      },
    };
  }

  /**
   * Get optimal timing analysis
   */
  private async getOptimalTimingAnalysis(
    submissions: any[]
  ): Promise<OptimalTimingAnalysis> {
    // Platform-specific analysis
    const platformWindows: Record<string, any> = {};
    
    const platforms = ['LinkedIn', 'Indeed', 'Glassdoor', 'ZipRecruiter'];
    for (const platform of platforms) {
      const platformSubs = submissions.filter(s => 
        this.detectPlatform(s) === platform
      );
      
      if (platformSubs.length > 0) {
        platformWindows[platform] = this.analyzePlatformTiming(platformSubs);
      }
    }

    // Competition analysis
    const competitionAnalysis = await this.analyzeCompetitionWindows(submissions);

    // Visibility scoring
    const visibilityScores = this.calculateVisibilityScores(submissions);

    return {
      platformSpecificWindows: platformWindows,
      competitionAnalysis,
      visibilityScores,
    };
  }

  /**
   * Calculate enhanced ROI metrics
   */
  private async getEnhancedROI(submissions: any[]): Promise<EnhancedROIMetrics> {
    const automated = submissions.filter(s => s.wasAutomated);
    const manual = submissions.filter(s => !s.wasAutomated);
    
    // Time calculations
    const avgManualTime = 30; // minutes
    const totalTimeSaved = (automated.length * avgManualTime) / 60; // hours
    const hourlyRate = 25; // $25/hour default
    const dollarValueSaved = totalTimeSaved * hourlyRate;
    
    // Efficiency calculations
    const automationTime = 2; // 2 minutes per automated application
    const efficiencyGain = ((avgManualTime - automationTime) / avgManualTime) * 100;
    
    // Utilization metrics
    const settings = await db.automationSettings.findUnique({
      where: { userId: this.userId },
    });
    
    const maxCapacity = settings ? settings.applicationsPerDay * 30 : 1500; // Monthly
    const automationUtilization = (automated.length / maxCapacity) * 100;
    
    // Scalability
    const scalabilityFactor = Math.max(0, 100 - automationUtilization);
    
    // Calculate applications per hour
    const timeRange = differenceInHours(new Date(), submissions[submissions.length - 1]?.createdAt || new Date());
    const applicationsPerHour = timeRange > 0 ? automated.length / timeRange : 0;

    return {
      totalTimeSaved,
      applicationsPerHour,
      costPerApplication: 0, // Could calculate based on API costs
      totalApplicationsAutomated: automated.length,
      averageTimePerManualApplication: avgManualTime,
      dollarValueSaved,
      efficiencyGain,
      breakEvenPoint: null, // Would need subscription cost data
      projectedMonthlySavings: (dollarValueSaved / automated.length) * 150, // Assume 150/month
      automationUtilization,
      scalabilityFactor,
    };
  }

  /**
   * Calculate cost savings metrics
   */
  private async getCostSavings(submissions: any[]): Promise<CostSavingsMetrics> {
    const automated = submissions.filter(s => s.wasAutomated);
    
    // Direct cost savings
    const timeSaved = (automated.length * 30) / 60; // hours
    const hourlyRate = 25;
    
    // Indirect benefits (scored 0-100)
    const consistencyScore = automated.length > 0 ? 85 : 0; // Automation is consistent
    const coverageScore = Math.min(100, automated.length * 2); // More apps = better coverage
    const stressReduction = Math.min(100, automated.length * 3); // Less manual work
    
    // Opportunity costs
    const additionalApps = automated.length; // Wouldn't have been done manually
    const fasterResponse = 75; // Automation responds faster
    const betterTargeting = 60; // Can target more precisely

    return {
      directCosts: {
        timeSaved,
        dollarValue: timeSaved * hourlyRate,
      },
      indirectCosts: {
        reducedStress: stressReduction,
        improvedConsistency: consistencyScore,
        betterCoverage: coverageScore,
      },
      opportunityCosts: {
        additionalApplications: additionalApps,
        fasterResponseTime: fasterResponse,
        improvedTargeting: betterTargeting,
      },
    };
  }

  /**
   * Get performance metrics and trends
   */
  private async getPerformanceMetrics(
    submissions: any[],
    dateRange: 'day' | 'week' | 'month'
  ): Promise<PerformanceMetrics> {
    // Calculate trends
    const currentPeriodSuccess = submissions.filter(s => s.status === 'SUBMITTED').length;
    const currentPeriodTotal = submissions.length;
    
    // Get previous period for comparison
    const prevStartDate = dateRange === 'day' ? subDays(new Date(), 2) :
                         dateRange === 'week' ? subWeeks(new Date(), 2) :
                         subMonths(new Date(), 2);
    
    const prevSubmissions = await db.applicationSubmission.findMany({
      where: {
        userId: this.userId,
        wasAutomated: true,
        createdAt: {
          gte: prevStartDate,
          lt: this.getStartDate(dateRange),
        },
      },
    });
    
    const prevPeriodSuccess = prevSubmissions.filter(s => s.status === 'SUBMITTED').length;
    const prevPeriodTotal = prevSubmissions.length;
    
    // Calculate growth
    const currentRate = currentPeriodTotal > 0 ? (currentPeriodSuccess / currentPeriodTotal) * 100 : 0;
    const prevRate = prevPeriodTotal > 0 ? (prevPeriodSuccess / prevPeriodTotal) * 100 : 0;
    const trendPercentage = prevRate > 0 ? ((currentRate - prevRate) / prevRate) * 100 : 0;
    
    // Determine trend
    const trend = trendPercentage > 5 ? 'improving' :
                 trendPercentage < -5 ? 'declining' : 'stable';
    
    // Calculate scores
    const performanceScore = Math.min(100, currentRate);
    const reliabilityScore = Math.max(0, 100 - (submissions.filter(s => s.status === 'FAILED').length / Math.max(1, submissions.length)) * 100);
    const efficiencyScore = Math.min(100, 100 - (submissions.filter(s => s.status === 'PENDING').length / Math.max(1, submissions.length)) * 100);
    
    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks(submissions);

    return {
      trend,
      trendPercentage,
      weekOverWeekGrowth: 0, // Would need weekly data
      monthOverMonthGrowth: 0, // Would need monthly data
      performanceScore,
      reliabilityScore,
      efficiencyScore,
      bottlenecks,
    };
  }

  /**
   * Analyze success factors
   */
  private async getSuccessFactors(
    submissions: any[]
  ): Promise<SuccessFactorAnalysis> {
    const successful = submissions.filter(s => s.status === 'SUBMITTED');
    const failed = submissions.filter(s => s.status === 'FAILED');
    
    // Analyze success factors
    const successFactors = [
      {
        factor: 'Optimal Timing',
        correlation: this.calculateTimingCorrelation(successful),
        description: 'Applications submitted during peak hours',
      },
      {
        factor: 'Platform Match',
        correlation: this.calculatePlatformCorrelation(successful),
        description: 'Using the right platform for the job type',
      },
      {
        factor: 'Quick Submission',
        correlation: this.calculateSpeedCorrelation(successful),
        description: 'Applying within 24 hours of posting',
      },
    ];
    
    // Analyze failure patterns
    const failurePatterns = this.analyzeFailurePatterns(failed);
    
    // Identify improvement opportunities
    const opportunities = [
      {
        area: 'Timing Optimization',
        currentPerformance: 60,
        potential: 85,
        effort: 'low' as const,
        impact: 'high' as const,
      },
      {
        area: 'Platform Selection',
        currentPerformance: 70,
        potential: 90,
        effort: 'medium' as const,
        impact: 'medium' as const,
      },
      {
        area: 'Error Recovery',
        currentPerformance: 50,
        potential: 80,
        effort: 'high' as const,
        impact: 'high' as const,
      },
    ];

    return {
      topSuccessFactors: successFactors.sort((a, b) => b.correlation - a.correlation),
      failurePatterns,
      improvementOpportunities: opportunities,
    };
  }

  /**
   * Detect anomalies in automation performance
   */
  private async detectAnomalies(submissions: any[]): Promise<AnomalyDetection[]> {
    const anomalies: AnomalyDetection[] = [];
    
    // Check for unusual failure spikes
    const recentFailures = submissions.filter(s => 
      s.status === 'FAILED' && 
      s.createdAt >= subHours(new Date(), 1)
    );
    
    if (recentFailures.length >= 5) {
      anomalies.push({
        id: 'failure-spike',
        type: 'Performance Anomaly',
        description: 'Unusual spike in application failures',
        detectedAt: new Date(),
        severity: 'high',
        metrics: {
          expected: 1,
          actual: recentFailures.length,
          deviation: recentFailures.length - 1,
        },
        recommendation: 'Check platform APIs and authentication credentials',
      });
    }
    
    // Check for processing time anomalies
    const processingTimes = submissions
      .filter(s => s.submittedAt && s.createdAt)
      .map(s => differenceInMinutes(s.submittedAt!, s.createdAt));
    
    if (processingTimes.length > 0) {
      const avgTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      const recentTimes = processingTimes.slice(0, 5);
      const recentAvg = recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length;
      
      if (recentAvg > avgTime * 2) {
        anomalies.push({
          id: 'slow-processing',
          type: 'Performance Anomaly',
          description: 'Processing times are slower than usual',
          detectedAt: new Date(),
          severity: 'medium',
          metrics: {
            expected: avgTime,
            actual: recentAvg,
            deviation: recentAvg - avgTime,
          },
          recommendation: 'Check system load and API rate limits',
        });
      }
    }
    
    return anomalies;
  }

  /**
   * Get enhanced recent activity
   */
  private async getEnhancedRecentActivity(limit = 10): Promise<EnhancedRecentActivity[]> {
    const submissions = await db.applicationSubmission.findMany({
      where: {
        userId: this.userId,
        wasAutomated: true,
      },
      include: {
        jobLead: {
          include: {
            jobListing: true,
            jobFitAnalysis: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return submissions.map(submission => {
      const processingTime = submission.submittedAt && submission.createdAt
        ? differenceInMinutes(submission.submittedAt, submission.createdAt)
        : null;

      // Count similar applications
      const similarCount = submissions.filter(s => 
        s.jobLead.jobListing.company === submission.jobLead.jobListing.company
      ).length - 1;

      return {
        id: submission.id,
        jobTitle: submission.jobLead.jobListing.title,
        companyName: submission.jobLead.jobListing.company || 'Unknown Company',
        platform: this.detectPlatform(submission),
        status: submission.status,
        submittedAt: submission.submittedAt,
        processingTime,
        errorMessage: submission.errorMessage,
        optimalityScore: (submission.metadata as any)?.optimalityScore,
        competitionLevel: (submission.metadata as any)?.competitionLevel,
        estimatedResponseTime: this.estimateResponseTime(submission),
        similarApplicationsCount: similarCount,
        successProbability: this.calculateSuccessProbability(submission),
      };
    });
  }

  /**
   * Get enhanced alerts
   */
  private async getEnhancedAlerts(submissions: any[]): Promise<EnhancedAutomationAlert[]> {
    const alerts: EnhancedAutomationAlert[] = [];
    
    // Critical: Complete automation failure
    const allFailed = submissions.filter(s => s.wasAutomated).every(s => s.status === 'FAILED');
    if (allFailed && submissions.length > 0) {
      alerts.push({
        id: 'complete-failure',
        type: 'critical',
        title: 'Automation System Failure',
        message: 'All automated applications are failing',
        timestamp: new Date(),
        severity: 10,
        actionRequired: true,
        suggestedAction: 'Check authentication and API connections immediately',
        autoResolve: false,
      });
    }
    
    // Error: High failure rate
    const failureRate = submissions.filter(s => s.status === 'FAILED').length / Math.max(1, submissions.length);
    if (failureRate > 0.3) {
      alerts.push({
        id: 'high-failure',
        type: 'error',
        title: 'High Failure Rate',
        message: `${(failureRate * 100).toFixed(0)}% of applications are failing`,
        timestamp: new Date(),
        severity: 7,
        actionRequired: true,
        suggestedAction: 'Review error logs and adjust automation settings',
        autoResolve: false,
      });
    }
    
    // Warning: Low automation usage
    const automationRate = submissions.filter(s => s.wasAutomated).length / Math.max(1, submissions.length);
    if (automationRate < 0.5 && submissions.length > 10) {
      alerts.push({
        id: 'low-automation',
        type: 'warning',
        title: 'Low Automation Usage',
        message: 'Most applications are being submitted manually',
        timestamp: new Date(),
        severity: 4,
        actionRequired: false,
        suggestedAction: 'Enable more automation features to save time',
        autoResolve: true,
      });
    }
    
    // Success: Good performance
    if (failureRate < 0.1 && submissions.length > 20) {
      alerts.push({
        id: 'good-performance',
        type: 'success',
        title: 'Excellent Performance',
        message: 'Automation is working smoothly with minimal errors',
        timestamp: new Date(),
        severity: 1,
        actionRequired: false,
        autoResolve: true,
      });
    }
    
    return alerts;
  }

  /**
   * Get scheduling metrics integration
   */
  private async getSchedulingMetrics(): Promise<SchedulingMetrics | undefined> {
    try {
      const schedulingAnalytics = await getSchedulingAnalytics(this.userId);
      
      return {
        totalScheduled: schedulingAnalytics.totalScheduled,
        optimalSlots: Math.floor(schedulingAnalytics.averageOptimalityScore / 20), // Rough estimate
        suboptimalSlots: schedulingAnalytics.totalScheduled - Math.floor(schedulingAnalytics.averageOptimalityScore / 20),
        averageOptimalityScore: schedulingAnalytics.averageOptimalityScore,
        schedulingEfficiency: schedulingAnalytics.averageOptimalityScore,
        upcomingOptimalWindows: schedulingAnalytics.upcomingOptimalSlots.map(slot => ({
          time: slot.time,
          score: slot.score,
        })),
      };
    } catch (error) {
      console.error('Error fetching scheduling metrics:', error);
      return undefined;
    }
  }

  // Helper methods
  private detectPlatform(submission: any): string {
    if (submission.submissionUrl) {
      if (submission.submissionUrl.includes('linkedin.com')) return 'LinkedIn';
      if (submission.submissionUrl.includes('indeed.com')) return 'Indeed';
      if (submission.submissionUrl.includes('glassdoor.com')) return 'Glassdoor';
      if (submission.submissionUrl.includes('ziprecruiter.com')) return 'ZipRecruiter';
    }
    
    if (submission.jobLead?.jobListing?.source) {
      return submission.jobLead.jobListing.source;
    }
    
    return 'Other';
  }

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

  private getTimeBreakdown(submissions: any[]): TimeMetrics[] {
    const timeMap = new Map<string, { submissions: number; successes: number }>();

    submissions.forEach(submission => {
      if (submission.submittedAt) {
        const hour = submission.submittedAt.getHours();
        const dayOfWeek = submission.submittedAt.getDay();
        const key = `${dayOfWeek}-${hour}`;

        if (!timeMap.has(key)) {
          timeMap.set(key, { submissions: 0, successes: 0 });
        }

        const data = timeMap.get(key)!;
        data.submissions++;
        if (submission.status === 'SUBMITTED') {
          data.successes++;
        }
      }
    });

    const metrics: TimeMetrics[] = [];
    timeMap.forEach((data, key) => {
      const [dayOfWeek, hour] = key.split('-').map(Number);
      metrics.push({
        hour,
        dayOfWeek,
        submissions: data.submissions,
        successRate: data.submissions > 0 ? (data.successes / data.submissions) * 100 : 0,
      });
    });

    return metrics;
  }

  private findPeakWindows(submissions: any[]): any[] {
    // Implementation would analyze submission patterns to find peak windows
    return [];
  }

  private analyzePlatformTiming(submissions: any[]): any {
    // Analyze platform-specific timing patterns
    return {
      optimalHours: [9, 10, 11],
      optimalDays: [1, 2, 3, 4],
      avoidHours: [12, 13],
      avoidDays: [0, 6],
    };
  }

  private async analyzeCompetitionWindows(submissions: any[]): Promise<any> {
    // Analyze when competition is lowest/highest
    return {
      lowCompetitionWindows: [],
      highCompetitionWindows: [],
    };
  }

  private calculateVisibilityScores(submissions: any[]): any[] {
    // Calculate visibility scores for different time slots
    return [];
  }

  private async getPlatformWeeklyTrend(platform: string): Promise<number[]> {
    // Get weekly trend data for a platform
    return [];
  }

  private calculateCostPerSubmission(platform: string, total: number): number {
    // Calculate cost based on platform and usage
    return 0;
  }

  private identifyBottlenecks(submissions: any[]): any[] {
    const bottlenecks = [];
    
    const failureRate = submissions.filter(s => s.status === 'FAILED').length / Math.max(1, submissions.length);
    if (failureRate > 0.2) {
      bottlenecks.push({
        type: 'High Failure Rate',
        impact: 'high' as const,
        description: `${(failureRate * 100).toFixed(0)}% of applications are failing`,
        recommendation: 'Review error logs and fix authentication issues',
      });
    }
    
    return bottlenecks;
  }

  private calculateTimingCorrelation(submissions: any[]): number {
    // Calculate correlation between timing and success
    return Math.random() * 100; // Placeholder
  }

  private calculatePlatformCorrelation(submissions: any[]): number {
    // Calculate correlation between platform and success
    return Math.random() * 100; // Placeholder
  }

  private calculateSpeedCorrelation(submissions: any[]): number {
    // Calculate correlation between submission speed and success
    return Math.random() * 100; // Placeholder
  }

  private analyzeFailurePatterns(failures: any[]): any[] {
    const patterns = [];
    
    // Group failures by error message
    const errorGroups = new Map<string, number>();
    failures.forEach(f => {
      const error = f.errorMessage || 'Unknown error';
      errorGroups.set(error, (errorGroups.get(error) || 0) + 1);
    });
    
    errorGroups.forEach((count, error) => {
      patterns.push({
        pattern: error,
        frequency: count,
        preventable: true,
        solution: 'Review and fix the root cause',
      });
    });
    
    return patterns;
  }

  private estimateResponseTime(submission: any): number {
    // Estimate based on platform and job type
    return Math.floor(Math.random() * 14) + 1; // 1-14 days placeholder
  }

  private calculateSuccessProbability(submission: any): number {
    // Calculate based on various factors
    return Math.random() * 100; // Placeholder
  }

  // Cache management
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp.getTime()) < this.cacheExpiry) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: new Date() });
  }
}

// Export utility functions
export async function getEnhancedAutomationMetrics(
  userId: string,
  dateRange: 'day' | 'week' | 'month' = 'week'
): Promise<EnhancedAutomationMetrics> {
  const analytics = new EnhancedAutomationAnalytics(userId);
  return analytics.getEnhancedMetrics(dateRange);
}

interface TimeMetrics {
  hour: number;
  dayOfWeek: number;
  submissions: number;
  successRate: number;
}