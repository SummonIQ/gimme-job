import { JobLeadStatus } from '@/generated/prisma/browser';
import {
  A11Y_TEST_ANALYTICS_OVERVIEW,
  isA11yTestMode,
} from '@/lib/a11y/test-mode';
import { db } from '@/lib/db/client';
import {
  requireAuth,
  validateQueryParams,
  withApiErrorHandling,
} from '@/lib/errors/api';
import { getCurrentUser } from '@/lib/user/query';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const analyticsQuerySchema = z.object({
  timeframe: z
    .enum(['7d', '30d', '90d', '1y', 'all'])
    .optional()
    .default('30d'),
  type: z
    .enum(['overview', 'job-leads', 'resumes', 'job-searches'])
    .optional()
    .default('overview'),
});

type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

interface AnalyticsOverview {
  totalJobLeads: number;
  appliedJobs: number;
  interviewsScheduled: number;
  offersReceived: number;
  applicationRate: number;
  interviewRate: number;
  offerRate: number;
  avgJobFitScore: number;
  onboardingProgress: {
    completeProfile: boolean;
    uploadResume: boolean;
    runSearch: boolean;
    saveLead: boolean;
    trackApplication: boolean;
    setupApplicationTracking: boolean;
  };
}

interface JobLeadAnalytics {
  statusDistribution: Record<JobLeadStatus, number>;
  statusProgression: Array<{
    date: string;
    status: JobLeadStatus;
    count: number;
  }>;
  topCompanies: Array<{
    company: string;
    count: number;
    avgFitScore: number;
  }>;
  locationDistribution: Array<{
    location: string;
    count: number;
  }>;
}

interface ResumeAnalytics {
  totalResumes: number;
  avgOptimizationScore: number;
  completedOptimizations: number;
  scoreImprovements: Array<{
    resumeId: string;
    resumeName: string;
    previousScore: number;
    currentScore: number;
    improvement: number;
  }>;
}

interface JobSearchAnalytics {
  totalSearches: number;
  completedSearches: number;
  avgJobsPerSearch: number;
  topSearchTerms: Array<{
    term: string;
    count: number;
    avgResults: number;
  }>;
  searchSuccessRate: number;
}

function getDateFilter(timeframe: string) {
  const now = new Date();
  switch (timeframe) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case '1y':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    case 'all':
    default:
      return new Date(0);
  }
}

async function getOverviewAnalytics(
  userId: string,
  since: Date,
): Promise<AnalyticsOverview> {
  try {
    const [
      jobLeadsAgg,
      jobFitScores,
      resumeCount,
      searchCount,
      leadCount,
      trackedApplicationCount,
      userWithProfile,
    ] = await Promise.all([
      db.jobLead.groupBy({
        by: ['status'],
        where: {
          userId,
          createdAt: { gte: since },
        },
        _count: {
          status: true,
        },
      }),
      db.jobFitAnalysis.aggregate({
        where: {
          jobLead: {
            userId,
          },
          createdAt: { gte: since },
        },
        _avg: {
          overallMatchScore: true,
        },
      }),
      db.resume.count({
        where: {
          userId,
        },
      }),
      db.jobSearch.count({
        where: {
          userId,
        },
      }),
      db.jobLead.count({
        where: {
          userId,
        },
      }),
      db.jobLead.count({
        where: {
          userId,
          status: {
            in: [
              JobLeadStatus.APPLIED,
              JobLeadStatus.ADVANCED,
              JobLeadStatus.INTERVIEW_SCHEDULED,
              JobLeadStatus.INTERVIEW_COMPLETED,
              JobLeadStatus.INTERVIEWED_NOT_SELECTED,
              JobLeadStatus.OFFER,
              JobLeadStatus.OFFER_DECLINED,
              JobLeadStatus.HIRED,
              JobLeadStatus.REJECTED,
            ],
          },
        },
      }),
      db.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          trackingEmailAlias: true,
          jobPreferences: {
            select: {
              city: true,
              companyType: true,
              experienceLevel: true,
              jobTitles: true,
              preferRemote: true,
              remoteOnly: true,
              state: true,
              zipCode: true,
            },
          },
          profile: {
            select: {
              city: true,
              educationDegree: true,
              educationInstitution: true,
              emailAddress: true,
              firstName: true,
              githubUrl: true,
              lastName: true,
              linkedinUrl: true,
              phoneNumber: true,
              state: true,
              streetAddress: true,
              websiteUrl: true,
              zipCode: true,
            },
          },
        },
      }),
    ]);

    const statusCounts = jobLeadsAgg.reduce(
      (acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      },
      {} as Record<JobLeadStatus, number>,
    );

    const totalJobLeads = Object.values(statusCounts).reduce(
      (sum, count) => sum + count,
      0,
    );
    const appliedJobs = statusCounts[JobLeadStatus.APPLIED] || 0;
    const interviewsScheduled =
      statusCounts[JobLeadStatus.INTERVIEW_SCHEDULED] || 0;
    const offersReceived =
      (statusCounts[JobLeadStatus.OFFER] || 0) +
      (statusCounts[JobLeadStatus.HIRED] || 0);
    const hasText = (value?: string | null) =>
      typeof value === 'string' && value.trim().length > 0;
    const profile = userWithProfile?.profile;
    const profileFieldCount = profile
      ? [
          profile.firstName,
          profile.lastName,
          profile.emailAddress,
          profile.phoneNumber,
          profile.streetAddress,
          profile.city,
          profile.state,
          profile.zipCode,
          profile.linkedinUrl,
          profile.githubUrl,
          profile.websiteUrl,
          profile.educationInstitution,
          profile.educationDegree,
        ].filter(hasText).length
      : 0;
    const jobPreferences = userWithProfile?.jobPreferences;
    const preferenceSignals = jobPreferences
      ? [
          hasText(jobPreferences.city),
          hasText(jobPreferences.state),
          hasText(jobPreferences.zipCode),
          hasText(jobPreferences.companyType),
          Boolean(jobPreferences.experienceLevel),
          (jobPreferences.jobTitles?.length ?? 0) > 0,
          typeof jobPreferences.preferRemote === 'boolean',
          typeof jobPreferences.remoteOnly === 'boolean',
        ].filter(Boolean).length
      : 0;
    const completeProfile = profileFieldCount >= 3 || preferenceSignals >= 2;

    return {
      totalJobLeads,
      appliedJobs,
      interviewsScheduled,
      offersReceived,
      applicationRate:
        totalJobLeads > 0 ? (appliedJobs / totalJobLeads) * 100 : 0,
      interviewRate:
        appliedJobs > 0 ? (interviewsScheduled / appliedJobs) * 100 : 0,
      offerRate:
        interviewsScheduled > 0
          ? (offersReceived / interviewsScheduled) * 100
          : 0,
      avgJobFitScore: jobFitScores._avg.overallMatchScore ?? 0,
      onboardingProgress: {
        completeProfile,
        runSearch: searchCount > 0,
        saveLead: leadCount > 0,
        trackApplication: trackedApplicationCount > 0,
        uploadResume: resumeCount > 0,
        setupApplicationTracking: Boolean(userWithProfile?.trackingEmailAlias),
      },
    };
  } catch (error) {
    console.error('Database error in getOverviewAnalytics:', error);
    // Return empty data instead of throwing
    return {
      totalJobLeads: 0,
      appliedJobs: 0,
      interviewsScheduled: 0,
      offersReceived: 0,
      applicationRate: 0,
      interviewRate: 0,
      offerRate: 0,
      avgJobFitScore: 0,
      onboardingProgress: {
        completeProfile: false,
        runSearch: false,
        saveLead: false,
        trackApplication: false,
        uploadResume: false,
        setupApplicationTracking: false,
      },
    };
  }
}

async function getJobLeadAnalytics(
  userId: string,
  since: Date,
): Promise<JobLeadAnalytics> {
  const [
    statusDistribution,
    statusProgression,
    topCompanies,
    locationDistribution,
  ] = await Promise.all([
    db.jobLead.groupBy({
      by: ['status'],
      where: {
        userId,
        createdAt: { gte: since },
      },
      _count: {
        status: true,
      },
    }),
    db.$queryRaw<
      Array<{ date: Date; status: JobLeadStatus; count: bigint }>
    >`SELECT 
        DATE_TRUNC('day', "createdAt") as date,
        status,
        COUNT(*) as count
      FROM "JobLead"
      WHERE "userId" = ${userId} AND "createdAt" >= ${since}
      GROUP BY DATE_TRUNC('day', "createdAt"), status
      ORDER BY date ASC`,
    db.$queryRaw<
      Array<{ company: string; count: bigint; avgFitScore: number }>
    >`SELECT 
        jl.company,
        COUNT(*) as count,
        AVG(jfa."overallMatchScore") as "avgFitScore"
      FROM "JobListing" jl
      INNER JOIN "JobLead" jld ON jl.id = jld."jobListingId"
      LEFT JOIN "JobFitAnalysis" jfa ON jld.id = jfa."jobLeadId"
      WHERE jld."userId" = ${userId} AND jld."createdAt" >= ${since}
      GROUP BY jl.company
      ORDER BY count DESC
      LIMIT 10`,
    db.$queryRaw<Array<{ location: string; count: bigint }>>`SELECT 
        jl.location,
        COUNT(*) as count
      FROM "JobListing" jl
      INNER JOIN "JobLead" jld ON jl.id = jld."jobListingId"
      WHERE jld."userId" = ${userId} AND jld."createdAt" >= ${since} AND jl.location IS NOT NULL
      GROUP BY jl.location
      ORDER BY count DESC
      LIMIT 10`,
  ]);

  const statusCounts = statusDistribution.reduce(
    (acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    },
    {} as Record<JobLeadStatus, number>,
  );

  return {
    statusDistribution: statusCounts,
    statusProgression: statusProgression.map(item => ({
      date: item.date.toISOString().split('T')[0],
      status: item.status,
      count: Number(item.count),
    })),
    topCompanies: topCompanies.map(item => ({
      company: item.company || 'Unknown',
      count: Number(item.count),
      avgFitScore: item.avgFitScore || 0,
    })),
    locationDistribution: locationDistribution.map(item => ({
      location: item.location || 'Unknown',
      count: Number(item.count),
    })),
  };
}

async function getResumeAnalytics(
  userId: string,
  since: Date,
): Promise<ResumeAnalytics> {
  const [resumeCount, optimizations] = await Promise.all([
    db.resume.count({
      where: {
        userId,
        createdAt: { gte: since },
      },
    }),
    db.resumeOptimization.findMany({
      where: {
        userId,
        createdAt: { gte: since },
        status: 'COMPLETED',
        NOT: [{ score: null }, { previousScore: null }],
      },
      include: {
        resume: {
          select: { id: true, name: true },
        },
      },
      orderBy: { scoreImprovement: 'desc' },
      take: 10,
    }),
  ]);

  const avgScore =
    optimizations.length > 0
      ? optimizations.reduce((sum, opt) => sum + (opt.score || 0), 0) /
        optimizations.length
      : 0;

  return {
    totalResumes: resumeCount,
    avgOptimizationScore: avgScore,
    completedOptimizations: optimizations.length,
    scoreImprovements: optimizations.map(opt => ({
      resumeId: opt.resume?.id || '',
      resumeName: opt.resume?.name || 'Unknown Resume',
      previousScore: opt.previousScore || 0,
      currentScore: opt.score || 0,
      improvement: opt.scoreImprovement || 0,
    })),
  };
}

async function getJobSearchAnalytics(
  userId: string,
  since: Date,
): Promise<JobSearchAnalytics> {
  const [searches, searchTerms] = await Promise.all([
    db.jobSearch.findMany({
      where: {
        userId,
        createdAt: { gte: since },
      },
      include: {
        _count: {
          select: { jobSearchListings: true },
        },
      },
    }),
    db.$queryRaw<
      Array<{ searchTerm: string; count: bigint; avgResults: number }>
    >`SELECT 
        "searchTerm",
        COUNT(*) as count,
        AVG("totalJobs") as "avgResults"
      FROM "JobSearch"
      WHERE "userId" = ${userId} AND "createdAt" >= ${since}
      GROUP BY "searchTerm"
      ORDER BY count DESC
      LIMIT 10`,
  ]);

  const completedSearches = searches.filter(
    s => s.status === 'COMPLETED',
  ).length;
  const totalJobs = searches.reduce(
    (sum, search) => sum + search._count.jobSearchListings,
    0,
  );

  return {
    totalSearches: searches.length,
    completedSearches,
    avgJobsPerSearch: searches.length > 0 ? totalJobs / searches.length : 0,
    topSearchTerms: searchTerms.map(item => ({
      term: item.searchTerm,
      count: Number(item.count),
      avgResults: item.avgResults || 0,
    })),
    searchSuccessRate:
      searches.length > 0 ? (completedSearches / searches.length) * 100 : 0,
  };
}

const handleGET = async (request: NextRequest): Promise<NextResponse> => {
  const user = await getCurrentUser();
  requireAuth(user);

  const url = new URL(request.url);
  const query = validateQueryParams<AnalyticsQuery>(url, analyticsQuerySchema);

  if (isA11yTestMode) {
    const overview = A11Y_TEST_ANALYTICS_OVERVIEW;
    const empty = {
      applicationRate: 0,
      appliedJobs: 0,
      avgJobFitScore: 0,
      interviewRate: 0,
      interviewsScheduled: 0,
      onboardingProgress: {
        completeProfile: false,
        runSearch: false,
        saveLead: false,
        trackApplication: false,
        uploadResume: false,
        setupApplicationTracking: false,
      },
      offerRate: 0,
      offersReceived: 0,
      totalJobLeads: 0,
    };

    return NextResponse.json({
      data: query.type === 'overview' ? overview : empty,
      timeframe: query.timeframe,
      type: query.type,
    });
  }

  const since = getDateFilter(query.timeframe);

  let data;
  switch (query.type) {
    case 'overview':
      data = await getOverviewAnalytics(user!.id, since);
      break;
    case 'job-leads':
      data = await getJobLeadAnalytics(user!.id, since);
      break;
    case 'resumes':
      data = await getResumeAnalytics(user!.id, since);
      break;
    case 'job-searches':
      data = await getJobSearchAnalytics(user!.id, since);
      break;
    default:
      data = await getOverviewAnalytics(user!.id, since);
  }

  return NextResponse.json({
    data,
    timeframe: query.timeframe,
    type: query.type,
  });
};

export const GET = withApiErrorHandling(handleGET);
