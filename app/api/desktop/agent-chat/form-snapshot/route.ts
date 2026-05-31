import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db/client';
import { validateToken } from '@/lib/desktop-tokens';

const optionSchema = z.union([
  z.string(),
  z.object({ label: z.string(), value: z.string() }),
]);

const fieldSchema = z.object({
  fieldType: z.string(),
  label: z.string(),
  options: z.array(optionSchema).default([]),
  required: z.boolean().default(false),
  selector: z.string(),
  value: z.string().default(''),
});

const requestSchema = z.object({
  applicationUrl: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  capturedAt: z.string().datetime().optional(),
  fields: z.array(fieldSchema).default([]),
  filePath: z.string().min(1),
  hostname: z.string().min(1),
  jobLeadId: z.string().optional(),
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
        error: 'Invalid request body',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 400 },
    );
  }

  const userId = validation.token.userId;
  try {
    const created = await db.localFormSnapshot.create({
      data: {
        applicationUrl: body.applicationUrl,
        byteSize: body.byteSize,
        capturedAt: body.capturedAt ? new Date(body.capturedAt) : new Date(),
        fields: body.fields,
        filePath: body.filePath,
        hostname: body.hostname,
        jobLeadId: body.jobLeadId,
        userId,
      },
      select: { id: true },
    });
    return NextResponse.json({ id: created.id });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'FORM_SNAPSHOT_WRITE_FAILED',
        message: error instanceof Error ? error.message : String(error),
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
