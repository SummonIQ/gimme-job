# Agent Plan Board Updates

Use `scripts/update-plan-board-task.ts` instead of hand-writing `fetch` or
`curl` calls when updating `/admin/plan-board`.

## Auth

The helper talks to the same authenticated API as the board:

```bash
export PLAN_BOARD_BASE_URL=http://localhost:10100
export PLAN_BOARD_AGENT=codex
export PLAN_BOARD_COOKIE_FILE=/tmp/gimme-job-plan-board-cookies.txt
```

You can also use `PLAN_BOARD_COOKIE` directly, or set
`PLAN_BOARD_EMAIL` and `PLAN_BOARD_PASSWORD` so the script signs in before the
update.

## Commands

Assign yourself without changing the current status:

```bash
bun scripts/update-plan-board-task.ts P15.6 assign --agent codex
```

Start work:

```bash
bun scripts/update-plan-board-task.ts P15.6 start --agent codex --message "Starting from fresh origin/main worktree."
```

Add a progress note without changing status:

```bash
bun scripts/update-plan-board-task.ts P15.6 note --agent codex --message "Focused tests are passing; formatting next."
```

Mark blocked:

```bash
bun scripts/update-plan-board-task.ts P15.6 block --agent codex --message "Blocked because dependency is not on origin/main."
```

Mark done:

```bash
bun scripts/update-plan-board-task.ts P15.6 done --agent codex --message "Completed locally. No push/CI/deploy triggered."
```

Move back to Todo when a blocker clears:

```bash
bun scripts/update-plan-board-task.ts P15.6 todo --agent codex --message "Unblocked and ready for pickup."
```

Add `--json` when another tool needs the updated task payload.

## Behavior

For `assign` and `note`, the helper first reads the current task status and
sends it back unchanged, because the board PATCH endpoint requires `status` on
every update. For `start`, `block`, `done`, and `todo`, the helper sends the
corresponding status transition. Every update includes `agentHandle`,
`eventType`, and `message` so it uses the SummonFlow publish path instead of
raw Prisma writes.
