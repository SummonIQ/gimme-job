#!/usr/bin/env bun

import { gzipSync } from 'node:zlib';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  type FlowContext,
  type FlowStep,
  runFlow,
} from '@/lib/applications/flow-executor';
import { startFixtureDriver } from '@/lib/evaluation/fixture-driver';
import {
  FIXTURE_FAMILIES,
  type FixtureFamily,
  type FixtureManifest,
  startFixtureServer,
} from '@/lib/evaluation/fixture-server';
import {
  buildRegressionReport,
  calculatePassRate,
  compareRegressionResults,
  hasCurrentFailures,
  hasRegression,
  parseRegressionSummary,
  type RegressionComparison,
  type RegressionFamilyResult,
} from '@/lib/evaluation/regression-reporter';
import {
  replaySession,
  type ReplayArtifactInput,
  type ReplayFlowDefinitionInput,
  type ReplayRuleInput,
} from '@/lib/evaluation/replay-harness';

export interface RegressionRunOptions {
  readonly now?: Date;
  readonly fixturesRoot?: string;
  readonly reportDir?: string;
  readonly outputPath?: string;
  readonly baselinePath?: string | null;
  readonly thresholdPercentagePoints?: number;
  readonly families?: readonly FixtureFamily[];
}

export interface RegressionRunResult {
  readonly reportPath: string;
  readonly baselinePath: string | null;
  readonly results: readonly RegressionFamilyResult[];
  readonly comparisons: readonly RegressionComparison[];
  readonly markdown: string;
  readonly exitCode: number;
}

interface FixtureField {
  readonly selector: string;
  readonly required?: boolean;
  readonly kind?: string;
}

const DEFAULT_CONTEXT: FlowContext = {
  mode: 'replay',
  sessionId: 'p7-3-regression',
};

export async function runRegression(
  options: RegressionRunOptions = {},
): Promise<RegressionRunResult> {
  const now = options.now ?? new Date();
  const reportDir = path.resolve(options.reportDir ?? 'docs');
  const reportPath = path.resolve(
    options.outputPath ?? path.join(reportDir, `regression-${dateStamp(now)}.md`),
  );
  const threshold = options.thresholdPercentagePoints ?? 5;
  const families = options.families ?? FIXTURE_FAMILIES;
  const baseline = await loadBaseline({
    baselinePath: options.baselinePath,
    reportDir,
    reportPath,
  });

  const server = await startFixtureServer({
    fixturesRoot: options.fixturesRoot,
    latencyMs: 1,
  });

  let results: RegressionFamilyResult[];
  try {
    results = [];
    for (const family of families) {
      results.push(await runFixtureFamily({ baseUrl: server.baseUrl, family }));
    }
  } finally {
    await server.stop();
  }

  const comparisons = compareRegressionResults(
    results,
    baseline.summary,
    threshold,
  );
  const markdown = buildRegressionReport({
    baselinePath: baseline.path,
    comparisons,
    generatedAt: now,
    results,
    thresholdPercentagePoints: threshold,
  });

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, markdown, 'utf8');

  return {
    baselinePath: baseline.path,
    comparisons,
    exitCode:
      hasCurrentFailures(results) || hasRegression(comparisons) ? 1 : 0,
    markdown,
    reportPath,
    results,
  };
}

export function parseRegressionArgs(argv: readonly string[]): RegressionRunOptions {
  const options: {
    now?: Date;
    fixturesRoot?: string;
    reportDir?: string;
    outputPath?: string;
    baselinePath?: string | null;
    thresholdPercentagePoints?: number;
    families?: FixtureFamily[];
  } = {};

  for (const arg of argv) {
    if (arg.startsWith('--date=')) {
      options.now = new Date(`${arg.slice('--date='.length)}T00:00:00.000Z`);
      continue;
    }
    if (arg.startsWith('--fixtures-root=')) {
      options.fixturesRoot = arg.slice('--fixtures-root='.length);
      continue;
    }
    if (arg.startsWith('--report-dir=')) {
      options.reportDir = arg.slice('--report-dir='.length);
      continue;
    }
    if (arg.startsWith('--output=')) {
      options.outputPath = arg.slice('--output='.length);
      continue;
    }
    if (arg.startsWith('--baseline=')) {
      const value = arg.slice('--baseline='.length);
      options.baselinePath = value === 'none' ? null : value;
      continue;
    }
    if (arg.startsWith('--threshold=')) {
      options.thresholdPercentagePoints = Number(arg.slice('--threshold='.length));
      continue;
    }
    if (arg.startsWith('--families=')) {
      options.families = parseFamilies(arg.slice('--families='.length));
    }
  }

  return options;
}

async function runFixtureFamily(input: {
  readonly baseUrl: string;
  readonly family: FixtureFamily;
}): Promise<RegressionFamilyResult> {
  const manifest = await loadManifest(input.baseUrl, input.family);
  const applicationHtml = await fetchText(
    `${input.baseUrl}/fixtures/${input.family}/application`,
  );
  const replayReport = await replaySession(
    createReplayArtifact(input.family, applicationHtml),
    createReplayFlow(manifest),
  );
  const fixtureResult = await runFixtureFlow({
    baseUrl: input.baseUrl,
    manifest,
  });
  const confirmationMatched = await submitFixture({
    baseUrl: input.baseUrl,
    manifest,
  });

  const checks = [
    replayReport.overallVerdict === 'would_succeed',
    fixtureResult.passed,
    confirmationMatched,
  ];
  const notes = [
    ...fixtureResult.notes,
    ...replayReport.stepReports.flatMap(step =>
      step.verdict === 'would_succeed'
        ? []
        : [`replay step ${step.stepIndex}: ${step.divergenceReason ?? step.verdict}`],
    ),
  ];

  return {
    confirmationMatched,
    family: input.family,
    fixturePassed: fixtureResult.passed,
    notes,
    passRate: calculatePassRate(
      checks.filter(Boolean).length,
      checks.length,
    ),
    passedChecks: checks.filter(Boolean).length,
    replayVerdict: replayReport.overallVerdict,
    totalChecks: checks.length,
  };
}

function createReplayArtifact(
  family: FixtureFamily,
  applicationHtml: string,
): ReplayArtifactInput {
  const payload = [
    {
      domHtml: applicationHtml,
      metadata: null,
      node: family,
      occurredAt: new Date(0).toISOString(),
      url: null,
    },
  ];
  return {
    domSnapshots: gzipSync(Buffer.from(JSON.stringify(payload), 'utf8')),
    domSnapshotsMimeType: 'application/gzip',
    eventBundle: { transitions: payload },
    sessionId: `fixture-${family}`,
  };
}

function createReplayFlow(
  manifest: FixtureManifest,
): ReplayFlowDefinitionInput {
  const fields = readFields(manifest);
  const selectors = [
    ...Object.values(fields)
      .filter(field => field.required !== false)
      .map(field => field.selector),
    manifest.submitSelector,
  ];
  return {
    hostname: `${manifest.family}.fixture.local`,
    steps: [
      {
        node: manifest.family,
        primarySelector: manifest.submitSelector,
        rules: [
          ...Object.entries(fields).map(([fieldName, field]) =>
            createReplayRule(fieldName, field),
          ),
          {
            actionType: 'click',
            stableSelector: manifest.submitSelector,
          },
        ],
        selectors,
        stepIndex: 0,
      },
    ],
  };
}

function createReplayRule(
  fieldName: string,
  field: FixtureField,
): ReplayRuleInput {
  return {
    actionType: actionTypeForField(field),
    fieldName,
    sampleValue: sampleValueFor(fieldName, field),
    stableSelector: field.selector,
  };
}

async function runFixtureFlow(input: {
  readonly baseUrl: string;
  readonly manifest: FixtureManifest;
}): Promise<{ passed: boolean; notes: readonly string[] }> {
  const harness = startFixtureDriver();
  const result = await runFlow(
    createFlowSteps(input.baseUrl, input.manifest),
    harness.driver,
    DEFAULT_CONTEXT,
    { stopOnError: false },
  );
  return {
    notes: result.events
      .filter(event => event.status === 'error')
      .map(event => `${event.action} ${event.selector ?? ''}: ${event.errorMessage}`),
    passed: !result.failed,
  };
}

function createFlowSteps(
  baseUrl: string,
  manifest: FixtureManifest,
): FlowStep[] {
  const fields = readFields(manifest);
  return [
    {
      type: 'navigate',
      url: `${baseUrl}/fixtures/${manifest.family}/application`,
    },
    {
      selector: manifest.submitSelector,
      timeoutMs: 1_000,
      type: 'wait_for',
    },
    ...Object.entries(fields).map(([fieldName, field]) =>
      createFlowStep(fieldName, field),
    ),
    { selector: manifest.submitSelector, type: 'scroll_into_view' },
    { selector: manifest.submitSelector, type: 'read_element' },
  ];
}

function createFlowStep(fieldName: string, field: FixtureField): FlowStep {
  const actionType = actionTypeForField(field);
  switch (actionType) {
    case 'upload':
      return {
        filePath: '/tmp/regression-fixture-resume.pdf',
        selector: field.selector,
        type: 'upload',
      };
    case 'select':
      return {
        selector: field.selector,
        type: 'select',
        value: sampleValueFor(fieldName, field),
      };
    case 'click':
      return { selector: field.selector, type: 'click' };
    default:
      return {
        selector: field.selector,
        type: 'fill',
        value: sampleValueFor(fieldName, field),
      };
  }
}

async function submitFixture(input: {
  readonly baseUrl: string;
  readonly manifest: FixtureManifest;
}): Promise<boolean> {
  const form = new FormData();
  for (const [fieldName, field] of Object.entries(readFields(input.manifest))) {
    if (field.kind === 'file') {
      form.append(
        fieldName,
        new Blob(['fixture resume'], { type: 'application/pdf' }),
        'resume.pdf',
      );
    } else {
      form.append(fieldName, sampleValueFor(fieldName, field));
    }
  }
  const response = await fetch(new URL(input.manifest.submitPath, input.baseUrl), {
    body: form,
    method: 'POST',
  });
  const body = await response.text();
  return response.ok && body.includes(input.manifest.confirmationPhrase);
}

async function loadManifest(
  baseUrl: string,
  family: FixtureFamily,
): Promise<FixtureManifest> {
  const response = await fetch(`${baseUrl}/fixtures/${family}/fixture.json`);
  if (!response.ok) {
    throw new Error(`failed to load fixture manifest for ${family}`);
  }
  return (await response.json()) as FixtureManifest;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

function readFields(manifest: FixtureManifest): Record<string, FixtureField> {
  const fields: Record<string, FixtureField> = {};
  for (const [fieldName, raw] of Object.entries(manifest.fields)) {
    const selector =
      typeof raw.selector === 'string' && raw.selector.length > 0
        ? raw.selector
        : null;
    if (!selector) continue;
    fields[fieldName] = {
      kind: typeof raw.kind === 'string' ? raw.kind : undefined,
      required: typeof raw.required === 'boolean' ? raw.required : undefined,
      selector,
    };
  }
  return fields;
}

function actionTypeForField(field: FixtureField): ReplayRuleInput['actionType'] {
  if (field.kind === 'file') return 'upload';
  if (field.kind === 'select') return 'select';
  if (field.kind === 'checkbox' || field.kind === 'radio') return 'click';
  return 'fill';
}

function sampleValueFor(fieldName: string, field: FixtureField): string {
  if (field.kind === 'select' || field.kind === 'checkbox' || field.kind === 'radio') {
    return 'yes';
  }
  const lower = fieldName.toLowerCase();
  if (lower.includes('email')) return 'regression@example.test';
  if (lower.includes('phone')) return '4155550199';
  if (lower.includes('first')) return 'Steven';
  if (lower.includes('last')) return 'Bennett';
  if (lower === 'name') return 'Steven Bennett';
  if (lower.includes('year')) return '8';
  if (lower.includes('country')) return 'United States';
  if (lower.includes('city') || lower.includes('location')) return 'San Francisco';
  if (lower.includes('linkedin')) return 'https://www.linkedin.com/in/example';
  if (lower.includes('org') || lower.includes('employer')) return 'Fixture Co';
  if (lower.includes('additional')) return 'Regression fixture answer';
  return 'Regression fixture value';
}

async function loadBaseline(input: {
  readonly baselinePath?: string | null;
  readonly reportDir: string;
  readonly reportPath: string;
}): Promise<{ path: string | null; summary: Record<string, number> | null }> {
  if (input.baselinePath === null) {
    return { path: null, summary: null };
  }

  const baselinePath =
    input.baselinePath ??
    (await findLatestRegressionReport(input.reportDir, input.reportPath));
  if (!baselinePath) {
    return { path: null, summary: null };
  }

  const markdown = await readFile(baselinePath, 'utf8');
  return {
    path: baselinePath,
    summary: parseRegressionSummary(markdown),
  };
}

async function findLatestRegressionReport(
  reportDir: string,
  outputPath: string,
): Promise<string | null> {
  let entries: string[];
  try {
    entries = await readdir(reportDir);
  } catch {
    return null;
  }
  const output = path.resolve(outputPath);
  const reports = entries
    .filter(entry => /^regression-\d{4}-\d{2}-\d{2}\.md$/.test(entry))
    .map(entry => path.resolve(reportDir, entry))
    .filter(entry => entry !== output)
    .sort();
  return reports.at(-1) ?? null;
}

function parseFamilies(value: string): FixtureFamily[] {
  const families = value.split(',').map(family => family.trim());
  const allowed = new Set<string>(FIXTURE_FAMILIES);
  return families.filter((family): family is FixtureFamily =>
    allowed.has(family),
  );
}

function dateStamp(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function main() {
  const result = await runRegression(parseRegressionArgs(process.argv.slice(2)));
  console.log(`Wrote ${result.reportPath}`);
  if (result.baselinePath) {
    console.log(`Compared against ${result.baselinePath}`);
  }
  process.exitCode = result.exitCode;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
