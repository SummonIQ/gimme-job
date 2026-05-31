'use cache';

import type { UserJobPreferences } from '@/generated/prisma/browser';

import { cacheTag,  } from '@/lib/cache/tag';
import { revalidateTag } from '@/lib/cache/revalidate';
import { db } from '@/lib/db/client';

export async function getUserJobPreferences({ userId }: { userId: string }) {
  // 'use cache' directive is now at the top of the file

  cacheTag(`user:${userId}:job-preferences`);

  const user = await db.user.findUnique({
    include: {
      jobPreferences: true,
    },
    where: {
      id: userId,
    },
  });

  return user?.jobPreferences;
}

export async function updateUserJobPreferences({
  userId,
  jobPreferences,
}: {
  jobPreferences: OptionalNullable<
    Omit<
      UserJobPreferences,
      'id' | 'createdAt' | 'jobTitles' | 'updatedAt' | 'userId'
    >
  >;
  userId: string;
}) {
  const user = await db.user.update({
    data: {
      jobPreferences: {
        update: jobPreferences,
      },
    },
    include: {
      jobPreferences: true,
    },
    where: {
      id: userId,
    },
  });

  revalidateTag(`user:${userId}:job-preferences`);

  return user?.jobPreferences;
}
