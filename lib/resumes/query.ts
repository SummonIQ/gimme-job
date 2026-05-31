import { Prisma, ResumeOptimizationStatus } from '@/generated/prisma/browser';
import { cacheTag } from 'next/cache';

import { db } from '@/lib/db/client';

export type GetUserResumesProps = {
  count?: number;
  include?: Prisma.ResumeInclude;
  orderBy?: Array<{
    createdAt: 'asc' | 'desc';
  }>;
  statuses?: Array<ResumeOptimizationStatus>;
  userId: string;
};

export async function getUserResumes({
  orderBy = [
    {
      createdAt: 'desc',
    },
  ],
  include = {},
  count,
  statuses,
  userId,
}: GetUserResumesProps) {
  'use cache';

  cacheTag(`user:${userId}:resumes`);

  const resumes = await db.resume.findMany({
    include,
    orderBy: orderBy,
    take: count,
    where: {
      userId,
      ...(statuses ? { optimization: { status: { in: statuses } } } : {}),
    },
  });

  return resumes;
}

export async function getUserResume({
  id,
  include,
  userId,
}: {
  id: string;
  include?: Prisma.ResumeInclude;
  userId: string;
}) {
  'use cache';

  cacheTag(`user:${userId}:resumes:${id}`);

  const resume = await db.resume.findUnique({
    include,
    where: {
      id,
      userId,
    },
  });

  return resume;
}
