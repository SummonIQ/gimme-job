'use client';

import { useMemo, useState } from 'react';

import type { FailureSignal } from './failure-signals';

// Hostname → desktop runner file. Used by buildFixPrompt to point the agent
// directly at the file that needs editing instead of asking it to figure out
// which runner handles which ATS.
const RUNNER_BY_HOST: ReadonlyArray<{
  readonly pattern: RegExp;
  readonly file: string;
  readonly label: string;
}> = [
  { pattern: /(?:job-?boards?\.)?greenhouse\.io|boards\.greenhouse\.io/i, file: 'desktop/electron/submit/greenhouse-submit.ts', label: 'Greenhouse' },
  { pattern: /(?:jobs|job-boards)\.ashbyhq\.com/i, file: 'desktop/electron/submit/ashby-submit.ts', label: 'Ashby' },
  { pattern: /jobs\.lever\.co/i, file: 'desktop/electron/submit/lever-submit.ts', label: 'Lever' },
  { pattern: /apply\.workable\.com|jobs\.workable\.com/i, file: 'desktop/electron/submit/workable-submit.ts', label: 'Workable' },
  { pattern: /jobs\.smartrecruiters\.com|careers\.smartrecruiters\.com/i, file: 'desktop/electron/submit/smartrecruiters-submit.ts', label: 'SmartRecruiters' },
  { pattern: /\.recruitee\.com/i, file: 'desktop/electron/submit/recruitee-submit.ts', label: 'Recruitee' },
  { pattern: /\.teamtailor\.com/i, file: 'desktop/electron/submit/teamtailor-submit.ts', label: 'Teamtailor' },
  { pattern: /\.jobvite\.com/i, file: 'desktop/electron/submit/jobvite-submit.ts', label: 'Jobvite' },
  { pattern: /\.bamboohr\.com/i, file: 'desktop/electron/submit/bamboohr-submit.ts', label: 'BambooHR' },
  { pattern: /\.personio\.(com|de)/i, file: 'desktop/electron/submit/personio-submit.ts', label: 'Personio' },
  { pattern: /\.breezy\.hr/i, file: 'desktop/electron/submit/breezy-submit.ts', label: 'BreezyHR' },
  { pattern: /\.myworkdayjobs\.com|workday\.com/i, file: 'desktop/electron/submit/workday-submit.ts', label: 'Workday' },
  { pattern: /icims\.com/i, file: 'desktop/electron/submit/icims-submit.ts', label: 'iCIMS' },
  { pattern: /taleo\.net/i, file: 'desktop/electron/submit/taleo-submit.ts', label: 'Taleo' },
];

function identifyRunner(url: string): { file: string; label: string } {
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    return { file: 'desktop/electron/submit/generic-submit.ts', label: 'generic (unknown URL)' };
  }
  for (const entry of RUNNER_BY_HOST) {
    if (entry.pattern.test(host)) {
      return { file: entry.file, label: entry.label };
    }
  }
  return { file: 'desktop/electron/submit/generic-submit.ts', label: `generic (${host})` };
}

// Categorize the failure to point at the specific function/symbol the agent
// should open. Pattern-matches the message + tool-call trace; returns the
// most specific bullet first.
function identifyFixTargets(row: SubmissionRow): readonly string[] {
  const targets: string[] = [];
  const message = (row.message ?? '').toLowerCase();
  const failedCalls = row.toolCalls.filter(c => !c.ok);
  const failedTools = new Set(failedCalls.map(c => c.tool));
  const reasonsLower = row.toolCalls.map(c => (c.reason ?? '').toLowerCase());
  const allReasons = reasonsLower.join(' | ');

  // 1. "Confirmation didn't show within 30s" — submit fired, runner didn't
  // detect the post-submit page. Almost always a missing pattern.
  if (
    /did not show a confirmation page|no confirmation/i.test(row.message ?? '') ||
    /submit click fired/i.test(row.message ?? '')
  ) {
    targets.push(
      '`waitForSubmissionConfirmation` in desktop/electron/submit/greenhouse-submit.ts (lines ~745–870). Likely missing a confirmation pattern: extend `SUBMISSION_CONFIRMATION_TEXT_PATTERNS`, `SUBMISSION_CONFIRMATION_URL_PATTERNS`, or `CONFIRMATION_CONTAINER_PATTERNS` with whatever the live page is rendering.',
    );
  }

  // 2. Required-field-still-empty — collectUnansweredQuestions found a
  // required field the runner couldn't fill.
  if (
    /required field.*still empty/i.test(row.message ?? '') ||
    row.signals.some(s => /required.*empty|missing.*field/i.test(s.title))
  ) {
    targets.push(
      '`collectUnansweredQuestions` + `resolveRemainingFieldsWithLlm` in desktop/electron/submit/greenhouse-submit.ts. The LLM fallback either skipped the field (empty answer / low-confidence drop) or `selectOptionalAll` couldn\'t match an option. Check `pickBestSelectMatch` in desktop/electron/tools/electron-driver.ts for option-matching gaps and `resolveDeterministicAnswer` in lib/field-answer/resolve.ts for missing profile-field cases.',
    );
  }

  // 3. Wrong answer despite profile field set (gender/race/etc.). Symptom:
  // a fill SUCCEEDED but the user reported the value was wrong.
  if (
    /wrong (?:gender|value|answer|option)/i.test(row.message ?? '') ||
    row.signals.some(s => /wrong/i.test(s.title))
  ) {
    targets.push(
      '`resolveDeterministicAnswer` in lib/field-answer/resolve.ts (lines ~692–940). Add or extend the deterministic case for the affected profile field so it matches options before falling through to the LLM. Use `pickProfileFieldAnswer` with a synonym table.',
    );
  }

  // 4. Validation error from the form post-submit.
  if (
    /validation error/i.test(row.message ?? '') ||
    failedTools.has('fill') ||
    failedTools.has('select')
  ) {
    targets.push(
      '`detectValidationErrors` in desktop/electron/submit/greenhouse-submit.ts (~line 920). Read the actual error text from the run-log trace and either fix the upstream fill (wrong format/value) or add a re-prompt path that re-resolves the field with the validation message in context.',
    );
  }

  // 5. Resume / cover letter file uploaded into wrong slot.
  if (
    /cover.?letter/i.test(allReasons) ||
    /resume.*cover/i.test(row.message ?? '')
  ) {
    targets.push(
      '`GREENHOUSE_RESUME_SELECTOR` (~line 144) and `loadGreenhouseFieldSelectors().resume` (~line 1270) in desktop/electron/submit/greenhouse-submit.ts. Tighten the selector / add a `negativeLabelPatterns: [/cover.letter/i]` filter so the resume PDF can\'t land in the cover-letter file input.',
    );
  }

  // 6. Anti-bot disclosure paused for manual review (informational, not a bug).
  if (/manual review.*disclosure|anti-bot/i.test(row.message ?? '')) {
    targets.push(
      '`findAutomationDisclosureChallenge` in desktop/electron/submit/greenhouse-submit.ts (~line 1659). This pause is intentional — submit-mode runs halt on human-vs-automation questions. Only investigate if the question wasn\'t actually a bot-check (false positive in `AUTOMATION_DISCLOSURE_TEXT_PATTERNS`).',
    );
  }

  // 7. Phone-format mismatch / intl-tel-input drift.
  if (failedTools.has('fill') && /phone/i.test(allReasons)) {
    targets.push(
      '`fillWithVerification` + the phone-stable retry block in desktop/electron/submit/greenhouse-submit.ts (~lines 380–450). Either the country dial-code prefix is missing (check `withDialCode` in app/api/desktop/profile/route.ts) or the keystroke fallback `typePhoneDigitsByKeystroke` needs the format the form expects.',
    );
  }

  // 8. Verification-code field — usually a deliverability issue, not code.
  if (failedCalls.some(c => /verification.code/i.test(c.reason ?? ''))) {
    targets.push(
      '`isVerificationCodeField` + the polling block in `resolveRemainingFieldsWithLlm` (desktop/electron/submit/greenhouse-submit.ts ~line 1763). Check the inbox/webhook path (`app/api/webhooks/improvmx/route.ts`) — the code was likely never received by the time the 24s lookup window expired.',
    );
  }

  // 9. Generic fallback — give the agent the right area at least.
  if (targets.length === 0) {
    targets.push(
      'Start with the runner identified above. Read the failed tool-call trace below; each entry includes the selector and error message that should pinpoint the failing step.',
    );
  }
  return targets;
}

// Build a structured prompt the user can paste into a coding agent (Claude
// Code, Codex, Cursor, etc.) to fix whatever made this run fail. The prompt
// pre-identifies the runner file, the likely-affected function(s), and the
// raw trace so the agent can go straight to the fix without re-investigating.
function buildFixPrompt(row: SubmissionRow): string {
  const lines: string[] = [];
  const runner = identifyRunner(row.submissionUrl);
  const targets = identifyFixTargets(row);

  lines.push(
    `A desktop runner submission failed in gimme-job. The runner that handles this URL is **${runner.label}** at \`${runner.file}\`. Open that file (and any helpers it imports from desktop/electron/submit/greenhouse-submit.ts) and apply the fix described below.`,
  );
  lines.push('');
  lines.push('## Where the bug likely lives');
  for (const target of targets) {
    lines.push(`- ${target}`);
  }
  lines.push('');
  lines.push('## Failure context');
  if (row.jobTitle || row.company) {
    lines.push(
      `- Job: ${row.jobTitle ?? '?'}${row.company ? ` @ ${row.company}` : ''}`,
    );
  }
  lines.push(`- Application URL: ${row.submissionUrl || '(unknown)'}`);
  if (row.mode) lines.push(`- Mode: ${row.mode}`);
  lines.push(`- Status: ${row.status}`);
  lines.push(`- When: ${new Date(row.createdAt).toISOString()}`);
  if (typeof row.toolCallCount === 'number') {
    lines.push(`- Tool calls executed: ${row.toolCallCount}`);
  }
  if (row.message) {
    lines.push('');
    lines.push('## Raw message');
    lines.push('```');
    lines.push(row.message);
    lines.push('```');
  }
  if (row.signals.length > 0) {
    lines.push('');
    lines.push('## Surfaced failure signals');
    for (const signal of row.signals) {
      lines.push(`- **${signal.title}** — ${signal.detail}`);
      lines.push(`  Recommendation: ${signal.recommendation}`);
      if (signal.profileFieldHint) {
        lines.push(`  Profile field: \`${signal.profileFieldHint}\``);
      }
    }
  }
  if (row.validationFailures.length > 0) {
    lines.push('');
    lines.push('## Structured validation errors');
    for (const failure of row.validationFailures) {
      lines.push(
        `- ${failure.fieldLabel}: ${failure.message}${
          failure.fieldSelector ? ` (${failure.fieldSelector})` : ''
        }`,
      );
    }
  }
  const failedCalls = row.toolCalls.filter(call => !call.ok);
  if (failedCalls.length > 0) {
    lines.push('');
    lines.push(`## Failed tool calls (${failedCalls.length})`);
    for (const call of failedCalls.slice(0, 20)) {
      const parts = [call.tool];
      if (call.selector) parts.push(`selector="${call.selector}"`);
      if (call.reason) parts.push(`reason="${call.reason}"`);
      if (call.errorMessage) parts.push(`error="${call.errorMessage}"`);
      lines.push(`- ${parts.join(' · ')}`);
    }
    if (failedCalls.length > 20) {
      lines.push(`- (+${failedCalls.length - 20} more truncated)`);
    }
  }
  if (row.toolCalls.length > 0 && failedCalls.length === 0) {
    lines.push('');
    lines.push('## Last tool calls (for context — none reported failure)');
    for (const call of row.toolCalls.slice(-8)) {
      const parts = [`${call.ok ? '✓' : '✗'} ${call.tool}`];
      if (call.reason) parts.push(call.reason);
      if (call.selector) parts.push(`[${call.selector}]`);
      lines.push(`- ${parts.join(' · ')}`);
    }
  }
  lines.push('');
  lines.push('## What to do');
  lines.push(
    `1. Open \`${runner.file}\` (and any imports from greenhouse-submit.ts it uses).`,
  );
  lines.push(
    '2. Apply a targeted fix to the function(s) named in "Where the bug likely lives" above.',
  );
  lines.push(
    '3. Add a regression test in desktop/electron/submit/__tests__/greenhouse-submit.test.ts (or the runner-specific test file) covering this exact failure.',
  );
  lines.push(
    '4. Show me the diff + a one-line rationale before committing.',
  );
  return lines.join('\n');
}

export interface SubmissionToolCall {
  readonly tool: string;
  readonly ok: boolean;
  readonly reason: string | null;
  readonly errorMessage: string | null;
  readonly selector: string | null;
}

export interface SubmissionValidationFailure {
  readonly fieldLabel: string;
  readonly fieldSelector: string;
  readonly message: string;
}

export interface SubmissionFailureArtifacts {
  readonly capturedAt: string | null;
  readonly domUrl: string | null;
  readonly error: string | null;
  readonly screenshotUrl: string | null;
}

export interface SubmissionRow {
  readonly id: string;
  readonly createdAt: string;
  readonly submissionUrl: string;
  readonly submittedAt: string | null;
  readonly status: string;
  readonly providerLabel: string;
  readonly providerReadiness:
    | 'production'
    | 'beta'
    | 'manual_review'
    | 'unsupported';
  readonly mode: string | null;
  readonly message: string | null;
  readonly failureArtifacts: SubmissionFailureArtifacts | null;
  readonly toolCallCount: number | null;
  readonly jobTitle: string | null;
  readonly company: string | null;
  readonly signals: readonly FailureSignal[];
  readonly toolCalls: readonly SubmissionToolCall[];
  readonly validationFailures: readonly SubmissionValidationFailure[];
}

type StatusFilter = 'all' | 'failed' | 'completed' | 'unavailable';

export function SubmissionsTable({
  rows,
}: {
  readonly rows: readonly SubmissionRow[];
}) {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter(row =>
      filter === 'failed'
        ? /failed/i.test(row.status) || row.signals.length > 0
        : row.status.toLowerCase().includes(filter),
    );
  }, [filter, rows]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 text-sm">
        {(['all', 'failed', 'completed', 'unavailable'] as const).map(option => (
          <button
            className={
              option === filter
                ? 'rounded border border-blue-500 bg-blue-500/10 px-3 py-1'
                : 'rounded border border-border px-3 py-1 hover:bg-muted'
            }
            key={option}
            onClick={() => setFilter(option)}
            type="button"
          >
            {option}
          </button>
        ))}
        <span className="ml-auto self-center text-muted-foreground">
          {filtered.length} of {rows.length}
        </span>
      </div>
      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Job</th>
              <th className="px-3 py-2">Provider</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Signals</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(row => (
              <SubmissionRowItem
                expanded={expanded === row.id}
                key={row.id}
                onToggle={() =>
                  setExpanded(current => (current === row.id ? null : row.id))
                }
                row={row}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-muted-foreground" colSpan={6}>
                  No submissions match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CopyFixPromptButton({ row }: { readonly row: SubmissionRow }) {
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const prompt = useMemo(() => buildFixPrompt(row), [row]);

  const handleCopy = () => {
    void navigator.clipboard
      .writeText(prompt)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        // Fall back to showing the prompt so the user can manually select.
        setShowPrompt(true);
      });
  };

  return (
    <div className="rounded border border-blue-500/30 bg-blue-500/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-blue-300">
            Agent fix prompt
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Paste into Claude Code / Codex to investigate and propose a fix.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
            onClick={() => setShowPrompt(value => !value)}
            type="button"
          >
            {showPrompt ? 'Hide' : 'Preview'}
          </button>
          <button
            className={
              copied
                ? 'rounded border border-emerald-500 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300'
                : 'rounded border border-blue-500 bg-blue-500/10 px-3 py-1 text-xs hover:bg-blue-500/20'
            }
            onClick={handleCopy}
            type="button"
          >
            {copied ? 'Copied ✓' : 'Copy fix prompt'}
          </button>
        </div>
      </div>
      {showPrompt && (
        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded border border-border bg-background p-3 font-mono text-xs">
          {prompt}
        </pre>
      )}
    </div>
  );
}

function SubmissionRowItem({
  row,
  expanded,
  onToggle,
}: {
  readonly row: SubmissionRow;
  readonly expanded: boolean;
  readonly onToggle: () => void;
}) {
  const isFailed =
    /failed/i.test(row.status) ||
    row.signals.length > 0 ||
    row.validationFailures.length > 0;
  return (
    <>
      <tr className={isFailed ? 'border-t border-border bg-rose-500/5' : 'border-t border-border'}>
        <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
          {new Date(row.createdAt).toLocaleString()}
        </td>
        <td className="px-3 py-2">
          <div className="font-medium">
            {row.jobTitle ?? row.submissionUrl}
          </div>
          {row.company && (
            <div className="text-xs text-muted-foreground">{row.company}</div>
          )}
          <a
            className="block text-xs text-blue-500 hover:underline"
            href={row.submissionUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {row.submissionUrl}
          </a>
        </td>
        <td className="whitespace-nowrap px-3 py-2">
          <div className="font-medium">{row.providerLabel}</div>
          <span
            className={
              row.providerReadiness === 'production'
                ? 'rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300'
                : row.providerReadiness === 'unsupported'
                  ? 'rounded bg-rose-500/15 px-2 py-0.5 text-xs text-rose-300'
                  : row.providerReadiness === 'manual_review'
                    ? 'rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300'
                    : 'rounded bg-blue-500/15 px-2 py-0.5 text-xs text-blue-300'
            }
          >
            {row.providerReadiness.replaceAll('_', ' ')}
          </span>
        </td>
        <td className="whitespace-nowrap px-3 py-2">
          <span
            className={
              isFailed
                ? 'rounded bg-rose-500/15 px-2 py-0.5 text-rose-300'
                : 'rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-300'
            }
          >
            {row.status}
          </span>
        </td>
        <td className="px-3 py-2">
          {row.signals.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <ul className="list-disc pl-4">
              {row.signals.slice(0, 3).map((signal, index) => (
                <li key={index}>{signal.title}</li>
              ))}
              {row.signals.length > 3 && (
                <li className="text-muted-foreground">
                  +{row.signals.length - 3} more
                </li>
              )}
            </ul>
          )}
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-right">
          <button
            className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
            onClick={onToggle}
            type="button"
          >
            {expanded ? 'Hide' : 'Details'}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-border bg-muted/20">
          <td className="px-3 py-3" colSpan={6}>
            <div className="space-y-3">
              {isFailed && <CopyFixPromptButton row={row} />}
              {row.message && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Raw message
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{row.message}</p>
                </div>
              )}
              {row.signals.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    What you can do
                  </div>
                  <ul className="space-y-2">
                    {row.signals.map((signal, index) => (
                      <li
                        className="rounded border border-border bg-background p-3"
                        key={index}
                      >
                        <div className="font-medium">{signal.title}</div>
                        <p className="mt-1 text-sm">{signal.detail}</p>
                        <p className="mt-2 text-sm text-emerald-300">
                          → {signal.recommendation}
                        </p>
                        {signal.profileFieldHint && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Profile field: <code>{signal.profileFieldHint}</code>
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {row.validationFailures.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Validation errors
                  </div>
                  <ul className="mt-1 space-y-2">
                    {row.validationFailures.map((failure, index) => (
                      <li
                        className="rounded border border-border bg-background p-3"
                        key={`${failure.fieldSelector}-${index}`}
                      >
                        <div className="font-medium">{failure.fieldLabel}</div>
                        <p className="mt-1 text-sm">{failure.message}</p>
                        {failure.fieldSelector && (
                          <p className="mt-1 font-mono text-xs text-muted-foreground">
                            {failure.fieldSelector}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {row.failureArtifacts && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Failure artifacts
                  </div>
                  {row.failureArtifacts.error ? (
                    <p className="mt-1 text-sm text-rose-300">
                      {row.failureArtifacts.error}
                    </p>
                  ) : (
                    <div className="mt-1 flex flex-wrap gap-2 text-sm">
                      {row.failureArtifacts.screenshotUrl && (
                        <a
                          className="rounded border border-border px-2 py-1 text-blue-500 hover:bg-muted hover:underline"
                          href={row.failureArtifacts.screenshotUrl}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          Screenshot
                        </a>
                      )}
                      {row.failureArtifacts.domUrl && (
                        <a
                          className="rounded border border-border px-2 py-1 text-blue-500 hover:bg-muted hover:underline"
                          href={row.failureArtifacts.domUrl}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          DOM snapshot
                        </a>
                      )}
                      {row.failureArtifacts.capturedAt && (
                        <span className="self-center text-xs text-muted-foreground">
                          {new Date(
                            row.failureArtifacts.capturedAt,
                          ).toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
              {row.toolCalls.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Tool-call trace ({row.toolCalls.length})
                  </div>
                  <ol className="mt-1 max-h-64 space-y-1 overflow-auto rounded border border-border bg-background p-2 font-mono text-xs">
                    {row.toolCalls.map((call, index) => (
                      <li
                        className={
                          call.ok
                            ? 'text-foreground'
                            : 'text-rose-400'
                        }
                        key={index}
                      >
                        <span className="font-bold">
                          {call.ok ? '✓' : '✗'} {call.tool}
                        </span>
                        {call.reason ? ` — ${call.reason}` : ''}
                        {call.selector ? ` [${call.selector}]` : ''}
                        {call.errorMessage ? ` :: ${call.errorMessage}` : ''}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div>
                  <span>Mode</span>
                  <div className="text-foreground">{row.mode ?? '—'}</div>
                </div>
                {typeof row.toolCallCount === 'number' && (
                  <div>
                    <span>Tool calls</span>
                    <div className="text-foreground">{row.toolCallCount}</div>
                  </div>
                )}
                {row.submittedAt && (
                  <div>
                    <span>Submitted at</span>
                    <div className="text-foreground">
                      {new Date(row.submittedAt).toLocaleString()}
                    </div>
                  </div>
                )}
                <div>
                  <span>Submission ID</span>
                  <div className="font-mono text-foreground">{row.id}</div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
