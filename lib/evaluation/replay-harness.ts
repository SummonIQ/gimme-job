import { gunzipSync } from 'node:zlib';

import { JSDOM } from 'jsdom';

import {
  type FlowContext,
  type FlowStep,
  runFlow,
} from '@/lib/applications/flow-executor';

import { startFixtureDriver } from './fixture-driver';

/**
 * P7.1 - Replay harness.
 *
 * Takes a `ReplayArtifact` produced by the desktop session recorder
 * (P6.2) plus the current `ApplicationFlowDefinition` for the same
 * hostname, and reports - per step - whether the current flow would
 * succeed, fail, or diverge against the recorded snapshot.
 *
 *   would_succeed  - every rule in the step resolves against the
 *                    recorded DOM (driver returns ok for each action).
 *   would_fail     - at least one rule raises a driver error (selector
 *                    missing, wrong element kind, etc.) and the step's
 *                    expected selectors are all present in the snapshot.
 *   would_diverge  - the snapshot does not structurally match what the
 *                    current flow expects: any of the step's expected
 *                    `selectors` (or the `primarySelector`) is absent.
 *                    Divergence takes precedence over rule failure - if
 *                    the page shape changed, rule-level outcomes are
 *                    unreliable.
 */

// ----- Input shapes ---------------------------------------------------

export interface ReplayArtifactInput {
  readonly sessionId: string;
  readonly domSnapshots: Buffer;
  readonly domSnapshotsMimeType: string;
  readonly eventBundle: unknown;
  readonly screenshotUrls?: readonly string[];
}

export interface ReplayRuleInput {
  readonly actionType: string;
  readonly stableSelector: string;
  readonly fieldName?: string | null;
  readonly fieldLabel?: string | null;
  readonly ariaLabel?: string | null;
  readonly sampleValue?: string | null;
}

export interface ReplayFlowStepInput {
  readonly stepIndex: number;
  readonly node?: string;
  readonly primarySelector?: string | null;
  readonly selectors?: readonly string[];
  readonly rules: readonly ReplayRuleInput[];
}

export interface ReplayFlowDefinitionInput {
  readonly hostname: string;
  readonly version?: number;
  readonly steps: readonly ReplayFlowStepInput[];
}

// ----- Output shapes --------------------------------------------------

export type ReplayVerdict = 'would_succeed' | 'would_fail' | 'would_diverge';

export interface ReplayRuleReport {
  readonly actionType: string;
  readonly stableSelector: string;
  readonly verdict: ReplayVerdict;
  readonly reason: string | null;
}

export interface ReplayStepReport {
  readonly stepIndex: number;
  readonly node: string | null;
  readonly verdict: ReplayVerdict;
  readonly ruleReports: readonly ReplayRuleReport[];
  readonly divergenceReason: string | null;
  readonly missingSelectors: readonly string[];
}

export interface ReplayReport {
  readonly sessionId: string;
  readonly hostname: string;
  readonly overallVerdict: ReplayVerdict;
  readonly stepReports: readonly ReplayStepReport[];
  readonly stats: {
    readonly stepCount: number;
    readonly wouldSucceed: number;
    readonly wouldFail: number;
    readonly wouldDiverge: number;
  };
  readonly unmatchedRecordedNodes: readonly string[];
}

export interface ReplayOptions {
  /**
   * Match a flow-definition step to a recorded transition.
   * Default: first by `node` equality, then by `stepIndex` position.
   */
  readonly matchTransition?: (
    step: ReplayFlowStepInput,
    transitions: readonly RecordedTransition[],
  ) => RecordedTransition | null;
}

export interface RecordedTransition {
  readonly node: string;
  readonly url: string | null;
  readonly domHtml: string;
  readonly occurredAt: string;
  readonly metadata: Record<string, unknown> | null;
}

// ----- Public entrypoint ---------------------------------------------

export async function replaySession(
  artifact: ReplayArtifactInput,
  flow: ReplayFlowDefinitionInput,
  options: ReplayOptions = {},
): Promise<ReplayReport> {
  const transitions = decodeTransitions(artifact);
  const matchTransition = options.matchTransition ?? defaultMatchTransition;
  const context: FlowContext = {
    mode: 'replay',
    sessionId: artifact.sessionId,
  };

  const stepReports: ReplayStepReport[] = [];
  const matchedNodes = new Set<string>();

  for (const step of flow.steps) {
    const transition = matchTransition(step, transitions);
    if (!transition) {
      stepReports.push({
        divergenceReason: 'no recorded transition matches this step',
        missingSelectors: [
          ...(step.primarySelector ? [step.primarySelector] : []),
          ...(step.selectors ?? []),
        ],
        node: step.node ?? null,
        ruleReports: step.rules.map(rule => ({
          actionType: rule.actionType,
          reason: 'no recorded transition to replay against',
          stableSelector: rule.stableSelector,
          verdict: 'would_diverge',
        })),
        stepIndex: step.stepIndex,
        verdict: 'would_diverge',
      });
      continue;
    }
    matchedNodes.add(transition.node);

    const missingSelectors = findMissingSelectors(step, transition.domHtml);
    if (missingSelectors.length > 0) {
      stepReports.push({
        divergenceReason: `structural selectors missing: ${missingSelectors.join(', ')}`,
        missingSelectors,
        node: transition.node,
        ruleReports: step.rules.map(rule => ({
          actionType: rule.actionType,
          reason: 'skipped: step diverged',
          stableSelector: rule.stableSelector,
          verdict: 'would_diverge',
        })),
        stepIndex: step.stepIndex,
        verdict: 'would_diverge',
      });
      continue;
    }

    const { flowSteps, ruleOfStep } = compileStepRulesIntoFlowSteps(step);
    const harness = startFixtureDriver();
    harness.setDocument({
      html: transition.domHtml,
      url: transition.url ?? undefined,
    });
    const result = await runFlow(flowSteps, harness.driver, context, {
      stopOnError: false,
    });

    const ruleReports = step.rules.map(
      (rule, ruleIdx): ReplayRuleReport => {
        const event = result.events.find(
          e => ruleOfStep[e.stepIndex] === ruleIdx,
        );
        if (!event) {
          return {
            actionType: rule.actionType,
            reason: 'no event emitted',
            stableSelector: rule.stableSelector,
            verdict: 'would_fail',
          };
        }
        if (event.status === 'ok') {
          return {
            actionType: rule.actionType,
            reason: null,
            stableSelector: rule.stableSelector,
            verdict: 'would_succeed',
          };
        }
        return {
          actionType: rule.actionType,
          reason: event.errorMessage ?? 'rule failed',
          stableSelector: rule.stableSelector,
          verdict: 'would_fail',
        };
      },
    );

    const hasFailure = ruleReports.some(r => r.verdict === 'would_fail');
    stepReports.push({
      divergenceReason: null,
      missingSelectors: [],
      node: transition.node,
      ruleReports,
      stepIndex: step.stepIndex,
      verdict: hasFailure ? 'would_fail' : 'would_succeed',
    });
  }

  const stats = {
    stepCount: stepReports.length,
    wouldDiverge: stepReports.filter(s => s.verdict === 'would_diverge').length,
    wouldFail: stepReports.filter(s => s.verdict === 'would_fail').length,
    wouldSucceed: stepReports.filter(s => s.verdict === 'would_succeed').length,
  };

  const overallVerdict: ReplayVerdict =
    stats.wouldDiverge > 0
      ? 'would_diverge'
      : stats.wouldFail > 0
        ? 'would_fail'
        : 'would_succeed';

  const unmatchedRecordedNodes = transitions
    .filter(t => !matchedNodes.has(t.node))
    .map(t => t.node);

  return {
    hostname: flow.hostname,
    overallVerdict,
    sessionId: artifact.sessionId,
    stats,
    stepReports,
    unmatchedRecordedNodes,
  };
}

// ----- Internals ------------------------------------------------------

function decodeTransitions(
  artifact: ReplayArtifactInput,
): RecordedTransition[] {
  const { domSnapshots, domSnapshotsMimeType } = artifact;
  if (domSnapshots.byteLength === 0) return [];

  const rawJson =
    domSnapshotsMimeType === 'application/gzip'
      ? gunzipSync(domSnapshots).toString('utf8')
      : domSnapshots.toString('utf8');

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (error) {
    throw new Error(
      `replay-harness: failed to parse domSnapshots as JSON (${
        error instanceof Error ? error.message : String(error)
      })`,
    );
  }
  if (!Array.isArray(parsed)) {
    throw new Error('replay-harness: domSnapshots must decode to an array');
  }

  return parsed.map((entry, idx): RecordedTransition => {
    if (entry === null || typeof entry !== 'object') {
      throw new Error(`replay-harness: transition[${idx}] is not an object`);
    }
    const record = entry as Record<string, unknown>;
    const node = typeof record.node === 'string' ? record.node : '';
    const domHtml = typeof record.domHtml === 'string' ? record.domHtml : '';
    const url = typeof record.url === 'string' ? record.url : null;
    const occurredAt =
      typeof record.occurredAt === 'string' ? record.occurredAt : '';
    const metadata =
      record.metadata && typeof record.metadata === 'object'
        ? (record.metadata as Record<string, unknown>)
        : null;
    return { domHtml, metadata, node, occurredAt, url };
  });
}

function defaultMatchTransition(
  step: ReplayFlowStepInput,
  transitions: readonly RecordedTransition[],
): RecordedTransition | null {
  if (step.node) {
    const match = transitions.find(t => t.node === step.node);
    if (match) return match;
  }
  return transitions[step.stepIndex] ?? null;
}

function findMissingSelectors(
  step: ReplayFlowStepInput,
  html: string,
): string[] {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const candidates: string[] = [];
  if (step.primarySelector) candidates.push(step.primarySelector);
  if (step.selectors) candidates.push(...step.selectors);

  const missing: string[] = [];
  for (const selector of candidates) {
    try {
      if (!doc.querySelector(selector)) missing.push(selector);
    } catch {
      // An unparsable selector is treated as divergent - the recorded
      // DOM cannot prove the selector is present.
      missing.push(selector);
    }
  }
  return missing;
}

function compileStepRulesIntoFlowSteps(step: ReplayFlowStepInput): {
  flowSteps: FlowStep[];
  ruleOfStep: Record<number, number>;
} {
  const flowSteps: FlowStep[] = [];
  const ruleOfStep: Record<number, number> = {};

  step.rules.forEach((rule, ruleIdx) => {
    const mapped = ruleToFlowStep(rule);
    if (mapped) {
      ruleOfStep[flowSteps.length] = ruleIdx;
      flowSteps.push(mapped);
    }
  });
  return { flowSteps, ruleOfStep };
}

function ruleToFlowStep(rule: ReplayRuleInput): FlowStep | null {
  switch (rule.actionType) {
    case 'fill':
      return {
        selector: rule.stableSelector,
        type: 'fill',
        value: rule.sampleValue ?? 'replay-sample',
      };
    case 'click':
    case 'activate':
      return { selector: rule.stableSelector, type: 'click' };
    case 'select':
      return {
        selector: rule.stableSelector,
        type: 'select',
        value: rule.sampleValue ?? '',
      };
    case 'upload':
      return {
        filePath: '/dev/null/replay.pdf',
        selector: rule.stableSelector,
        type: 'upload',
      };
    default:
      return null;
  }
}
