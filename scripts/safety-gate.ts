#!/usr/bin/env bun
/**
 * P16.1 — pre-submission safety gate.
 *
 * Usage:
 *   bun run scripts/safety-gate.ts --target=<hostname> [--user=<userId|email>] [--action-type=submit] [--json]
 *
 * Exit codes:
 *   0 — every check passed
 *   1 — one or more checks failed (see JSON/pretty output for codes)
 *   2 — bad CLI arguments
 */

import { runAllChecks, type ReasonCode } from '@/lib/runtime-safety/checks';
import { db } from '@/lib/db/client';

interface ParsedArgs {
  readonly target: string;
  readonly user: string | null;
  readonly actionType: string;
  readonly json: boolean;
}

function parseArgs(argv: readonly string[]): ParsedArgs | { error: string } {
  let target: string | null = null;
  let user: string | null = null;
  let actionType = 'submit';
  let json = false;

  for (const raw of argv.slice(2)) {
    if (raw === '--json') {
      json = true;
      continue;
    }
    const [key, ...rest] = raw.split('=');
    const value = rest.join('=') || '';
    if (key === '--target') target = value;
    else if (key === '--user') user = value;
    else if (key === '--action-type') actionType = value || 'submit';
    else if (!raw.startsWith('--')) continue;
    else return { error: `Unknown flag: ${raw}` };
  }

  if (!target) return { error: '--target=<hostname> is required' };
  return { actionType, json, target, user };
}

async function resolveUserId(user: string | null): Promise<string | null> {
  if (!user) return null;
  if (user.includes('@')) {
    const row = await db.user.findUnique({
      select: { id: true },
      where: { email: user },
    });
    return row?.id ?? null;
  }
  return user;
}

function renderPretty(report: Awaited<ReturnType<typeof runAllChecks>>): string {
  const lines = [`safety-gate report for ${report.hostname}:`];
  for (const check of report.checks) {
    const mark = check.ok ? 'ok' : 'FAIL';
    const reason = check.reasonCode ? ` [${check.reasonCode}]` : '';
    lines.push(`  ${mark.padEnd(4)} ${check.name}${reason} — ${check.detail}`);
  }
  if (report.ok) {
    lines.push('result: OK');
  } else {
    lines.push(`result: FAIL (${report.failingReasons.join(', ')})`);
  }
  return lines.join('\n');
}

export interface MainOptions {
  readonly argv?: readonly string[];
  readonly exit?: (code: number) => never;
  readonly stdout?: (text: string) => void;
}

export async function main(opts: MainOptions = {}): Promise<{
  readonly code: 0 | 1 | 2;
  readonly reasonCodes: readonly ReasonCode[];
}> {
  const argv = opts.argv ?? process.argv;
  const stdout = opts.stdout ?? ((t: string) => process.stdout.write(`${t}\n`));

  const parsed = parseArgs(argv);
  if ('error' in parsed) {
    stdout(`safety-gate: ${parsed.error}`);
    return { code: 2, reasonCodes: [] };
  }

  const userId = await resolveUserId(parsed.user);
  const report = await runAllChecks({
    actionType: parsed.actionType,
    hostname: parsed.target,
    userId: userId ?? undefined,
  });

  if (parsed.json) {
    stdout(JSON.stringify(report, null, 2));
  } else {
    stdout(renderPretty(report));
  }

  return { code: report.ok ? 0 : 1, reasonCodes: report.failingReasons };
}

// CLI entrypoint
if (import.meta.main) {
  main()
    .then(result => {
      process.exit(result.code);
    })
    .catch(err => {
      console.error('safety-gate error:', err);
      process.exit(1);
    });
}
