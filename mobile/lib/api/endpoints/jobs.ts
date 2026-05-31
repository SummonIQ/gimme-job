import { api } from '@/lib/api/client';

interface JobsParams {
  excludeApplied?: boolean;
  excludeDismissed?: boolean;
  excludeLeads?: boolean;
  includeCount?: boolean;
  jobType?: string;
  location?: string;
  maxSalary?: string;
  minSalary?: string;
  noCache?: boolean;
  page?: number;
  pageSize?: number;
  postedWithin?: string;
  remote?: boolean;
  savedOnly?: boolean;
  search?: string;
  sort?: string;
  sources?: string;
}

interface JobListingResponse {
  data: JobListing[];
  pageInfo: {
    count: number;
    total: number;
    pageCount: number;
  };
  timestamp: number;
}

interface JobListing {
  id: string;
  title: string;
  company: string | null;
  companyLogoUrl: string | null;
  location: string | null;
  salary: string | null;
  description: string | null;
  remote: boolean | null;
  jobType: string | null;
  jobProvider: string | null;
  status: string;
  source: string | null;
  saved: boolean;
  postedAt: string | null;
  createdAt: string;
  healthInsurance: boolean | null;
  dentalCoverage: boolean | null;
  paidTimeOff: boolean | null;
  workFromHome: boolean | null;
  lead?: { id: string } | null;
}

export type { JobListing, JobListingResponse };

export function getJobs(params: JobsParams = {}): Promise<JobListingResponse> {
  const queryParams: Record<string, string | number | boolean | undefined> = {};

  if (params.search) queryParams.search = params.search;
  if (params.location) queryParams.location = params.location;
  if (params.jobType && params.jobType !== 'any') queryParams.jobType = params.jobType;
  if (params.postedWithin && params.postedWithin !== 'any') queryParams.postedWithin = params.postedWithin;
  if (params.sort) queryParams.sort = params.sort;
  if (params.remote) queryParams.remote = true;
  if (params.savedOnly) queryParams.savedOnly = true;
  if (params.excludeApplied) queryParams.excludeApplied = true;
  if (params.excludeDismissed !== false) queryParams.excludeDismissed = true;
  if (params.excludeLeads) queryParams.excludeLeads = true;
  if (params.minSalary) queryParams.minSalary = params.minSalary;
  if (params.maxSalary) queryParams.maxSalary = params.maxSalary;
  if (params.sources) queryParams.sources = params.sources;
  if (params.page) queryParams.page = params.page;
  if (params.pageSize) queryParams.pageSize = params.pageSize;
  if (params.noCache) queryParams.noCache = true;
  if (params.includeCount) queryParams.includeCount = true;

  return api.get<JobListingResponse>('/api/jobs', queryParams);
}

interface JobListingDetail extends JobListing {
  requirements: string[] | null;
  qualifications: string[] | null;
  responsibilities: string[] | null;
  benefits: string[] | null;
  companyLogoUrl: string | null;
}

export type { JobListingDetail };

export function getJob(id: string): Promise<JobListingDetail> {
  return api.get<JobListingDetail>(`/api/mobile/jobs/${id}`);
}
