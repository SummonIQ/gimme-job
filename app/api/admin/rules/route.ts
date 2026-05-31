import { NextResponse, type NextRequest } from 'next/server';

import { isAdminUser } from '@/lib/admin/scrape-service';
import { db } from '@/lib/db/client';
import { syncApplicationFlowDefinitionForHostname } from '@/lib/runtime-flow-definitions';
import { getCurrentUser } from '@/lib/user/query';

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !(await isAdminUser(user.email))) {
    return null;
  }
  return user;
}

/** GET – list rules */
export async function GET(request: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500);
  const hostname = searchParams.get('hostname') ?? undefined;

  const rules = await db.aTSRule.findMany({
    where: hostname ? { hostname } : undefined,
    orderBy: [{ confidence: 'desc' }, { observationCount: 'desc' }],
    take: limit,
    select: {
      id: true,
      hostname: true,
      fieldLabel: true,
      fieldName: true,
      ariaLabel: true,
      actionType: true,
      stableSelector: true,
      stepIndex: true,
      observationCount: true,
      confidence: true,
      enabled: true,
      reason: true,
    },
  });

  return NextResponse.json({ rules });
}

/** PATCH – update one rule or batch-reorder multiple rules */
export async function PATCH(request: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  // Batch reorder: { reorder: [{ id, stepIndex }] }
  if (Array.isArray(body.reorder)) {
    const updates = body.reorder as { id: string; stepIndex: number }[];
    await db.$transaction(
      updates.map(u =>
        db.aTSRule.update({ where: { id: u.id }, data: { stepIndex: u.stepIndex } }),
      ),
    );
    return NextResponse.json({ ok: true });
  }

  // Single rule update
  const {
    id,
    enabled,
    stepIndex,
    reason,
    confidence,
    action,
    actionType,
    resetFailures,
  } =
    body as {
      id: string;
      enabled?: boolean;
      stepIndex?: number;
      reason?: string;
      confidence?: number;
      action?: string;
      actionType?: string;
      resetFailures?: boolean;
    };

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (enabled !== undefined) data.enabled = enabled;
  if (stepIndex !== undefined) data.stepIndex = stepIndex;
  if (reason !== undefined) data.reason = reason;
  if (confidence !== undefined) data.confidence = confidence;
  if (action !== undefined) data.action = action;
  if (actionType !== undefined) data.actionType = actionType;
  if (resetFailures) data.consecutiveFailures = 0;

  const rule = await db.aTSRule.update({
    where: { id },
    data,
  });

  await syncApplicationFlowDefinitionForHostname({
    atsSystemId: rule.atsSystemId,
    hostname: rule.hostname,
  });

  return NextResponse.json({ ok: true, rule });
}

/** DELETE – remove a rule */
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

  await db.aTSRule.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
