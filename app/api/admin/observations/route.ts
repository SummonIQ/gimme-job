import { NextResponse, type NextRequest } from 'next/server';

import { ApplicationRuntimeSource } from '@/generated/prisma/client';
import { isAdminUser } from '@/lib/admin/scrape-service';
import { embedRule } from '@/lib/ai/embeddings';
import { db } from '@/lib/db/client';
import { createATSFieldObservation } from '@/lib/runtime-provenance';
import { getCurrentUser } from '@/lib/user/query';

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !(await isAdminUser(user.email))) {
    return null;
  }
  return user;
}

/** GET – list observations */
export async function GET(request: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500);
  const hostname = searchParams.get('hostname') ?? undefined;

  const observations = await db.aTSFieldObservation.findMany({
    where: hostname ? { hostname } : undefined,
    orderBy: { observationCount: 'desc' },
    take: limit,
    select: {
      id: true,
      hostname: true,
      fieldLabel: true,
      fieldDisplayName: true,
      fieldName: true,
      ariaLabel: true,
      actionType: true,
      stableSelector: true,
      observationCount: true,
      success: true,
      valueFilled: true,
      stepIndex: true,
    },
  });

  return NextResponse.json({ observations });
}

/** PATCH – update an observation */
export async function PATCH(request: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as {
    id: string;
    action?: string;
    actionType?: string;
    stepIndex?: number;
    fieldLabel?: string;
    stableSelector?: string;
    aiReason?: string;
    valueFilled?: string | null;
    success?: boolean;
    fieldConstraints?: Record<string, unknown> | null;
  };

  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.action !== undefined) data.action = body.action;
  if (body.actionType !== undefined) data.actionType = body.actionType;
  if (body.stepIndex !== undefined) data.stepIndex = body.stepIndex;
  if (body.fieldLabel !== undefined) data.fieldLabel = body.fieldLabel;
  if (body.stableSelector !== undefined)
    data.stableSelector = body.stableSelector;
  if (body.aiReason !== undefined) data.aiReason = body.aiReason;
  if (body.valueFilled !== undefined) data.valueFilled = body.valueFilled;
  if (body.success !== undefined) data.success = body.success;
  if (body.fieldConstraints !== undefined) {
    data.fieldConstraints = body.fieldConstraints;
  }

  const observation = await db.aTSFieldObservation.update({
    where: { id: body.id },
    data,
  });

  return NextResponse.json({ ok: true, observation });
}

/** DELETE – remove an observation */
export async function DELETE(request: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  await db.aTSFieldObservation.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}

/** POST – create a new observation manually or promote to rule */
export async function POST(request: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as {
    action: 'create' | 'promote';
    // For create
    hostname?: string;
    selector?: string;
    stableSelector?: string;
    tagName?: string;
    fieldName?: string;
    fieldLabel?: string;
    ariaLabel?: string;
    role?: string;
    inputType?: string;
    actionValue?: string;
    actionType?: string;
    stepIndex?: number;
    aiReason?: string;
    // For promote
    observationId?: string;
  };

  if (body.action === 'promote') {
    if (!body.observationId) {
      return NextResponse.json(
        { error: 'observationId is required' },
        { status: 400 },
      );
    }

    const obs = await db.aTSFieldObservation.findUnique({
      where: { id: body.observationId },
    });
    if (!obs) {
      return NextResponse.json(
        { error: 'Observation not found' },
        { status: 404 },
      );
    }

    const selectorForRule = obs.stableSelector || obs.selector;

    const rule = await db.aTSRule.upsert({
      where: {
        unique_rule: {
          hostname: obs.hostname,
          stableSelector: selectorForRule,
          action: obs.action,
        },
      },
      update: {
        actionType: obs.actionType,
        tagName: obs.tagName,
        fieldName: obs.fieldName,
        fieldLabel: obs.fieldLabel,
        ariaLabel: obs.ariaLabel,
        role: obs.role,
        stepIndex: obs.stepIndex,
        reason: obs.aiReason,
        observationCount: obs.observationCount,
        confidence: 1.0,
        enabled: true,
      },
      create: {
        hostname: obs.hostname,
        atsSystemId: obs.atsSystemId,
        action: obs.action,
        actionType: obs.actionType,
        stableSelector: selectorForRule,
        tagName: obs.tagName,
        fieldName: obs.fieldName,
        fieldLabel: obs.fieldLabel,
        ariaLabel: obs.ariaLabel,
        role: obs.role,
        stepIndex: obs.stepIndex,
        reason: obs.aiReason,
        observationCount: obs.observationCount,
        confidence: 1.0,
        enabled: true,
      },
    });

    void embedRule(rule.id).catch(error => {
      console.warn('[admin/observations] embed rule failed', error);
    });
    return NextResponse.json({ ok: true, rule });
  }

  // Create new observation
  if (
    !body.hostname ||
    !body.tagName ||
    !body.actionValue ||
    !body.actionType
  ) {
    return NextResponse.json(
      { error: 'hostname, tagName, actionValue, and actionType are required' },
      { status: 400 },
    );
  }

  const observation = await createATSFieldObservation({
    userId: user.id,
    hostname: body.hostname,
    selector:
      body.selector || body.stableSelector || `${body.tagName.toLowerCase()}`,
    stableSelector: body.stableSelector || null,
    tagName: body.tagName,
    fieldName: body.fieldName || null,
    fieldLabel: body.fieldLabel || null,
    ariaLabel: body.ariaLabel || null,
    role: body.role || null,
    inputType: body.inputType || null,
    action: body.actionValue,
    actionType: body.actionType,
    stepIndex: body.stepIndex ?? 0,
    aiReason: body.aiReason || null,
    observationCount: 1,
    success: true,
    source: ApplicationRuntimeSource.OWNER_OVERRIDE,
  });

  return NextResponse.json({ ok: true, observation });
}
