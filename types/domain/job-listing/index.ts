import { JobListing } from '@/generated/prisma/browser';

export type WithJobListing<T> = T & { jobListing: JobListing };
