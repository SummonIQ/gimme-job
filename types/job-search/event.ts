import { JobSearchStatus } from '@/generated/prisma/browser';

// Common payload for all job search events
export type JobSearchProgressPayload = {
  id: string;
  jobListingsCount?: number;
  progress: number;
  searchTerm: string;
  status: JobSearchStatus;
};

// Extended payload with status message for real-time updates
export type JobSearchUpdatePayload = {
  id: string;
  progress?: number;
  statusMessage?: string;
  jobsFound?: number;
  status?: JobSearchStatus;
};
