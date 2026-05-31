import type {
  ApplicationSubmission,
  JobFitAnalysis,
  JobLead,
  JobLeadOptimization,
} from '@/generated/prisma/browser';
import {
  JobFitAnalysisStatus,
  JobLeadOptimizationStatus,
  JobLeadStatus,
} from '@/generated/prisma/browser';

const STATUS_RANK: Record<JobLeadStatus, number> = {
  [JobLeadStatus.ADDED]: 0,
  [JobLeadStatus.ANALYZING]: 1,
  [JobLeadStatus.ANALYZED]: 2,
  [JobLeadStatus.ANALYSIS_FAILED]: 2,
  [JobLeadStatus.OPTIMIZING]: 3,
  [JobLeadStatus.OPTIMIZED]: 4,
  [JobLeadStatus.OPTIMIZATION_FAILED]: 4,
  [JobLeadStatus.APPLYING]: 5,
  [JobLeadStatus.APPLIED]: 6,
  [JobLeadStatus.REJECTED]: 6,
  [JobLeadStatus.ADVANCED]: 7,
  [JobLeadStatus.INTERVIEW_SCHEDULED]: 8,
  [JobLeadStatus.INTERVIEW_CANCELLED]: 8,
  [JobLeadStatus.INTERVIEW_COMPLETED]: 9,
  [JobLeadStatus.INTERVIEWED_NOT_SELECTED]: 9,
  [JobLeadStatus.OFFER]: 10,
  [JobLeadStatus.OFFER_DECLINED]: 10,
  [JobLeadStatus.HIRED]: 11,
  [JobLeadStatus.REMOVED]: -1,
};

export function getEffectiveJobLeadStatus(
  lead: JobLead & {
    applicationSubmissions?: ApplicationSubmission[];
    jobFitAnalysis?: JobFitAnalysis | null;
    optimization?: JobLeadOptimization | null;
  },
): JobLeadStatus {
  let effectiveStatus = lead.status;
  let effectiveRank = STATUS_RANK[effectiveStatus] ?? 0;

  const promote = (status: JobLeadStatus) => {
    const rank = STATUS_RANK[status] ?? 0;
    if (rank > effectiveRank) {
      effectiveStatus = status;
      effectiveRank = rank;
    }
  };

  // Infer from job fit analysis
  if (lead.jobFitAnalysis) {
    if (lead.jobFitAnalysis.status === JobFitAnalysisStatus.COMPLETED) {
      promote(JobLeadStatus.ANALYZED);
    } else if (lead.jobFitAnalysis.status === JobFitAnalysisStatus.ANALYZING) {
      promote(JobLeadStatus.ANALYZING);
    }
  }

  // Infer from optimization
  if (lead.optimization) {
    if (lead.optimization.status === JobLeadOptimizationStatus.COMPLETED) {
      promote(JobLeadStatus.OPTIMIZED);
    } else if (
      lead.optimization.status === JobLeadOptimizationStatus.OPTIMIZING
    ) {
      promote(JobLeadStatus.OPTIMIZING);
    } else if (
      lead.optimization.status === JobLeadOptimizationStatus.ANALYZING
    ) {
      promote(JobLeadStatus.ANALYZING);
    }
  }

  // Infer from application submissions
  if (lead.applicationSubmissions && lead.applicationSubmissions.length > 0) {
    promote(JobLeadStatus.APPLIED);
  }

  return effectiveStatus;
}
