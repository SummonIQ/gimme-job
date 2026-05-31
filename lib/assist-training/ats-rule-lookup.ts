import { db } from '@/lib/db/client';

/**
 * Look up rules for a hostname, falling back to ATS-level rules when no
 * hostname-specific rules exist. This is the read-path half of per-ATS
 * rule keying: one good Greenhouse training run should unlock ALL
 * Greenhouse hostnames, not just the one that was trained.
 *
 * Precedence:
 *  1. Hostname-specific rules (exact match on `hostname`)
 *  2. ATS-level rules (matched via `atsSystemId` across all hostnames
 *     that share the same ATS system)
 *
 * The caller gets back a flat list of rules regardless of which tier
 * matched. The `source` field on each result indicates provenance.
 */
export interface ResolvedRule {
  id: string;
  hostname: string;
  stableSelector: string;
  action: string;
  actionType: string;
  tagName: string;
  fieldName: string | null;
  fieldLabel: string | null;
  ariaLabel: string | null;
  stepIndex: number;
  reason: string | null;
  observationCount: number;
  confidence: number;
  enabled: boolean;
  source: 'hostname' | 'ats';
}

export async function lookupRulesForHostname(
  hostname: string,
): Promise<ResolvedRule[]> {
  // Try hostname-specific first.
  const hostnameRules = await db.aTSRule.findMany({
    where: { hostname, enabled: true },
    orderBy: { stepIndex: 'asc' },
  });

  if (hostnameRules.length > 0) {
    return hostnameRules.map(r => ({ ...r, source: 'hostname' as const }));
  }

  // No hostname-specific rules — fall back to ATS-level. First, detect
  // which ATS this hostname belongs to.
  const atsSystem = await db.aTSSystem.findFirst({
    select: { id: true },
    where: {
      OR: [
        { detectedDomain: hostname },
        { domainPatterns: { has: hostname } },
      ],
    },
  });

  if (!atsSystem) return [];

  // Find rules from ANY hostname that shares this ATS system.
  const atsRules = await db.aTSRule.findMany({
    where: { atsSystemId: atsSystem.id, enabled: true },
    orderBy: [{ confidence: 'desc' }, { stepIndex: 'asc' }],
    // Limit to the highest-confidence rules to avoid noise from
    // poorly-trained hostnames within the same ATS.
    take: 50,
  });

  return atsRules.map(r => ({ ...r, source: 'ats' as const }));
}
