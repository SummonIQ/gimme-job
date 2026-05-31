'use cache';

import { db } from '@/lib/db/client';
import { ApplicationStatus } from '@/generated/prisma/browser';
import { cacheTag } from 'next/cache';

export interface ResumePerformanceMetrics {
  id: string;
  resumeId?: string;
  resumeRevisionId?: string;
  resumeName?: string;
  
  // Performance Metrics
  totalApplications: number;
  totalResponses: number;
  totalInterviews: number;
  totalOffers: number;
  responseRate: number;
  interviewRate: number;
  offerRate: number;
  
  // ATS & Optimization Scores
  atsScore?: number;
  atsScoreHistory?: Array<{ score: number; date: Date }>;
  optimizationScore?: number;
  optimizationHistory?: Array<{ score: number; date: Date }>;
  
  // Time-based Analytics
  avgResponseTime?: number;
  avgInterviewTime?: number;
  avgOfferTime?: number;
  
  // Content Analysis
  keywordEffectiveness?: Record<string, number>;
  sectionEffectiveness?: Record<string, number>;
  lengthOptimal?: boolean;
  
  // Comparison Metrics
  industryBenchmark?: {
    responseRate: number;
    interviewRate: number;
    offerRate: number;
  };
  personalBest: boolean;
  improvementFromPrevious?: number;
  
  // Metadata
  calculatedAt: Date;
  sampleSize: number;
  dataRange?: {
    startDate: Date;
    endDate: Date;
  };
}

export interface ResumePerformanceOptions {
  resumeId?: string;
  resumeRevisionId?: string;
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  includeComparison?: boolean;
}

export interface ATSScoreTrend {
  date: Date;
  score: number;
  resumeId?: string;
  resumeRevisionId?: string;
  resumeName?: string;
  changeFromPrevious?: number;
}

export interface ResumeComparison {
  resumes: Array<{
    id: string;
    name: string;
    type: 'resume' | 'revision';
    metrics: ResumePerformanceMetrics;
  }>;
  winner: {
    id: string;
    metric: string; // 'responseRate' | 'interviewRate' | 'offerRate' | 'overall'
    value: number;
  };
  insights: string[];
}

export async function calculateResumePerformanceMetrics(
  userId: string,
  options: ResumePerformanceOptions = {}
): Promise<ResumePerformanceMetrics[]> {
  cacheTag(`user:${userId}:resume-performance`);
  
  const { resumeId, resumeRevisionId, dateRange, includeComparison } = options;
  
  // Build the application submissions query
  const whereClause: any = {
    userId,
    ...(dateRange && {
      createdAt: {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      },
    }),
  };

  if (resumeId) {
    whereClause.resumeId = resumeId;
  }

  // Get application submissions with resume information
  const applications = await db.applicationSubmission.findMany({
    where: whereClause,
    include: {
      resume: {
        include: {
          analysis: true,
        },
      },
      outcomeEvents: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  // Group applications by resume/revision
  const groupedApplications = new Map<string, typeof applications>();
  
  applications.forEach((app) => {
    const key = resumeRevisionId 
      ? `revision:${resumeRevisionId}`
      : `resume:${app.resumeId}`;
    
    if (!groupedApplications.has(key)) {
      groupedApplications.set(key, []);
    }
    groupedApplications.get(key)!.push(app);
  });

  const metrics: ResumePerformanceMetrics[] = [];

  for (const [key, apps] of groupedApplications) {
    const [type, id] = key.split(':');
    const isRevision = type === 'revision';
    
    // Calculate basic metrics
    const totalApplications = apps.length;
    const responses = apps.filter(app => 
      [ApplicationStatus.UNDER_REVIEW, ApplicationStatus.INTERVIEW_REQUESTED, 
       ApplicationStatus.INTERVIEW_SCHEDULED, ApplicationStatus.INTERVIEW_COMPLETED,
       ApplicationStatus.OFFER_RECEIVED, ApplicationStatus.OFFER_ACCEPTED].includes(app.status)
    );
    const interviews = apps.filter(app => 
      [ApplicationStatus.INTERVIEW_SCHEDULED, ApplicationStatus.INTERVIEW_COMPLETED,
       ApplicationStatus.OFFER_RECEIVED, ApplicationStatus.OFFER_ACCEPTED].includes(app.status)
    );
    const offers = apps.filter(app => 
      [ApplicationStatus.OFFER_RECEIVED, ApplicationStatus.OFFER_ACCEPTED].includes(app.status)
    );

    const responseRate = totalApplications > 0 ? (responses.length / totalApplications) * 100 : 0;
    const interviewRate = totalApplications > 0 ? (interviews.length / totalApplications) * 100 : 0;
    const offerRate = totalApplications > 0 ? (offers.length / totalApplications) * 100 : 0;

    // Calculate timing metrics
    const responseTimings = apps
      .filter(app => app.responseReceivedAt)
      .map(app => {
        const daysDiff = (app.responseReceivedAt!.getTime() - app.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff;
      });

    const avgResponseTime = responseTimings.length > 0 
      ? responseTimings.reduce((sum, time) => sum + time, 0) / responseTimings.length 
      : undefined;

    // Get resume/revision info for scores
    let atsScore: number | undefined;
    let optimizationScore: number | undefined;
    let resumeName = 'Unknown Resume';

    if (isRevision && resumeRevisionId) {
      const revision = await db.resumeRevision.findUnique({
        where: { id: resumeRevisionId },
        include: { 
          resumeAnalysis: true,
          resume: true,
        },
      });
      if (revision) {
        atsScore = revision.resumeAnalysis?.score || undefined;
        optimizationScore = revision.resumeAnalysis?.score || undefined;
        resumeName = revision.name;
      }
    } else if (!isRevision) {
      const resume = await db.resume.findUnique({
        where: { id },
        include: { analysis: true },
      });
      if (resume) {
        atsScore = resume.analysis?.score || undefined;
        optimizationScore = resume.analysis?.score || undefined;
        resumeName = resume.name;
      }
    }

    // Create performance metric
    const metric: ResumePerformanceMetrics = {
      id: `${type}:${id}`,
      ...(isRevision ? { resumeRevisionId: id } : { resumeId: id }),
      resumeName,
      totalApplications,
      totalResponses: responses.length,
      totalInterviews: interviews.length,
      totalOffers: offers.length,
      responseRate,
      interviewRate,
      offerRate,
      atsScore,
      optimizationScore,
      avgResponseTime,
      personalBest: false, // Will be calculated later
      calculatedAt: new Date(),
      sampleSize: totalApplications,
      dataRange: dateRange,
    };

    metrics.push(metric);
  }

  // Determine personal best
  if (metrics.length > 1) {
    const bestMetric = metrics.reduce((best, current) => {
      const bestScore = (best.responseRate + best.interviewRate + best.offerRate) / 3;
      const currentScore = (current.responseRate + current.interviewRate + current.offerRate) / 3;
      return currentScore > bestScore ? current : best;
    });
    bestMetric.personalBest = true;
  } else if (metrics.length === 1) {
    metrics[0].personalBest = true;
  }

  return metrics;
}

export async function compareResumePerformance(
  userId: string,
  options: {
    resumeIds?: string[];
    revisionIds?: string[];
    dateRange?: {
      startDate: Date;
      endDate: Date;
    };
  }
): Promise<ResumeComparison> {
  cacheTag(`user:${userId}:resume-comparison`);
  
  const { resumeIds, revisionIds, dateRange } = options;
  const resumes: ResumeComparison['resumes'] = [];

  // Get metrics for each resume
  if (resumeIds) {
    for (const resumeId of resumeIds) {
      const metrics = await calculateResumePerformanceMetrics(userId, {
        resumeId,
        dateRange,
      });
      
      if (metrics.length > 0) {
        const resume = await db.resume.findUnique({
          where: { id: resumeId },
          select: { name: true },
        });
        
        resumes.push({
          id: resumeId,
          name: resume?.name || 'Unknown Resume',
          type: 'resume',
          metrics: metrics[0],
        });
      }
    }
  }

  if (revisionIds) {
    for (const revisionId of revisionIds) {
      const metrics = await calculateResumePerformanceMetrics(userId, {
        resumeRevisionId: revisionId,
        dateRange,
      });
      
      if (metrics.length > 0) {
        const revision = await db.resumeRevision.findUnique({
          where: { id: revisionId },
          select: { name: true },
        });
        
        resumes.push({
          id: revisionId,
          name: revision?.name || 'Unknown Revision',
          type: 'revision',
          metrics: metrics[0],
        });
      }
    }
  }

  // Find the winner
  let winner = resumes[0];
  let winningMetric = 'overall';
  let winningValue = 0;

  resumes.forEach((resume) => {
    const overallScore = (
      resume.metrics.responseRate + 
      resume.metrics.interviewRate + 
      resume.metrics.offerRate
    ) / 3;
    
    if (overallScore > winningValue) {
      winner = resume;
      winningValue = overallScore;
    }
  });

  // Generate insights
  const insights: string[] = [];
  
  if (resumes.length > 1) {
    const avgResponseRate = resumes.reduce((sum, r) => sum + r.metrics.responseRate, 0) / resumes.length;
    const bestResponseRate = Math.max(...resumes.map(r => r.metrics.responseRate));
    const worstResponseRate = Math.min(...resumes.map(r => r.metrics.responseRate));
    
    insights.push(
      `Response rates vary by ${(bestResponseRate - worstResponseRate).toFixed(1)}% across versions`,
      `${winner.name} performs ${(winner.metrics.responseRate - avgResponseRate).toFixed(1)}% above average`,
    );
    
    if (winner.metrics.totalApplications < 10) {
      insights.push('Small sample size - consider collecting more data for reliable insights');
    }
  }

  return {
    resumes,
    winner: {
      id: winner.id,
      metric: winningMetric,
      value: winningValue,
    },
    insights,
  };
}

export async function getATSScoreTrends(
  userId: string,
  options: {
    resumeId?: string;
    dateRange?: {
      startDate: Date;
      endDate: Date;
    };
    timeframe?: string;
  } = {}
): Promise<ATSScoreTrend[]> {
  cacheTag(`user:${userId}:ats-trends`);
  
  const { resumeId, dateRange, timeframe = '90d' } = options;
  
  // Calculate date range if not provided
  let startDate = dateRange?.startDate;
  let endDate = dateRange?.endDate || new Date();
  
  if (!startDate) {
    const days = parseInt(timeframe.replace('d', ''));
    startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
  }

  // Get resume analyses within date range
  const whereClause: any = {
    userId,
    createdAt: {
      gte: startDate,
      lte: endDate,
    },
    score: {
      not: null,
    },
  };

  if (resumeId) {
    whereClause.OR = [
      { resumeId },
      { resumeRevision: { resumeId } },
    ];
  }

  const analyses = await db.resumeAnalysis.findMany({
    where: whereClause,
    include: {
      resume: {
        select: { id: true, name: true },
      },
      resumeRevision: {
        select: { id: true, name: true, resumeId: true },
        include: {
          resume: {
            select: { name: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const trends: ATSScoreTrend[] = analyses.map((analysis, index) => {
    const previousScore = index > 0 ? analyses[index - 1].score : null;
    const changeFromPrevious = previousScore 
      ? ((analysis.score! - previousScore) / previousScore) * 100 
      : undefined;

    return {
      date: analysis.createdAt,
      score: analysis.score!,
      resumeId: analysis.resumeId || analysis.resumeRevision?.resumeId,
      resumeRevisionId: analysis.resumeRevisionId || undefined,
      resumeName: analysis.resumeRevision 
        ? `${analysis.resumeRevision.resume.name} (${analysis.resumeRevision.name})`
        : analysis.resume?.name || 'Unknown',
      changeFromPrevious,
    };
  });

  return trends;
}