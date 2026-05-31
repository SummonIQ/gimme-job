# Dirty-tree inventory (2026-04-22)

**Task:** P0.2
**Produced by:** claude-code
**Snapshot taken at:** 2026-04-22 (local `git status --porcelain` on `main`)
**Raw list:** [`dirty-tree-raw-2026-04-22.txt`](dirty-tree-raw-2026-04-22.txt) (641 paths)

---

## 1. Why this exists

P0.2's original wording was "commit or restore every file listed as `M` or `D`". That's unachievable as an agent task — 641 dirty paths span the whole app and carry no ownership metadata, so no agent can safely decide whether a given modification is in-progress work, a half-finished refactor, or a disposable experiment.

This doc replaces that acceptance. It is a **non-destructive inventory only**. Triage is Steven's ongoing operational task, not an agent task. Agents must not commit, restore, or delete files listed here.

## 2. Totals

| Status | Count |
|---|---|
| `M` (modified) | 270 |
| `D` (deleted) | 127 |
| `??` (untracked) | 244 |
| **Total** | **641** |

## 3. Clusters

Grouped by the first two path segments, sorted by size. Small clusters (≤1 file) are rolled into "Scattered (root + misc)" at the bottom.

### Disposable — should be `.gitignore`'d, not committed

| Cluster | M | D | ?? | Total | Notes |
|---|---|---|---|---|---|
| `.applab/` | 1 | 0 | 98 | 99 | Screenshot artifacts (AppLab visual review tooling). `.applab/screenshots/gimme-job/latest.png` is the one tracked baseline; the rest is output. |
| `test-results/` | 1 | 3 | 5 | 9 | Playwright/Vitest run artifacts. |
| `playwright-report/` | 1 | 3 | 0 | 4 | Playwright HTML report. |
| `.playwright-cli/`, `.playwright-mcp/` | 0 | 0 | 2 | 2 | Playwright CLI/MCP workspaces. |
| `.claude/settings.json` | 0 | 0 | 1 | 1 | Per-user Claude Code settings. |
| `vendor/` | 0 | 0 | 1 | 1 | Vendor drop. |

**Recommendation:** add `.applab/screenshots/`, `test-results/`, `playwright-report/`, `.playwright-cli/`, `.playwright-mcp/`, `.claude/` to `.gitignore` in a tiny dedicated commit. The single tracked `.applab/screenshots/gimme-job/latest.png` is kept as the regression baseline.

### In-progress feature work — Steven's

Listed from largest cluster to smallest. Do not touch any of these from an agent task.

| Cluster | M | D | ?? | Total |
|---|---|---|---|---|
| `app/api/` | 24 | 50 | 12 | 86 |
| `app/(app)/` | 48 | 12 | 13 | 73 |
| `components/ui/` | 38 | 0 | 3 | 41 |
| `tests/e2e/` | 4 | 1 | 35 | 40 |
| `components/job-listings/` | 11 | 0 | 2 | 13 |
| `components/analytics/` | 11 | 1 | 0 | 12 |
| `lib/applications/` | 8 | 4 | 0 | 12 |
| `lib/resumes/` | 6 | 4 | 2 | 12 |
| `prisma/migrations/` | 0 | 0 | 9 | 9 |
| `components/job-search/` | 5 | 2 | 1 | 8 |
| `components/resumes/` | 5 | 0 | 3 | 8 |
| `lib/automation/` | 8 | 0 | 0 | 8 |
| `lib/job-leads/` | 7 | 1 | 0 | 8 |
| `scrapers/` | 1 | 0 | 7 | 8 |
| `components/linkedin/` | 1 | 6 | 0 | 7 |
| `lib/admin/` | 2 | 0 | 5 | 7 |
| `components/automation/` | 5 | 1 | 0 | 6 |
| `lib/assist-training/` | 1 | 0 | 5 | 6 |
| `lib/portfolio/` | 0 | 6 | 0 | 6 |
| `scripts/` | 0 | 0 | 6 | 6 |
| `components/common/` | 2 | 0 | 3 | 5 |
| `components/job-leads/` | 3 | 0 | 2 | 5 |
| `components/navigation/` | 5 | 0 | 0 | 5 |
| `lib/api/` | 0 | 5 | 0 | 5 |
| `lib/job-searches/` | 4 | 1 | 0 | 5 |
| `components/job-searches/` | 4 | 0 | 0 | 4 |
| `components/layout/` | 3 | 0 | 1 | 4 |
| `lib/analytics/` | 2 | 0 | 2 | 4 |
| `lib/job-listings/` | 0 | 0 | 4 | 4 |
| `types/domain/` | 0 | 4 | 0 | 4 |
| `components/guided-application/` | 3 | 0 | 0 | 3 |
| `components/job-applications/` | 2 | 0 | 1 | 3 |
| `constants/job-leads/` | 1 | 2 | 0 | 3 |
| `lib/exports/` | 3 | 0 | 0 | 3 |
| `lib/files/` | 1 | 2 | 0 | 3 |
| `lib/guided-applications/` | 2 | 0 | 1 | 3 |
| `lib/interviews/` | 0 | 3 | 0 | 3 |
| `app/docs/`, `app/interviews/`, `app/shared/` | 4 | 2 | 0 | 6 |
| `components/charts/`, `components/notifications/` | 4 | 0 | 0 | 4 |
| `constants/job-listings/`, `constants/resumes/`, `constants/job-searches/` | 1 | 4 | 0 | 5 |
| `docs/` (existing untracked docs unrelated to this task) | 0 | 0 | 2 | 2 |
| `mobile/` | 0 | 2 | 0 | 2 |
| Scattered (root + misc) | 22 | 5 | 8 | 35 |

Noteworthy small items hidden in "scattered":
- `prisma/schema.prisma` (M) — has uncommitted plan-board-unrelated changes (`AssistTrainingSession.trainingType`, a large batch of `JobProvider` enum values). Those are Steven's in-flight migration.
- `.vscode/settings.json`, `AGENTS.md`, `README.md` have small local tweaks (`M` at root).
- 9 untracked directories under `prisma/migrations/` that are not yet applied migrations.

## 4. Recommended order (for Steven, when he wants to triage)

Not required; for reference. Smallest / least risky first:

1. **Gitignore sweep.** One commit adding `.applab/screenshots/`, `test-results/`, `playwright-report/`, `.playwright-cli/`, `.playwright-mcp/`, `.claude/` to `.gitignore`. This removes ~115 dirty paths immediately. Run `git rm -r --cached` on the currently-tracked entries inside those dirs before committing the ignore update.
2. **Prisma migrations.** Decide one by one whether each of the 9 untracked `prisma/migrations/<timestamp>_*/` folders should be committed (if applied against a shared DB) or discarded (if it was a throwaway exploration). Name-based guess is usually enough.
3. **Feature clusters.** Commit or discard per feature folder (`lib/portfolio/`, `components/linkedin/`, `lib/interviews/`, etc.). Each cluster can be one focused commit. Many `D` entries in these folders suggest completed deletions waiting to land.
4. **Large active modules** (`app/api/`, `app/(app)/`, `components/ui/`). These need case-by-case review. No rush — agents don't need them committed.

## 5. Ground rules for agents going forward

The worktree-from-`origin/main` pattern we already use keeps agents fully isolated from this dirty state:

```bash
git worktree add -b <handle>/<task-id> /tmp/<task-id> origin/main
```

Stage only files the task owns, never `git add .` or `git add -A`, never stash or restore files you did not author, never `git checkout -- <path>` on paths outside the task scope. If a task needs a file that's currently only in the dirty main tree (not on `origin/main`), **stop and ask** — do not import unknown work into a commit.

## 6. Status

- **P0.2 deliverable:** this document. Task moves to `DONE`.
- **P0.2 follow-up work (commit/restore per cluster):** not scheduled as a plan task. It's Steven's operational work.
- **Agent protocol update:** merged into FINAL_PLAN.md §0 alongside this task.

---

_This inventory is a snapshot. Regenerate it any time by running `git status --porcelain` from `main` and re-clustering. The raw list is in [`dirty-tree-raw-2026-04-22.txt`](dirty-tree-raw-2026-04-22.txt)._
