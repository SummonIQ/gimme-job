import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db/client';
import { validateToken } from '@/lib/desktop-tokens';
import { tailorResumeForLead } from '@/lib/resumes/tailor-for-lead';

const requestSchema = z.object({
  leadId: z.string().min(1, 'leadId is required'),
});

export async function POST(request: Request) {
  const rawToken = readBearerToken(request);
  if (!rawToken) {
    return NextResponse.json(
      { error: 'Missing Bearer token' },
      { status: 401 },
    );
  }

  const validation = await validateToken(rawToken, {
    requireScope: 'desktop:runtime',
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 401 });
  }

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : String(error),
        error: 'Invalid request body',
      },
      { status: 400 },
    );
  }

  const userId = validation.token.userId;

  const lead = await db.jobLead.findUnique({
    select: { id: true, userId: true },
    where: { id: body.leadId },
  });
  if (!lead || lead.userId !== userId) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  try {
    const result = await tailorResumeForLead(body.leadId);
    return NextResponse.json({
      diffSummary: result.diffSummary,
      emphasizedKeywords: result.emphasizedKeywords,
      formats: result.formats,
      revisionId: result.revisionId,
      summary: result.summary,
    });
  } catch (error) {
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : String(error),
        error: 'Failed to tailor resume',
      },
      { status: 500 },
    );
  }
}

function readBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/);
  return match?.[1]?.trim() || null;
}
