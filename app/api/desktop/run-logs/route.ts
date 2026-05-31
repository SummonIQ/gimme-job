/**
 * Desktop run-log ingestion. The desktop already writes a per-run JSON
 * log to `~/Documents/Gimme Job/run-logs/`. We additionally upload it
 * here so the admin desktop-submissions page can display the full
 * tool-call trace, not just the result message. Runs of every status
 * (failed, completed, cancelled, paused) are accepted — the value of
 * the trace is highest precisely when the run failed.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db/client';
import { validateToken } from '@/lib/desktop-tokens';

const toolCallSchema = z.object({
  tool: z.string(),
  ok: z.boolean(),
  reason: z.string().optional(),
  selector: z.string().optional(),
  errorMessage: z.string().optional(),
  input: z.unknown().optional(),
});

const consoleErrorSchema = z.object({
  level: z.enum(['error', 'warning', 'info', 'log', 'debug']),
  message: z.string(),
  source: z.string().optional(),
  line: z.number().optional(),
  capturedAt: z.string().optional(),
});

const requestSchema = z.object({
  applicationUrl: z.string().min(1),
  jobLeadId: z.string().optional(),
  mode: z.enum(['submit', 'training']),
  status: z.string(),
  message: z.string().optional(),
  capturedAt: z.string().datetime().optional(),
  toolCalls: z.array(toolCallSchema).default([]),
  pageConsoleErrors: z.array(consoleErrorSchema).default([]),
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

  // Trim very long tool-call traces — the audit log stores full JSON in
  // a Postgres jsonb, so a 5000-call trace is fine, but keep a cap to
  // avoid pathological cases (runaway loops). 1000 calls is well past
  // anything a healthy run produces.
  const trimmedTrace = body.toolCalls.slice(0, 1000);
  const trimmedConsoleErrors = body.pageConsoleErrors
    .slice(0, 200)
    .map(entry => {
      const out: Record<string, string | number> = {
        level: entry.level,
        message: entry.message,
      };
      if (entry.source) out.source = entry.source;
      if (entry.line !== undefined) out.line = entry.line;
      if (entry.capturedAt) out.capturedAt = entry.capturedAt;
      return out;
    });

  try {
    // JSON round-trip to strip `undefined` keys from optional fields —
    // Prisma's InputJsonValue doesn't accept `undefined`, only missing keys.
    const metadata = JSON.parse(
      JSON.stringify({
        applicationUrl: body.applicationUrl,
        capturedAt: body.capturedAt ?? new Date().toISOString(),
        message: body.message ?? null,
        mode: body.mode,
        status: body.status,
        toolCallCount: body.toolCalls.length,
        toolCalls: trimmedTrace,
        pageConsoleErrors: trimmedConsoleErrors,
      }),
    );
    const created = await db.automationAuditLog.create({
      data: {
        action: 'desktop_run_log',
        actionType: body.status === 'completed' ? 'success' : 'failure',
        jobLeadId: body.jobLeadId ?? null,
        metadata,
        userId: validation.token.userId,
      },
      select: { id: true },
    });
    return NextResponse.json({ id: created.id });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'RUN_LOG_WRITE_FAILED',
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
