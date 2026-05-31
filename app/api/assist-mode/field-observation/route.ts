import { NextResponse, type NextRequest } from 'next/server';

import { rejectNonReconstructionSource } from '@/app/api/_lib/reconstruction-source-guard';
import { ApplicationRuntimeSource } from '@/generated/prisma/client';
import { redactPiiValue } from '@/app/api/assist-mode/_lib/redact-pii';
import { isAdminUser } from '@/lib/admin/scrape-service';
import { embedRule } from '@/lib/ai/embeddings';
import { db } from '@/lib/db/client';
import {
  createATSFieldObservation,
  upsertATSFieldObservation,
} from '@/lib/runtime-provenance';
import { getCurrentUser } from '@/lib/user/query';

const RULE_PROMOTION_THRESHOLD = 4;

async function updateAtsSystemSuccessMetrics(
  atsSystemId: string | null,
): Promise<void> {
  if (!atsSystemId) return;

  const rows = await db.aTSFieldObservation.findMany({
    select: { observationCount: true, success: true },
    where: {
      action: 'continue',
      atsSystemId,
    },
  });

  if (rows.length === 0) return;

  const totalAnalyzed = rows.reduce(
    (sum, row) => sum + Math.max(row.observationCount || 1, 1),
    0,
  );
  if (totalAnalyzed === 0) return;

  const successful = rows
    .filter(row => row.success)
    .reduce((sum, row) => sum + Math.max(row.observationCount || 1, 1), 0);
  const successRate = successful / totalAnalyzed;

  await db.aTSSystem.update({
    data: {
      lastSuccessfulSubmit: successful > 0 ? new Date() : undefined,
      successRate,
      totalAnalyzed,
    },
    where: { id: atsSystemId },
  });
}

/**
 * Build a stable, reproducible CSS selector for an element.
 * Prefers: aria-label > label text > role+name > fieldName > readable fieldId.
 * Falls back to the original AI selector if nothing stable is available.
 */
function buildStableSelector(body: {
  tagName: string;
  ariaLabel?: string;
  fieldLabel?: string;
  fieldName?: string;
  fieldId?: string;
  role?: string;
  inputType?: string;
  selector?: string;
}): string | null {
  const tag = body.tagName.toLowerCase();

  // 1. aria-label is the most reliable
  if (body.ariaLabel) {
    return `${tag}[aria-label="${body.ariaLabel}"]`;
  }

  // 2. role + name combo
  if (body.role && body.fieldName) {
    return `${tag}[role="${body.role}"][name="${body.fieldName}"]`;
  }

  // 3. name attribute (stable if it's not a random UUID)
  if (body.fieldName && !isRandomId(body.fieldName)) {
    return `${tag}[name="${body.fieldName}"]`;
  }

  // 4. For inputs, type + label combo
  if (body.inputType && body.fieldLabel) {
    return `${tag}[type="${body.inputType}"]`;
  }

  // 5. Readable ID (not a random UUID)
  if (body.fieldId && !isRandomId(body.fieldId)) {
    return `#${body.fieldId}`;
  }

  // 6. name attribute even if UUID-like (better than nothing)
  if (body.fieldName) {
    return `${tag}[name="${body.fieldName}"]`;
  }

  // 7. Field label as stable identifier — labels like "Full name", "Email" are
  //    consistent across page loads even when IDs/names are random
  if (body.fieldLabel) {
    const normalizedLabel = body.fieldLabel
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    return `${tag}:label("${normalizedLabel}")`;
  }

  return null;
}

/** Detect random UUIDs / hex strings that aren't stable selectors */
function isRandomId(id: string): boolean {
  // UUID pattern: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    return true;
  }
  // Long hex strings (16+ chars of hex)
  if (/^[0-9a-f]{16,}$/i.test(id)) {
    return true;
  }
  // React-generated IDs like :r0:, :r1a:
  if (/^:r[0-9a-z]+:$/i.test(id)) {
    return true;
  }
  return false;
}

/**
 * When an observation reaches the promotion threshold, create or update an ATSRule.
 */
async function maybePromoteToRule(
  hostname: string,
  stableSelector: string,
  observation: {
    action: string;
    actionType: string;
    tagName: string;
    fieldName?: string | null;
    fieldLabel?: string | null;
    ariaLabel?: string | null;
    role?: string | null;
    stepIndex: number;
    aiReason?: string | null;
    atsSystemId?: string | null;
    observationCount: number;
  },
) {
  if (observation.observationCount < RULE_PROMOTION_THRESHOLD) return;

  const rule = await db.aTSRule.upsert({
    where: {
      unique_rule: {
        hostname,
        stableSelector,
        action: observation.action,
      },
    },
    update: {
      observationCount: observation.observationCount,
      stepIndex: observation.stepIndex,
      reason: observation.aiReason,
      confidence: Math.min(1.0, observation.observationCount / 10),
    },
    create: {
      hostname,
      atsSystemId: observation.atsSystemId,
      action: observation.action,
      actionType: observation.actionType,
      stableSelector,
      tagName: observation.tagName,
      fieldName: observation.fieldName,
      fieldLabel: observation.fieldLabel,
      ariaLabel: observation.ariaLabel,
      role: observation.role,
      stepIndex: observation.stepIndex,
      reason: observation.aiReason,
      observationCount: observation.observationCount,
      confidence: Math.min(1.0, observation.observationCount / 10),
    },
    select: { id: true },
  });
  void embedRule(rule.id).catch(error => {
    console.warn('[assist-mode/field-observation] embed rule failed', error);
  });
}

async function recordWithDedup(data: {
  userId: string;
  hostname: string;
  pathname: string | null;
  atsSystemId: string | null;
  selector: string;
  stableSelector: string | null;
  tagName: string;
  inputType: string | null;
  fieldName: string | null;
  fieldId: string | null;
  fieldLabel: string | null;
  ariaLabel: string | null;
  placeholder: string | null;
  autocomplete: string | null;
  role: string | null;
  stepIndex: number;
  sessionId: string | null;
  action: string;
  actionType: string;
  aiReason: string | null;
  valueFilled: string | null;
  success: boolean;
  source: ApplicationRuntimeSource;
}): Promise<{ observationCount: number }> {
  if (data.stableSelector) {
    return upsertATSFieldObservation({
      where: {
        unique_observation: {
          hostname: data.hostname,
          stableSelector: data.stableSelector,
          action: data.action,
          actionType: data.actionType,
        },
      },
      update: {
        observationCount: { increment: 1 },
        pathname: data.pathname ?? undefined,
        selector: data.selector,
        aiReason: data.aiReason ?? undefined,
        valueFilled: data.valueFilled ?? undefined,
        success: data.success,
        stepIndex: data.stepIndex,
        sessionId: data.sessionId ?? undefined,
      },
      create: data,
    });
  }

  // No stable selector — match on element attributes instead of the raw AI selector
  // which changes every page load
  const existing = await db.aTSFieldObservation.findFirst({
    where: {
      hostname: data.hostname,
      tagName: data.tagName,
      action: data.action,
      actionType: data.actionType,
      ...(data.fieldName ? { fieldName: data.fieldName } : {}),
      ...(data.fieldLabel ? { fieldLabel: data.fieldLabel } : {}),
      ...(data.ariaLabel ? { ariaLabel: data.ariaLabel } : {}),
    },
    select: { id: true },
  });

  if (existing) {
    return db.aTSFieldObservation.update({
      where: { id: existing.id },
      data: {
        observationCount: { increment: 1 },
        pathname: data.pathname ?? undefined,
        aiReason: data.aiReason ?? undefined,
        valueFilled: data.valueFilled ?? undefined,
        success: data.success,
        stepIndex: data.stepIndex,
        sessionId: data.sessionId ?? undefined,
      },
      select: { observationCount: true },
    });
  }

  const observation = await createATSFieldObservation(data);
  return { observationCount: observation.observationCount };
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as {
      hostname?: string;
      pathname?: string;
      selector?: string;
      tagName?: string;
      inputType?: string;
      fieldName?: string;
      fieldId?: string;
      fieldLabel?: string;
      ariaLabel?: string;
      placeholder?: string;
      autocomplete?: string;
      role?: string;
      action?: string;
      actionType?: string;
      aiReason?: string;
      valueFilled?: string;
      success?: boolean;
      stepIndex?: number;
      sessionId?: string;
      source?: unknown;
    };

    const forbiddenSource = rejectNonReconstructionSource(body.source);
    if (forbiddenSource) return forbiddenSource;

    if (
      !body.hostname ||
      !body.selector ||
      !body.tagName ||
      !body.action ||
      !body.actionType
    ) {
      return NextResponse.json(
        {
          error:
            'hostname, selector, tagName, action, and actionType are required',
        },
        { status: 400 },
      );
    }

    // Try to match hostname to an existing ATSSystem
    let atsSystemId: string | null = null;
    const atsSystem = await db.aTSSystem.findFirst({
      where: {
        OR: [
          { detectedDomain: body.hostname },
          { domainPatterns: { has: body.hostname } },
        ],
      },
      select: { id: true },
    });
    if (atsSystem) {
      atsSystemId = atsSystem.id;
    }

    const redactedValue = redactPiiValue(
      body.valueFilled,
      body.fieldLabel,
      body.fieldName,
    );

    // Build a stable selector for dedup and rule promotion
    const stableSelector = buildStableSelector({
      tagName: body.tagName,
      ariaLabel: body.ariaLabel,
      fieldLabel: body.fieldLabel,
      fieldName: body.fieldName,
      fieldId: body.fieldId,
      role: body.role,
      inputType: body.inputType,
      selector: body.selector,
    });

    const selectorForDedup = stableSelector || body.selector;
    const stepIndex = body.stepIndex ?? 0;

    // Skip recording if an enabled rule already covers this hostname+stepIndex.
    // If the action was successful, reset the rule's failure counter.
    try {
      const existingRule = await db.aTSRule.findFirst({
        where: {
          hostname: body.hostname,
          stepIndex,
          enabled: true,
          consecutiveFailures: { lt: 3 },
        },
        select: { id: true, consecutiveFailures: true },
      });
      if (existingRule) {
        if (body.success !== false && existingRule.consecutiveFailures > 0) {
          db.aTSRule
            .update({
              where: { id: existingRule.id },
              data: { consecutiveFailures: 0 },
            })
            .catch(() => {});
        }
        return NextResponse.json({ ok: true, skipped: true });
      }
    } catch {
      // Pre-migration: consecutiveFailures column may not exist yet
    }

    // Try new schema with dedup, fall back to old create-only if columns don't exist
    let observation: { observationCount: number };
    try {
      observation = await recordWithDedup({
        userId: user.id,
        hostname: body.hostname,
        pathname: body.pathname ?? null,
        atsSystemId,
        selector: body.selector,
        stableSelector,
        tagName: body.tagName,
        inputType: body.inputType ?? null,
        fieldName: body.fieldName ?? null,
        fieldId: body.fieldId ?? null,
        fieldLabel: body.fieldLabel ?? null,
        ariaLabel: body.ariaLabel ?? null,
        placeholder: body.placeholder ?? null,
        autocomplete: body.autocomplete ?? null,
        role: body.role ?? null,
        stepIndex,
        sessionId: body.sessionId ?? null,
        action: body.action,
        actionType: body.actionType,
        aiReason: body.aiReason ?? null,
        valueFilled: redactedValue,
        success: body.success ?? true,
        source: ApplicationRuntimeSource.RECONSTRUCTION,
      });
    } catch {
      // Pre-migration fallback: create with only original columns
      await createATSFieldObservation({
        userId: user.id,
        hostname: body.hostname,
        pathname: body.pathname ?? null,
        atsSystemId,
        selector: body.selector,
        tagName: body.tagName,
        inputType: body.inputType ?? null,
        fieldName: body.fieldName ?? null,
        fieldId: body.fieldId ?? null,
        fieldLabel: body.fieldLabel ?? null,
        ariaLabel: body.ariaLabel ?? null,
        placeholder: body.placeholder ?? null,
        autocomplete: body.autocomplete ?? null,
        action: body.action,
        actionType: body.actionType,
        aiReason: body.aiReason ?? null,
        valueFilled: redactedValue,
        success: body.success ?? true,
        source: ApplicationRuntimeSource.RECONSTRUCTION,
      });
      return NextResponse.json({ ok: true });
    }

    // Auto-promote to rule if threshold reached
    if (
      selectorForDedup &&
      observation.observationCount >= RULE_PROMOTION_THRESHOLD
    ) {
      maybePromoteToRule(body.hostname, selectorForDedup, {
        action: body.action,
        actionType: body.actionType,
        tagName: body.tagName,
        fieldName: body.fieldName,
        fieldLabel: body.fieldLabel,
        ariaLabel: body.ariaLabel,
        role: body.role,
        stepIndex,
        aiReason: body.aiReason,
        atsSystemId,
        observationCount: observation.observationCount,
      }).catch(() => {}); // Fire and forget
    }

    updateAtsSystemSuccessMetrics(atsSystemId).catch(() => {});

    return NextResponse.json({
      ok: true,
      promoted: observation.observationCount >= RULE_PROMOTION_THRESHOLD,
    });
  } catch (error) {
    console.error('Field observation recording error:', error);
    return NextResponse.json(
      { error: 'Failed to record observation' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !(await isAdminUser(user.email))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await db.aTSFieldObservation.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Field observation delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete observation' },
      { status: 500 },
    );
  }
}
