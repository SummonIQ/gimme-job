import { getServerAiProvider } from '@/lib/ai/provider';
import { requireAuth, withApiErrorHandling } from '@/lib/errors/api';
import {
  analyzeSkillGap,
  getAllSkillGapAnalyses,
  getSkillGapAnalysis,
} from '@/lib/skills/gap-analysis';
import { getCurrentUser } from '@/lib/user';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const analyzeSkillGapSchema = z.object({
  jobLeadId: z.string().optional(),
  resumeId: z.string().optional(),
  jobTitle: z.string().optional(),
  jobDescription: z.string().optional(),
  resumeText: z.string().optional(),
});

/**
 * GET handler for fetching skill gap analyses
 */
const handleGET = async (request: NextRequest): Promise<NextResponse> => {
  const user = await getCurrentUser();
  requireAuth(user);

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  let data;
  if (id) {
    data = await getSkillGapAnalysis(id);
  } else {
    data = await getAllSkillGapAnalyses();
  }

  return NextResponse.json({ success: true, data });
};

/**
 * POST handler for creating a new skill gap analysis
 */
const handlePOST = async (request: NextRequest): Promise<NextResponse> => {
  const user = await getCurrentUser();
  requireAuth(user);
  const body = await request.json();

  const aiProvider = await getServerAiProvider();
  const analysis = await analyzeSkillGap({ ...body, aiProvider });

  return NextResponse.json({
    success: true,
    data: analysis,
  });
};

export const GET = withApiErrorHandling(handleGET);
export const POST = withApiErrorHandling(handlePOST);
