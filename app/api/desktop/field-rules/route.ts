/**
 * Desktop ↔ server field-rule sync.
 *
 * GET  - returns the current set of user field rules (used by the desktop
 *        on startup to hydrate its local cache and by the web's AI-assist
 *        flow when resolving question-to-answer mappings).
 *
 * POST - desktop pushes a single rule (created via State-tab correction,
 *        chat training, or rules tab manual entry). Server upserts on
 *        (userId, hostname, lower(question)) so duplicate teaches collapse
 *        into a single row with the newest answer.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db/client';
import { validateToken } from '@/lib/desktop-tokens';
import { embedUserFieldRule } from '@/lib/ai/embeddings';
import { invalidateResolverCacheSlice } from '@/lib/field-answer/resolve';

const ruleSourceSchema = z.enum(['manual', 'state-tab', 'chat']);

const upsertSchema = z.object({
  hostname: z.string().min(1).nullable().optional(),
  question: z.string().min(1),
  answer: z.string().min(1),
  source: ruleSourceSchema.default('manual'),
});

// Prisma error code for "table does not exist" — when the UserFieldRule
// migration hasn't been applied yet, treat the missing table the same as
// an empty rule list rather than throwing 500. Lets the desktop continue
// working (it just gets no remote rules) while the user runs db:migrate.
function isMissingTableError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2021'
  );
}

export async function GET(request: Request) {
  const validation = await authorize(request);
  if (!validation.ok) return validation.response;

  try {
    const rules = await db.userFieldRule.findMany({
      where: { userId: validation.userId },
      orderBy: { updatedAt: 'desc' },
      take: 500,
      select: {
        id: true,
        hostname: true,
        question: true,
        answer: true,
        source: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({ rules });
  } catch (error) {
    if (isMissingTableError(error)) {
      console.warn(
        '[field-rules] UserFieldRule table missing — run `bun db:migrate --name add_user_field_rule`. Returning empty rule list.',
      );
      return NextResponse.json({ rules: [], pendingMigration: true });
    }
    throw error;
  }
}

export async function POST(request: Request) {
  const validation = await authorize(request);
  if (!validation.ok) return validation.response;

  let body: z.infer<typeof upsertSchema>;
  try {
    body = upsertSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Invalid request body',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 400 },
    );
  }

  const hostname = body.hostname?.trim().toLowerCase() || null;
  const question = body.question.trim();
  const answer = body.answer.trim();

  let existing: { id: string } | null = null;
  try {
    existing = await db.userFieldRule.findFirst({
      where: {
        userId: validation.userId,
        hostname,
        question: { equals: question, mode: 'insensitive' },
      },
      select: { id: true },
    });
  } catch (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json(
        {
          error: 'UserFieldRule table missing',
          pendingMigration: true,
          hint: 'Run `bun db:migrate --name add_user_field_rule`',
        },
        { status: 503 },
      );
    }
    throw error;
  }
  if (existing) {
    const updated = await db.userFieldRule.update({
      data: { answer, source: body.source },
      where: { id: existing.id },
      select: { id: true },
    });
    // Question text didn't change on update, but re-embedding is cheap
    // and keeps the column in sync if we ever expand to embed `answer`.
    void embedUserFieldRule(updated.id).catch(error => {
      console.warn('[field-rules] embed failed', error);
    });
    invalidateResolverCacheSlice(validation.userId, 'fieldRules');
    return NextResponse.json({ id: updated.id, created: false });
  }

  const created = await db.userFieldRule.create({
    data: {
      userId: validation.userId,
      hostname,
      question,
      answer,
      source: body.source,
    },
    select: { id: true },
  });
  void embedUserFieldRule(created.id).catch(error => {
    console.warn('[field-rules] embed failed', error);
  });
  invalidateResolverCacheSlice(validation.userId, 'fieldRules');
  return NextResponse.json({ id: created.id, created: true });
}

export async function DELETE(request: Request) {
  const validation = await authorize(request);
  if (!validation.ok) return validation.response;

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const result = await db.userFieldRule.deleteMany({
    where: { id, userId: validation.userId },
  });
  if (result.count > 0) {
    invalidateResolverCacheSlice(validation.userId, 'fieldRules');
  }
  return NextResponse.json({ deleted: result.count > 0 });
}

async function authorize(
  request: Request,
): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const rawToken = readBearerToken(request);
  if (!rawToken) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Missing Bearer token' },
        { status: 401 },
      ),
    };
  }
  const validation = await validateToken(rawToken, {
    requireScope: 'desktop:runtime',
  });
  if (!validation.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: validation.reason },
        { status: 401 },
      ),
    };
  }
  return { ok: true, userId: validation.token.userId };
}

function readBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/);
  return match?.[1]?.trim() || null;
}
