import { Prisma } from '@/generated/prisma/browser';
import { cacheTag } from '@/lib/cache/tag';

import { db } from '@/lib/db/client';
export async function getResumeRevision({
  id,
  include = {},
  userId,
}: {
  id: string;
  include?: Prisma.ResumeRevisionInclude;
  userId: string;
}) {
  'use cache';

  cacheTag(`user:${userId}:resume-revisions:${id}`);

  const revision = await db.resumeRevision.findUnique({
    include,
    where: {
      id,
      userId,
    },
  });

  return revision;
}
