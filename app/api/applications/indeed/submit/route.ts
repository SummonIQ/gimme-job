import { submitIndeedApplication } from '@/lib/applications/services/indeed-submission';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const submitIndeedApplicationSchema = z.object({
  additionalInfo: z.record(z.string(), z.unknown()).optional(),
  coverLetterId: z.string().optional(),
  jobLeadId: z.string().min(1),
  resumeId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const validation = submitIndeedApplicationSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      {
        error: 'Invalid Indeed application submission request.',
        success: false,
      },
      { status: 400 },
    );
  }

  try {
    const result = await submitIndeedApplication({
      additionalInfo: validation.data.additionalInfo as
        | Record<string, string>
        | undefined,
      coverLetterId: validation.data.coverLetterId,
      jobLeadId: validation.data.jobLeadId,
      resumeId: validation.data.resumeId,
    });

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to submit Indeed application.';

    return NextResponse.json(
      {
        error: message,
        success: false,
      },
      { status: message === 'User not authenticated' ? 401 : 500 },
    );
  }
}
