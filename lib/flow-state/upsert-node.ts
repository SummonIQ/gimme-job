import { db } from '@/lib/db/client';
import {
  computePageFingerprint,
  extractFieldSignatures,
  partitionSignatures,
  type FieldSignature,
} from './fingerprint';

interface UpsertFlowNodeInput {
  hostname: string;
  atsSystemId?: string | null;
  html: string;
  nodeLabel?: string | null;
  notes?: string | null;
  /**
   * Whether this call represents a successful visit (landed + continued
   * forward) or an observation-only visit. Successful visits bump the
   * `successfulExitCount`; observation-only visits only increment
   * `observationCount` and `visitCount`.
   */
  isSuccessfulExit?: boolean;
}

export interface UpsertedFlowNode {
  id: string;
  pageFingerprint: string;
  isNew: boolean;
  requiredFieldCount: number;
}

/**
 * Upsert an `ApplicationFlowNode` derived from a page's HTML. Called by
 * training runs (and eventually by auto-submit) to accumulate knowledge
 * about distinct pages in an ATS flow.
 *
 * - Computes the fingerprint from `html`.
 * - On first observation, creates a new node with the extracted field
 *   signatures and an initial confidence.
 * - On repeat observation, bumps `observationCount` and `visitCount`
 *   and widens the confidence toward 1.0 as observations accumulate.
 * - If `isSuccessfulExit` is true, bumps `successfulExitCount` too.
 */
export async function upsertFlowNode({
  hostname,
  atsSystemId,
  html,
  nodeLabel,
  notes,
  isSuccessfulExit,
}: UpsertFlowNodeInput): Promise<UpsertedFlowNode> {
  const trimmedHost = hostname.trim().toLowerCase();
  const signatures = extractFieldSignatures(html);
  const fingerprint = computePageFingerprint(html);
  const { required, optional } = partitionSignatures(signatures);

  // Brand-new nodes start at low confidence and grow toward 1.
  // Repeat observations pull confidence toward: visits / (visits + 5),
  // so it saturates around ~0.83 at 25 visits and ~0.95 at 95.
  const computeConfidence = (visits: number, successes: number) =>
    Math.min(1, (successes + visits * 0.5) / (visits + 5));

  try {
    const existing = await db.applicationFlowNode.findUnique({
      select: {
        id: true,
        observationCount: true,
        successfulExitCount: true,
        visitCount: true,
      },
      where: {
        hostname_pageFingerprint: {
          hostname: trimmedHost,
          pageFingerprint: fingerprint,
        },
      },
    });

    if (existing) {
      const nextVisitCount = existing.visitCount + 1;
      const nextSuccesses =
        existing.successfulExitCount + (isSuccessfulExit ? 1 : 0);
      const nextConfidence = computeConfidence(nextVisitCount, nextSuccesses);

      await db.applicationFlowNode.update({
        data: {
          confidence: nextConfidence,
          observationCount: { increment: 1 },
          successfulExitCount: nextSuccesses,
          visitCount: nextVisitCount,
          // Only overwrite label/notes if the caller provided fresh values.
          ...(nodeLabel ? { nodeLabel } : {}),
          ...(notes ? { notes } : {}),
          // Keep requiredFields/optionalFields fresh with the latest
          // observation so new fields on the page get captured.
          requiredFields: required as unknown as object,
          optionalFields: optional as unknown as object,
        },
        where: { id: existing.id },
      });

      return {
        id: existing.id,
        isNew: false,
        pageFingerprint: fingerprint,
        requiredFieldCount: required.length,
      };
    }

    const created = await db.applicationFlowNode.create({
      data: {
        atsSystemId: atsSystemId ?? null,
        confidence: computeConfidence(1, isSuccessfulExit ? 1 : 0),
        hostname: trimmedHost,
        nodeLabel: nodeLabel ?? null,
        notes: notes ?? null,
        observationCount: 1,
        optionalFields: optional as unknown as object,
        pageFingerprint: fingerprint,
        requiredFields: required as unknown as object,
        successfulExitCount: isSuccessfulExit ? 1 : 0,
        visitCount: 1,
      },
    });

    return {
      id: created.id,
      isNew: true,
      pageFingerprint: fingerprint,
      requiredFieldCount: required.length,
    };
  } catch (error) {
    console.warn('[FlowState] Failed to upsert flow node:', error);
    throw error;
  }
}

/**
 * Record a transition between two nodes. Called after a successful
 * advance action ("click Continue", "click Submit"). Auto-submit will
 * eventually consult these edges to plan the forward path through an
 * ATS flow.
 */
export async function recordFlowTransition({
  fromNodeId,
  toNodeId,
  triggerSelector,
  triggerLabel,
  actionType = 'click',
  success,
}: {
  fromNodeId: string;
  toNodeId: string;
  triggerSelector: string;
  triggerLabel?: string | null;
  actionType?: string;
  success: boolean;
}): Promise<void> {
  if (fromNodeId === toNodeId) return;

  try {
    const existing = await db.applicationFlowTransition.findUnique({
      select: {
        id: true,
        failureCount: true,
        observationCount: true,
        successCount: true,
      },
      where: {
        fromNodeId_triggerSelector_toNodeId: {
          fromNodeId,
          toNodeId,
          triggerSelector,
        },
      },
    });

    if (existing) {
      const nextObs = existing.observationCount + 1;
      const nextSuccess = existing.successCount + (success ? 1 : 0);
      const nextFail = existing.failureCount + (success ? 0 : 1);
      const nextConfidence =
        nextObs > 0 ? Math.min(1, (nextSuccess + 0.5) / (nextObs + 1)) : 0.2;

      await db.applicationFlowTransition.update({
        data: {
          confidence: nextConfidence,
          failureCount: nextFail,
          observationCount: nextObs,
          successCount: nextSuccess,
          ...(triggerLabel ? { triggerLabel } : {}),
        },
        where: { id: existing.id },
      });
      return;
    }

    await db.applicationFlowTransition.create({
      data: {
        actionType,
        confidence: success ? 0.35 : 0.15,
        failureCount: success ? 0 : 1,
        fromNodeId,
        observationCount: 1,
        successCount: success ? 1 : 0,
        toNodeId,
        triggerLabel: triggerLabel ?? null,
        triggerSelector,
      },
    });
  } catch (error) {
    console.warn('[FlowState] Failed to record flow transition:', error);
  }
}
