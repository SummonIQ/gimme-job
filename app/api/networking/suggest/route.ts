import { getServerAiProvider } from '@/lib/ai/provider';
import { requireAuth, withApiErrorHandling } from '@/lib/errors/api';
import {
  addSuggestedContact,
  suggestContactsForJobLead,
  suggestLinkedinConnections,
} from '@/lib/networking/suggest-contacts';
import { getCurrentUser } from '@/lib/user';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const suggestContactsSchema = z.object({
  jobLeadId: z.string(),
});

const addSuggestedContactSchema = z.object({
  name: z.string().optional(),
  company: z.string(),
  position: z.string().optional(),
  linkedinUrl: z.string().url().optional(),
  jobLeadId: z.string().optional(),
});

/**
 * GET handler for suggesting contacts based on job lead
 */
const handleGET = async (request: NextRequest): Promise<NextResponse> => {
  const user = await getCurrentUser();
  requireAuth(user);

  const url = new URL(request.url);
  const jobLeadId = url.searchParams.get('jobLeadId');
  const source = url.searchParams.get('source');

  if (!jobLeadId) {
    return NextResponse.json(
      { success: false, message: 'Job lead ID is required' },
      { status: 400 },
    );
  }

  const aiProvider = await getServerAiProvider();
  let data;
  if (source === 'linkedin') {
    data = await suggestLinkedinConnections(jobLeadId, { aiProvider });
  } else {
    data = await suggestContactsForJobLead(jobLeadId, { aiProvider });
  }

  return NextResponse.json({ success: true, data });
};

/**
 * POST handler for adding a suggested contact
 */
const handlePOST = async (request: NextRequest): Promise<NextResponse> => {
  const user = await getCurrentUser();
  requireAuth(user);
  const body = await request.json();

  const contact = await addSuggestedContact(body);

  return NextResponse.json({
    success: true,
    data: contact,
  });
};

export const GET = withApiErrorHandling(handleGET);
export const POST = withApiErrorHandling(handlePOST);
