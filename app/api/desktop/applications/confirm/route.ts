import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { applyConfirmationToSubmission } from '@/lib/applications/confirmation-detector';
import { db } from '@/lib/db/client';
import { validateToken } from '@/lib/desktop-tokens';

const requestSchema = z.object({
  family: z
    .enum(['greenhouse', 'lever', 'ashby', 'smartrecruiters', 'generic'])
    .optional(),
  hostname: z.string().optional(),
  pageHtml: z.string().min(1, 'pageHtml is required'),
  submissionId: z.string().min(1, 'submissionId is required'),
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

  const submission = await db.applicationSubmission.findUnique({
    select: { jobLeadId: true, userId: true },
    where: { id: body.submissionId },
  });
  if (!submission || submission.userId !== userId) {
    return NextResponse.json(
      { error: 'Submission not found' },
      { status: 404 },
    );
  }

  const result = await applyConfirmationToSubmission({
    family: body.family ?? inferFamilyFromHostname(body.hostname),
    hostname: body.hostname ?? null,
    html: body.pageHtml,
    submissionId: body.submissionId,
  });

  if (result.transitioned) {
    revalidateTag(`user:${userId}:applications`, 'max');
    if (submission.jobLeadId) {
      revalidateTag(`job-lead:${submission.jobLeadId}`, 'max');
    }
  }

  return NextResponse.json({
    detected: result.detected
      ? {
          confidence: result.detected.confidence,
          family: result.detected.family,
          matchedPhrase: result.detected.matchedPhrase,
          reason: result.detected.reason,
          variant: result.detected.variant,
        }
      : null,
    previousState: result.previousState,
    transitioned: result.transitioned,
  });
}

function inferFamilyFromHostname(
  hostname: string | undefined,
):
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'smartrecruiters'
  | 'generic'
  | undefined {
  if (!hostname) return undefined;
  const lower = hostname.toLowerCase();
  if (lower.includes('greenhouse.io')) return 'greenhouse';
  if (lower.includes('lever.co')) return 'lever';
  if (lower.includes('ashbyhq.com')) return 'ashby';
  if (lower.includes('smartrecruiters.com')) return 'smartrecruiters';
  return undefined;
}

function readBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/);
  return match?.[1]?.trim() || null;
}
