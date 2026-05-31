/**
 * Desktop training-feedback ingestion. The desktop's user-action tracker
 * captures every field the candidate either CORRECTED (AI guessed wrong,
 * user typed something different) or FILLED IN themselves (AI left blank).
 * Both of those are gold-standard signals about what the right answer is
 * for that question on that ATS. We persist them as `formFieldFeedback`
 * rows scoped to (userId, hostname, fieldLabel) so the LLM resolver
 * (`loadFieldFeedback`) finds them on the next run and inlines them into
 * the prompt — closing the training loop without an admin review step.
 *
 * `corrected` rows store the user's value as the approved filledValue
 * (rejecting the AI baseline). `filled` rows store the user's value as
 * the approved filledValue and an empty rejectReason.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db/client';
import { validateToken } from '@/lib/desktop-tokens';
import {
  embedFormFieldFeedback,
  embedUserFieldRule,
} from '@/lib/ai/embeddings';
import { invalidateResolverCacheSlice } from '@/lib/field-answer/resolve';

const fieldEntrySchema = z.object({
  label: z.string().min(1),
  value: z.string(),
  type: z.string().optional(),
  aiValue: z.string().optional(),
});

const requestSchema = z.object({
  applicationUrl: z.string().min(1),
  hostname: z.string().min(1),
  capturedAt: z.string().datetime().optional(),
  trigger: z.enum(['submit', 'manual']).optional(),
  correctedFields: z.array(fieldEntrySchema).default([]),
  filledFields: z.array(fieldEntrySchema).default([]),
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
  const hostname = body.hostname.trim().toLowerCase();
  if (!hostname) {
    return NextResponse.json(
      { error: 'hostname required' },
      { status: 400 },
    );
  }

  // Skip very short labels — they're almost always container junk that
  // would pollute the feedback set with low-signal rows ("Yes", "No").
  const corrected = body.correctedFields.filter(
    field => field.label.trim().length >= 4 && field.value.trim().length > 0,
  );
  const filled = body.filledFields.filter(
    field => field.label.trim().length >= 4 && field.value.trim().length > 0,
  );

  let writes = 0;
  for (const field of corrected) {
    await upsertFeedback({
      userId,
      hostname,
      applicationUrl: body.applicationUrl,
      fieldLabel: field.label.trim(),
      fieldType: field.type ?? null,
      filledValue: field.value.trim(),
      rejectReason:
        field.aiValue && field.aiValue.trim()
          ? `Replaced AI value "${field.aiValue.trim()}" with user value`
          : null,
      feedback: 'desktop_user_correction',
    });
    writes += 1;
    // Auto-promote: if the user has now corrected this same question
    // with the same answer on 2+ different hostnames, the answer is
    // clearly stable across ATSes — promote it to a global UserFieldRule
    // so the next site asking the same question gets it for free.
    void maybePromoteGlobalRule({
      userId,
      label: field.label.trim(),
      value: field.value.trim(),
    }).catch(error => {
      console.warn('[training-feedback] global-rule promotion failed:', error);
    });
  }
  for (const field of filled) {
    await upsertFeedback({
      userId,
      hostname,
      applicationUrl: body.applicationUrl,
      fieldLabel: field.label.trim(),
      fieldType: field.type ?? null,
      filledValue: field.value.trim(),
      rejectReason: null,
      feedback: 'desktop_user_fill',
    });
    writes += 1;
    void maybePromoteGlobalRule({
      userId,
      label: field.label.trim(),
      value: field.value.trim(),
    }).catch(error => {
      console.warn('[training-feedback] global-rule promotion failed:', error);
    });
  }

  return NextResponse.json({ writes });
}

const PROMOTION_HOSTNAME_THRESHOLD = 2;

async function maybePromoteGlobalRule(input: {
  readonly userId: string;
  readonly label: string;
  readonly value: string;
}): Promise<void> {
  if (input.label.length < 6 || input.value.length === 0) return;

  // Count distinct hostnames where the user gave this same answer.
  // The fieldLabel is matched case-insensitively because some ATSes
  // capitalize labels differently ("Why this company?" vs "Why this Company?").
  const matchingFeedback = await db.formFieldFeedback.findMany({
    where: {
      userId: input.userId,
      fieldLabel: { equals: input.label, mode: 'insensitive' },
      filledValue: input.value,
      status: 'approved',
    },
    select: { hostname: true },
  });
  const hostnames = new Set(
    matchingFeedback.map(row => row.hostname.toLowerCase()),
  );
  if (hostnames.size < PROMOTION_HOSTNAME_THRESHOLD) return;

  // Already have a global rule? Don't double-write.
  const existingGlobal = await db.userFieldRule.findFirst({
    where: {
      userId: input.userId,
      hostname: null,
      question: { equals: input.label, mode: 'insensitive' },
    },
    select: { id: true },
  });
  if (existingGlobal) return;

  const rule = await db.userFieldRule.create({
    data: {
      userId: input.userId,
      hostname: null,
      question: input.label,
      answer: input.value,
      source: 'manual',
    },
    select: { id: true },
  });
  void embedUserFieldRule(rule.id).catch(error => {
    console.warn('[training-feedback] embed rule failed', error);
  });
  invalidateResolverCacheSlice(input.userId, 'fieldRules');
  console.log(
    `[training-feedback] auto-promoted "${input.label}" → "${input.value}" to a global rule (matched on ${hostnames.size} hostnames)`,
  );
}

async function upsertFeedback(input: {
  readonly userId: string;
  readonly hostname: string;
  readonly applicationUrl: string;
  readonly fieldLabel: string;
  readonly fieldType: string | null;
  readonly filledValue: string;
  readonly rejectReason: string | null;
  readonly feedback: string;
}): Promise<void> {
  // No composite unique on (userId, hostname, fieldLabel) so we mimic an
  // upsert: find the latest row for the same (userId, hostname, label),
  // update it if present, otherwise create.
  const existing = await db.formFieldFeedback.findFirst({
    where: {
      userId: input.userId,
      hostname: input.hostname,
      fieldLabel: input.fieldLabel,
    },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });
  const data = {
    applicationUrl: input.applicationUrl,
    feedback: input.feedback,
    fieldType: input.fieldType,
    filledValue: input.filledValue,
    rejectReason: input.rejectReason,
    status: 'approved' as const,
  };
  if (existing) {
    await db.formFieldFeedback.update({
      data,
      where: { id: existing.id },
    });
    void embedFormFieldFeedback(existing.id).catch(error => {
      console.warn('[training-feedback] embed failed', error);
    });
    return;
  }
  const created = await db.formFieldFeedback.create({
    data: {
      ...data,
      fieldLabel: input.fieldLabel,
      hostname: input.hostname,
      userId: input.userId,
    },
    select: { id: true },
  });
  void embedFormFieldFeedback(created.id).catch(error => {
    console.warn('[training-feedback] embed failed', error);
  });
}

function readBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/);
  return match?.[1]?.trim() || null;
}
