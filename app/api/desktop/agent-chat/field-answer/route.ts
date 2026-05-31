/**
 * Desktop field-answer endpoint. Authenticates with desktop:runtime token
 * scope and delegates the actual answer resolution to the shared
 * `resolveFieldAnswer` library so the desktop runner and the web's
 * AI-assist autofill share the same priority chain (rule → deterministic
 * → LLM with profile/resume/job/feedback context).
 */
import { NextResponse } from 'next/server';

import { validateToken } from '@/lib/desktop-tokens';
import {
  fieldAnswerInputSchema,
  resolveFieldAnswer,
} from '@/lib/field-answer/resolve';

export async function POST(request: Request) {
  try {
    return await handleFieldAnswer(request);
  } catch (error) {
    console.error('[field-answer] unhandled', error);
    return NextResponse.json(
      {
        error: 'FIELD_ANSWER_HANDLER_FAILED',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}

async function handleFieldAnswer(request: Request) {
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

  let body: ReturnType<typeof fieldAnswerInputSchema.parse>;
  try {
    body = fieldAnswerInputSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Invalid request body',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 400 },
    );
  }

  try {
    const result = await resolveFieldAnswer(validation.token.userId, body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'LLM_ANSWER_FAILED',
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
