import { db } from '@/lib/db/client';
import {
  GREENHOUSE_HOSTNAMES,
  buildGreenhouseRulePack,
  type ATSRuleInput,
} from '@/lib/seed/greenhouse-rule-pack';

export interface ApplyRulePackResult {
  readonly ruleStats: {
    readonly created: number;
    readonly updated: number;
    readonly unchanged: number;
  };
  readonly flowStats: {
    readonly created: number;
    readonly updated: number;
    readonly unchanged: number;
    readonly compiledRuleCounts: Readonly<Record<string, number>>;
  };
}

async function upsertRule(row: ATSRuleInput): Promise<'created' | 'updated' | 'unchanged'> {
  const existing = await db.aTSRule.findFirst({
    where: {
      action: row.action,
      hostname: row.hostname,
      stableSelector: row.stableSelector,
    },
  });

  if (!existing) {
    await db.aTSRule.create({
      data: {
        action: row.action,
        actionType: row.actionType,
        ariaLabel: row.ariaLabel,
        confidence: row.confidence,
        enabled: true,
        fieldLabel: row.fieldLabel,
        fieldName: row.fieldName,
        hostname: row.hostname,
        reason: row.reason,
        role: row.role,
        sourceTrainingSessionIds: [...row.sourceTrainingSessionIds],
        stableSelector: row.stableSelector,
        stepIndex: row.stepIndex,
        tagName: row.tagName,
      },
    });
    return 'created';
  }

  const mergedSessionIds = Array.from(
    new Set([...existing.sourceTrainingSessionIds, ...row.sourceTrainingSessionIds]),
  );
  const drift =
    existing.actionType !== row.actionType ||
    existing.tagName !== row.tagName ||
    existing.fieldName !== row.fieldName ||
    existing.fieldLabel !== row.fieldLabel ||
    existing.ariaLabel !== row.ariaLabel ||
    existing.role !== row.role ||
    existing.stepIndex !== row.stepIndex ||
    existing.reason !== row.reason ||
    existing.sourceTrainingSessionIds.length !== mergedSessionIds.length ||
    Math.abs(existing.confidence - row.confidence) > 1e-6;

  if (!drift) return 'unchanged';

  await db.aTSRule.update({
    data: {
      actionType: row.actionType,
      ariaLabel: row.ariaLabel,
      confidence: row.confidence,
      fieldLabel: row.fieldLabel,
      fieldName: row.fieldName,
      reason: row.reason,
      role: row.role,
      sourceTrainingSessionIds: mergedSessionIds,
      stepIndex: row.stepIndex,
      tagName: row.tagName,
    },
    where: { id: existing.id },
  });
  return 'updated';
}

export async function applyGreenhouseRulePack(
  hostnames: readonly string[] = GREENHOUSE_HOSTNAMES,
): Promise<ApplyRulePackResult> {
  const pack = buildGreenhouseRulePack(hostnames);

  const ruleStats = { created: 0, updated: 0, unchanged: 0 };
  for (const row of pack.rules) {
    const result = await upsertRule(row);
    ruleStats[result] += 1;
  }

  const flowStats = {
    compiledRuleCounts: {} as Record<string, number>,
    created: 0,
    unchanged: 0,
    updated: 0,
  };

  for (const hostname of hostnames) {
    const compiledRules = await db.aTSRule.count({
      where: { enabled: true, hostname },
    });
    flowStats.compiledRuleCounts[hostname] = compiledRules;

    const averageConfidenceAgg = await db.aTSRule.aggregate({
      _avg: { confidence: true },
      where: { enabled: true, hostname },
    });
    const averageConfidence = averageConfidenceAgg._avg.confidence ?? 0;

    const existingFlow = await db.applicationFlowDefinition.findUnique({
      where: { hostname_version: { hostname, version: 1 } },
    });

    const metadataPayload = {
      bootstrappedFrom: 'P3.1 script',
      steps: pack.steps.filter(s => s.hostname === hostname),
    };

    if (!existingFlow) {
      const flow = await db.applicationFlowDefinition.create({
        data: {
          compiledFromRuleCount: compiledRules,
          confidence: averageConfidence,
          hostname,
          lastCompiledAt: new Date(),
          metadata: metadataPayload as object,
          status: 'ACTIVE',
          version: 1,
        },
      });
      for (const step of pack.steps.filter(s => s.hostname === hostname)) {
        await db.applicationFlowStepDefinition.create({
          data: {
            averageConfidence,
            enabledRuleCount: compiledRules,
            flowDefinitionId: flow.id,
            labels: [...step.labels],
            primarySelector: step.primarySelector,
            selectors: [step.primarySelector],
            stepIndex: step.stepIndex,
            stepLabel: step.stepLabel,
          },
        });
      }
      flowStats.created += 1;
      continue;
    }

    const drift =
      existingFlow.compiledFromRuleCount !== compiledRules ||
      Math.abs(existingFlow.confidence - averageConfidence) > 1e-6;
    if (!drift) {
      flowStats.unchanged += 1;
      continue;
    }

    await db.applicationFlowDefinition.update({
      data: {
        compiledFromRuleCount: compiledRules,
        confidence: averageConfidence,
        lastCompiledAt: new Date(),
        metadata: metadataPayload as object,
      },
      where: { id: existingFlow.id },
    });
    flowStats.updated += 1;
  }

  return { flowStats, ruleStats };
}

if (import.meta.main) {
  applyGreenhouseRulePack()
    .then(result => {
      console.log('Greenhouse rule pack applied:', JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(error => {
      console.error('Greenhouse rule pack failed:', error);
      process.exit(1);
    });
}
