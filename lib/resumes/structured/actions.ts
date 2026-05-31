'use server';

import { ResumeKind } from '@/generated/prisma/browser';
import { revalidateTag } from '@/lib/cache/revalidate';
import { db } from '@/lib/db/client';
import { AppError, ErrorCode } from '@/lib/errors';
import { setUserDefaultResume } from '@/lib/resumes/default';
import { getCurrentUser } from '@/lib/user/query';

import {
  emptyStructuredResume,
  structuredResumeSchema,
  type StructuredResume,
} from './schema';

async function requireUser(): Promise<string> {
  const user = await getCurrentUser();
  if (!user?.id) {
    throw new AppError({
      code: ErrorCode.UNAUTHORIZED,
      message: 'User not authenticated',
      userMessage: 'Please log in to use the resume designer.',
    });
  }
  return user.id;
}

export async function createStructuredResume({
  name,
  setDefault = false,
}: {
  name: string;
  setDefault?: boolean;
}): Promise<{ id: string }> {
  const userId = await requireUser();

  const trimmed = name.trim();
  if (!trimmed) {
    throw new AppError({
      code: ErrorCode.INVALID_INPUT,
      message: 'Resume name is required',
      userMessage: 'Please name your resume.',
    });
  }

  const resume = await db.resume.create({
    data: {
      userId,
      name: trimmed,
      kind: ResumeKind.STRUCTURED,
      structuredData: emptyStructuredResume(),
    },
    select: { id: true },
  });

  if (setDefault) {
    await setUserDefaultResume(resume.id);
  }

  revalidateTag(`user:${userId}:report:resumes`);
  revalidateTag(`user:${userId}:resumes`);
  revalidateTag(`user:${userId}:resumes:${resume.id}`);

  return { id: resume.id };
}

export async function getStructuredResume(resumeId: string): Promise<{
  id: string;
  name: string;
  structuredData: StructuredResume;
} | null> {
  const userId = await requireUser();

  const resume = await db.resume.findFirst({
    where: { id: resumeId, userId, kind: ResumeKind.STRUCTURED },
    select: { id: true, name: true, structuredData: true },
  });
  if (!resume) return null;

  const parsed = structuredResumeSchema.safeParse(
    resume.structuredData ?? emptyStructuredResume(),
  );
  return {
    id: resume.id,
    name: resume.name,
    structuredData: parsed.success ? parsed.data : emptyStructuredResume(),
  };
}

export async function saveStructuredResume({
  resumeId,
  data,
  name,
}: {
  resumeId: string;
  data: StructuredResume;
  name?: string;
}): Promise<void> {
  const userId = await requireUser();

  const parsed = structuredResumeSchema.safeParse(data);
  if (!parsed.success) {
    throw new AppError({
      code: ErrorCode.INVALID_INPUT,
      message: 'Invalid structured-resume payload',
      userMessage: 'Some of the resume fields are invalid. Please review.',
    });
  }

  const existing = await db.resume.findFirst({
    where: { id: resumeId, userId, kind: ResumeKind.STRUCTURED },
    select: { id: true },
  });
  if (!existing) {
    throw new AppError({
      code: ErrorCode.NOT_FOUND,
      message: 'Structured resume not found',
      userMessage: 'We could not find that resume.',
    });
  }

  await db.resume.update({
    where: { id: resumeId },
    data: {
      structuredData: parsed.data,
      ...(name?.trim() ? { name: name.trim() } : {}),
    },
  });

  revalidateTag(`user:${userId}:report:resumes`);
  revalidateTag(`user:${userId}:resumes`);
  revalidateTag(`user:${userId}:resumes:${resumeId}`);
}
