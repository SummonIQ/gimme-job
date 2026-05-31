'use cache';

import type { UserProfile } from '@/generated/prisma/browser';

import { cacheTag,  } from '@/lib/cache/tag';
import { revalidateTag } from '@/lib/cache/revalidate';
import { db } from '@/lib/db/client';

export async function getUserProfile({ userId }: { userId: string }) {
  // 'use cache' directive is now at the top of the file

  cacheTag(`user:${userId}:profile`);

  const user = await db.user.findUnique({
    include: {
      profile: true,
    },
    where: {
      id: userId,
    },
  });

  return user?.profile;
}

export async function updateUserProfile({
  userId,
  profile,
}: {
  profile: Omit<
    OptionalNullable<UserProfile>,
    'id' | 'createdAt' | 'updatedAt' | 'userId'
  >;
  userId: string;
}) {
  const user = await db.user.update({
    data: {
      profile: {
        update: profile,
      },
    },
    include: {
      profile: true,
    },
    where: {
      id: userId,
    },
  });

  revalidateTag(`user:${userId}:profile`);

  return user?.profile;
}
