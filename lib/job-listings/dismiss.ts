'use server';

import { JobListingStatus } from '@/generated/prisma/browser';
import { revalidateTag } from '@/lib/cache/revalidate';
import { cacheTag } from '@/lib/cache/tag';

import { db } from '@/lib/db/client';
import { getJobListings } from '@/lib/job-listings/query';
import { getCurrentUser } from '@/lib/user/query';

export async function getDismissedJobs({ userId }: { userId: string }) {
  'use cache';

  cacheTag(`user:${userId}:job-listings:dismissed`);

  const jobs = await getJobListings({
    sortBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    statuses: [JobListingStatus.DISMISSED],
    userId,
  });

  return jobs;
}

export async function getDismissedJobListingsCount({
  userId,
}: {
  userId: string;
}) {
  'use cache';

  cacheTag(`user:${userId}:job-listings:dismissed:count`);

  const count = await db.jobListing.count({
    where: {
      status: {
        in: [JobListingStatus.DISMISSED],
      },
      userId,
    },
  });

  return count;
}

export async function dismissJobListings(ids: Array<string>) {
  const user = await getCurrentUser();

  const jobListings = await db.jobListing.updateMany({
    data: {
      status: JobListingStatus.DISMISSED,
    },
    where: { id: { in: ids }, userId: user.id },
  });

  revalidateTag(`user:${user.id}:report:job-listings`);
  revalidateTag(`user:${user.id}:report:job-listings:dismissed`);
  revalidateTag(`user:${user.id}:job-listings`);
  revalidateTag(`user:${user.id}:job-listings:count`);
  revalidateTag(`user:${user.id}:job-listings:dismissed`);
  revalidateTag(`user:${user.id}:job-listings:dismissed:count`);

  return jobListings;
}

export async function dismissJobListing(id: string) {
  const user = await getCurrentUser();

  const jobListing = await db.jobListing.update({
    data: { status: JobListingStatus.DISMISSED },
    where: { id, userId: user.id },
  });

  revalidateTag(`user:${user.id}:report:job-listings`);
  revalidateTag(`user:${user.id}:report:job-listings:dismissed`);
  revalidateTag(`user:${user.id}:job-listings`);
  revalidateTag(`user:${user.id}:job-listings:${id}`);
  revalidateTag(`user:${user.id}:job-listings:count`);
  revalidateTag(`user:${user.id}:job-listings:dismissed`);
  revalidateTag(`user:${user.id}:job-listings:dismissed:count`);

  return jobListing;
}

export async function undismissJobListings(ids: Array<string>) {
  const user = await getCurrentUser();

  const jobListings = await db.jobListing.updateMany({
    data: { status: JobListingStatus.UNREVIEWED },
    where: { id: { in: ids }, userId: user.id },
  });

  revalidateTag(`user:${user.id}:report:job-listings`);
  revalidateTag(`user:${user.id}:report:job-listings:dismissed`);
  revalidateTag(`user:${user.id}:job-listings`);
  revalidateTag(`user:${user.id}:job-listings:count`);
  revalidateTag(`user:${user.id}:job-listings:dismissed`);
  revalidateTag(`user:${user.id}:job-listings:dismissed:count`);
  return jobListings;
}

export async function undismissJobListing(id: string) {
  const user = await getCurrentUser();

  const jobListing = await db.jobListing.update({
    data: { status: JobListingStatus.UNREVIEWED },
    where: { id, userId: user.id },
  });

  revalidateTag(`user:${user.id}:report:job-listings`);
  revalidateTag(`user:${user.id}:report:job-listings:dismissed`);
  revalidateTag(`user:${user.id}:job-listings`);
  revalidateTag(`user:${user.id}:job-listings:${id}`);
  revalidateTag(`user:${user.id}:job-listings:count`);
  revalidateTag(`user:${user.id}:job-listings:dismissed`);
  revalidateTag(`user:${user.id}:job-listings:dismissed:count`);

  return jobListing;
}
