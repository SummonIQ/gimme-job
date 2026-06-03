/**
 * P5.6 - identity redaction for prompt traces.
 *
 * Guards against identity values leaking into anything that would be
 * serialized for the Agent SDK prompt log / telemetry. The acceptance
 * criterion in Section 5.6 demands "no identity appears in Agent SDK prompt
 * traces." Callers that build a prompt trace MUST pipe the object
 * through `redactIdentityInObject` before serialization.
 *
 * Redaction is done by value, not by key name - the identity store's
 * current snapshot is used to find any literal string equal to a
 * stored identity value anywhere in the object graph, and replace it
 * with `[REDACTED_IDENTITY]`. This is strictly more conservative than
 * key-based redaction: a field named `first_name` carrying the string
 * "Hacker" would be redacted if Steven happens to have "Hacker" stored
 * under any identity key.
 */

import type { IdentityStore } from './types.js';

export const IDENTITY_PLACEHOLDER = '[REDACTED_IDENTITY]';

export interface RedactionResult {
  readonly value: unknown;
  readonly redactionCount: number;
}

/**
 * Pure - given a snapshot of identity values (from
 * `IdentityStore.snapshot()`), walk an arbitrary object graph and
 * replace every literal string that appears in the snapshot with
 * `[REDACTED_IDENTITY]`.
 */
export function redactIdentityInValue(
  value: unknown,
  snapshot: Readonly<Record<string, string>>,
): RedactionResult {
  // Build a set of distinct identity-value strings. Skip empties.
  const needle = new Set<string>();
  for (const v of Object.values(snapshot)) {
    if (typeof v === 'string' && v.length > 0) {
      needle.add(v);
    }
  }

  let count = 0;

  const visit = (node: unknown): unknown => {
    if (typeof node === 'string') {
      if (needle.has(node)) {
        count += 1;
        return IDENTITY_PLACEHOLDER;
      }
      // Catch embedded matches (e.g. `"Dear Steven,"` when "Steven" is a value).
      let updated = node;
      let replacedAny = false;
      for (const secret of needle) {
        if (updated.includes(secret)) {
          updated = updated.split(secret).join(IDENTITY_PLACEHOLDER);
          replacedAny = true;
        }
      }
      if (replacedAny) count += 1;
      return updated;
    }
    if (Array.isArray(node)) {
      return node.map(visit);
    }
    if (node !== null && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        out[k] = visit(v);
      }
      return out;
    }
    return node;
  };

  const redacted = visit(value);
  return { redactionCount: count, value: redacted };
}

/**
 * Async wrapper that pulls the current snapshot from the store.
 * Convenience for callers that don't want to manage the snapshot.
 */
export async function redactIdentityInObject<T>(
  value: T,
  store: IdentityStore,
): Promise<RedactionResult> {
  const snapshot = await store.snapshot();
  return redactIdentityInValue(value, snapshot);
}
