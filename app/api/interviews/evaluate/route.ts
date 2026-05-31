import { getServerAiProvider } from '@/lib/ai/provider';
import { requireAuth, withApiErrorHandling } from '@/lib/errors/api';
import { evaluateInterviewResponse } from '@/lib/interviews/evaluate';
import { getCurrentUser } from '@/lib/user';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const evaluateResponseSchema = z.object({
  questionId: z.string(),
  response: z.string().min(1),
  sessionId: z.string().optional(),
});

const handlePOST = async (request: NextRequest): Promise<NextResponse> => {
  const user = await getCurrentUser();
  requireAuth(user);
  const body = await request.json();

  const aiProvider = await getServerAiProvider();
  const evaluation = await evaluateInterviewResponse(
    body.questionId,
    body.response,
    { aiProvider },
  );

  return NextResponse.json({
    success: true,
    data: evaluation,
  });
};

export const POST = withApiErrorHandling(handlePOST);
