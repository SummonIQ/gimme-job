/**
 * Web-app field-answer endpoint. Same shared resolver as the desktop's
 * /api/desktop/agent-chat/field-answer, but session-authenticated so the
 * embedded application viewer can fill custom questions on behalf of
 * the logged-in user.
 *
 * Accepts a single field OR a batch (array). Batched mode returns one
 * answer per question in the same order — used by the assist-mode
 * autofill flow to resolve every empty field on a page in one
 * round-trip.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  fieldAnswerInputSchema,
  resolveFieldAnswer,
  type FieldAnswerInput,
  type FieldAnswerOutput,
} from '@/lib/field-answer/resolve';
import { getCurrentUser } from '@/lib/user/query';

const batchSchema = z.object({
  fields: z.array(fieldAnswerInputSchema).min(1).max(40),
});

export async function POST(request: Request) {
  try {
    return await handle(request);
  } catch (error) {
    console.error('[applications/field-answer] unhandled', error);
    return NextResponse.json(
      {
        error: 'FIELD_ANSWER_HANDLER_FAILED',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

async function handle(request: Request) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  // Single-field path: { question, ... } directly.
  const single = fieldAnswerInputSchema.safeParse(payload);
  if (single.success) {
    const result = await resolveFieldAnswer(user.id, single.data);
    return NextResponse.json(result);
  }

  // Batch path: { fields: [...] }. Resolve in parallel; cap at 40 fields
  // per call to bound the worst-case LLM fan-out.
  const batch = batchSchema.safeParse(payload);
  if (!batch.success) {
    return NextResponse.json(
      {
        error: 'Invalid request body',
        details:
          'Provide either a single field-answer input or { fields: [...] }.',
      },
      { status: 400 },
    );
  }

  const settled = await Promise.allSettled(
    batch.data.fields.map((field: FieldAnswerInput) =>
      resolveFieldAnswer(user.id, field),
    ),
  );
  const answers: Array<
    | (FieldAnswerOutput & { ok: true })
    | { ok: false; error: string }
  > = settled.map(result => {
    if (result.status === 'fulfilled') {
      return { ok: true as const, ...result.value };
    }
    const reason = result.reason;
    return {
      ok: false as const,
      error: reason instanceof Error ? reason.message : String(reason),
    };
  });
  return NextResponse.json({ answers });
}
