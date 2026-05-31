import { revalidateTag } from '@/lib/cache/revalidate';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';

export async function deleteResume(resumeId: string) {
  const user = await getCurrentUser();

  await db.resume.delete({
    where: { id: resumeId },
  });

  revalidateTag(`user:${user.id}:report:resumes`);
  revalidateTag(`user:${user.id}:resumes`);
  revalidateTag(`user:${user.id}:resumes:${resumeId}`);
}
