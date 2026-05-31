'use server';

import { revalidateTag } from '@/lib/cache/revalidate';
import { cacheTag } from '@/lib/cache/tag';
import { unauthorized } from 'next/navigation';

import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';

export async function getSavedJobListingsCount({ userId }: { userId: string }) {
  'use cache';

  cacheTag(`user:${userId}:job-listings:saved:count`);

  const count = await db.jobListing.count({
    where: {
      saved: true,
      userId,
    },
  });

  return count;
}

export async function saveJobListing(id: string) {
  const user = await getCurrentUser();

  const jobListing = await db.jobListing.update({
    data: { saved: true },
    where: { id: id, userId: user.id },
  });

  revalidateTag(`user:${user.id}:report:job-listings`);
  revalidateTag(`user:${user.id}:report:job-listings:saved`);
  revalidateTag(`user:${user.id}:job-listings:${id}`);
  revalidateTag(`user:${user.id}:job-listings:saved:count`);

  return jobListing;
}

export async function unsaveJobListing(id: string) {
  const user = await getCurrentUser();

  if (!user) {
    unauthorized();
  }

  const result = await db.jobListing.update({
    data: { saved: false },
    where: { id, userId: user.id },
  });

  revalidateTag(`user:${user.id}:report:job-listings`);
  revalidateTag(`user:${user.id}:report:job-listings:saved`);
  revalidateTag(`user:${user.id}:job-listings:${id}`);
  revalidateTag(`user:${user.id}:job-listings:saved:count`);

  return result;
}

export async function saveJobListings(ids: Array<string>) {
  const user = await getCurrentUser();

  if (!user) {
    unauthorized();
  }

  const result = await db.jobListing.updateMany({
    data: { saved: true },
    where: { id: { in: ids }, userId: user.id },
  });

  revalidateTag(`user:${user.id}:report:job-listings`);
  revalidateTag(`user:${user.id}:report:job-listings:saved`);
  revalidateTag(`user:${user.id}:job-listings:saved:count`);

  return result;
}

export async function unsaveJobListings(ids: Array<string>) {
  const user = await getCurrentUser();

  if (!user) {
    unauthorized();
  }

  const result = await db.jobListing.updateMany({
    data: { saved: false },
    where: { id: { in: ids }, userId: user.id },
  });

  revalidateTag(`user:${user.id}:report:job-listings`);
  revalidateTag(`user:${user.id}:report:job-listings:saved`);
  revalidateTag(`user:${user.id}:job-listings:saved:count`);

  return result;
}
