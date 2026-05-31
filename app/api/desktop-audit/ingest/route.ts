import { NextResponse } from 'next/server';
import { z } from 'zod';

import { validateToken } from '@/lib/desktop-tokens';
import {
  ingestDesktopAuditBatch,
  type DesktopAuditAction,
} from '@/lib/desktop-audit';

const ActionSchema = z.enum([
  'tool_call',
  'submit_attempt',
  'submit_success',
  'submit_failure',
  'identity_read',
  'session_start',
  'session_end',
  'error',
]);

const RowSchema = z.object({
  action: ActionSchema,
  desktopSessionId: z.string().max(200).optional(),
  durationMs: z.number().int().min(0).max(3_600_000).optional(),
  errorMessage: z.string().max(4000).optional(),
  jobLeadId: z.string().optional(),
  outcome: z.enum(['ok', 'error']).optional(),
  payload: z.unknown(),
  runtimeSessionId: z.string().optional(),
  toolName: z.string().min(1).max(200),
});

const BodySchema = z.object({
  rows: z.array(RowSchema).min(1).max(100),
});

export async function POST(request: Request) {
  const header = request.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/);
  const rawToken = match?.[1]?.trim();
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await ingestDesktopAuditBatch(
    parsed.data.rows.map(row => ({
      action: row.action as DesktopAuditAction,
      desktopSessionId: row.desktopSessionId ?? null,
      durationMs: row.durationMs ?? null,
      errorMessage: row.errorMessage ?? null,
      jobLeadId: row.jobLeadId ?? null,
      outcome: row.outcome ?? null,
      payload: row.payload,
      runtimeSessionId: row.runtimeSessionId ?? null,
      tokenId: validation.token.id,
      toolName: row.toolName,
      userId: validation.token.userId,
    })),
  );

  return NextResponse.json({
    created: result.created,
    ids: result.ids,
  });
}
