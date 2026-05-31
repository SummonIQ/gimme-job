'use server';

import type { JobLead } from '@/generated/prisma/browser';
import {
  JobLeadOptimizationStatus,
  JobListingStatus,
  ResumeOptimizationStatus,
} from '@/generated/prisma/browser';
import { unauthorized } from 'next/navigation';
import { after } from 'next/server';

import { revalidateTag } from '@/lib/cache/revalidate';
import { db } from '@/lib/db/client';
import { getPrivateUserChannel } from '@/lib/events/channels';
import { sendDataUpdate } from '@/lib/events/data-update';
import { getCurrentUser } from '@/lib/user/query';
import { DataEventType } from '@/types/events';

import { logger } from '@/lib/logger';
import {
  canProcessImmediately,
  processJobLeadOptimization,
} from './process-optimization';

export async function createJobLead({
  jobListingId,
}: {
  jobListingId: string;
}) {
  const user = await getCurrentUser({
    include: {
      profile: true,
    },
  });
  if (!user) {
    unauthorized();
  }
  const userChannel = getPrivateUserChannel(user.id);

  logger.info('[JOB_LEAD_CREATE] Fetching job listing');
  const jobListing = await db.jobListing.findUnique({
    where: { id: jobListingId, userId: user.id },
  });

  if (!jobListing) {
    logger.error('[JOB_LEAD_CREATE] Job listing not found', { jobListingId });
    throw new Error(`Job listing not found: ${jobListingId}`);
  }

  // Check if a lead already exists for this listing (jobListingId is unique on JobLead)
  const existingLead = await db.jobLead.findUnique({
    where: { jobListingId },
  });
  if (existingLead) {
    logger.info('[JOB_LEAD_CREATE] Lead already exists for this listing', {
      jobLeadId: existingLead.id,
      jobListingId,
    });
    return existingLead;
  }

  logger.info('[JOB_LEAD_CREATE] Updating job listing status');
  await db.jobListing.update({
    data: { status: JobListingStatus.ADDED_TO_LEADS },
    where: { id: jobListingId },
  });
  logger.info('[JOB_LEAD_CREATE] Updated job listing status');

  logger.info('[JOB_LEAD_CREATE] Creating job lead');
  const jobLead = await db.jobLead.create({
    data: {
      jobListing: { connect: { id: jobListingId } },
      optimization: {
        create: {
          status: JobLeadOptimizationStatus.QUEUED,
          user: { connect: { id: user.id } },
        },
      },
      title: jobListing?.title,
      user: { connect: { id: user.id } },
    },
  });
  logger.info('[JOB_LEAD_CREATE] Created job lead');

  logger.info('[JOB_LEAD_CREATE] Revalidating tags');
  revalidateTag(`user:${user.id}:report:job-leads`);
  revalidateTag(`user:${user.id}:job-leads`);
  revalidateTag(`user:${user.id}:job-leads:count`);
  revalidateTag(`user:${user.id}:job-leads:${jobLead.id}`);
  revalidateTag(`user:${user.id}:report:job-listings`);
  revalidateTag(`user:${user.id}:job-listings`);
  revalidateTag(`user:${user.id}:job-listings:${jobListingId}`);
  logger.info('[JOB_LEAD_CREATE] Finished revalidating tags');

  logger.info('[JOB_LEAD_CREATE] Creating resume optimization');
  await db.resumeOptimization.create({
    data: {
      jobLead: { connect: { id: jobLead.id } },
      status: ResumeOptimizationStatus.PROCESSING,
      user: { connect: { id: user.id } },
    },
  });
  logger.info('[JOB_LEAD_CREATE] Created resume optimization');

  logger.info('[JOB_LEAD_CREATE] Revalidating tags');
  revalidateTag(`user:${user.id}:report:job-leads`);
  revalidateTag(`user:${user.id}:job-leads`);
  revalidateTag(`user:${user.id}:job-leads:${jobLead.id}`);
  revalidateTag(`user:${user.id}:report:job-listings`);
  revalidateTag(`user:${user.id}:job-listings`);
  revalidateTag(`user:${user.id}:job-listings:${jobListingId}`);
  logger.info('[JOB_LEAD_CREATE] Finished revalidating tags');

  // Check if we can process immediately (max 3 concurrent)
  const canProcess = await canProcessImmediately(user.id);

  if (canProcess) {
    sendDataUpdate({
      channel: userChannel,
      payload: {
        data: { id: jobLead.id, progress: 20 },
        type: DataEventType.JOB_LEAD_OPTIMIZATION_PROGRESS,
      },
    });

    after(async () => {
      await processJobLeadOptimization(jobLead.id);
    });
  } else {
    logger.info('[JOB_LEAD_CREATE] Queued for processing, max concurrent reached', {
      jobLeadId: jobLead.id,
    });
  }

  return jobLead;
}

export async function createJobLeads(
  ids: Array<string>,
): Promise<Array<JobLead>> {
  const user = await getCurrentUser();

  if (!user) {
    unauthorized();
  }

  const jobLeads: Array<JobLead> = [];

  for (const jobListingId of ids) {
    const jobLead = await createJobLead({ jobListingId });
    jobLeads.push(jobLead);
  }

  return jobLeads;
}
