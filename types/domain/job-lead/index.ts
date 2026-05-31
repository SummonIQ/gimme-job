import { JobLead } from '@/generated/prisma/browser';

export type WithJobLead<T> = T & { lead: JobLead };

export * from './events';
