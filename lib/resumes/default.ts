import { revalidateTag } from '@/lib/cache/revalidate';

import { db } from '@/lib/db/client';
import { invalidateResolverCacheSlice } from '@/lib/field-answer/resolve';
import { getCurrentUser } from '@/lib/user/query';

export async function setUserDefaultResume(id: string) {
  const user = await getCurrentUser();
  const previousDefaultResumeId = user.defaultResumeId ?? undefined;

  await db.user.update({
    data: {
      defaultRevisionId: null,
      defaultResumeId: id,
    },
    where: {
      id: user.id,
    },
  });

  revalidateTag(`user:${user.id}:resumes:default`);
  revalidateTag(`user:${user.id}:report:resumes`);
  revalidateTag(`user:${user.id}:resumes`);
  revalidateTag(`user:${user.id}:resumes:${id}`);
  if (previousDefaultResumeId && previousDefaultResumeId !== id) {
    revalidateTag(`user:${user.id}:resumes:${previousDefaultResumeId}`);
  }
  // Resume content feeds the form-fill resolver's prompt; the user record
  // also stores defaultResumeId/defaultRevisionId, so invalidate both
  // slices so the next field-fill picks up the new resume immediately.
  invalidateResolverCacheSlice(user.id, 'resume');
  invalidateResolverCacheSlice(user.id, 'user');

  return user;
}
