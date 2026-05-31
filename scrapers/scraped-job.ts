import type { JobProvider } from '@/generated/prisma/browser';

interface ScrapedJobMetadata {
  [key: string]: unknown;
}

export interface ScrapedJob {
  title: string;
  company?: string;
  location?: string;
  description?: string;
  postedAt?: Date;
  jobUrl?: string;
  applyUrl?: string;
  remote?: boolean;
  salary?: string;
  scheduleType?: string;
  jobType?: string;
  jobProvider?: JobProvider;
  sourceId?: string;
  sourceJobId?: string;
  metadata?: ScrapedJobMetadata;
}
