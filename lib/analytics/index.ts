import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';
import { JobProvider, ApplicationStatus } from '@/generated/prisma/browser';

/**
 * Types for analytics data
 */
export interface AnalyticsPeriod {
  days: number;
  startDate: Date;
  endDate: Date;
}

export interface ApplicationsOverviewData {
  total: number;
  submitted: number;
  rejected: number;
  interviewing: number;
  offered: number;
  accepted: number;
  archived: number;
}

export interface ResponseRateData {
  submitted: number;
  anyResponse: number;
  responseRate: number;
  interviewRate: number;
  offerRate: number;
}

export interface TimeToResponseData {
  averageDaysToFirstResponse: number | null;
  averageDaysToInterview: number | null;
  averageDaysToOffer: number | null;
}

export interface JobProviderPerformanceData {
  jobProvider: JobProvider;
  applications: number;
  responses: number;
  interviews: number;
  offers: number;
  responseRate: number;
  interviewRate: number;
  offerRate: number;
}

export interface ResumePerformanceData {
  resumeId: string;
  resumeName: string;
  applications: number;
  responses: number;
  interviews: number;
  offers: number;
  responseRate: number;
  interviewRate: number;
  offerRate: number;
}

export interface AnalyticsData {
  overview: ApplicationsOverviewData;
  responseRates: ResponseRateData;
  timeToResponse: TimeToResponseData;
  jobProviderPerformance: JobProviderPerformanceData[];
  resumePerformance: ResumePerformanceData[];
  period: AnalyticsPeriod;
}

/**
 * Create a period for analytics
 */
export function createAnalyticsPeriod(days: number): AnalyticsPeriod {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return {
    days,
    startDate,
    endDate,
  };
}

/**
 * Get analytics for the current user
 */
export async function getUserAnalytics(
  period: AnalyticsPeriod = createAnalyticsPeriod(90)
): Promise<AnalyticsData> {
  const user = await getCurrentUser();
  
  // Fetch all applications within the period
  const applications = await db.applicationSubmission.findMany({
    where: {
      userId: user.id,
      createdAt: {
        gte: period.startDate,
        lte: period.endDate,
      },
    },
    include: {
      jobLead: {
        include: {
          jobListing: true,
        }
      },
      resume: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  // Calculate overview metrics
  const overview: ApplicationsOverviewData = {
    total: applications.length,
    submitted: applications.filter(a => a.status === ApplicationStatus.SUBMITTED || a.status === ApplicationStatus.PENDING).length,
    rejected: applications.filter(a => a.status === ApplicationStatus.REJECTED).length,
    interviewing: applications.filter(a => a.status === ApplicationStatus.INTERVIEWING).length,
    offered: applications.filter(a => a.status === ApplicationStatus.OFFERED).length,
    accepted: applications.filter(a => a.status === ApplicationStatus.ACCEPTED).length,
    archived: applications.filter(a => a.status === ApplicationStatus.ARCHIVED).length,
  };

  // Calculate response rate metrics
  const submitted = overview.submitted;
  const anyResponse = applications.filter(a => 
    a.status === ApplicationStatus.INTERVIEWING || 
    a.status === ApplicationStatus.REJECTED || 
    a.status === ApplicationStatus.OFFERED || 
    a.status === ApplicationStatus.ACCEPTED
  ).length;
  const interviews = overview.interviewing + overview.offered + overview.accepted;
  const offers = overview.offered + overview.accepted;
  
  const responseRates: ResponseRateData = {
    submitted,
    anyResponse,
    responseRate: submitted > 0 ? (anyResponse / submitted) * 100 : 0,
    interviewRate: submitted > 0 ? (interviews / submitted) * 100 : 0,
    offerRate: submitted > 0 ? (offers / submitted) * 100 : 0,
  };

  // Calculate time to response metrics
  const timeToResponseData: TimeToResponseData = {
    averageDaysToFirstResponse: calculateAverageDaysToResponse(applications),
    averageDaysToInterview: calculateAverageDaysToInterview(applications),
    averageDaysToOffer: calculateAverageDaysToOffer(applications),
  };

  // Calculate job board performance
  const jobProviderPerformance = await calculateJobProviderPerformance(applications);
  
  // Calculate resume performance
  const resumePerformance = await calculateResumePerformance(applications);

  return {
    overview,
    responseRates,
    timeToResponse: timeToResponseData,
    jobProviderPerformance,
    resumePerformance,
    period,
  };
}

/**
 * Calculate average days between submission and first response
 */
function calculateAverageDaysToResponse(applications: any[]): number | null {
  const applicationsWithResponse = applications.filter(app => 
    app.status !== ApplicationStatus.SUBMITTED && 
    app.status !== ApplicationStatus.PENDING &&
    app.firstResponseDate
  );
  
  if (applicationsWithResponse.length === 0) {
    return null;
  }
  
  const totalDays = applicationsWithResponse.reduce((sum, app) => {
    const submissionDate = new Date(app.createdAt);
    const responseDate = new Date(app.firstResponseDate);
    const diffTime = Math.abs(responseDate.getTime() - submissionDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return sum + diffDays;
  }, 0);
  
  return totalDays / applicationsWithResponse.length;
}

/**
 * Calculate average days between submission and first interview
 */
function calculateAverageDaysToInterview(applications: any[]): number | null {
  const applicationsWithInterview = applications.filter(app => 
    (app.status === ApplicationStatus.INTERVIEWING || 
     app.status === ApplicationStatus.OFFERED || 
     app.status === ApplicationStatus.ACCEPTED) &&
    app.firstInterviewDate
  );
  
  if (applicationsWithInterview.length === 0) {
    return null;
  }
  
  const totalDays = applicationsWithInterview.reduce((sum, app) => {
    const submissionDate = new Date(app.createdAt);
    const interviewDate = new Date(app.firstInterviewDate);
    const diffTime = Math.abs(interviewDate.getTime() - submissionDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return sum + diffDays;
  }, 0);
  
  return totalDays / applicationsWithInterview.length;
}

/**
 * Calculate average days between submission and offer
 */
function calculateAverageDaysToOffer(applications: any[]): number | null {
  const applicationsWithOffer = applications.filter(app => 
    (app.status === ApplicationStatus.OFFERED || 
     app.status === ApplicationStatus.ACCEPTED) &&
    app.offerDate
  );
  
  if (applicationsWithOffer.length === 0) {
    return null;
  }
  
  const totalDays = applicationsWithOffer.reduce((sum, app) => {
    const submissionDate = new Date(app.createdAt);
    const offerDate = new Date(app.offerDate);
    const diffTime = Math.abs(offerDate.getTime() - submissionDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return sum + diffDays;
  }, 0);
  
  return totalDays / applicationsWithOffer.length;
}

/**
 * Calculate job board performance metrics
 */
async function calculateJobProviderPerformance(applications: any[]): Promise<JobProviderPerformanceData[]> {
  // Group applications by job board
  const jobProviderApplications = applications.reduce((acc, app) => {
    if (!app.jobLead?.jobListing?.jobProvider) return acc;

    const jobProvider = app.jobLead.jobListing.jobProvider;
    if (!acc[jobProvider]) {
      acc[jobProvider] = [];
    }
    acc[jobProvider].push(app);
    return acc;
  }, {} as Record<JobProvider, any[]>);

  // Calculate metrics for each job provider
  return Object.entries(jobProviderApplications).map(([jobProvider, apps]) => {
    const applications = apps.length;
    const responses = apps.filter(a => 
      a.status !== ApplicationStatus.SUBMITTED && 
      a.status !== ApplicationStatus.PENDING
    ).length;
    const interviews = apps.filter(a => 
      a.status === ApplicationStatus.INTERVIEWING || 
      a.status === ApplicationStatus.OFFERED || 
      a.status === ApplicationStatus.ACCEPTED
    ).length;
    const offers = apps.filter(a => 
      a.status === ApplicationStatus.OFFERED || 
      a.status === ApplicationStatus.ACCEPTED
    ).length;
    
    return {
      jobProvider: jobProvider as JobProvider,
      applications,
      responses,
      interviews,
      offers,
      responseRate: applications > 0 ? (responses / applications) * 100 : 0,
      interviewRate: applications > 0 ? (interviews / applications) * 100 : 0,
      offerRate: applications > 0 ? (offers / applications) * 100 : 0,
    };
  });
}

/**
 * Calculate resume performance metrics
 */
async function calculateResumePerformance(applications: any[]): Promise<ResumePerformanceData[]> {
  // Group applications by resume
  const resumeApplications = applications.reduce((acc, app) => {
    if (!app.resumeId || !app.resume) return acc;
    
    if (!acc[app.resumeId]) {
      acc[app.resumeId] = {
        resumeId: app.resumeId,
        resumeName: app.resume.name,
        applications: [],
      };
    }
    acc[app.resumeId].applications.push(app);
    return acc;
  }, {} as Record<string, { resumeId: string; resumeName: string; applications: any[] }>);
  
  // Calculate metrics for each resume
  return Object.values(resumeApplications).map((resumeData) => {
    const apps = resumeData.applications;
    const applications = apps.length;
    const responses = apps.filter(a => 
      a.status !== ApplicationStatus.SUBMITTED && 
      a.status !== ApplicationStatus.PENDING
    ).length;
    const interviews = apps.filter(a => 
      a.status === ApplicationStatus.INTERVIEWING || 
      a.status === ApplicationStatus.OFFERED || 
      a.status === ApplicationStatus.ACCEPTED
    ).length;
    const offers = apps.filter(a => 
      a.status === ApplicationStatus.OFFERED || 
      a.status === ApplicationStatus.ACCEPTED
    ).length;
    
    return {
      resumeId: resumeData.resumeId,
      resumeName: resumeData.resumeName,
      applications,
      responses,
      interviews,
      offers,
      responseRate: applications > 0 ? (responses / applications) * 100 : 0,
      interviewRate: applications > 0 ? (interviews / applications) * 100 : 0,
      offerRate: applications > 0 ? (offers / applications) * 100 : 0,
    };
  });
}

/**
 * Get application status history
 */
export async function getApplicationStatusHistory(
  period: AnalyticsPeriod = createAnalyticsPeriod(90)
): Promise<{ date: string; status: ApplicationStatus; count: number }[]> {
  const user = await getCurrentUser();
  
  // Get application status history (daily snapshot)
  const statusHistory = await db.$queryRaw`
    SELECT 
      DATE(created_at) as date, 
      status, 
      COUNT(*) as count
    FROM application_submission
    WHERE 
      user_id = ${user.id} AND
      created_at >= ${period.startDate} AND
      created_at <= ${period.endDate}
    GROUP BY DATE(created_at), status
    ORDER BY date ASC
  `;
  
  return statusHistory as { date: string; status: ApplicationStatus; count: number }[];
}
