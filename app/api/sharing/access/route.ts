import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiErrorHandling } from '@/lib/errors/api';
import { getResourceByShareToken, addShareFeedback } from '@/lib/sharing';

const getSharedResourceSchema = z.object({
  token: z.string()
});

const addFeedbackSchema = z.object({
  token: z.string(),
  content: z.string(),
  createdByName: z.string().optional(),
  createdByEmail: z.string().email().optional()
});

/**
 * GET handler for accessing a resource by share token
 */
const handleGET = async (request: NextRequest): Promise<NextResponse> => {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  
  if (!token) {
    return NextResponse.json(
      { success: false, message: 'Share token is required' },
      { status: 400 }
    );
  }
  
  const resource = await getResourceByShareToken(token);
  
  return NextResponse.json({
    success: true,
    data: resource
  });
};

/**
 * POST handler for adding feedback to a shared resource
 */
const handlePOST = async (request: NextRequest): Promise<NextResponse> => {
  const body = await request.json();
  
  const validation = addFeedbackSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { success: false, message: 'Invalid request data', errors: validation.error.format() },
      { status: 400 }
    );
  }
  
  const feedback = await addShareFeedback(
    body.token,
    body.content,
    body.createdByName,
    body.createdByEmail
  );
  
  return NextResponse.json({
    success: true,
    data: feedback
  });
};

export const GET = withApiErrorHandling(handleGET);
export const POST = withApiErrorHandling(handlePOST);
