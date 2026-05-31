#!/usr/bin/env bun
/**
 * Agent file-lock CLI.
 *
 * When two agents (claude-code + codex) work the same repo in parallel,
 * the only collision risk is two of them editing the same file. This
 * script gives each agent a single command to claim a file before
 * editing and release it when done. Locks live in `.agent-locks/`,
 * mirroring the project's path layout, so collisions are obvious from
 * the directory tree alone.
 *
 *   .agent-locks/
 *     desktop/electron/submit/lever-submit.ts.lock   ← JSON
 *     lib/runtime-provider/closed-posting.ts.lock    ← JSON
 *
 * Each lock file is JSON:
 *   {
 *     "agent":     "claude-code" | "codex" | ...,
 *     "claimedAt": "2026-05-08T07:00:00.000Z",
 *     "taskId":    "P17.1",
 *     "reason":    "typed status enum + emit-site audit"
 *   }
 *
 * Usage:
 *   bun scripts/agent-lock.ts claim   <file> --agent <handle> --task <id> [--reason "..."]
 *   bun scripts/agent-lock.ts release <file> --agent <handle>
 *   bun scripts/agent-lock.ts check   <file>
 *   bun scripts/agent-lock.ts list    [--agent <handle>] [--task <id>]
 *
 * Exit codes:
 *   0  success
 *   1  conflict (lock held by another agent) or "not your lock" on release
 *   2  argument / usage error
 *
 * Convention:
 *   - Claim BEFORE the first edit, release AFTER the last edit + commit.
 *   - If you crash mid-task, your locks are stale. Another agent may
 *     break them with `release --force --agent <other-handle>` IF they
 *     have confirmed via the plan board that you're not active.
 *   - Locks are NOT committed (see .gitignore). They are filesystem
 *     coordination only, not history.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const LOCK_ROOT = resolve(process.cwd(), '.agent-locks');
const LOCK_SUFFIX = '.lock';

interface LockRecord {
  readonly agent: string;
  readonly claimedAt: string;
  readonly taskId: string | null;
  readonly reason: string | null;
}

interface ClaimArgs {
  readonly file: string;
  readonly agent: string;
  readonly taskId: string | null;
  readonly reason: string | null;
}

interface ReleaseArgs {
  readonly file: string;
  readonly agent: string;
  readonly force: boolean;
}

function lockPathFor(file: string): string {
  const repoRelative = relative(process.cwd(), resolve(file));
  if (repoRelative.startsWith('..')) {
    fail(`Refusing to lock ${file} — it is outside the repo.`);
  }
  return join(LOCK_ROOT, `${repoRelative}${LOCK_SUFFIX}`);
}

function readLock(lockPath: string): LockRecord | null {
  if (!existsSync(lockPath)) return null;
  try {
    const raw = readFileSync(lockPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (typeof parsed.agent !== 'string') return null;
    return {
      agent: parsed.agent,
      claimedAt: typeof parsed.claimedAt === 'string' ? parsed.claimedAt : '',
      taskId: typeof parsed.taskId === 'string' ? parsed.taskId : null,
      reason: typeof parsed.reason === 'string' ? parsed.reason : null,
    };
  } catch {
    return null;
  }
}

function writeLock(lockPath: string, record: LockRecord): void {
  mkdirSync(dirname(lockPath), { recursive: true });
  writeFileSync(lockPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
}

function fail(message: string, code = 2): never {
  console.error(message);
  process.exit(code);
}

function ok(message: string): void {
  console.log(message);
}

function parseFlags(rest: readonly string[]): Record<string, string | true> {
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith('--')) {
      fail(`Unexpected positional argument: ${token}`);
    }
    const key = token.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith('--')) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    i += 1;
  }
  return flags;
}

function commandClaim(args: readonly string[]): void {
  const file = args[0];
  if (!file) fail('Usage: claim <file> --agent <handle> [--task <id>] [--reason "..."]');
  const flags = parseFlags(args.slice(1));
  const agent = typeof flags.agent === 'string' ? flags.agent : '';
  if (!agent) fail('--agent <handle> is required.');
  const taskId = typeof flags.task === 'string' ? flags.task : null;
  const reason = typeof flags.reason === 'string' ? flags.reason : null;

  const lockPath = lockPathFor(file);
  const existing = readLock(lockPath);
  if (existing && existing.agent !== agent) {
    fail(
      `LOCKED by ${existing.agent}` +
        (existing.taskId ? ` for ${existing.taskId}` : '') +
        ` since ${existing.claimedAt}.\n` +
        `Coordinate with them via the plan board (NOTE_ADDED) before editing ${file}.`,
      1,
    );
  }
  const record: LockRecord = {
    agent,
    claimedAt: new Date().toISOString(),
    taskId,
    reason,
  };
  writeLock(lockPath, record);
  ok(
    `claimed ${file} for ${agent}` +
      (taskId ? ` (task ${taskId})` : '') +
      `\n  → ${relative(process.cwd(), lockPath)}`,
  );
}

function commandRelease(args: readonly string[]): void {
  const file = args[0];
  if (!file) fail('Usage: release <file> --agent <handle> [--force]');
  const flags = parseFlags(args.slice(1));
  const agent = typeof flags.agent === 'string' ? flags.agent : '';
  if (!agent) fail('--agent <handle> is required.');
  const force = flags.force === true;

  const lockPath = lockPathFor(file);
  const existing = readLock(lockPath);
  if (!existing) {
    ok(`no lock on ${file}; nothing to release.`);
    return;
  }
  if (existing.agent !== agent && !force) {
    fail(
      `Refusing to release a lock held by ${existing.agent}.\n` +
        `Use --force only if you have confirmed they are not active.`,
      1,
    );
  }
  rmSync(lockPath, { force: true });
  ok(
    `released ${file}` +
      (existing.agent === agent ? '' : ` (force-released from ${existing.agent})`),
  );
}

function commandCheck(args: readonly string[]): void {
  const file = args[0];
  if (!file) fail('Usage: check <file>');
  const lockPath = lockPathFor(file);
  const existing = readLock(lockPath);
  if (!existing) {
    ok(`free: ${file}`);
    return;
  }
  ok(
    `LOCKED by ${existing.agent}` +
      (existing.taskId ? ` (${existing.taskId})` : '') +
      ` since ${existing.claimedAt}` +
      (existing.reason ? `: ${existing.reason}` : ''),
  );
}

function commandList(args: readonly string[]): void {
  const flags = parseFlags(args);
  const agentFilter = typeof flags.agent === 'string' ? flags.agent : null;
  const taskFilter = typeof flags.task === 'string' ? flags.task : null;
  if (!existsSync(LOCK_ROOT)) {
    ok('(no active locks)');
    return;
  }

  const rows: Array<{ file: string; lock: LockRecord; lockPath: string }> = [];
  walk(LOCK_ROOT, entry => {
    if (!entry.endsWith(LOCK_SUFFIX)) return;
    const lock = readLock(entry);
    if (!lock) return;
    if (agentFilter && lock.agent !== agentFilter) return;
    if (taskFilter && lock.taskId !== taskFilter) return;
    const fileRelative = relative(LOCK_ROOT, entry).slice(0, -LOCK_SUFFIX.length);
    rows.push({ file: fileRelative, lock, lockPath: entry });
  });

  if (rows.length === 0) {
    ok('(no active locks)');
    return;
  }
  rows.sort((a, b) => a.file.localeCompare(b.file));
  for (const row of rows) {
    ok(
      `${row.lock.agent.padEnd(12)} ${row.file}` +
        (row.lock.taskId ? `  (${row.lock.taskId})` : '') +
        `  since ${row.lock.claimedAt}`,
    );
  }
}

function walk(root: string, onFile: (path: string) => void): void {
  for (const entry of readdirSync(root)) {
    const full = join(root, entry);
    const info = statSync(full);
    if (info.isDirectory()) {
      walk(full, onFile);
    } else {
      onFile(full);
    }
  }
}

function main(): void {
  const [, , command, ...rest] = process.argv;
  switch (command) {
    case 'claim':
      return commandClaim(rest);
    case 'release':
      return commandRelease(rest);
    case 'check':
      return commandCheck(rest);
    case 'list':
      return commandList(rest);
    default:
      fail(
        'Usage:\n' +
          '  bun scripts/agent-lock.ts claim   <file> --agent <handle> [--task <id>] [--reason "..."]\n' +
          '  bun scripts/agent-lock.ts release <file> --agent <handle> [--force]\n' +
          '  bun scripts/agent-lock.ts check   <file>\n' +
          '  bun scripts/agent-lock.ts list    [--agent <handle>] [--task <id>]',
      );
  }
}

main();
