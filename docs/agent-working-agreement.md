# Agent working agreement

This is the canonical "how to be an agent on this repo" guide. Read it before
your first edit. It supersedes any older instructions you find in
`FINAL_PLAN.md` (which now points here).

Audience: `claude-code`, `codex`, `copilot`, and any future agent handle. Steven
does not need to read this document — it exists for you.

## Three rules above all else

1. **One ticket IN_PROGRESS at a time.** Flip back to TODO (not BLOCKED) if you
   can't finish in this session — another agent will pick it up later.
2. **No pushes, PRs, or merges.** Local commits only. CI costs money; Steven
   runs CI manually when he wants it.
3. **Always claim file locks before editing.** Always release after committing.

## Agent handle

Use one of these, never anything else:

- `claude-code`
- `codex`
- `copilot`

If you need a new handle (a new agent enters the repo), Steven adds it to the
allowlist in `lib/admin/plan-board.ts` first. Don't invent variants like
`claude` or use Steven's email address as a handle — those get filtered out of
the dashboard and your work won't be visible.

## Setup (once per session)

```bash
export PLAN_BOARD_BASE_URL=http://localhost:10100
export PLAN_BOARD_AGENT=<your-handle>
export PLAN_BOARD_COOKIE_FILE=/tmp/gimme-job-plan-board-cookies-<your-handle>.txt
export PLAN_BOARD_EMAIL=bright-and-early@outlook.com
export PLAN_BOARD_PASSWORD=12341234
```

Use a separate cookie file per agent so sessions don't clobber each other.

## Find the next ticket

Read `FINAL_PLAN.md`. Pick the lowest-numbered ticket that satisfies ALL of:

- Status is `[ ]` (TODO, unclaimed) — not `[>]`, `[x]`, or `[!]`.
- Every `Depends on:` task is `[x]` (DONE).
- No HTML comment showing another agent claimed it (e.g.
  `<!-- claimed: claude-code 2026-05-08T13:08:00Z -->`).
- You can plausibly finish it in one session.

Phase 18 (Job Scrapers, P18.1–P18.41) is the freshest backlog. P17 still has
open tickets too. Foundation tickets (P18.1, P18.2, P18.3, P18.4, P18.30)
unblock most of the rest — start there if free. Don't claim P18.28 or P18.29
(test infra / admin dashboard) until at least 5 of their dependencies are
`[x]`.

## Claim a ticket

```bash
bun scripts/update-plan-board-task.ts <TASK_ID> start \
  --agent <your-handle> \
  --message "Starting from fresh origin/main worktree."
```

Then in `FINAL_PLAN.md`, flip the checkbox manually:

```
- [ ] **PXX.YY** ...   →   - [>] **PXX.YY** ... <!-- claimed: <handle> <ISO-8601-UTC> -->
```

## One ticket at a time. Always.

You may have **only one** ticket in IN_PROGRESS at any time. When you finish
working on a ticket — successful, partial, or stuck — follow this decision
tree:

- **Did you complete acceptance + tests + commit?** Mark DONE, then claim
  the next.
- **Are you stopping to checkpoint, or running out of session time?** Mark
  TODO with a "handed off" note. Do **not** leave it IN_PROGRESS. Another
  agent may finish it. Do **not** also claim a new ticket — finish the
  checkpoint cycle first.
- **Did you hit a real external blocker** (missing API access, ambiguous
  spec, upstream service down, dependency someone else hasn't finished)?
  Mark BLOCKED:

  ```bash
  bun scripts/update-plan-board-task.ts <TASK_ID> block \
    --agent <your-handle> \
    --message "Blocked because <specific external blocker>. Cannot proceed without <what's needed>."
  ```

  Then you **may** claim a different unblocked ticket — but if you don't,
  leave the board cleanly and stop. Never stay IN_PROGRESS while blocked.
  Never work in parallel on a second ticket while the first is IN_PROGRESS.

If you find yourself thinking "I'll keep this IN_PROGRESS while I poke at
something else" — stop. Move it to BLOCKED or TODO first. The kanban must
always reflect ground truth: **IN_PROGRESS means actively typing.**

## Lock files BEFORE editing

For every file the ticket touches, claim a lock first:

```bash
bun scripts/agent-lock.ts claim <file> --agent <your-handle> --task <TASK_ID> \
  --reason "<short reason>"
```

Locks live in `.agent-locks/` (gitignored). If `claim` exits 1, the file is
held by another agent — **stop**. Add a NOTE_ADDED on their ticket and pick
a different ticket:

```bash
bun scripts/update-plan-board-task.ts <THEIR_TASK_ID> note \
  --agent <your-handle> \
  --message "I need <file> for <my-task>. Will wait for release."
```

To see all current locks:

```bash
bun scripts/agent-lock.ts list
```

To check one file:

```bash
bun scripts/agent-lock.ts check <file>
```

**Never force-break someone else's lock** without first confirming on the
plan board that the holder is dead. `release --force` will eat their work
if they're alive.

Full reference: [`docs/agent-file-locks.md`](agent-file-locks.md).

## Do the work

- Follow the ticket's `Acceptance:` and `Tests required:` fields literally.
- Tests run via `bunx vitest run <path>` (NOT `bun test` — that uses Bun's
  runner without jsdom). For desktop typecheck use
  `desktop/tsconfig.electron.json`.
- Stay inside the files listed in the ticket's `Files:` field. If you need
  a file that's NOT listed, that's a sign the ticket scope is off — add a
  NOTE rather than silently expanding scope.
- Match the project's code style (`CLAUDE.md` project section). No emojis
  in code unless explicitly asked. No comments explaining WHAT — only
  non-obvious WHY.
- For Phase 18 scrapers specifically: every scraper MUST drop non-US
  postings at fetch time via P18.30's `isUsLocation` utility. US-only is
  non-negotiable.

## Commit

One commit per completed ticket, message format:

```
<TASK_ID>: <short summary>

<one paragraph of detail if needed>
```

Do **not** use `--no-verify`. Do **not** amend. Do **not** push.

## Release locks + finish

Release every lock you claimed for this ticket:

```bash
bun scripts/agent-lock.ts release <file> --agent <your-handle>
```

Then either DONE or TODO via the plan-board CLI.

If everything passed and is committed:

```bash
bun scripts/update-plan-board-task.ts <TASK_ID> done \
  --agent <your-handle> \
  --message "Completed locally. <one-line what changed>. No push/CI/deploy."
```

If you couldn't finish (out of time, scope ambiguity, etc):

```bash
bun scripts/update-plan-board-task.ts <TASK_ID> todo \
  --agent <your-handle> \
  --message "Local commits at <SHA>. Stopping here so another agent can pick up. Remaining: <what's left>."
```

In `FINAL_PLAN.md`, flip the checkbox to match:

- `[>]` → `[x]` with `<!-- done: <handle> <ISO> PR:local SHA:<short-sha> -->`
- `[>]` → `[ ]` with `<!-- handed off: <handle> <ISO> SHA:<short-sha> remaining:<...> -->`
- `[>]` → `[!]` with `<!-- blocked: <handle> <ISO> reason:<short> -->`

## Then immediately pick the next ticket

Don't pause to ask "should I continue?" — Steven's standing instruction is
that the loop self-paces. Pick the next eligible ticket, claim it, work it,
repeat. Stop only when:

- No eligible ticket is available (every TODO has unmet deps or an active
  claim by another agent), OR
- The working tree breaks in a way that suggests another agent's commit
  landed wrong, OR
- You've made 3+ tickets DONE and want a checkpoint.

## Test runner notes

- **Unit** → Vitest, co-located under `__tests__/`, no DB, no network.
- **Integration** → Vitest with a real local Postgres (testcontainers or
  docker-compose), no external network.
- **E2E** → runs against a real ATS. Gated behind an `*_E2E=1` env var per
  test (e.g. `GREENHOUSE_QUICK_APPLY_E2E=1`). Each E2E test must target a
  known-safe fixture account or sandbox, never a real recruiter's inbox.

## Task IDs

Each task has a stable ID like `P3.2` (Phase 3, Task 2). These IDs **never
change** — if scope shifts, add a new task rather than renumbering.

## Plan board mechanics

- **Definition source:** `FINAL_PLAN.md` task ID, phase, title, dependencies,
  files, acceptance, tests, labels.
- **Live state source:** `PlanBoardTask` rows keyed by `taskId`.
- **Event source:** `PlanBoardEvent` rows plus SummonFlow broadcasts on
  `public-gimme-job-plan-board`.
- **Agent update API:** `PATCH /api/admin/plan-board/tasks/:taskId`.
- **CLI helper:** [`docs/agent-plan-board.md`](agent-plan-board.md) covers
  every command.

## If something's wrong with the workflow itself

(missing scripts, lock dir corrupt, plan-board API down, etc) — **stop** and
post a NOTE on whatever ticket you were about to claim, then ping Steven.
Don't try to fix the workflow infrastructure mid-session; that's outside any
ticket's scope.

## Architecture caveats agents tend to miss

- **No Playwright as the production application-runtime executor.** Existing
  gated E2E tests can remain unless Steven explicitly removes them. The
  desktop execution plane uses Electron's native `BrowserView` with direct
  CDP, not Playwright.
- **Vitest, not Jest.** `bun test` uses Bun's runner (no jsdom). Always run
  via `bunx vitest run <path>`.
- **Don't broaden scope.** Tasks are deliberately small. If the ticket says
  "fix X in file Y", don't refactor Y. Add a follow-up ticket if you spot
  something.
- **Never claim a task whose `Depends on:` chain isn't all `[x]`.** If you
  think a dependency is wrong, raise it to Steven — don't silently work
  around it.
- **Always run the task's required tests before flipping to `[x]`.** A task
  without passing tests is not done.
