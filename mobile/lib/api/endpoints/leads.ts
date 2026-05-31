import { api } from '@/lib/api/client';

interface LeadsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: string;
  status?: string;
}

interface LeadsResponse {
  data: JobLeadSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface JobLeadSummary {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  jobListing: {
    company: string | null;
    location: string | null;
    remote: boolean | null;
    salaryMax: number | null;
    salaryMin: number | null;
    title: string;
    type: string | null;
  } | null;
  jobFitAnalysis: {
    overallMatchScore: number | null;
    summary: string | null;
    status: string;
  } | null;
  optimization: {
    progress: number | null;
    status: string;
  } | null;
}

interface JobLeadDetail {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  jobListing: Record<string, unknown>;
  jobFitAnalysis: Record<string, unknown> | null;
  optimization: Record<string, unknown> | null;
  applicationSubmissions: Record<string, unknown>[];
  resumeRevisions: Record<string, unknown>[];
}

export function getLeads(params: LeadsParams = {}): Promise<LeadsResponse> {
  return api.get<LeadsResponse>('/api/mobile/job-leads', params);
}

export function getLead(id: string): Promise<JobLeadDetail> {
  return api.get<JobLeadDetail>(`/api/mobile/job-leads/${id}`);
}

export function createLead(jobListingId: string) {
  return api.post<{ id: string }>('/api/mobile/job-leads', { jobListingId });
}

export function updateLeadStatus(id: string, status: string) {
  return api.patch(`/api/mobile/job-leads/${id}/status`, { status });
}

export function reoptimizeLead(id: string) {
  return api.post(`/api/mobile/job-leads/${id}/reoptimize`);
}
