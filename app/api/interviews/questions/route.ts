import { getServerAiProvider } from '@/lib/ai/provider';
import { requireAuth, withApiErrorHandling } from '@/lib/errors/api';
import { generateInterviewQuestions } from '@/lib/interviews/generate';
import { DifficultyLevel, InterviewType } from '@/lib/interviews/types';
import { withRateLimit } from '@/lib/rate-limit/middleware';
import { getCurrentUser } from '@/lib/user';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const generateQuestionsSchema = z.object({
  jobLeadId: z.string().optional(),
  type: z.nativeEnum(InterviewType).optional(),
  count: z.number().min(1).max(20).optional(),
  difficulty: z.nativeEnum(DifficultyLevel).optional(),
  jobTitle: z.string().optional(),
  jobDescription: z.string().optional(),
  specificTopic: z.string().optional(),
});

const handlePOST = async (request: NextRequest): Promise<NextResponse> => {
  // Apply rate limiting for AI interview prep
  const rateLimitError = await withRateLimit(request, {
    preset: 'aiInterviewPrep',
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  const user = await getCurrentUser();
  requireAuth(user);
  const body = await request.json();

  const aiProvider = await getServerAiProvider();
  const questions = await generateInterviewQuestions({ ...body, aiProvider });

  return NextResponse.json({
    success: true,
    data: questions,
  });
};

export const POST = withApiErrorHandling(handlePOST);
