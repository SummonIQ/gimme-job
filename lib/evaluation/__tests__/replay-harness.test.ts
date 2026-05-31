import { gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import {
  replaySession,
  type ReplayArtifactInput,
  type ReplayFlowDefinitionInput,
} from '../replay-harness.js';

function makeArtifact(
  transitions: Array<{
    node: string;
    domHtml: string;
    url?: string;
    occurredAt?: string;
    metadata?: Record<string, unknown> | null;
  }>,
  sessionId = 'replay-test',
): ReplayArtifactInput {
  const payload = transitions.map(t => ({
    domHtml: t.domHtml,
    metadata: t.metadata ?? null,
    node: t.node,
    occurredAt: t.occurredAt ?? '2026-04-23T12:00:00.000Z',
    url: t.url ?? null,
  }));
  const gz = gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'));
  return {
    domSnapshots: gz,
    domSnapshotsMimeType: 'application/gzip',
    eventBundle: {
      fieldFills: [],
      mode: 'training',
      sessionId,
      transitions: payload,
    },
    sessionId,
  };
}

const CONTACT_HTML = `
<!doctype html>
<html><body>
  <form id="application_form">
    <input id="first_name" name="first_name" />
    <input id="last_name" name="last_name" />
    <input id="email" name="email" />
  </form>
</body></html>`;

const RESUME_HTML = `
<!doctype html>
<html><body>
  <form id="application_form">
    <input id="resume" name="resume" type="file" />
    <button id="continue_btn" type="button">Continue</button>
  </form>
</body></html>`;

const baseFlow: ReplayFlowDefinitionInput = {
  hostname: 'boards.greenhouse.io',
  steps: [
    {
      node: 'contact',
      primarySelector: '#application_form',
      rules: [
        {
          actionType: 'fill',
          fieldName: 'first_name',
          sampleValue: 'Steven',
          stableSelector: '#first_name',
        },
        {
          actionType: 'fill',
          fieldName: 'last_name',
          sampleValue: 'Bennett',
          stableSelector: '#last_name',
        },
        {
          actionType: 'fill',
          fieldName: 'email',
          sampleValue: 'steven@example.com',
          stableSelector: '#email',
        },
      ],
      selectors: ['#first_name', '#last_name', '#email'],
      stepIndex: 0,
    },
    {
      node: 'resume',
      primarySelector: '#application_form',
      rules: [
        {
          actionType: 'upload',
          fieldName: 'resume',
          stableSelector: '#resume',
        },
        {
          actionType: 'click',
          stableSelector: '#continue_btn',
        },
      ],
      selectors: ['#resume', '#continue_btn'],
      stepIndex: 1,
    },
  ],
};

describe('replaySession - positive (clean replay)', () => {
  it('reports every step as would_succeed when rules match the snapshot', async () => {
    const artifact = makeArtifact([
      { domHtml: CONTACT_HTML, node: 'contact' },
      { domHtml: RESUME_HTML, node: 'resume' },
    ]);
    const report = await replaySession(artifact, baseFlow);

    expect(report.overallVerdict).toBe('would_succeed');
    expect(report.stats.stepCount).toBe(2);
    expect(report.stats.wouldSucceed).toBe(2);
    expect(report.stats.wouldFail).toBe(0);
    expect(report.stats.wouldDiverge).toBe(0);

    for (const step of report.stepReports) {
      expect(step.verdict).toBe('would_succeed');
      expect(step.divergenceReason).toBeNull();
      expect(step.missingSelectors).toHaveLength(0);
      for (const rule of step.ruleReports) {
        expect(rule.verdict).toBe('would_succeed');
      }
    }
    expect(report.unmatchedRecordedNodes).toHaveLength(0);
  });
});

describe('replaySession - negative (rule change)', () => {
  it('reports would_fail when a rule selector no longer matches a present-but-different DOM', async () => {
    // Snapshot still has #first_name / #last_name / #email (contact
    // shape) and #resume / #continue_btn (resume shape). The flow
    // has been "updated" - it expects a renamed email field (#work_email)
    // and a renamed continue button (#submit_continue). Structural
    // selectors (primary + step.selectors) are still present in the
    // snapshot, so divergence does NOT fire; instead the per-rule
    // replay fails because the new selector does not resolve.
    const artifact = makeArtifact([
      { domHtml: CONTACT_HTML, node: 'contact' },
      { domHtml: RESUME_HTML, node: 'resume' },
    ]);
    const updatedFlow: ReplayFlowDefinitionInput = {
      ...baseFlow,
      steps: [
        {
          ...baseFlow.steps[0],
          rules: [
            ...baseFlow.steps[0].rules.slice(0, 2),
            {
              actionType: 'fill',
              fieldName: 'email',
              sampleValue: 'steven@example.com',
              stableSelector: '#work_email',
            },
          ],
          // Structural selectors unchanged - step should NOT diverge.
        },
        {
          ...baseFlow.steps[1],
          rules: [
            baseFlow.steps[1].rules[0],
            { actionType: 'click', stableSelector: '#submit_continue' },
          ],
        },
      ],
    };

    const report = await replaySession(artifact, updatedFlow);

    expect(report.overallVerdict).toBe('would_fail');
    expect(report.stats.wouldFail).toBe(2);
    expect(report.stats.wouldDiverge).toBe(0);

    const contactStep = report.stepReports[0];
    expect(contactStep.verdict).toBe('would_fail');
    expect(contactStep.divergenceReason).toBeNull();
    const failedRule = contactStep.ruleReports.find(
      r => r.stableSelector === '#work_email',
    );
    expect(failedRule?.verdict).toBe('would_fail');
    expect(failedRule?.reason).toMatch(/not found|Fill target/);

    const resumeStep = report.stepReports[1];
    expect(resumeStep.verdict).toBe('would_fail');
    const failedClick = resumeStep.ruleReports.find(
      r => r.stableSelector === '#submit_continue',
    );
    expect(failedClick?.verdict).toBe('would_fail');
  });
});

describe('replaySession - divergence (DOM structure changed)', () => {
  it('reports would_diverge when the snapshot is missing expected structural selectors', async () => {
    // Snapshot replaces the whole contact form with a placeholder -
    // none of the flow's expected selectors resolve. Divergence
    // pre-empts rule-level replay.
    const PLACEHOLDER_HTML = `
      <!doctype html>
      <html><body><h1>Server error - please retry</h1></body></html>`;
    const artifact = makeArtifact([
      { domHtml: PLACEHOLDER_HTML, node: 'contact' },
      { domHtml: RESUME_HTML, node: 'resume' },
    ]);

    const report = await replaySession(artifact, baseFlow);

    expect(report.overallVerdict).toBe('would_diverge');
    expect(report.stats.wouldDiverge).toBe(1);
    expect(report.stats.wouldSucceed).toBe(1);

    const contactStep = report.stepReports[0];
    expect(contactStep.verdict).toBe('would_diverge');
    expect(contactStep.divergenceReason).toMatch(/structural selectors missing/);
    expect(contactStep.missingSelectors).toEqual(
      expect.arrayContaining(['#application_form', '#first_name', '#email']),
    );
    for (const rule of contactStep.ruleReports) {
      expect(rule.verdict).toBe('would_diverge');
    }

    // Resume step still succeeds - divergence is per-step, not global.
    expect(report.stepReports[1].verdict).toBe('would_succeed');
  });

  it('reports would_diverge when no recorded transition matches a step', async () => {
    const artifact = makeArtifact([
      { domHtml: CONTACT_HTML, node: 'contact' },
      // No resume transition recorded.
    ]);
    const report = await replaySession(artifact, {
      ...baseFlow,
      steps: [baseFlow.steps[1]],
    });

    expect(report.stepReports).toHaveLength(1);
    expect(report.stepReports[0].verdict).toBe('would_diverge');
    expect(report.stepReports[0].divergenceReason).toMatch(
      /no recorded transition/,
    );
  });
});

describe('replaySession - bookkeeping', () => {
  it('surfaces recorded nodes that never matched a flow step', async () => {
    const artifact = makeArtifact([
      { domHtml: CONTACT_HTML, node: 'contact' },
      { domHtml: RESUME_HTML, node: 'resume' },
      {
        domHtml: '<html><body><h1>Thanks</h1></body></html>',
        node: 'confirmation',
      },
    ]);
    const report = await replaySession(artifact, baseFlow);
    expect(report.unmatchedRecordedNodes).toEqual(['confirmation']);
  });

  it('accepts a custom matchTransition strategy', async () => {
    const artifact = makeArtifact([
      { domHtml: RESUME_HTML, node: 'different-name' },
    ]);
    const flowOneStep: ReplayFlowDefinitionInput = {
      hostname: 'boards.greenhouse.io',
      steps: [baseFlow.steps[1]],
    };
    const report = await replaySession(artifact, flowOneStep, {
      matchTransition: (_step, transitions) => transitions[0] ?? null,
    });
    expect(report.stepReports[0].verdict).toBe('would_succeed');
  });

  it('handles an empty ReplayArtifact as all-diverge', async () => {
    const empty: ReplayArtifactInput = {
      domSnapshots: Buffer.alloc(0),
      domSnapshotsMimeType: 'application/gzip',
      eventBundle: {},
      sessionId: 'empty',
    };
    const report = await replaySession(empty, baseFlow);
    expect(report.overallVerdict).toBe('would_diverge');
    expect(report.stats.wouldDiverge).toBe(2);
  });

  it('tolerates raw (non-gzipped) JSON snapshots', async () => {
    const transitions = [
      {
        domHtml: CONTACT_HTML,
        metadata: null,
        node: 'contact',
        occurredAt: '2026-04-23T12:00:00.000Z',
        url: null,
      },
    ];
    const artifact: ReplayArtifactInput = {
      domSnapshots: Buffer.from(JSON.stringify(transitions), 'utf8'),
      domSnapshotsMimeType: 'application/json',
      eventBundle: {},
      sessionId: 'raw',
    };
    const report = await replaySession(artifact, {
      ...baseFlow,
      steps: [baseFlow.steps[0]],
    });
    expect(report.stepReports[0].verdict).toBe('would_succeed');
  });
});
