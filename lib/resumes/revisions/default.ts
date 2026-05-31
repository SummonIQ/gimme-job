import { revalidateTag } from '@/lib/cache/revalidate';
import { db } from '@/lib/db/client';
import { invalidateResolverCacheSlice } from '@/lib/field-answer/cache';
import { getCurrentUser } from '@/lib/user/query';

export async function setDefaultResumeRevision(resumeId: string, id: string) {
  const user = await getCurrentUser();

  const revision = await db.resumeRevision.findFirst({
    select: { id: true },
    where: {
      id,
      resumeId,
      userId: user.id,
    },
  });

  if (!revision) {
    throw new Error('Resume revision not found.');
  }

  const [resume] = await db.$transaction([
    db.resume.update({
      data: {
        defaultRevisionId: id,
      },
      where: {
        id: resumeId,
        userId: user.id,
      },
    }),
    db.user.update({
      data: {
        defaultResumeId: resumeId,
        defaultRevisionId: id,
      },
      where: {
        id: user.id,
      },
    }),
  ]);

  revalidateTag(`user:${user.id}:resumes:default`);
  revalidateTag(`user:${user.id}:report:resumes`);
  revalidateTag(`user:${user.id}:resumes`);
  revalidateTag(`user:${user.id}:resumes:${resumeId}`);
  revalidateTag(`user:${user.id}:resumes:${resumeId}:revisions:${id}`);
  invalidateResolverCacheSlice(user.id, 'resume');
  invalidateResolverCacheSlice(user.id, 'user');

  return resume;
}
