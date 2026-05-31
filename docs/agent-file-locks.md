# Agent file locks

When `claude-code` and `codex` (and any future agent) edit this repo in
parallel, the only collision risk that can silently corrupt work is two
agents editing the same file at the same time. The plan board tracks
*tasks*; this doc covers the finer-grained question of *files*.

## TL;DR

```bash
# Before your first edit on a file:
bun scripts/agent-lock.ts claim   <file> --agent <handle> --task <id> [--reason "..."]

# After your last edit + commit on that file:
bun scripts/agent-lock.ts release <file> --agent <handle>

# Before claiming, see who else is in flight:
bun scripts/agent-lock.ts list

# Or just check one file:
bun scripts/agent-lock.ts check <file>
```

If `claim` exits 1, the file is held by another agent. Stop. Coordinate
on the plan board ticket via `NOTE_ADDED` (`bun scripts/update-plan-board-task.ts note`).

## Where the locks live

`.agent-locks/` at the repo root, mirroring the project's path layout.
For example, claiming `desktop/electron/submit/lever-submit.ts` writes:

```
.agent-locks/desktop/electron/submit/lever-submit.ts.lock
```

The lock file is JSON:

```json
{
  "agent": "claude-code",
  "claimedAt": "2026-05-08T07:00:00.000Z",
  "taskId": "P17.4",
  "reason": "Lever pre-step routes to /apply"
}
```

Locks are **not committed** (see `.gitignore`). They are filesystem
coordination on Steven's machine, not history.

## Rules

1. **Claim before the first edit.** Not after. The whole point is that
   the second agent can see "this file is busy" before they start
   typing.
2. **Release after the last edit and the commit.** A file you've
   committed but still hold a lock on blocks the other agent for no
   reason.
3. **One agent per file.** If you need to edit a file someone else
   holds, stop, post a `NOTE_ADDED` on the conflicting plan-board task,
   and wait for them to release.
4. **Locks expire on agent crash, not on time.** There is no auto-TTL.
   If you crashed mid-task and another agent confirmed via the plan
   board that you're not active, they may break your lock with
   `release --force --agent <your-handle>`. Don't force-break a lock
   without that confirmation — you will eat their work.
5. **Locks do not replace tests.** A lock prevents *this round* of
   collision; tests prevent the *next* one (when the file is unlocked
   and someone refactors).

## Failure modes

- **You forgot to claim.** Other agent claims while you're editing →
  whoever commits second loses the diff. Mitigation: always claim
  first. The CLI is one command.
- **You forgot to release.** Other agent is blocked. Mitigation: a
  release call at the end of every commit-cycle, or at task-done time.
- **Stale lock from a crash.** Other agent calls `list` and sees a
  lock from minutes/hours ago belonging to a not-running session.
  Confirm via the plan board (event timestamps), then `release --force`.

## When NOT to use a lock

- Reading a file (no lock needed).
- Editing a file you own that nobody else is touching (lock is still
  cheap insurance, but not critical).
- Tiny edits inside a single function while the other agent is in a
  different part of the same file — the lock is per-file, not per-
  region. If you both must touch the same file, the second one waits.
