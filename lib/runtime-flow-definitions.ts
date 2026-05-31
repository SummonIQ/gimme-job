import { db } from '@/lib/db/client';

interface SyncApplicationFlowDefinitionInput {
  readonly atsSystemId?: string | null;
  readonly hostname: string;
}

export async function syncApplicationFlowDefinitionForHostname({
  atsSystemId,
  hostname,
}: SyncApplicationFlowDefinitionInput): Promise<void> {
  const rules = await db.aTSRule.findMany({
    orderBy: [{ stepIndex: 'asc' }, { confidence: 'desc' }],
    select: {
      confidence: true,
      fieldLabel: true,
      stableSelector: true,
      stepIndex: true,
    },
    where: { enabled: true, hostname },
  });
  const averageConfidence =
    rules.length > 0
      ? rules.reduce((sum, rule) => sum + rule.confidence, 0) / rules.length
      : 0;
  const metadata = {
    labels: rules.map(rule => rule.fieldLabel).filter(Boolean),
    selectors: rules.map(rule => rule.stableSelector),
    stepIndexes: Array.from(new Set(rules.map(rule => rule.stepIndex))),
    syncedAt: new Date().toISOString(),
  };
  const existing = await db.applicationFlowDefinition.findFirst({
    select: { id: true },
    where: { hostname, version: 1 },
  });
  const data = {
    atsSystemId: atsSystemId ?? undefined,
    compiledFromRuleCount: rules.length,
    confidence: averageConfidence,
    lastCompiledAt: new Date(),
    metadata,
    status: 'ACTIVE',
  };

  if (existing) {
    await db.applicationFlowDefinition.update({
      data,
      where: { id: existing.id },
    });
    return;
  }

  await db.applicationFlowDefinition.create({
    data: {
      ...data,
      hostname,
      version: 1,
    },
  });
}
