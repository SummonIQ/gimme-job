import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const [observations, rules] = await Promise.all([
    db.aTSFieldObservation.findMany({
      where: { sessionId: id },
      orderBy: { stepIndex: 'asc' },
      select: {
        id: true,
        stepIndex: true,
        selector: true,
        stableSelector: true,
        tagName: true,
        fieldName: true,
        fieldLabel: true,
        fieldDisplayName: true,
        ariaLabel: true,
        placeholder: true,
        action: true,
        actionType: true,
        aiReason: true,
        valueFilled: true,
        success: true,
        hostname: true,
        maxLength: true,
        minLength: true,
        pattern: true,
        inputMode: true,
        fieldConstraints: true,
      },
    }),
    db.aTSRule.findMany({
      where: {
        hostname: {
          in: await db.assistTrainingSession
            .findUnique({ where: { id }, select: { hostname: true } })
            .then(s => (s ? [s.hostname] : [])),
        },
      },
      orderBy: { stepIndex: 'asc' },
      select: {
        id: true,
        hostname: true,
        action: true,
        actionType: true,
        stableSelector: true,
        tagName: true,
        fieldName: true,
        fieldLabel: true,
        ariaLabel: true,
        stepIndex: true,
        reason: true,
        observationCount: true,
        confidence: true,
        enabled: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({ observations, rules });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { ruleId, enabled } = body;

  if (!ruleId || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'ruleId and enabled required' }, { status: 400 });
  }

  const rule = await db.aTSRule.update({
    where: { id: ruleId },
    data: { enabled },
  });

  return NextResponse.json(rule);
}
