import { type Prisma } from '@/generated/prisma/browser';

import { db } from '@/lib/db/client';

export async function createJobSearchListings({
  jobListings,
  jobSearchId,
  userId,
}: {
  jobListings: Array<Prisma.JobListingCreateManyInput>;
  jobSearchId: string;
  userId: string;
}): Promise<{ createdCount: number; linkedCount: number }> {
  if (jobListings.length === 0) {
    return { createdCount: 0, linkedCount: 0 };
  }

  const createResult = await db.jobListing.createMany({
    data: jobListings,
    skipDuplicates: true,
  });

  const jobIds = Array.from(
    new Set(
      jobListings
        .map(listing => listing.jobId)
        .filter(
          (jobId): jobId is string =>
            typeof jobId === 'string' && jobId.trim().length > 0,
        ),
    ),
  );

  if (jobIds.length === 0) {
    return { createdCount: createResult.count, linkedCount: 0 };
  }

  const listings = await db.jobListing.findMany({
    where: {
      jobId: { in: jobIds },
      userId,
    },
    select: { id: true },
  });

  const linkResult = await db.jobSearchListing.createMany({
    data: listings.map(listing => ({
      jobListingId: listing.id,
      jobSearchId,
    })),
    skipDuplicates: true,
  });

  return { createdCount: createResult.count, linkedCount: linkResult.count };
}
