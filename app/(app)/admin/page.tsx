import {
  ApplicationStatus,
  JobLeadStatus,
  ResumeAnalysisStatus,
  ResumeOptimizationStatus,
} from '@/generated/prisma/browser';

import { getFantasticUsageBudget } from '@/lib/admin/usage-budget';
import { db } from '@/lib/db/client';

import { AdminDashboard } from './admin-dashboard';
import { requireAdminUser } from './require-admin-user';

export default async function AdminPage() {
  const user = await requireAdminUser();

  const now = Date.now();
  const day1 = new Date(now - 24 * 60 * 60 * 1000);
  const day7 = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const day30 = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const [
    // ── Funnel counts ──
    totalListings,
    totalLeads,
    totalApplications,
    interviewCount,
    offerCount,
    // ── 24h activity ──
    listings24h,
    leads24h,
    applications24h,
    resumes24h,
    notifications24h,
    // ── 7d / 30d ──
    listings7d,
    listings30d,
    leads7d,
    applications7d,
    // ── Lead pipeline ──
    leadsApplied,
    leadsDismissed,
    leadsActive,
    // ── Resume health ──
    totalResumes,
    analysesCompleted,
    analysesFailed,
    optimizationsCompleted,
    avgResumeScore,
    // ── Application breakdown ──
    appsSubmitted,
    appsPending,
    appsFailed,
    appsAutomated,
    // ── Users ──
    totalUsers,
    newUsers7d,
    activeSessions,
    activeSubscriptions,
    // ── Automation ──
    scheduledApps,
    auditLogs24h,
    // ── Budget ──
    usageBudget,
    // ── Provider breakdown (24h) ──
    providerDaily,
  ] = await Promise.all([
    // funnel
    db.jobListing.count(),
    db.jobLead.count(),
    db.applicationSubmission.count(),
    db.applicationSubmission.count({
      where: {
        status: {
          in: [
            ApplicationStatus.INTERVIEW_REQUESTED,
            ApplicationStatus.INTERVIEW_SCHEDULED,
            ApplicationStatus.INTERVIEW_COMPLETED,
          ],
        },
      },
    }),
    db.applicationSubmission.count({
      where: {
        status: {
          in: [
            ApplicationStatus.OFFER_RECEIVED,
            ApplicationStatus.OFFER_ACCEPTED,
          ],
        },
      },
    }),
    // 24h
    db.jobListing.count({ where: { createdAt: { gte: day1 } } }),
    db.jobLead.count({ where: { createdAt: { gte: day1 } } }),
    db.applicationSubmission.count({ where: { createdAt: { gte: day1 } } }),
    db.resume.count({ where: { createdAt: { gte: day1 } } }),
    db.notification.count({ where: { createdAt: { gte: day1 } } }),
    // 7d / 30d
    db.jobListing.count({ where: { createdAt: { gte: day7 } } }),
    db.jobListing.count({ where: { createdAt: { gte: day30 } } }),
    db.jobLead.count({ where: { createdAt: { gte: day7 } } }),
    db.applicationSubmission.count({ where: { createdAt: { gte: day7 } } }),
    // lead pipeline
    db.jobLead.count({ where: { status: JobLeadStatus.APPLIED } }),
    db.jobLead.count({ where: { status: JobLeadStatus.REMOVED } }),
    db.jobLead.count({
      where: {
        status: {
          in: [
            JobLeadStatus.ADDED,
            JobLeadStatus.ANALYZING,
            JobLeadStatus.ANALYZED,
            JobLeadStatus.OPTIMIZING,
            JobLeadStatus.OPTIMIZED,
            JobLeadStatus.APPLYING,
            JobLeadStatus.APPLIED,
            JobLeadStatus.ADVANCED,
            JobLeadStatus.INTERVIEW_SCHEDULED,
            JobLeadStatus.INTERVIEW_COMPLETED,
            JobLeadStatus.OFFER,
          ],
        },
      },
    }),
    // resume health
    db.resume.count(),
    db.resumeAnalysis.count({
      where: { status: ResumeAnalysisStatus.COMPLETED },
    }),
    db.resumeAnalysis.count({
      where: { status: ResumeAnalysisStatus.FAILED },
    }),
    db.resumeOptimization.count({
      where: { status: ResumeOptimizationStatus.COMPLETED },
    }),
    db.resumeAnalysis.aggregate({
      _avg: { score: true },
      where: { status: ResumeAnalysisStatus.COMPLETED, score: { not: null } },
    }),
    // application breakdown
    db.applicationSubmission.count({
      where: { status: ApplicationStatus.SUBMITTED },
    }),
    db.applicationSubmission.count({
      where: { status: ApplicationStatus.PENDING },
    }),
    db.applicationSubmission.count({
      where: {
        status: {
          in: [ApplicationStatus.FAILED, ApplicationStatus.NOT_SELECTED],
        },
      },
    }),
    db.applicationSubmission.count({ where: { wasAutomated: true } }),
    // users
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: day7 } } }),
    db.session.count({ where: { expiresAt: { gt: new Date() } } }),
    db.subscription.count({
      where: { status: { in: ['active', 'trialing'] } },
    }),
    // automation
    db.automationScheduledApplication.count({
      where: { status: 'scheduled' },
    }),
    db.automationAuditLog.count({ where: { createdAt: { gte: day1 } } }),
    // budget
    getFantasticUsageBudget(),
    // provider daily
    db.jobListing.groupBy({
      by: ['jobProvider'],
      _count: true,
      where: { createdAt: { gte: day1 } },
    }),
  ]);

  const listingToLeadRate =
    totalListings > 0 ? Math.round((totalLeads / totalListings) * 100) : 0;
  const leadToAppRate =
    totalLeads > 0 ? Math.round((totalApplications / totalLeads) * 100) : 0;
  const appToInterviewRate =
    totalApplications > 0
      ? Math.round((interviewCount / totalApplications) * 100)
      : 0;
  const interviewToOfferRate =
    interviewCount > 0 ? Math.round((offerCount / interviewCount) * 100) : 0;

  const providerDailyMap = providerDaily.reduce(
    (acc, row) => {
      acc[row.jobProvider || 'unknown'] = row._count;
      return acc;
    },
    {} as Record<string, number>,
  );

  const stats = {
    funnel: {
      totalListings,
      totalLeads,
      totalApplications,
      interviewCount,
      offerCount,
      listingToLeadRate,
      leadToAppRate,
      appToInterviewRate,
      interviewToOfferRate,
    },
    activity24h: {
      listings: listings24h,
      leads: leads24h,
      applications: applications24h,
      resumes: resumes24h,
      notifications: notifications24h,
    },
    trends: {
      listings7d,
      listings30d,
      leads7d,
      applications7d,
    },
    pipeline: {
      leadsApplied,
      leadsDismissed,
      leadsActive,
    },
    resumeHealth: {
      totalResumes,
      analysesCompleted,
      analysesFailed,
      optimizationsCompleted,
      avgScore: Math.round(avgResumeScore._avg.score ?? 0),
    },
    applications: {
      total: totalApplications,
      submitted: appsSubmitted,
      pending: appsPending,
      failed: appsFailed,
      automated: appsAutomated,
      manualCount: totalApplications - appsAutomated,
    },
    users: {
      total: totalUsers,
      new7d: newUsers7d,
      activeSessions,
      activeSubscriptions,
    },
    automation: {
      scheduledApps,
      auditLogs24h,
    },
    budget: {
      cycleStart: usageBudget.cycleStart,
      cycleEnd: usageBudget.cycleEnd,
      jobsUsed: usageBudget.jobsUsed,
      jobsLimit: usageBudget.jobsLimit,
      requestsUsed: usageBudget.requestsUsed,
      requestsLimit: usageBudget.requestsLimit,
      projectedJobsUsed: usageBudget.projectedJobsUsed,
      projectedRequestsUsed: usageBudget.projectedRequestsUsed,
    },
    providerDaily: providerDailyMap,
  };

  return <AdminDashboard userId={user.id} stats={stats} />;
}
