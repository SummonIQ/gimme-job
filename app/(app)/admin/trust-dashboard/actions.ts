'use server';

import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db/client';
import {
  TRUST_LEVEL_INDEX,
  type TrustLevel,
  type TrustScope,
} from '@/lib/runtime-trust-ladder';

import { requireAdminUser } from '../require-admin-user';

const DEMOTABLE_LEVELS: readonly TrustLevel[] = [
  'OBSERVE_ONLY',
  'SUGGEST_ONLY',
  'ACTION_WITH_CONFIRMATION',
  'AUTO_STEP_GUARDED',
];

function isTrustLevel(value: unknown): value is TrustLevel {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(TRUST_LEVEL_INDEX, value)
  );
}

export interface DemoteInput {
  readonly scope: TrustScope;
  readonly demotedTo: TrustLevel;
  readonly reason: string;
  readonly expiresAt?: Date | null;
}

/**
 * Create or update a RuntimeTrustOverride that caps the given scope at
 * `demotedTo`. `demotedTo` must be a non-FULL_AUTO level (demotions only).
 * Writes an AutomationAuditLog row so the decision is visible in the
 * audit trail.
 */
export async function demoteTrustScope(input: DemoteInput) {
  const user = await requireAdminUser();

  if (!isTrustLevel(input.demotedTo)) {
    throw new Error(`Invalid trust level: ${input.demotedTo}`);
  }
  if (!DEMOTABLE_LEVELS.includes(input.demotedTo)) {
    throw new Error(
      `${input.demotedTo} is not a demotable target; demotions cannot promote to FULL_AUTO.`,
    );
  }

  const reason = input.reason.trim();
  if (!reason) {
    throw new Error('A reason is required when manually demoting trust.');
  }

  const override = await db.runtimeTrustOverride.create({
    data: {
      actionType: input.scope.actionType,
      atsFamily: input.scope.atsFamily,
      demotedTo: input.demotedTo,
      expiresAt: input.expiresAt ?? null,
      hostname: input.scope.hostname,
      node: input.scope.node,
      reason,
      transition: input.scope.transition,
      userId: user.id,
    },
  });

  await db.automationAuditLog.create({
    data: {
      action: 'MANUAL_TRUST_DEMOTE',
      actionType: 'TRUST_POLICY',
      metadata: {
        demotedTo: input.demotedTo,
        expiresAt: input.expiresAt?.toISOString() ?? null,
        overrideId: override.id,
        reason,
        scope: { ...input.scope },
      },
      userId: user.id,
    },
  });

  revalidatePath('/admin/trust-dashboard');
  return { overrideId: override.id };
}

/**
 * Clear (soft-delete) an active override. Useful when Steven wants to let
 * the ladder re-evaluate a scope from scratch after investigating a signal.
 */
export async function clearTrustOverride(overrideId: string) {
  const user = await requireAdminUser();

  const override = await db.runtimeTrustOverride.findUnique({
    where: { id: overrideId },
  });
  if (!override || override.userId !== user.id) {
    throw new Error('Override not found');
  }

  await db.runtimeTrustOverride.update({
    data: { clearedAt: new Date() },
    where: { id: overrideId },
  });

  await db.automationAuditLog.create({
    data: {
      action: 'MANUAL_TRUST_OVERRIDE_CLEARED',
      actionType: 'TRUST_POLICY',
      metadata: {
        overrideId,
        previousDemotedTo: override.demotedTo,
        scope: {
          actionType: override.actionType,
          atsFamily: override.atsFamily,
          hostname: override.hostname,
          node: override.node,
          transition: override.transition,
        },
      },
      userId: user.id,
    },
  });

  revalidatePath('/admin/trust-dashboard');
}
