'use server';

import {
  JobListingStatus,
  type JobProvider,
  type JobType,
  type Prisma,
} from '@/generated/prisma/browser';
import { Prisma as PrismaClient } from '@/generated/prisma/client';
import { unauthorized } from 'next/navigation';

import { createJobLead } from '@/lib/job-leads/create';
import { saveJobListing, saveJobListings, unsaveJobListing } from './save';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';

export interface LiveJobListingPayload {
  applyOptions?: Prisma.JsonValue;
  benefits?: string[];
  company?: string | null;
  companyLogoUrl?: string | null;
  dentalCoverage?: boolean | null;
  description?: string | null;
  detectedExtensions?: Prisma.JsonValue;
  extensions?: string[];
  healthInsurance?: boolean | null;
  id: string;
  jobProvider?: JobProvider | null;
  jobProviderUrl?: string | null;
  jobId?: string | null;
  jobType?: JobType | null;
  location?: string | null;
  paidTimeOff?: boolean | null;
  postedAt?: string | Date | null;
  qualifications?: string[];
  remote?: boolean | null;
  requirements?: string[];
  responsibilities?: string[];
  salary?: string | null;
  scheduleType?: string | null;
  source?: string | null;
  title: string;
  workFromHome?: boolean | null;
}

const resolveJobId = (payload: LiveJobListingPayload): string => {
  if (payload.jobId && payload.jobId.trim()) {
    return payload.jobId.trim();
  }
  if (payload.jobProviderUrl && payload.jobProviderUrl.trim()) {
    return payload.jobProviderUrl.trim();
  }
  return payload.id;
};

const resolvePostedAt = (postedAt?: string | Date | null): Date | null => {
  if (!postedAt) return null;
  if (postedAt instanceof Date) return postedAt;
  const parsed = new Date(postedAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildListingData = (
  payload: LiveJobListingPayload,
  userId: string,
  jobId: string,
): Prisma.JobListingCreateInput => ({
  applyOptions: payload.applyOptions ?? undefined,
  benefits: payload.benefits ?? [],
  company: payload.company ?? undefined,
  companyLogoUrl: payload.companyLogoUrl ?? undefined,
  dentalCoverage: payload.dentalCoverage ?? undefined,
  description: payload.description ?? undefined,
  detectedExtensions: payload.detectedExtensions ?? undefined,
  extensions: payload.extensions ?? [],
  healthInsurance: payload.healthInsurance ?? undefined,
  jobProvider: payload.jobProvider ?? undefined,
  jobProviderUrl: payload.jobProviderUrl ?? undefined,
  jobId,
  jobType: payload.jobType ?? undefined,
  location: payload.location ?? undefined,
  paidTimeOff: payload.paidTimeOff ?? undefined,
  postedAt: resolvePostedAt(payload.postedAt),
  qualifications: payload.qualifications ?? [],
  remote: payload.remote ?? undefined,
  requirements: payload.requirements ?? [],
  responsibilities: payload.responsibilities ?? [],
  salary: payload.salary ?? undefined,
  scheduleType: payload.scheduleType ?? undefined,
  source: payload.source ?? undefined,
  status: JobListingStatus.UNREVIEWED,
  title: payload.title,
  user: { connect: { id: userId } },
  workFromHome: payload.workFromHome ?? undefined,
});

const isUniqueConstraintError = (error: unknown): boolean =>
  error instanceof PrismaClient.PrismaClientKnownRequestError &&
  error.code === 'P2002';

export async function persistLiveJobListing(payload: LiveJobListingPayload) {
  const user = await getCurrentUser();
  if (!user) {
    unauthorized();
  }

  const baseJobId = resolveJobId(payload);
  const baseData = buildListingData(payload, user.id, baseJobId);

  try {
    const created = await db.jobListing.create({ data: baseData });
    return created;
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const existing = await db.jobListing.findUnique({
      where: { jobId: baseJobId },
    });

    if (existing?.userId === user.id) {
      return existing;
    }

    const fallbackJobId = `${baseJobId}:${user.id}`;
    const fallbackData = buildListingData(payload, user.id, fallbackJobId);
    return db.jobListing.create({ data: fallbackData });
  }
}

export async function saveLiveJobListing(payload: LiveJobListingPayload) {
  const persisted = await persistLiveJobListing(payload);
  await saveJobListing(persisted.id);
  return persisted;
}

export async function saveLiveJobListings(payloads: LiveJobListingPayload[]) {
  const persisted = [];
  for (const payload of payloads) {
    persisted.push(await persistLiveJobListing(payload));
  }

  await saveJobListings(persisted.map(listing => listing.id));
  return persisted;
}

export async function unsaveLiveJobListing(payload: LiveJobListingPayload) {
  const persisted = await persistLiveJobListing(payload);
  await unsaveJobListing(persisted.id);
  return persisted;
}

export async function addLiveJobToLeads(payload: LiveJobListingPayload) {
  const persisted = await persistLiveJobListing(payload);
  const jobLead = await createJobLead({ jobListingId: persisted.id });
  return { jobLead, jobListing: persisted };
}
