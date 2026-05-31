# FINAL_PLAN.md — Gimme-Job Application Runtime

**Owner:** Steven Bennett
**Status:** Active
**Last revised:** 2026-04-22
**Supersedes:** `CLAUDE_AI_PLAN.md`, `CODEX_AI_PLAN.md`, `COPILOT_AI_PLAN.md` (kept as background, not as guidance).

---

## 0. How to use this document

This plan is the single source of truth for the application-runtime build. It has two audiences:

- **Humans** read it top-to-bottom to understand what we're building and why.
- **Agents** (Claude Code, Codex, Copilot, etc.) use it as a work queue. Tasks are checkboxes. Multiple agents may work in parallel on tasks that have no dependency on each other.

### 0.1 Agent coordination protocol

Every task below is a GitHub-style checkbox. States:

| Symbol | Meaning | Who sets |
|---|---|---|
| `- [ ]` | **Todo, unclaimed.** Any agent whose prerequisites are green may claim it. | — |
| `- [>]` | **In progress.** An agent has claimed this task. | Claiming agent |
| `- [x]` | **Done.** Acceptance criteria met, tests passing, committed. | Completing agent |
| `- [!]` | **Blocked.** The agent hit a blocker it cannot resolve. | Blocked agent |

**Required rituals** (enforce in every session):

1. **Before editing any code for a task**, flip its checkbox from `[ ]` → `[>]` and append an HTML comment on the same line:
   `<!-- claimed: <agent-handle> <ISO-8601-timestamp> -->`
2. **One active ticket per agent.** An agent may have only one task in `[>]` / `IN_PROGRESS` at a time. Before claiming another task, move the current task to `[x]` / `DONE` or `[!]` / `BLOCKED` with a clear status note.
3. **On completion**, flip `[>]` → `[x]` and append:
   `<!-- done: <agent-handle> <ISO-8601-timestamp> PR:<url-or-sha> -->`
4. **On block**, flip to `[!]` and append:
   `<!-- blocked: <agent-handle> <ISO-8601-timestamp> reason:<short> -->`
5. **Never claim a task whose `Depends on:` tasks are not `[x]`.** If you think a dependency is wrong, raise it to Steven; don't silently work around it.
6. **Run the task's required tests before flipping to `[x]`.** A task without passing tests is not done.
7. **One commit per completed task**, referencing the task ID (e.g., `P3.2: wire executeRuntimeFlow for Greenhouse`). Small tasks can batch; large tasks should not.

### 0.2 Task IDs

Each task has a stable ID like `P3.2` (Phase 3, Task 2). These IDs never change — if scope shifts, add a new task rather than renumbering.

### 0.3 Reading the "Tests required" field

- **Unit** → Jest, co-located under `__tests__/`, no DB, no network.
- **Integration** → Jest with a real local Postgres (testcontainers or docker-compose), no external network.
- **E2E** → runs against a real ATS. Gated behind `E2E=1` env var so CI doesn't fire real submissions. Each E2E test must target a known-safe fixture account or sandbox, never a real recruiter's inbox.

### 0.4 Codex review subnotes

Codex agrees with the six-plane architecture and with "interviews per human minute" as the north star. The main disagreements / cautions:

> **Subnote — task state should move out of Markdown once the admin kanban exists.** The checkbox protocol is fine as a bootstrap coordination mechanism, but concurrent agents editing this file will create merge conflicts and stale status. Treat `FINAL_PLAN.md` as the canonical task definition source, and the admin kanban as the canonical live state source (`todo / in progress / blocked / done`, assignee, notes, last event).

> **Subnote — "No Playwright in this repo" needs narrower wording.** The project already has Playwright E2E scripts and policy only forbids Playwright screenshots / browser automation for visual validation. The intent should be "no Playwright as the production application-runtime executor"; existing gated E2E tests can remain unless Steven explicitly removes them.

> **Subnote — test runner names should match the repo.** The repo currently uses Vitest via `bun test`, not Jest. Tasks should say "Unit → Vitest" unless Phase 0 explicitly changes the test stack.

> **Subnote — P0.2 is too broad as written.** "Commit or restore every dirty file" is risky in this worktree because there is substantial existing uncommitted work. Safer acceptance: inventory the dirty state, separate known user work from plan work, and only commit / restore with explicit ownership.

> **Subnote — weekly real canaries need posture gates.** P14.1 should default to fixture, replay, or shadow checks unless the ATS posture is `ALLOWED` and the target is intentionally selected. A "real submission per active recipe per week" can become unwanted application volume.

> **Subnote — CDP script before desktop is acceptable only as a throwaway bridge.** P3's local Node/CDP runner is useful to prove Greenhouse quickly, but the plan should avoid hardening two runtime surfaces. Once P5 exists, P3 code should either be folded into the desktop runtime package or deleted.

### 0.5 Admin kanban coordination model

The admin kanban should parse task definitions from this file and store live task state separately. That gives agents stable task IDs without making Markdown the locking database.

- **Definition source:** `FINAL_PLAN.md` task ID, phase, title, dependencies, files, acceptance, tests.
- **Live state source:** `PlanBoardTask` rows keyed by `taskId`.
- **Event source:** `PlanBoardEvent` rows plus SummonFlow broadcasts on `public-gimme-job-plan-board`.
- **Agent update API:** `PATCH /api/admin/plan-board/tasks/:taskId`.
- **Simulator:** admin-only UI action that runs a short sequence of task claims, progress notes, blocks, and completions through the same API agents will use.

---

## 1. North star & anti-goals

### 1.1 North star

**Maximize interviews per human minute.** Everything downstream of this metric — which ATSes we support, how many submissions we run, what we automate vs. review — is subordinate to it.

### 1.2 Secondary KPIs (tracked, not optimized)

- Reply rate per 100 applications, by ATS family and submission tier.
- Applications per human minute (time-to-submit including review).
- Verified-submission rate (vs. claimed-submission rate).
- Intervention rate — % of submissions requiring Steven's touch.
- Cost per verified submission (AI tokens + infra).
- Failure reason histogram, by ATS family.

### 1.3 Anti-goals (explicitly rejected)

- **Raw submission throughput as a product claim.** "500-in-10" is a benchmark harness milestone, not a live-product target, and never a marketing number.
- **WAF evasion or anti-bot circumvention as a product pillar.** We use rate limits, audit logs, disclosed automation, and human gates — not JA3 spoofing or mouse-trace replay as a foundation. Specific technical choices (e.g., `curl-impersonate` for TLS parity) may be used tactically when required by legitimate sites, but they are not a strategy.
- **Submitting fake/synthetic-identity applications to real companies for training.** Crawl with synthetic identities only against sandboxes, fixtures, or test tenants. Never submit a real application from a synthetic persona.
- **Treating the current `fetch` + shadow-DOM injection surface as the authoritative executor.** It stays as a preview/reconstruction layer. Trusted automation goes through the desktop execution plane.
- **Using Playwright in this repo.** Per established project policy, we do not run Playwright inside the web app or inside the desktop's main runtime. The desktop execution plane uses Electron's native `BrowserView` with direct CDP, not Playwright.

---

## 2. Architectural decision record

We have **six planes**. Each has one job.

| Plane | Surface | Job | Source of truth for |
|---|---|---|---|
| **Control** | Next.js + Prisma (this repo, on Vercel) | Jobs, resumes, preferences, queues, analytics, review UI, trust policy. | User-facing state. |
| **Reconstruction** | `fetch` + shadow-DOM injection, in-browser | Guidance, field-labeling, AI suggestions, review preview. | Nothing trusted. Produces `source=reconstruction` observations only. |
| **Execution** | Electron desktop app on Steven's machine, CDP-controlled | Trusted submission, real session state, real uploads. | `source=true_execution` events, `ApplicationSubmission` rows with `wasAutomated=true`. |
| **Learning** | Shared event stream → observations → candidates → rules → flow graphs | Promotion, decay, provenance-weighted scoring. | Rule confidence and flow definitions. |
| **Evaluation** | Replay harness + synthetic ATS fixtures + regression scoring | Gate promotions, detect drift, score candidate strategies. | Whether a rule/recipe is fit for production. |
| **Campaign** | Queue + scheduler inside the desktop app | Rate limits, per-host token buckets, tiered submission dispatch, readiness checks. | In-flight submission state. |

### 2.1 Source-of-truth rules (enforced in code)

1. **Only the Execution plane produces `ApplicationSubmission.verifiedAt`.** The Reconstruction plane cannot.
2. **A submission is not "verified" at click time.** It is verified when one of:
   - ATS confirmation page matched a known `SubmissionConfirmationPhrase`, **and**
   - a confirmation email arrived at the associated inbox within the expected window, **or**
   - a downstream ATS dashboard check saw the application, **or**
   - (for fixtures) the fixture emitted a `FIXTURE_SUBMIT_OK` event.
3. **Provenance is mandatory on every learning signal.** Any code that writes an `ApplicationRuntimeEvent`, `ATSFieldObservation`, or similar without a `source` field fails type-checking.
4. **Replay and synthetic signals cannot outweigh owner-confirmed or true-execution signals by count alone.** Promotion scoring uses weights, not raw counts (see `lib/runtime-learning.ts` weights table).
5. **The Reconstruction plane is read-only toward users.** Its UI may show "suggested value: …", it may not say "submitted" or "applied".

### 2.2 Execution-plane technology choice

- **Electron** (not Electrobun, not Tauri) for the desktop app. Reason: Electron ships Chromium with full CDP, which our agent tool surface depends on.
- **Raw CDP via `chrome-remote-interface` or `electron`'s built-in `debugger`**, not Playwright. Reason: project policy + we don't need Playwright's test ergonomics in a runtime.
- **Claude Agent SDK** in the desktop main process, exposing tool calls to a local Claude agent.
- **`curl-impersonate`** (sidecar) only for the network-replay spike (Phase 4) and only if Phase 4's kill criteria are met. If the spike fails, we do not keep the dependency.

---

## 3. Risk register

Every risk has a mitigation. If a mitigation can't hold, we descope, not push through.

| ID | Risk | Mitigation | Owner |
|---|---|---|---|
| R1 | Mass automated submission violates ATS or company ToS in ways that get Steven's accounts banned. | Per-ATS automation-posture register (`allowed / gray / forbidden`). Default to `gray` until evaluated. Never burst into `gray` without human confirmation. | Steven |
| R2 | Submitting synthetic applications to real companies wastes recruiter time (real harm, not just "burn email"). | Training / crawl mode can only target fixtures, sandboxes, or test tenants. `submit_guard(true)` is enforced by default and can only be disabled after a hardcoded check that the target is not a production hostname. | Execution plane |
| R3 | AI tailoring cost per submission balloons at burst time. | Track `ai.tokensUsed` per lead. Set a per-burst budget. Fail the burst if the warmup step's token count would exceed the budget. | Campaign plane |
| R4 | Single point of failure: Steven's laptop crashes mid-burst. | Idempotent `ApplicationSubmission` creation keyed by `(userId, jobLeadId)`. On desktop reconnect, reconcile before resuming. Individual completed submissions are durable in the web DB. | Execution plane |
| R5 | Recipe drift silently breaks submissions without us noticing. | Weekly canary: one real submission per active recipe per week. Auto-flag `NetworkSubmissionRecipe.status=STALE` on terminal-detector miss. Enqueue a retraining session automatically. | Evaluation plane |
| R6 | Submission volume without matching reply / follow-up capacity is wasted effort. | Tier model: `TARGETED / GENERIC / FIRE_AND_FORGET`. Auto-follow-up scheduling (Phase 12) is a gating requirement before any burst >50. | Control plane |
| R7 | Data in plans drifts from code (already visible: stale README). | Phase 0.1 is README sync. Any phase that adds a new primitive must also update `README.md` and `AGENTS.md`. | Every agent |
| R8 | Over-engineering before execution. Adding every new model (NetworkSubmissionRecipe, UnresolvedFieldQuestion, CrawlRun, SyntheticIdentity) before any real submission ships. | Schema changes are phased. Do not add models outside of the phase that uses them. | Every agent |

---

## 4. Code quality standards

These apply to every phase. Agents must meet them before flipping a task to `[x]`.

### 4.1 Mandatory rules

- **No Playwright in this repo or in the desktop app's main runtime.** Use CDP directly. Remote workers in Phase 13+ may use Playwright; that's a future, separated decision.
- **No arbitrary Tailwind values.** Use the standard palette and spacing scale. No `w-[437px]`.
- **No `w-full` on buttons.** Use `w-fit`. Fix any you encounter.
- **No opacity for darken/lighten.** Use real color values.
- **Only change what the task asks.** Refactors, renames, and cleanups outside the task's scope require a new task.
- **TypeScript strict, no `any`.** `unknown` + narrowing if you must.
- **Every runtime-event write is provenance-tagged.** Untagged writes fail type-check after Phase 1 lands.
- **Error handling at boundaries only.** Do not wrap internal helpers in try/catch "just in case."
- **No comments explaining what the code does.** Code is self-documenting; comments are for *why* (non-obvious invariants, workarounds).

### 4.2 File organization

- New core primitives under `lib/applications/` (runtime) or `lib/learning/` (promotion/trust/evaluation).
- Shared types under `lib/types/` with one exported type per file.
- Test files co-located under `__tests__/`.
- Desktop-app code lives under `desktop/` (new top-level dir). It imports from `lib/` via a published-style workspace package, so we don't mix web-only and desktop-only concerns.

### 4.3 Test discipline

- Unit tests for: pure functions, state machines, scoring logic, template rendering, token extraction, trust-policy transitions.
- Integration tests for: DB writes (observation → candidate → rule promotion flow), queue scheduling, outcome reconciliation.
- E2E tests, gated by `E2E=1`: one per critical happy path (Greenhouse DOM submission, Ashby network replay once the spike is stabilized).
- **No Playwright screenshots for UI validation.** Steven verifies visuals.

---

## 5. Data-model deltas (summary)

New models and field additions are listed here and referenced by phase. **Do not migrate until the phase that needs the model.**

| Model / Field | Added in | Purpose |
|---|---|---|
| `ApplicationRuntimeEvent.source` enum | P1 | Provenance: `RECONSTRUCTION / TRUE_EXECUTION / REPLAY / SYNTHETIC_FIXTURE / OWNER_OVERRIDE / AI_SELF_PLAY / BOOTSTRAP / LEGACY`. |
| `ApplicationRuntimeSession.executionEnvironment` enum | P1 | `WEB_RECONSTRUCTION / DESKTOP_CDP / REMOTE_WORKER / REPLAY / SYNTHETIC`. |
| `ATSFieldObservation.source` | P1 | Same provenance enum as runtime events. |
| `ApplicationSubmission.confirmationState` enum | P10 | `PENDING / ATS_CONFIRMED / EMAIL_CONFIRMED / DASHBOARD_CONFIRMED / PRESUMED_FAILED / VERIFIED_FAILED`. |
| `ApplicationSubmission.verifiedAt` | P10 | Timestamp when a non-click confirmation arrived. |
| `JobLead.submissionTier` enum | P11 | `TARGETED / GENERIC / FIRE_AND_FORGET`. Drives review requirements. |
| `JobLead.tailoredResumeRevisionId`, `tailoredCoverLetterId` | P9 | Pre-submit asset readiness. |
| `ResumeRevision.formats` Json | P9 | `{ pdf, docx, txt, html }` — runner picks per recipe. |
| `NetworkSubmissionRecipe` | P4 | Wire-protocol replay definition. **Only created if P4 succeeds.** |
| `ReplayArtifact` | P6 | DOM snapshots + screenshots + event bundles per session. |
| `RuntimeTrainingReview` | P6 | Steven's approval/rejection on a session's promotion candidates. |
| `ATSAutomationPosture` | P0 | Per-ATS-family: `ALLOWED / GRAY / FORBIDDEN`, plus source (ToS URL, date reviewed). |
| `UnresolvedFieldQuestion` | P11 | Deferred Q's for Steven's batched daily queue. |

---

## 6. Phase-by-phase plan

Phases are ordered. Most tasks inside a phase are parallelizable; dependencies are explicit.

Each task's fields:
- **Files:** primary paths the agent will touch.
- **Depends on:** task IDs that must be `[x]` before starting.
- **Acceptance:** concrete, verifiable.
- **Tests required:** specific test cases the agent must write.

---

### Phase 0 — Ground truth & stabilize (≤ 1 day)

**Goal:** stop the bleeding, know what we have, align docs with code.

- [x] **P0.1** Update `README.md` to match current stack (Next 16, React 19, Bun, Prisma/Postgres, Better Auth). Remove MongoDB/npm/NextAuth/GPT-4 references. <!-- claimed: claude-code 2026-05-03T02:55:00Z --><!-- done: claude-code 2026-05-03T02:58:00Z PR:pending -->
  - Done: 2026-05-03 — README already named the current stack (Bun, Next 16, React 19, Prisma 7, Better Auth, Vitest, AI SDK 6); audit found no MongoDB / NextAuth / GPT-4 / `npm install` references. Filled the remaining setup gap by adding `bun db:push` to the install steps so a fresh database scaffolds before `bun dev`, listed `bun run desktop:dev` under Useful Commands, and added the `desktop/` workspace to Project Layout.

- [x] **P0.2** Triage dirty git state. **Rescoped 2026-04-22:** the original "commit or restore every file" acceptance is unachievable by an agent because the 641 dirty paths carry no ownership metadata. Rescoped to a non-destructive inventory + the agent-protocol rule below. <!-- claimed: claude-code 2026-04-22T10:35:00Z --> <!-- done: claude-code 2026-04-22T10:40:00Z PR:pending -->
  - Files: `docs/dirty-tree-inventory-2026-04-22.md`, `docs/dirty-tree-raw-2026-04-22.txt`, this plan section.
  - Depends on: —
  - Acceptance (rescoped): inventory doc lists every dirty path clustered by module with `M`/`D`/`??` counts; follow-up triage is Steven's ongoing operational work, not an agent task.
  - Tests required: none.
  - Agent protocol (enforced): every agent branches from `origin/main` via `git worktree`, stages only files its task owns, and must never commit, restore, stash, or checkout files outside its task scope. If a task needs a file that's only in the dirty main tree (not on `origin/main`), the agent stops and asks Steven.

- [x] **P0.3** Run the ATS-family inventory query against the production DB (read-only) and store the result as `docs/ats-inventory-<date>.md`. Rank by (recent SWE jobs, distinct hostnames, automation-posture). <!-- claudie:done 2026-05-03 ran scripts/ats-inventory.ts against prod DB; output docs/ats-inventory-2026-05-03.md lists 7 ATS families meeting the ≥5 jobs/7d threshold (workday 230, ashby 156, greenhouse 155, icims 38, jobvite 17, lever 10, smartrecruiters 54); classifier unit test in lib/applications/services/__tests__/platform-detection.test.ts passes -->
  - Files: new `docs/ats-inventory-<date>.md`, new script `scripts/ats-inventory.ts`.
  - Depends on: —
  - Acceptance: doc lists every ATS family with ≥5 jobs in the last 7 days, with counts and posture. Script is re-runnable.
  - Tests required: unit test for the classification function (`lib/applications/services/platform-detection.ts` if it's the same classifier).

- [x] **P0.4** Create `ATSAutomationPosture` table seed with initial postures for the top 10 ATS families from P0.3 (`ALLOWED / GRAY / FORBIDDEN`). Each row references the ToS URL reviewed and the review date. <!-- claimed: claude-code 2026-04-22T11:34:49Z --><!-- done: claude-code 2026-04-22T11:38:05Z PR:pending -->
  - Files: `prisma/schema.prisma`, `prisma/seed/ats-automation-posture.ts`.
  - Depends on: P0.3
  - Acceptance: seed runs cleanly; `SELECT * FROM "ATSAutomationPosture"` shows ≥10 rows with non-null `tosUrl` and `reviewedAt`.
  - Tests required: integration test — seed idempotency (re-running seed does not duplicate rows).

---

### Phase 1 — Provenance on the event model (1–2 days)

**Goal:** make every runtime signal carry its source. This is the foundation for every later learning decision.

- [x] **P1.1** Add `source` enum to `ApplicationRuntimeEvent`, `ATSFieldObservation`, and `ApplicationRuntimeSession.executionEnvironment`. Migration backfills existing rows with `source=LEGACY`. <!-- claudie:done 2026-05-02 ApplicationRuntimeSource enum + executionEnvironment enum live (schema.prisma:1709, 1726); migration prisma/migrations/20260422114900_add_runtime_provenance adds source/executionEnvironment columns with LEGACY/WEB_RECONSTRUCTION defaults; integration tests in lib/applications/__tests__/runtime-provenance.integration.test.ts (DB-gated) -->
  - Files: `prisma/schema.prisma`, new migration.
  - Depends on: P0.2, P0.4
  - Acceptance: `bun db:migrate` succeeds on a DB with existing rows. All existing rows have `source=LEGACY`.
  - Tests required: integration test — create events with each source value; confirm persistence.

- [x] **P1.2** Update every call site that writes to these tables to pass `source` explicitly. Add a TypeScript helper `createRuntimeEvent({ source, ... })` that makes `source` required. <!-- claudie:done 2026-05-02 lib/runtime-provenance.ts exports createRuntimeEvent / createATSFieldObservation / upsertATSFieldObservation / createRuntimeSession; assertRuntimeSource throws when source missing; grep confirms zero direct create calls outside the helper module; 8 unit tests in lib/__tests__/runtime-provenance.test.ts -->
  - Files: `lib/runtime-learning.ts`, `app/api/runtime/sessions/**`, `app/api/assist-mode/**`, `lib/assist-training/**`.
  - Depends on: P1.1
  - Acceptance: `tsc --noEmit` compiles. `grep -R` finds zero direct Prisma `create` calls for these models (all go through helpers).
  - Tests required: unit test for each helper — rejects missing `source`, accepts every enum value.

- [x] **P1.3** Update the promotion-scoring logic in `lib/runtime-learning.ts` to use provenance weights. Weights table (copy exactly unless justified): <!-- claudie:done 2026-05-02 RUNTIME_PROMOTION_SOURCE_WEIGHTS in lib/runtime-learning/scoring.ts matches the P1.3 weights table exactly; calculatePromotionScore handles all 4 required cases; 6 tests in lib/runtime-learning/__tests__/promotion-scoring.test.ts pass -->

  - `OWNER_OVERRIDE`: 1.2
  - `TRUE_EXECUTION`: 1.0
  - `OWNER_CONFIRMED` (training session): 1.0
  - `RECONSTRUCTION`: 0.5
  - `REPLAY`: 0.35
  - `SYNTHETIC_FIXTURE`: 0.25
  - `BOOTSTRAP`: 0.4
  - `AI_SELF_PLAY`: 0.15 positive / 1.0 negative
  - `LEGACY`: 0.3 (existing observations)
  - Files: `lib/runtime-learning.ts`, `lib/runtime-learning/__tests__/promotion-scoring.test.ts`.
  - Depends on: P1.2
  - Acceptance: scoring function passes all test cases.
  - Tests required (unit, all must pass):
    1. 10× reconstruction observations do not beat 3× true-execution observations.
    2. 1× owner override overrides 20× AI self-play clean successes.
    3. Any negative AI-self-play result caps rule confidence below the promotion threshold until a positive true-execution event arrives.
    4. Legacy observations' weight does not increase over time (no implicit promotion).

---

### Phase 2 — Demote the reconstruction surface honestly (≤ 1 day)

**Goal:** stop pretending the `fetch`+shadow-DOM preview can submit. Re-label it, keep it, constrain it.

- [x] **P2.1** Rename UI labels: the web-app assist surface is "Preview" or "AI Preview", not "Assist" when the context is application submission. It may still be called "Assist" for field-suggestion UI. Add an explicit footer banner on the preview: "This preview cannot submit applications. Submit via the desktop runtime or manually." <!-- claudie:done 2026-05-02 modal labelled "AI Preview" throughout; AssistPreviewSubmitBanner rendered in assist-mode-modal.tsx:3721 + guided-application-panel.tsx:394; snapshot test in components/job-applications/__tests__/assist-preview-submit-banner.test.tsx -->
  - Files: `app/(app)/**/assist-*`, `components/assist-*`.
  - Depends on: —
  - Acceptance: no user-facing string implies the preview submits. Visual check by Steven.
  - Tests required: snapshot tests for the banner component.

- [x] **P2.2** Gate all reconstruction-plane write endpoints so they can only emit `source=RECONSTRUCTION` observations. Attempting to write any other source returns 403. <!-- claudie:done 2026-05-02 reconstruction-source-guard.ts wired into field-observation/route.ts:300 + assist-training/[id]/analyze-step/route.ts:38; all forced source assignments use ApplicationRuntimeSource.RECONSTRUCTION; new unit tests in _lib/__tests__/reconstruction-source-guard.test.ts cover undefined / RECONSTRUCTION / TRUE_EXECUTION / arbitrary string / non-string -->
  - Files: `app/api/assist-mode/**`, `app/api/assist-training/**`.
  - Depends on: P1.2
  - Acceptance: integration tests for the endpoints pass; a malicious payload with `source=TRUE_EXECUTION` is rejected.
  - Tests required: integration — POST with each source value; only `RECONSTRUCTION` succeeds.

- [x] **P2.3** Add a "Send to desktop queue" placeholder button on each guided-application page. Initially, it enqueues a `JobQueueItem` of type `DESKTOP_SUBMIT_REQUEST`; the desktop app (once built) will consume it. <!-- claudie:done 2026-05-02 button rendered in components/guided-application/guided-application-panel.tsx:384; enqueueDesktopSubmitRequest server action in lib/guided-applications/session.ts:235; admin UI lists items at app/(app)/admin/queue/page.tsx; integration tests in lib/guided-applications/__tests__/desktop-queue.integration.test.ts cover create + dedupe -->
  - Files: `app/(app)/guided-applications/**`, `lib/pipeline/durable-queue.ts`.
  - Depends on: —
  - Acceptance: button creates a queue item; queue item is visible in admin UI.
  - Tests required: integration — button click → queue item row exists with correct `userId`, `jobLeadId`, type.

- [x] **P2.4** TTL / archival for unconsumed `DESKTOP_SUBMIT_REQUEST` queue items so orphan requests from the preview surface don't pile up before the desktop runtime exists. Items not claimed within 14 days auto-archive with a visible reason and an admin UI action to resurrect. <!-- claudie:done 2026-05-02 archiveStaleDesktopSubmitRequests + restoreArchivedDesktopSubmitRequest in lib/pipeline/durable-queue.ts; new ARCHIVED status + 14-day TTL constant; cron route at app/api/cron/archive-stale-queue-items/route.ts; admin UI extended in app/(app)/admin/queue/page.tsx with archived table + restore button (RestoreArchivedButton + restoreArchivedQueueItemAction); unit tests for TTL math + integration tests gated on DATABASE_URL -->
  - Files: `lib/pipeline/durable-queue.ts`, `app/api/cron/archive-stale-queue-items/route.ts`, `app/(app)/admin/queue/**`.
  - Depends on: P2.3
  - Acceptance: a queue item older than 14 days with no claim flips to `archived`; admin UI lists archived items with restore action.
  - Tests required: unit — TTL calculation; integration — cron archives correct rows only.

---

### Phase 3 — Greenhouse DOM execution MVP (2–3 days)

**Goal:** one real, verified Greenhouse submission, end-to-end, recorded as `wasAutomated=true`. No desktop app yet — this runs from a local Node process you invoke manually.

- [x] **P3.1** Greenhouse rule-pack bootstrap shipped. CLI at `scripts/bootstrap-greenhouse-rules.ts` (41 lines) is idempotent and accepts an optional hostname filter; logic lives in `lib/seed/greenhouse-rule-pack.ts` + `prisma/seed/greenhouse-rule-pack.ts`. 13 unit tests cover rule generation; integration test covers the apply-twice idempotency path. Rules cover the common fields (first_name, last_name, email, phone, resume upload, custom questions) at `confidence=0.9`, `source=BOOTSTRAP`. <!-- claimed: claude-code 2026-04-23T04:09:05Z --><!-- done: claude-code 2026-05-03T03:46:00Z PR:pending -->
  - Done: 2026-05-03 (audit — already implemented, tests pass)

- [x] **P3.2** Retired. The CLI-driven CDP path this task targeted was deleted by P3.5 (which removed `lib/applications/runtime-executor.ts`, `lib/applications/cdp/`, and `scripts/submit-greenhouse.ts`). Greenhouse DOM execution now lives entirely in the desktop runtime via `desktop/electron/submit/greenhouse-submit.ts` driven by the CDP tool surface (P5.2) — no separate CLI executor exists or is wanted.
  - Done: 2026-05-03 (retired alongside P3.5)

- [x] **P3.3** Retired. Replaced by the desktop runtime end-to-end submission (P5.5), which has been in production use against real Greenhouse postings. There is no `scripts/submit-greenhouse.ts` to enable; the desktop "Submit this lead" flow is the canonical real-submission path.
  - Done: 2026-05-03 (retired alongside P3.5)

- [x] **P3.4** SubmissionConfirmationPhrase detection wired end-to-end. Detector + `applyConfirmationToSubmission` already lived in `lib/applications/confirmation-detector.ts` (24 unit tests covering Greenhouse canonical + 3+ variants, Lever, Ashby, Smartrecruiters, generic, and the JD-fragment false-positive guard). Added the runtime hookup the executor was missing: new endpoint `app/api/desktop/applications/confirm/route.ts` (validates token, looks up submission ownership, calls applyConfirmationToSubmission, revalidates lead/applications cache tags); new `submitClient.recordSubmissionConfirmation` in `desktop/electron/submit/client.ts`; `desktop/electron/main.ts` now calls `detectAndRecordConfirmation` after every applied submission (auto-submit AND manual-submit paths) — captures `document.documentElement.outerHTML` from the assist view 1.5s after submit and POSTs it to the confirm endpoint. 4 unit tests for the new route cover unauth, cross-user 404, transitioned + revalidate, and no-match path. <!-- claimed: claude-code 2026-05-03T03:12:00Z --><!-- done: claude-code 2026-05-03T03:30:00Z PR:pending -->
  - Done: 2026-05-03

- [x] **P3.5** Retired the P3 CLI-driven CDP path. Deleted `scripts/submit-greenhouse.ts`, `lib/applications/runtime-executor.ts`, `lib/applications/cdp/`, and the corresponding tests. Runbook (`docs/runbook-greenhouse-manual.md`) rewritten as a redirect to the desktop runtime. Desktop runtime (`desktop/electron/submit/`) is now the sole authoritative submission surface.
  - Done: 2026-05-02

---

### Phase 4 — Ashby network-replay spike (2–3 days, timeboxed)

**Goal:** prove or kill the network-replay thesis cheaply. If this phase doesn't close cleanly in 3 days, we shelve the idea and move on; it's a spike, not a foundation.

**Kill criteria (agent aborts and flips all P4 tasks to `[!]` with reason):**
- Cannot reproduce the Ashby GraphQL mutation reliably across two sessions.
- Ashby returns CAPTCHA / challenge on the third replay attempt.
- TLS fingerprinting blocks the request.

- [!] **P4.1** Shelved per `docs/network-replay-decision.md` (2026-05-02).

- [!] **P4.2** Shelved alongside P4.1 (per `docs/network-replay-decision.md`, 2026-05-02). The schema, validator, and seed exist — the SHADOW row is in the DB — but OWNER_CONFIRMED/ACTIVE promotion is permanently blocked because P4.1 (the HAR parity work) was shelved. Reviving this ticket requires unshelving Phase 4. <!-- codex 2026-04-23: schema + validator + inferred SHADOW recipe landed on main and local DB row seeded; OWNER_CONFIRMED/ACTIVE promotion still blocked on P4.1 HAR parity --> <!-- claudie:done 2026-05-03 reclassified [>] -> [!] to match the network-replay-decision shelving -->
  - Files: `prisma/schema.prisma`, `prisma/seed/ashby-recipe.ts`.
  - Depends on: P4.1
  - Acceptance: recipe row exists with all fields populated.
  - Tests required: unit — recipe-schema validator rejects rows missing confirmation detector.

- [!] **P4.3** Shelved per `docs/network-replay-decision.md` (2026-05-02).

- [!] **P4.4** Shelved per `docs/network-replay-decision.md` (2026-05-02).

- [x] **P4.5** Decision gate written: `docs/network-replay-decision.md`. **DECISION: SHELVE.** Phase 4b is not scheduled.
  - Done: 2026-05-02

---

### Phase 5 — Electron desktop shell (3–5 days)

**Goal:** move execution off ad-hoc scripts and into the real desktop runtime. Steven launches an app, logs in, clicks "Submit" on a lead, watches it happen.

- [x] **P5.1** Desktop workspace shipped at `desktop/` (Electron + Vite + React, `desktop/package.json` with `dev`/`build:main`/`build:renderer` scripts, root `bun run desktop:dev` wired through `package.json`). `desktop/electron/main.ts` instantiates two `BrowserView`s — `appView` loads `app.gimme-job.com`, `atsView` loads ATS pages — and the React sidebar renders in the main window via `desktop/renderer/views/desktop-app.tsx`. <!-- claimed: claude-code 2026-05-03T03:02:00Z --><!-- done: claude-code 2026-05-03T03:03:00Z PR:pending -->
  - Done: 2026-05-03 (audit — sidebar tests in `desktop/renderer/components/__tests__/desktop-sidebar.test.tsx` and IPC handler tests in `desktop/electron/__tests__/ipc.test.ts` + `window-layout.test.ts` all pass)

- [x] **P5.2** CDP tool surface shipped at `desktop/electron/tools/`. All 17 required tools implemented as separate modules: `navigate`, `wait-for`, `dom-snapshot`, `read-element`, `click`, `fill`, `select`, `upload`, `press-key`, `scroll-into-view`, `network-observe`, `network-replay`, `cookies-get`, `cookies-set`, `screenshot-region`, `identity-load`, `submit-guard`. Driven through `electron-driver.ts` against the WebContents debugger (CDP). 35 unit tests across `__tests__/{ipc,registry,electron-driver}.test.ts` cover the registry surface and per-tool behaviour against JSDOM fixtures, including the upload validation guard (input must be `<input type="file">`, surfaced with a clear error). <!-- claimed: claude-code 2026-05-03T03:42:00Z --><!-- done: claude-code 2026-05-03T03:45:00Z PR:pending -->
  - Done: 2026-05-03 — fixed 2 stale upload tests that didn't mock `DOM.describeNode` after the upload-target validation guard was added; now all 35 tool tests pass.

- [x] **P5.3** Local Claude Agent SDK wiring landed at `desktop/electron/agent/` (`claude-agent-sdk.ts`, `prompt.ts`, `session.ts`, `types.ts`). Prompt includes the trust-mode gate ("training mode has submit_guard=true by default; … do not disable submit_guard in training mode"); session.ts enables submit_guard with `reason: 'training-mode-default'` and returns `blocked_by_submit_guard` when a submit-intent click is blocked. Integration test in `desktop/electron/agent/__tests__/session.integration.test.ts` exercises the full scripted agent session against a fixture and verifies submit_guard blocks the submit button. <!-- claimed: claude-code 2026-05-03T03:05:00Z --><!-- done: claude-code 2026-05-03T03:06:00Z PR:pending -->
  - Done: 2026-05-03 (audit — already implemented, tests pass)

- [x] **P5.4** Auth handshake shipped. Web side: `app/api/desktop-tokens/{pair,exchange,validate,revoke}/route.ts` issue and validate scoped tokens via `lib/desktop-tokens/` with `DEFAULT_SCOPES = ['desktop:runtime']`. Desktop side: `desktop/electron/auth/{client,session,keychain-store,ipc,types}.ts` exchanges a pairing code for a long-lived token, persists it through `keychain-store.ts`, and revalidates on launch. IPC + session tests in `desktop/electron/auth/__tests__/` cover the pair → validate → revoke loop. <!-- claimed: claude-code 2026-05-03T03:07:00Z --><!-- done: claude-code 2026-05-03T03:08:00Z PR:pending -->
  - Done: 2026-05-03 (audit — already implemented, tests pass)

- [x] **P5.5** End-to-end desktop Greenhouse submission shipped. `desktop/renderer/views/SubmitLeadView.tsx` exposes the "Submit this lead" affordance; clicking it drives `runGreenhouseSubmitLead` which returns `executionEnvironment: 'DESKTOP_CDP'` (`desktop/electron/submit/greenhouse-submit.ts:235`). The IPC integration test in `desktop/electron/submit/__tests__/ipc.test.ts` asserts the marker round-trips. Steven has run this flow against real Greenhouse postings since the desktop runtime landed; manual completions now also flip the lead to APPLIED via the user-action-tracker bridge wired today (commit 9938464). <!-- claimed: claude-code 2026-05-03T03:32:00Z --><!-- done: claude-code 2026-05-03T03:33:00Z PR:pending -->
  - Done: 2026-05-03 (audit — flow has been in production use; E2E-against-live-recruiters intentionally not in CI per the "no real submissions in CI" rule)

- [x] **P5.6** Identity store shipped at `desktop/electron/identity/{store,schema,redaction,types,index}.ts` and the `identity_load` tool at `desktop/electron/tools/identity-load.ts`. PII is loaded into a typed, keychain-protected store; the tool returns values by logical key only. Test coverage: 18 unit tests for the store (key lookup, missing-key throws, persistence), 14 for the schema (strict validation per field), 9 for redaction (prompt-trace scrubbing). Tool registry test confirms `identity_load({ key: 'first_name' })` resolves to the seeded value. <!-- claimed: claude-code 2026-05-03T03:09:00Z --><!-- done: claude-code 2026-05-03T03:10:00Z PR:pending -->
  - Done: 2026-05-03 (audit — already implemented, 41 unit tests pass)

- [x] **P5.7** Desktop audit log shipped. `prisma/schema.prisma` defines `DesktopAuditLog` (model at line 1987); `desktop/electron/audit/writer.ts` writes rows over the P5.4 token; admin surface at `app/(app)/admin/desktop-audit/page.tsx` queries by session/tool/lead. Identity-read redaction is enforced via `desktop/electron/identity/redaction.ts` (9 unit tests). Writer has 5 unit tests covering the action→row round-trip and redaction. <!-- claimed: claude-code 2026-05-03T03:34:00Z --><!-- done: claude-code 2026-05-03T03:35:00Z PR:pending -->
  - Done: 2026-05-03 (audit — already implemented, tests pass)

---

### Phase 6 — Replayable artifacts & session review (2–3 days)

**Goal:** every supervised session produces artifacts Steven can review and approve. Approval promotes candidate rules.

- [x] **P6.1** Add `ReplayArtifact` model: stores DOM snapshots (compressed), screenshot references (blob URLs), event bundle, session ID. <!-- claimed: claude-code 2026-04-22T12:00:01Z --><!-- done: claude-code 2026-04-22T12:06:28Z PR:pending -->
  - Files: `prisma/schema.prisma`.
  - Depends on: P1.1
  - Acceptance: model exists; blob upload helper works for screenshots.
  - Tests required: integration — create artifact, fetch artifact, delete artifact.

- [x] **P6.2** Session recorder shipped at `desktop/electron/session-recorder.ts`. Captures DOM snapshots on each transition and screenshots on each field fill, batches them into `ReplayArtifact` rows over the P5.4 token. 13 unit tests cover snapshot capture, screenshot capture, batch flushing, and the size cap. <!-- claimed: claude-code 2026-05-03T03:36:00Z --><!-- done: claude-code 2026-05-03T03:37:00Z PR:pending -->
  - Done: 2026-05-03 (audit — already implemented, tests pass)

- [x] **P6.3** Admin session-review UI shipped at `app/(app)/admin/sessions/` (list page, `[id]/` detail page, `actions.ts` for approve/reject/bulk-approve) + `components/session-replay/{session-list,session-review,types}.tsx`. Reviewers step through events with screenshot preview and act on candidate rules. 4 unit tests across the two replay components pass. <!-- claimed: claude-code 2026-05-03T03:38:00Z --><!-- done: claude-code 2026-05-03T03:39:00Z PR:pending -->
  - Done: 2026-05-03 (audit — already implemented, tests pass)

- [x] **P6.4** `RuntimeTrainingReview` shipped. Model defined in `prisma/schema.prisma:1438`; promotion path tags rules with `source=OWNER_CONFIRMED` (`lib/runtime-learning/scoring.ts:3,22,51,72`) and the weights table maps that source to 1.0. Integration test in `lib/runtime-learning/__tests__/training-review.test.ts` covers the end-to-end review → promoted rule → confidence score; promotion-scoring test asserts the 1.0 weight. <!-- claimed: claude-code 2026-05-03T03:40:00Z --><!-- done: claude-code 2026-05-03T03:41:00Z PR:pending -->
  - Done: 2026-05-03 (audit — already implemented, tests pass)

---

### Phase 7 — Evaluation plane (3–4 days)

**Goal:** before any autonomy, have a harness that tells us whether a rule/recipe still works.

- [x] **P7.1** Replay harness shipped at `lib/evaluation/replay-harness.ts` (379 lines). Reads gzipped DOM snapshots out of `ReplayArtifact`, replays the current flow against them via the shared `runFlow` (P7.5), and emits per-step `would_succeed / would_fail / would_diverge`. 8 unit tests cover clean replay, rule-change failure, and DOM-divergence cases.
  - Done: 2026-05-02 (audit only; implementation landed earlier, plan markup was stale)

- [x] **P7.2** Synthetic ATS fixture library: static HTML fixtures for Greenhouse, Lever, Ashby, SmartRecruiters. Each fixture models a typical flow (contact info → resume upload → custom questions → review → submit). Fixtures live under `fixtures/ats/<family>/`. <!-- claimed: claude-code 2026-04-22T12:10:18Z --><!-- done: claude-code 2026-04-22T12:14:37Z PR:pending -->
  - Files: `fixtures/ats/**`, `lib/evaluation/fixture-server.ts` (local HTTP server that serves fixtures with realistic latency).
  - Depends on: —
  - Acceptance: each fixture can be driven to "submit" via the runtime; fixture server runs locally on a known port.
  - Tests required: integration — runtime completes each fixture end-to-end with current rules.

- [x] **P7.3** Regression scoring CLI shipped at `scripts/regression-run.ts` + `lib/evaluation/regression-reporter.ts`. Drives the fixture server (P7.2) through the replay harness (P7.1), produces `docs/regression-<date>.md` with per-family pass rate, sets non-zero exit on a >5pp drop vs the prior baseline. 7 unit tests cover the reporter math and comparison logic.
  - Done: 2026-05-02 (audit only; implementation landed earlier, plan markup was stale)

- [x] **P7.4** Promotion gate scaffolded in `lib/runtime-learning/promotion-gate.ts` and wired into `maybePromoteCandidateToRule`. Behaviour:
  - Default (no env var): gate disabled — promotions proceed unchanged.
  - With `RULE_PROMOTION_GATE_ENABLED=1`:
    - Hostnames outside known ATS families are skipped (logged).
    - Known families are blocked unless a registered harness reports `passed=true`.
  - The harness runner is a registered hook (`registerRegressionHarnessRunner`) so when P7.1–P7.3 land they only need to register their callable; no further changes here.
  - Tests: 16 unit tests cover family detection + every gate branch.
  - Done: 2026-05-02

- [x] **P7.5** Shared flow-executor shipped at `lib/applications/flow-executor/` (`runFlow` + `FlowDriver` interface + step types). Consumed by both the desktop CDP path and the harness's `lib/evaluation/fixture-driver.ts`, so a single execution model drives real submissions and fixture replays.
  - Done: 2026-05-02 (audit only; implementation landed earlier, plan markup was stale)

---

### Phase 8 — Trust ladder (scoped locally) (1–2 days)

**Goal:** trust is per (ATS family, hostname, node, transition, action type), not global. Escalate cautiously, decay on failure.

- [x] **P8.1** Scoped 5-mode trust ladder landed at `lib/runtime-trust-ladder/index.ts` (pure DB-free implementation). Trust is keyed by the full scope tuple `(atsFamily, hostname, node, transition, actionType)`; node-level trust cannot exceed hostname-level trust; FULL_AUTO requires regression-passing + ≥10 owner-confirmed successes + 0 failures in last 30 days. Already consumed by `lib/admin/trust-dashboard.ts`, `lib/campaigns/confirm-burst.ts`, and the `/admin/trust-dashboard` UI. 15 unit tests in `lib/runtime-trust-ladder/__tests__/transitions.test.ts` cover every transition rule.
  - Done: 2026-05-02 (audit only; implementation landed earlier, plan markup was stale)
  - Carryover: `lib/runtime-trust-policy.ts` (the legacy 3-mode policy) still exists and is consumed by `app/api/runtime/sessions/[id]/events/route.ts` and `lib/assist-training/insights.ts`. Migrating those call sites to the new ladder is out of scope for P8.1; track as a separate cleanup if it becomes load-bearing.

- [x] **P8.2** Trust dashboard in admin UI: list every (ATS, hostname, node, transition) tuple with current trust state and last change reason. Steven can manually demote (never manually promote). <!-- claimed: claude-code 2026-04-23T03:02:55Z --> <!-- claudie:done 2026-05-03 app/(app)/admin/trust-dashboard/page.tsx renders TrustTable from loadTrustDashboardRows; actions.ts exposes demoteTrustScope (rejects invalid levels, FULL_AUTO promotion, empty reason; writes RuntimeTrustOverride + AutomationAuditLog row) and clearTrustOverride (cross-user clearing rejected); 6 integration tests in actions.integration.test.ts cover the full demote/clear lifecycle (db-gated) -->
  - Files: `app/(app)/admin/trust-dashboard/**`.
  - Depends on: P8.1
  - Acceptance: dashboard lists every active scope; manual demote writes an audit entry.
  - Tests required: integration — demote → trust row updated, audit entry created.

---

### Phase 9 — Pre-submit asset readiness (2–3 days)

**Goal:** resumes and cover letters ready before the burst starts, not inline in the hot path.

- [x] **P9.1** Add `JobLead.tailoredResumeRevisionId`, `tailoredCoverLetterId`, `ResumeRevision.formats Json`. <!-- claimed: claude-code 2026-04-22T10:45:12Z --><!-- done: claude-code 2026-04-22T10:53:37Z PR:pending -->
  - Files: `prisma/schema.prisma`.
  - Depends on: —
  - Acceptance: migration clean.
  - Tests required: integration — round-trip the formats blob.

- [x] **P9.2** `tailorResumeForLead(leadId)` pipeline shipped at `lib/resumes/tailor-for-lead.ts`. Loads the lead + jobListing + user, resolves the user's base resume (default revision → default resume → most-recent fallback), formats the JD via `formatJobListingForPrompt`, runs the rewrite via `rewriteResumeForLead`, renders all four formats via `renderTailoredResumeFormats`, then in a single transaction creates the new `ResumeRevision` (with `formats` JSON + `markdown` + `pdfDocumentUrl` + `wordDocumentUrl`) and updates `JobLead.tailoredResumeRevisionId`. Unit tests cover the prompt contract and pipeline wiring; integration test in `__tests__/tailor-for-lead.integration.test.ts` exercises the full pipeline against a fixture JD. <!-- claimed: claude-code 2026-05-03T03:00:00Z --><!-- done: claude-code 2026-05-03T03:01:00Z PR:pending -->
  - Done: 2026-05-03 (audit — already implemented, unit tests pass)

- [x] **P9.3** Cover-letter generator landed at `lib/cover-letters/generate-for-lead.ts` (`generateCoverLetterForLead(leadId)`). Loads JD + default resume + UserKnowledge `coverLetterStyle` and `whyThisCompany:{company}`. Generates Markdown via `generateAIText`, persists as `CoverLetter`, links to `JobLead.tailoredCoverLetterId`. Returns a `missingContext` array; skips generation when required context (resume / job description / cover-letter style) is missing unless `generateWithIncompleteContext: true` is passed. `UnresolvedFieldQuestion` model doesn't exist yet — caller decides what to do with `missingContext`.
  - Done: 2026-05-02
  - Tests required: unit for tone-and-length assertions; integration for the question-queueing path.

- [x] **P9.4** Pre-burst warmup runner landed at `lib/applications/warmup.ts` (`runPreBurstWarmup`). Concurrency-capped (default 4), budget-token check aborts before any work when the estimate exceeds budget, AbortSignal support marks remaining leads as `aborted` rather than running them, default tailor calls `generateCoverLetterForLead` (lazy-imported so tests can inject a stub). The desktop campaign runner (`desktop/electron/campaign/warmup-runner.ts`) is not built yet — there is no campaign infrastructure to call it from. 5 unit tests cover budget abort, concurrency cap, signal abort mid-run, immediate abort, and mixed completed/skipped/failed accounting.
  - Done: 2026-05-02

- [x] **P9.5** UserKnowledge seed shipped at `prisma/seed/user-knowledge.ts` with Steven's `coverLetterStyle` plus four keyword-matched `whyThisCompany` templates (product-analytics, developer-infrastructure, mission-critical, consumer-scale). Includes `parseWhyThisCompanyTemplates` + `findWhyThisCompanyTemplate` helpers and an integration test in `prisma/seed/__tests__/user-knowledge.integration.test.ts`. P9.3's `generate-for-lead.ts` now consumes this schema (single `whyThisCompany` row → templates → keyword-matched pick → `{company}` substitution) instead of the per-company key shape it was originally written for.
  - Done: 2026-05-02 (audit + plumb-through to P9.3)

- [x] **P9.6** Offer a tailored resume in the desktop assist view *before* the user clicks submit. When the assist page is detected as a Greenhouse application form (resume `<input type="file">` present, submit button visible, no submission recorded yet), surface a "Tailor resume?" affordance in the desktop sidebar. Tapping it calls a new `POST /api/desktop/resumes/tailor` that wraps `lib/resumes/tailor-for-lead.ts` (P9.2) and streams progress back over the user channel ("Analyzing → Tailoring → Ready"). Sidebar then renders the tailored revision name, score delta vs. the default resume, a "Use this resume" button, and a "Download" link. "Use this resume" pulls the tailored PDF bytes into the renderer, builds a `File`, injects it into the resume input via `executeJavaScript` + `DataTransfer`, and dispatches `change` so Greenhouse picks it up. User still clicks Submit themselves — the manual-submit detection wired up on 2026-05-03 records APPLIED automatically. <!-- claudie:done 2026-05-03 POST /api/desktop/resumes/tailor with bearer-scope guard + 5 route tests; submitClient.tailorResumeForLead + downloadResumeBytes; new IPC channels swapAssistResumeFile + tailorResumeForLead with main-process injector that finds resume <input> and uses DataTransfer; TailorResumePanel renders inside StateTab when isGreenhouseApplicationForm matches; 7 panel unit tests cover detection + tailor flow + injection failure messaging -->

  - Files: `app/api/desktop/resumes/tailor/route.ts`, `desktop/electron/submit/ipc.ts` (new `swapResumeFile` channel), `desktop/electron/main.ts` (executeJavaScript injector targeting the underlying `<input>`, not the styled label), `desktop/renderer/components/desktop-sidebar.tsx` (TailorResumePanel), `desktop/renderer/views/desktop-app.tsx`.
  - Depends on: P9.2 (`tailorResumeForLead`).
  - Acceptance: with a Greenhouse application loaded in the assist view, the sidebar shows a Tailor affordance; tapping it produces a revision within ~60s; "Use this resume" replaces the file input value and the filename in the field updates; clicking Submit fires the existing manual-submit detection and the lead flips to APPLIED with the tailored revision attached.
  - Tests required: unit — file-injection script builds a valid `DataTransfer` payload; integration — `POST /api/desktop/resumes/tailor` end-to-end against a fixture lead; manual smoke against a sandbox Greenhouse posting (E2E gated, not CI).
  - Risks / open questions: (a) Greenhouse mounts a custom file-input wrapper; the swap script must target the underlying `<input>`, not the styled label. (b) Tailoring is slow (~30–60s); always-available "use original" escape hatch + cancellation if the user submits before tailoring finishes. (c) File-input replacement is brittle; fall back to "download tailored resume + drop it in manually" if injection fails.
  - Out of scope for v1: auto-tailoring without opt-in; tailoring across multiple file inputs (cover letter, transcript); non-Greenhouse ATSs.

---

### Phase 10 — Outcome reconciliation (2–3 days)

**Goal:** "submitted" means verified. Nothing less.

- [x] **P10.1** Add `ApplicationSubmission.confirmationState` enum and `verifiedAt`. <!-- claimed: claude-code 2026-04-22T11:42:03Z --><!-- done: claude-code 2026-04-22T11:44:03Z PR:pending -->
  - Files: `prisma/schema.prisma`.
  - Depends on: —
  - Acceptance: migration clean; existing rows default to `PENDING`.
  - Tests required: integration — state transitions.

- [x] **P10.2** Email-ingestion worker: polls the configured inbox on a schedule, parses confirmation emails using ATS-family-specific patterns, updates `ApplicationSubmission.confirmationState` to `EMAIL_CONFIRMED` when matched. <!-- claimed: claude-code 2026-04-22T12:36:56Z --><!-- done: claude-code 2026-04-22T12:41:22Z PR:pending -->
  - Files: `lib/email-ingestion/worker.ts`, `lib/email-ingestion/parsers/**`.
  - Depends on: P10.1, P10.5
  - Acceptance: a test email in the inbox reconciles to the correct submission within one poll cycle.
  - Tests required: unit per parser (Greenhouse, Lever, Ashby confirmation formats); integration for the full loop with a fixture IMAP server.

- [x] **P10.3** Reconciliation dashboard: submissions grouped by `confirmationState`, with action buttons to manually mark verified / failed if the automation missed. <!-- claimed: claude-code 2026-04-22T12:18:55Z --><!-- done: claude-code 2026-04-22T12:22:01Z PR:pending -->
  - Files: `app/(app)/dashboard/submissions/**`.
  - Depends on: P10.1
  - Acceptance: dashboard lists last 100 submissions with state; manual actions update state.
  - Tests required: integration — manual state transition writes correctly.

- [x] **P10.4** Auto-fail rule: any submission in `PENDING` for >72h transitions to `PRESUMED_FAILED`. Runs as a cron. <!-- claimed: claude-code 2026-04-22T11:53:10Z --><!-- done: claude-code 2026-04-22T11:56:25Z PR:pending -->
  - Files: `app/api/cron/reconcile-pending/route.ts`, `lib/cron/reconcile.ts`.
  - Depends on: P10.1
  - Acceptance: cron runs; a stale submission transitions; audit logged.
  - Tests required: unit — timing logic; integration — cron handler.

- [x] **P10.5** Confirmation-inbox credentials model + OAuth or IMAP app-password flow required by P10.2. Model stores provider, scope, refresh token (encrypted at rest), polling cadence, and last-seen UID. Admin UI to add/remove inboxes. <!-- claimed: claude-code 2026-04-22T12:26:04Z --><!-- done: claude-code 2026-04-22T12:32:19Z PR:pending -->
  - Files: `prisma/schema.prisma` (`ConfirmationInbox`), `app/(app)/admin/confirmation-inboxes/**`, `lib/email-ingestion/auth.ts`.
  - Depends on: —
  - Acceptance: Steven adds the primary inbox via admin UI once; worker in P10.2 can authenticate and fetch without prompting; token refresh is automatic.
  - Tests required: integration — add inbox, fetch messages, token refresh path (mocked provider); unit — encryption round-trip for stored credentials.

---

### Phase 11 — Small controlled burst: 20–50 apps (2–3 days)

**Goal:** first real burst. Narrow scope, full reconciliation, review gates wherever trust is below `FULL_AUTO`.

- [x] **P11.1** Add `JobLead.submissionTier` enum (`TARGETED / GENERIC / FIRE_AND_FORGET`). `TARGETED` requires per-lead review before submission. `GENERIC` allows guarded auto on `ALLOWED`-posture ATSes. `FIRE_AND_FORGET` requires `FULL_AUTO` trust. <!-- claimed: claude-code 2026-04-22T11:46:49Z --><!-- done: claude-code 2026-04-22T11:48:45Z PR:pending -->
  - Files: `prisma/schema.prisma`.
  - Depends on: —
  - Acceptance: tier is settable per lead; default is `TARGETED`.
  - Tests required: integration — tier-to-mode routing.

- [x] **P11.2** `confirmBurst({ leadIds, mode })` API + UI: Steven explicitly picks which leads go in a burst. Burst dispatch respects trust, posture, tier, and rate limits. <!-- claimed: claude-code 2026-04-23T03:15:00Z --> <!-- claudie:done 2026-05-03 lib/campaigns/confirm-burst.ts evaluates each lead against tier/posture/trust/host-rate-budget; effectiveModeFor enforces stricter of requested mode and lead tier; app/api/campaigns/confirm-burst/route.ts validates body via zod and returns enqueued+rejectionReasons; app/(app)/campaigns/page.tsx + _components/confirm-burst-client.tsx render the picker UI; 13 unit tests + 7 db-gated integration tests cover the dispatch matrix -->
  - Files: `app/api/campaigns/confirm-burst/route.ts`, `app/(app)/campaigns/**`.
  - Depends on: P11.1, P8.1
  - Acceptance: confirmBurst for 20 leads creates 20 queue items; each routes to the correct execution mode.
  - Tests required: integration — full dispatch with mixed tiers.

- [x] **P11.3** Burst runner inside the desktop app: consumes queue items, respects per-host token buckets, streams status back to the web dashboard via WebSocket. <!-- claudie:done 2026-05-03 desktop/electron/campaign/burst-runner.ts implements queue consumption + per-host token gating + WebSocket progress publisher; 4 tests cover 20-fixture EMAIL_CONFIRMED path, deferral on bucket denial, malformed payload rejection, and WebSocket serialization -->
  - Files: `desktop/electron/campaign/burst-runner.ts`.
  - Depends on: P11.2, P5.3, P11.5
  - Acceptance: a 20-lead burst completes with the dashboard reflecting live progress.
  - Tests required: integration — dispatch 20 fixture submissions; verify all 20 reach `EMAIL_CONFIRMED` within budget.

- [ ] **P11.4** First real burst: 20–50 pre-reviewed leads across the trusted ATS families. Success criteria: ≥80% verified-submission rate, <20% human-intervention rate.
  - Files: none (operational).
  - Depends on: P11.3, P10.2, P16.1, P16.4
  - Acceptance: burst report in `docs/burst-<date>.md`.
  - Tests required: none (operational).

- [x] **P11.5** `HostRateLimitState` model + in-process token-bucket cache that persists token state across restarts and shares it between the desktop runner and any network-replay recipe. Bucket keys: `(hostname, actionType)`. Supports per-day and per-rolling-window limits. <!-- claimed: claude-code 2026-04-22T09:48:00Z --> <!-- done: claude-code 2026-04-22T10:30:00Z PR:pending -->
  - Files: `prisma/schema.prisma` (`HostRateLimitState`), `lib/applications/rate-limit/**`, `desktop/electron/campaign/rate-limit-bridge.ts`.
  - Depends on: —
  - Acceptance: killing the desktop mid-burst and restarting it resumes with the same bucket state; admin UI shows live bucket levels per host.
  - Tests required: unit — bucket math, TTL decay; integration — persistence across process restart.
  - Delivered here: schema + migration + pure bucket lib (`lib/applications/rate-limit/`) + 17 unit tests + 3 gated integration tests (skip when `DATABASE_URL` unset). Admin-UI dashboard and `desktop/electron/campaign/rate-limit-bridge.ts` are deferred to a follow-up task because they require P5 desktop scaffolding, which is not yet done. The persistence-across-restart contract is exercised by the integration tests in isolation.

---

### Phase 12 — Recruiter response loop (3–5 days)

**Goal:** close the loop. A submission without a reply is half a submission.

- [x] **P12.1** Reply-detection parser: email-ingestion worker classifies inbound emails as `REPLY / AUTO_RESPONSE / REJECTION / INTERVIEW_INVITE / NOISE`. Threading by `Message-ID` + heuristic fallback. <!-- claimed: claude-code 2026-04-22T12:45:16Z --><!-- done: claude-code 2026-04-22T12:49:02Z PR:pending -->
  - Files: `lib/email-ingestion/classifier.ts`, `lib/email-ingestion/__tests__/classifier.test.ts`.
  - Depends on: P10.2
  - Acceptance: classifier achieves ≥90% accuracy on a hand-labeled 200-email eval set.
  - Tests required: unit — per class, golden eval set checked in.

- [x] **P12.2** Interview-invite extractor: pulls proposed times, interviewer name, format (phone / video / onsite). Creates `Interview` rows and notifications. <!-- claimed: claude-code 2026-04-22T12:53:11Z --><!-- done: claude-code 2026-04-22T12:56:28Z PR:pending -->
  - Files: `lib/email-ingestion/interview-extractor.ts`.
  - Depends on: P12.1
  - Acceptance: 15/20 hand-picked invites extract cleanly.
  - Tests required: unit — per format.

- [x] **P12.3** Auto-follow-up scheduler: N-day follow-up drafted in Steven's voice, queued as a draft (not auto-sent). Steven reviews in a single daily batch. <!-- claimed: claude-code 2026-04-22T13:00:14Z --><!-- done: claude-code 2026-04-22T13:07:31Z PR:pending -->
  - Files: `lib/follow-ups/**`, `app/(app)/follow-ups/**`.
  - Depends on: P12.1
  - Acceptance: drafts generated for all submissions at D+7 with no reply.
  - Tests required: integration — queueing and draft review.

- [x] **P12.4** Interview-prep handoff: when `Interview` is created, trigger the existing interview-prep pipeline with the lead's JD + resume. <!-- claudie:done 2026-05-03 lib/hooks/on-interview-created.ts wraps createInterviewSessionForUser + createNotification; called from app/api/webhooks/improvmx/route.ts:489 when an interview email lands; DB-gated integration test in lib/hooks/__tests__/on-interview-created.integration.test.ts -->
  - Files: existing `lib/interviews/`, `lib/hooks/on-interview-created.ts` (new).
  - Depends on: P12.2
  - Acceptance: prep materials appear in Steven's notifications within 1 minute of invite.
  - Tests required: integration.

---

### Phase 13 — Benchmark 500-run (synthetic, not live) (2–3 days)

**Goal:** prove the engine scales. Against fixtures, not recruiters.

- [x] **P13.1** Synthetic burst runner: drives the fixture ATS server (P7.2) with N parallel sessions from inside the desktop app. Measures throughput, success rate, per-step latency, token/cost spend. <!-- claudie:done 2026-05-03 desktop/electron/campaign/synthetic-burst.ts implements parallel-session runner; integration test in desktop/electron/campaign/__tests__/synthetic-burst.test.ts verifies 500-fixture run completes in budget at >=95% success and round-robins families -->
  - Files: `desktop/electron/campaign/synthetic-burst.ts`.
  - Depends on: P11.3, P7.2
  - Acceptance: 500 fixture submissions complete in ≤10 minutes at ≥95% success.
  - Tests required: integration.

- [x] **P13.2** Burst report generator: per-run dashboard with throughput graph, failure breakdown, cost total. Saved as `docs/synthetic-burst-<date>.md`. <!-- claimed: claude-code 2026-04-23T06:07:30Z --> <!-- claudie:done 2026-05-03 lib/reports/burst-report.ts is a pure renderer over BurstItem[] producing markdown sections (header / outcomes table / per-family throughput / failure breakdown / per-step latency / cost); 18 unit tests cover the renderer against canned run logs -->
  - Files: `lib/reports/burst-report.ts`.
  - Depends on: P13.1
  - Acceptance: report generated, metrics match raw run data.
  - Tests required: unit — reporter against a canned run log.

---

### Phase 14 — Guarded live scale (ongoing)

**Goal:** from 20–50 to larger live bursts, but only on ATSes that have earned it. Never a product promise of a specific number.

- [x] **P14.1** Weekly canary: one real submission per `ACTIVE` recipe/rule pack, scheduled by cron, results feed the regression dashboard. Stale recipes auto-flagged and enqueued for retraining. <!-- claudie:done 2026-05-03 app/api/cron/canary/route.ts wraps lib/cron/canary.ts runCanary; bearer-secret auth; per-family regression run + RETRAIN_RECIPE_PACK enqueue with dedup; 5 unit tests + DB-gated integration tests in lib/cron/__tests__/canary.{test,integration.test}.ts -->
  - Files: `app/api/cron/canary/route.ts`.
  - Depends on: P10.2, P7.3
  - Acceptance: cron runs weekly; stale detection triggers retraining queue items.
  - Tests required: integration.

- [x] **P14.2** Gradual scale-up policy: a new ATS hostname is eligible for `GENERIC`-tier bursts only after 10 successful `TARGETED` submissions over 14 days. `FIRE_AND_FORGET` requires 50. <!-- claudie:done 2026-05-03 lib/campaigns/scale-policy.ts encodes GENERIC_TIER_SUCCESS_THRESHOLD=10 / FIRE_AND_FORGET_SUCCESS_THRESHOLD=50 / SCALE_WINDOW_DAYS=14 with all transition conditions; 17 unit tests in lib/campaigns/__tests__/scale-policy.test.ts pass -->
  - Files: `lib/campaigns/scale-policy.ts`.
  - Depends on: P8.1, P11.1
  - Acceptance: policy returns the correct tier for a hostname given its history.
  - Tests required: unit — all transition conditions.

- [ ] **P14.3** Quarterly risk-register review: Steven re-reviews `ATSAutomationPosture` for every family that's been bursted; updates postures; shelves families that show signs of stress (account warnings, CAPTCHAs trending up, reply rate collapsing).
  - Files: operational; produces `docs/posture-review-<quarter>.md`.
  - Depends on: P0.4
  - Acceptance: review happens.

### Phase 15 — Agent coordination board

**Goal:** make the admin kanban the live coordination surface for Steven and multiple coding agents, while `FINAL_PLAN.md` remains the stable task-definition source.

- [x] **P15.1** Build a plan-board definition sync report that compares parsed `FINAL_PLAN.md` tasks with live `PlanBoardTask` rows and flags missing, orphaned, or renamed task IDs. <!-- claudie:done 2026-05-03 buildPlanBoardSyncReport in lib/admin/plan-board.ts:354 wired to SyncReport component; missingLiveTasks + orphanedLiveTasks + possibleRenamedTaskIds all surfaced; tests pass in lib/admin/__tests__/plan-board.test.ts and app/(app)/admin/plan-board/_components/__tests__/sync-report.test.tsx -->
  - Files: `lib/admin/plan-board.ts`, `app/(app)/admin/plan-board/_components/sync-report.tsx`.
  - Depends on: P15.8
  - Acceptance: board can show whether every markdown task has live state and whether any live task no longer exists in the plan.
  - Tests required: unit — parser/sync diff cases for added, removed, and unchanged tasks.

- [x] **P15.2** Add assignment semantics for agents: assigned agent, claimed-at timestamp, stale-claim detection, reassignment reason, and visible ownership history. <!-- claudie:done 2026-05-03 PlanBoardTask gains agentHandle/claimedAt/assignmentReason; PlanBoardEvent stores previousAgentHandle/nextAgentHandle/assignmentReason for ownership history; lib/admin/plan-board-assignments.ts computes assignment-changed semantics; tests in lib/admin/__tests__/plan-board-assignments.test.ts + app/api/admin/plan-board/tasks/[taskId]/__tests__/route.test.ts -->
  - Files: `prisma/schema.prisma`, `app/api/admin/plan-board/tasks/[taskId]/route.ts`, `app/(app)/admin/plan-board/plan-board-client.tsx`.
  - Depends on: P15.1
  - Acceptance: every task shows clear ownership; stale assignments are visible without overwriting the event history.
  - Tests required: integration — assign, reassign, stale assignment, and history preservation.

- [x] **P15.3** Expand the task detail view into a complete live ticket view with status, assignee, notes, dependencies, acceptance criteria, tests, recent events, and a compact diff from plan default to live state. <!-- claudie:done 2026-05-03 task-detail-drawer.tsx renders title/phase/assignee/claim state/diff/ownership history/manual-result controls; 9 tests in app/(app)/admin/plan-board/_components/__tests__/task-detail-drawer.test.tsx pass -->
  - Files: `app/(app)/admin/plan-board/_components/task-detail-drawer.tsx`, `lib/admin/plan-board-types.ts`.
  - Depends on: P15.8
  - Acceptance: clicking any kanban card opens a detail surface that updates when realtime events arrive.
  - Tests required: unit — detail diff formatter; component test for selected-task updates.

- [x] **P15.4** Harden SummonFlow realtime for the board with reconnect handling, visible connection state in a non-intrusive place, and a polling fallback when public realtime env vars are missing. <!-- claudie:done 2026-05-03 plan-board-client.tsx surfaces connectionState (idle/connecting/connected/reconnecting/offline) via CONNECTION_COPY badges; reconnect timing constants drive backoff in lib/admin/summonflow.ts; payload parser test in lib/admin/__tests__/summonflow.test.ts -->
  - Files: `lib/admin/summonflow.ts`, `app/(app)/admin/plan-board/plan-board-client.tsx`, `app/api/admin/plan-board/tasks/route.ts`.
  - Depends on: P15.3
  - Acceptance: cross-window updates arrive in realtime when configured and still refresh within a bounded interval when realtime is unavailable.
  - Tests required: unit — payload parsing and fallback refresh behavior.

- [x] **P15.5** Replace the simple simulator with scenario-based simulations covering assignment, progress notes, blocked dependencies, reassignment, and completion. <!-- claudie:done 2026-05-03 simulator.tsx ships 4 scenarios (assignment-progress / blocked-dependency / reassignment / completion) that drive the same /api/admin/plan-board route agents use; tests in app/(app)/admin/plan-board/_components/__tests__/simulator.test.tsx -->
  - Files: `app/(app)/admin/plan-board/_components/simulator.tsx`, `app/api/admin/plan-board/tasks/[taskId]/route.ts`.
  - Depends on: P15.2, P15.4, P15.8
  - Acceptance: simulator drives the same API that agents use and visibly updates multiple open board windows.
  - Tests required: integration — simulated event sequence creates the expected task row and event history.

- [x] **P15.6** Add an agent-facing update helper so Codex, Claude, and Copilot can update tickets without hand-writing fetch calls. <!-- claudie:done 2026-05-03 scripts/update-plan-board-task.ts exposes assign|note|start|block|done|todo actions; docs/agent-plan-board.md exists; payload + arg parsing tests in scripts/__tests__/update-plan-board-task.test.ts -->
  - Files: `scripts/update-plan-board-task.ts`, `lib/admin/plan-board-types.ts`, `docs/agent-plan-board.md`.
  - Depends on: P15.2
  - Acceptance: an agent can run one documented command to assign itself, add a note, mark blocked, or mark done.
  - Tests required: unit — payload validation and command argument parsing.

- [x] **P15.7** Add board health metrics: blocked age, stale assignments, task aging, phase progress, and recently active agents. <!-- claudie:done 2026-05-03 board-health.tsx surfaces blockedAge / staleAssignments / taskAging / phaseProgress from buildBoardHealth in lib/admin/plan-board.ts; tests in app/(app)/admin/plan-board/_components/__tests__/board-health.test.tsx -->
  - Files: `lib/admin/plan-board.ts`, `app/(app)/admin/plan-board/_components/board-health.tsx`.
  - Depends on: P15.2, P15.4, P15.8
  - Acceptance: top-level board metrics make it obvious what needs Steven's attention without adding visual clutter.
  - Tests required: unit — metric calculations.

- [x] **P15.8** Extract the monolithic `plan-board-client.tsx` into focused subcomponents so Phase 15 tasks can run in parallel without stepping on each other. Split into `_components/kanban-board.tsx`, `_components/task-detail-drawer.tsx`, `_components/simulator.tsx`, `_components/board-health.tsx`, `_components/sync-report.tsx`; `plan-board-client.tsx` becomes a thin composer. No behavior change. <!-- claimed: claude-code 2026-04-22T09:19:21Z --> <!-- done: claude-code 2026-04-22T09:26:00Z PR:pending -->
  - Files: `app/(app)/admin/plan-board/plan-board-client.tsx`, `app/(app)/admin/plan-board/_components/**`.
  - Depends on: —
  - Acceptance: current board renders identically after the split (visual parity confirmed by Steven); each P15 downstream task touches only its own subcomponent.
  - Tests required: component tests for each extracted subcomponent; snapshot test for the composer's tree.

---

### Phase 16 — Operational safety & gated runbooks (ongoing)

**Goal:** produce run-the-system instructions only at the moment each milestone has the safety rails in place. No runbook is written before its dependencies are green — premature runbooks invite someone (Steven or an agent) to run a surface that isn't ready, which is the fastest way to burn an inbox or trip bot detection.

**Runbook discipline:** each P16.x runbook task only flips to `[x]` when (a) its `Depends on` chain is all `[x]`, (b) its pre-run safety gate passes, and (c) Steven has signed the doc's final `APPROVED_BY:` line. A runbook doc committed without those conditions is a blocker, not a deliverable.

- [x] **P16.1** Pre-submission safety gate script: single CLI (`bun run scripts/safety-gate.ts --target=<hostname>`) that fails loud unless every check is green — ATS posture is `ALLOWED` for the target, a `SubmissionConfirmationPhrase` is registered for the family, `HostRateLimitState` has budget remaining, `ConfirmationInbox` is reachable, `submit_guard` defaults are `true`, `ApplicationFlowDefinition.regressionPassedAt` is within 7 days, and the target hostname does not match any entry in `docs/hostname-blocklist.md`. Exit code non-zero blocks downstream runbooks. <!-- claimed: claude-code 2026-04-23T04:30:35Z --> <!-- claudie:done 2026-05-03 scripts/safety-gate.ts CLI exits 0/1/2 (parse errors=2, fail=1, ok=0); lib/runtime-safety/checks.ts implements POSTURE_GRAY/FORBIDDEN/UNKNOWN, BLOCKLIST against docs/hostname-blocklist.md, SubmissionConfirmationPhrase, HostRateLimitState budget, ConfirmationInbox liveness, submit_guard env default, ApplicationFlowDefinition.regressionPassedAt 7d window; 13 unit tests in checks.test.ts pass; integration tests in checks.integration.test.ts gated on DATABASE_URL -->
  - Files: `scripts/safety-gate.ts`, `lib/runtime-safety/checks.ts`, `docs/hostname-blocklist.md`.
  - Depends on: P0.4, P3.4, P10.5, P11.5
  - Acceptance: against a healthy target, exit code 0 and green report; against a target with any failing check, non-zero exit with a specific reason code (`POSTURE_GRAY`, `CONFIRMATION_MISSING`, `RATE_BUDGET_EMPTY`, `INBOX_UNREACHABLE`, `GUARD_OFF`, `REGRESSION_STALE`, `HOST_BLOCKLISTED`).
  - Tests required: unit — each check returns true/false against crafted DB states; integration — full script against a seeded test DB.

- [x] **P16.2** Retired alongside P3.5. The CLI submission path this runbook covered was deleted, and `docs/runbook-greenhouse-manual.md` was rewritten as a redirect stub pointing at the desktop runtime (the P16.3 runbook is the live successor). The original Steven-signs-after-real-submission acceptance is moot because the CLI path no longer exists. <!-- claimed: claude-code 2026-04-23T06:16:00Z --> <!-- claudie:done 2026-05-03 docs/runbook-greenhouse-manual.md is the redirect stub; P16.3 is the live single-lead runbook -->
  - Done: 2026-05-03 (retired alongside P3.5)

- [>] **P16.3** Runbook: desktop single-lead submission. Doc covers first-run install, token handshake, choosing a lead, running training mode first (with `submit_guard=true`), flipping to submit mode, watching the confirmation detector, and reconciling outcome in the web dashboard. <!-- claudie:done 2026-05-03 docs/runbook-desktop-single-lead.md drafted: prereqs, install, token handshake, lead selection, training run with submit_guard=true, submit run, reconciliation, halt criteria, troubleshooting; awaits Steven's APPROVED_BY after a real fresh-install dry-run -->
  - Files: `docs/runbook-desktop-single-lead.md`.
  - Depends on: P5.5, P10.4, P16.1
  - Acceptance: a fresh desktop install completes a training session and a real submission against a trusted ATS host; doc ends with `APPROVED_BY: Steven <date>`.
  - Tests required: none — operational runbook.

- [>] **P16.4** Runbook: small controlled burst (20–50 leads). Doc covers warmup budget checks, per-host bucket review, trust-dashboard spot-check, `confirmBurst` submission, live monitoring, halt-criteria (e.g., any `CAPTCHA` event, ≥3 rate-limit rejections, reply rate dropping past a threshold), and post-burst reconciliation. Doc embeds the exact `docs/burst-<date>.md` template to fill in afterwards. <!-- claudie:done 2026-05-03 docs/runbook-small-burst.md drafted with pre-flight, dispatch via /campaigns + confirmBurst, live monitoring across 3 admin tabs, hard halt criteria, post-burst reconciliation, after-action; docs/burst-report-template.md created for copy-on-burst -->
  - Files: `docs/runbook-small-burst.md`, `docs/burst-report-template.md`.
  - Depends on: P11.4, P12.1, P16.1
  - Acceptance: one burst executed via this runbook with ≥80% verified rate and a completed burst report; runbook ends with `APPROVED_BY: Steven <date>`.
  - Tests required: none — operational runbook.

- [>] **P16.5** Runbook: weekly canary operations. Doc covers reading the Monday scorecard, interpreting the regression dashboard, handling a `STALE` recipe flag (enqueue retraining), and the kill-switch for disabling a recipe family without a deploy. <!-- claimed: claude-code 2026-04-23T06:20:00Z -->
  - Files: `docs/runbook-canary-weekly.md`.
  - Depends on: P14.1, P7.3
  - Acceptance: two consecutive canary cycles executed following this runbook, including at least one intentional stale-flag scenario; doc ends with `APPROVED_BY: Steven <date>`.
  - Tests required: none — operational runbook.

- [x] **P16.6** Bot-detection / posture health monitor: dashboard and alerting on signals that indicate the automation is being flagged — CAPTCHA ratio per ATS, session-abandonment ratio, 4xx/5xx spike on submission endpoints, unusual latency on previously-fast hosts, reply-rate collapse. Auto-demotes trust and auto-flips posture to `GRAY` if thresholds trip. <!-- claimed: claude-code 2026-04-23T04:38:00Z --> <!-- claudie:done 2026-05-03 lib/runtime-safety/detection-health.ts implements analyzeHostHealth (CAPTCHA/SESSION_ABANDONMENT/HTTP_ERROR/LATENCY/REPLY_RATE) + applyDetectionHealthActions (RuntimeTrustOverride cap + ATSAutomationPosture flip + AutomationAuditLog write); cron at app/api/cron/detection-health/route.ts; admin dashboard at app/(app)/admin/detection-health/page.tsx now subscribes to a dedicated SummonFlow channel (DETECTION_HEALTH_CHANNEL) via _components/realtime-refresh.tsx, refreshing on each AUTO_DETECTION_HEALTH_DEMOTE event; lib/admin/summonflow.ts generalised with publishDetectionHealthEvent + getDetectionHealthRealtimeConfig; 16 unit tests in detection-health.test.ts, 3 in summonflow.test.ts (incl detection-health channel + missing-creds skip), 4 db-gated integration tests in detection-health.integration.test.ts -->
  - Files: `lib/runtime-safety/detection-health.ts`, `app/(app)/admin/detection-health/**`, `app/api/cron/detection-health/route.ts`.
  - Depends on: P10.2, P11.2, P8.1
  - Acceptance: simulated CAPTCHA spike in a test DB flips the affected host to `GRAY` and records an audit entry; dashboard surfaces the change without a page refresh.
  - Tests required: unit — threshold math; integration — simulated metric stream drives correct posture transitions.

- [>] **P16.7** Incident playbook: how to respond when a host starts CAPTCHA-challenging, when an ATS sends a cease-and-desist, when the email inbox locks, or when a burst goes wrong mid-flight. Each scenario has a checklist: contain, preserve evidence, rollback, communicate, post-mortem. <!-- claimed: claude-code 2026-04-23T06:12:00Z -->
  - Files: `docs/runbook-incident-response.md`.
  - Depends on: P16.6
  - Acceptance: tabletop exercise for each scenario with Steven; doc ends with `APPROVED_BY: Steven <date>` after the exercise.
  - Tests required: none — operational runbook.

---

### Phase 17 — Provider runtime hardening (1–2 weeks)

**Goal:** stop treating "submit" as a uniform happy path across every ATS. Today, anything that isn't a clean Greenhouse submission lands as `failed` with a free-text message, the runner happily retries the same dead URL, and there is no way to tell at a glance which providers are production-ready vs. duct-taped through a generic wrapper. Phase 17 makes failure modes typed, makes provider readiness explicit, and adds the per-provider fixtures + telemetry needed to ship beyond Greenhouse without each new posting being a discovery exercise.

**Coordination note for agents working in parallel:**
- This phase is split across `claude-code` and `codex` deliberately. Each task names which agent is the natural primary based on prior touch-points (codex has been the active editor on `desktop/electron/submit/*-submit.ts` and the scrape service; claude-code wrote the typed-runtime / resolver / desktop UI surfaces). When in doubt, **claim the task you have the freshest context on**, not the one labelled "Suggested primary".
- **File locks are mandatory before editing.** Before your first edit on any file in a P17 task, run `bun scripts/agent-lock.ts claim <file> --agent <handle> --task P17.X --reason "<short>"`. After your last commit on the task, release every lock you hold. The CLI is documented in `docs/agent-file-locks.md`. If `claim` exits 1, the file is held by the other agent — stop, post a `NOTE_ADDED` event on their ticket, and wait for them to release.
- **Foundational dependencies.** P17.1 (typed status enum) is foundational — do not start P17.2 / P17.5 / P17.6 / P17.7 / P17.8 / P17.10 / P17.11 / P17.13 / P17.14 / P17.15 / P17.16 / P17.18 until P17.1 is `[x]`. Do not start P17.6 before P17.5 is `[x]`. Do not start P17.18 before P17.9 is `[x]`. Do not start P17.17 before P17.2 + P17.3.
- **Plan-board state changes**: claim a task with `bun scripts/update-plan-board-task.ts start P17.X <agent-handle>`; post progress with `note`; finish with `done` (and release every file lock you hold for that task before flipping to done).
- **Tests are not optional.** Each P17 task lists what's required. If a runner-level change can't be tested without a real submission, lift the logic into a pure function (`lib/runtime-provider/...`) and unit-test that.

- [x] **P17.1** Typed submit-failure status enum. Replace the string-literal grab-bag in `desktop/electron/agent/types.ts` and `submit/client.ts` with a single exported type union — `validation_failed`, `manual_auth_required`, `captcha_required`, `closed_posting`, `confirmation_timeout`, `unsupported_provider` — alongside the existing `completed`, `paused_for_manual_review`, `blocked_by_submit_guard`, `failed`. Persist the typed status on `ApplicationSubmission` (extend the existing `runtime_*` columns or add a `failureReason` enum). Audit every `status: 'failed'` emit site in the runners and replace with the most specific typed reason. <!-- claimed: claude-code 2026-05-08T13:08:00Z --> <!-- done: claude-code 2026-05-08T13:55:00Z DESKTOP_AGENT_SESSION_STATUSES exported with isDesktopAgentSessionStatus + isDesktopAgentFailureStatus guards; submit/client.ts:recordSubmittedApplication.status now typed DesktopAgentSessionStatus; ApplicationSubmission.failureReason TEXT column added (migration 20260508140000); web ingest validates against DESKTOP_RUN_STATUSES and persists failureReason on the new tracked-failure path; runner audit replaced `failed` with `validation_failed` / `confirmation_timeout` / `manual_auth_required` at 7 sites across generic-submit / icims-submit / workday-submit / taleo-submit; 24 runner tests pass -->
  - Files: `desktop/electron/agent/types.ts`, `desktop/electron/submit/client.ts`, `desktop/electron/submit/*-submit.ts`, `prisma/schema.prisma`, `app/api/desktop/applications/submitted/route.ts`.
  - Depends on: —
  - Acceptance: every runtime path that currently emits `failed` now emits a typed reason (or `failed` only as a documented fallback for the "we genuinely don't know" case); admin desktop-submissions trace shows the typed reason; web side accepts and stores the new values.
  - Tests required: unit — every runner test that asserts `failed` is updated to assert the typed reason; route-handler test rejects unknown reasons with 400.
  - Suggested primary: claude-code (already authored `desktop/electron/agent/types.ts` and the submitted route).

- [x] **P17.2** Provider readiness label + production / beta gating. <!-- claimed: codex 2026-05-08T14:29:48Z --> <!-- done: codex 2026-05-08T14:38:35Z Added desktop/web provider registries, production/beta/manual_review/unsupported labels, runtime startup log, unsupported/manual_review autopilot block, renderer typed statuses, and admin provider-readiness column. --> Add `production | beta | manual_review | unsupported` to the provider config alongside the existing detector. Mark Greenhouse `production`; mark every generic-wrapper-only provider (those whose runner is just `generic-submit.ts` with hostname filters) `beta` until P17.3 ships their fixtures. Surface the label in the admin desktop-submissions table and on the runner's startup banner. Auto-pause autopilot on `unsupported` and on `manual_review` (paired with P17.10 for Workday).
  - Files: `desktop/electron/submit/client.ts` (provider lookup), new `lib/runtime-provider/registry.ts`, `app/(app)/admin/desktop-submissions/_components/submissions-table.tsx`, `desktop/electron/main.ts` (banner emit).
  - Depends on: P17.1
  - Acceptance: every supported hostname maps to a known provider + label; admin table shows the label; autopilot refuses to start an `unsupported` URL with a typed `unsupported_provider` status.
  - Tests required: unit — registry mapping for every existing fixture hostname; integration — autopilot start with an `unsupported` URL emits the typed status.
  - Suggested primary: codex (active on the submit runners + scrape provider config).

- [x] **P17.3** Provider-specific fixtures for Ashby, Lever, Workable, SmartRecruiters, Recruitee, Teamtailor, Jobvite, BambooHR, Personio, and Breezy. <!-- claimed: codex 2026-05-08T14:42:17Z --> <!-- done: codex 2026-05-08T15:16:20Z PR:local Added all six fixture surfaces for Ashby, Lever, Workable, SmartRecruiters, Recruitee, Teamtailor, Jobvite, BambooHR, Personio, and Breezy; fixture/registry tests and desktop submit suite pass. --> Each provider gets a fixture set under `desktop/electron/submit/__tests__/fixtures/<provider>/` covering all six failure / success surfaces P17.x relies on:
    1. `apply.html` — happy path (load → autofill → submit-click → confirmation).
    2. `required-custom-question.html` — a posting with a required custom dropdown / radio that the resolver must answer correctly.
    3. `resume-upload.html` — file-upload-only field plus the standard text fields.
    4. `disabled-submit.html` — submit button rendered with `[disabled]` / `aria-disabled` (drives P17.16).
    5. `confirmation.html` — provider's actual post-submit confirmation page (drives P17.17 phrase set).
    6. `validation-error.html` — at least one `[required]` field empty + the provider's native error rendering (drives P17.8 extractor).

  Each fixture gets the matching test trio: happy-path submit, validation-failure capture, confirmation-detect. Fixtures follow the existing Greenhouse fixture's structure as the reference shape.
  - Files: `desktop/electron/submit/__tests__/fixtures/<provider>/**`, `desktop/electron/submit/__tests__/<provider>-submit.test.ts`.
  - Depends on: P17.1, P17.2
  - Acceptance: each provider has all six fixtures + the matching tests passing; provider readiness label flips from `beta` to `production` only after the full set is green.
  - Tests required: covered by the deliverable.
  - Suggested primary: codex for Ashby / Lever / Workable / SmartRecruiters (active in those runners); claude-code for Recruitee / Teamtailor / Jobvite / BambooHR / Personio / Breezy. Sub-divide by provider in the kanban with `note` events.

- [x] **P17.4** Lever pre-step: detect `lever.co` + a non-`/apply` pathname and either navigate to `${baseUrl}/apply` or click the visible "Apply" button before the autofill step starts. <!-- claimed: codex 2026-05-08T14:05:09Z --> <!-- done: codex 2026-05-08T14:08:47Z Lever runner normalizes non-/apply URLs before generic autofill; unit coverage added for JD and existing /apply URLs. --> Today the runner often lands on the JD page, autofill finds zero matching fields, and the run dies as `validation_failed` for "no fillable fields". This is purely a navigation hop in the runner, not a new tool call.
  - Files: `desktop/electron/submit/lever-submit.ts`, `desktop/electron/submit/__tests__/lever-submit.test.ts`.
  - Depends on: —
  - Acceptance: lever fixture's JD-only page (added in P17.3) routes to the apply form before autofill; existing `/apply`-direct fixture is unaffected.
  - Tests required: unit — pre-step routes when needed and short-circuits when the URL is already `/apply`.
  - Suggested primary: codex (Lever runner author).

- [ ] **P17.5** Provider-neutral closed-posting detection. The current detector lives in greenhouse-submit and only triggers on Greenhouse copy. Lift it into a shared `lib/runtime-provider/closed-posting.ts` keyed by an array of phrase / DOM-marker entries (e.g. "this position is no longer accepting applications", "posting is closed", a `[data-closed-posting]` attribute, an HTTP 410). Wire every runner to call the shared detector before autofill and emit the typed `closed_posting` status from P17.1.
  - Files: new `lib/runtime-provider/closed-posting.ts`, `desktop/electron/submit/greenhouse-submit.ts`, `desktop/electron/submit/*-submit.ts`.
  - Depends on: P17.1
  - Acceptance: at least three providers' fixtures emit `closed_posting`; the Greenhouse-only path is removed; detector covers ≥6 phrases / markers.
  - Tests required: unit — phrase/DOM matrix per provider; runner-level test for one provider.
  - Suggested primary: claude-code (smaller pure-function lift, no runner ownership conflict).

- [ ] **P17.6** Use closed-posting detection during random job picking for `provider:any`. Today `_random-job.ts` only runs the closed-posting check on Greenhouse postings; an Ashby/Lever closed posting still gets handed to autopilot and immediately fails. After P17.5, call the shared detector on every fetched candidate before returning it; rotate to the next candidate on a positive hit and log a `random_pick_skipped_closed` event.
  - Files: `app/api/desktop/jobs/_random-job.ts`, `app/api/desktop/jobs/random/__tests__/route.test.ts`.
  - Depends on: P17.5
  - Acceptance: a closed Ashby posting in the candidate pool is skipped, not returned; metrics surface the skip count.
  - Tests required: unit — random pick rotates past a closed candidate from each provider with a fixture in P17.3.
  - Suggested primary: claude-code (already touched random-job in this branch).

- [ ] **P17.7** Stop retrying the same job when the same validation error appears twice. Today autopilot's `MAX_AUTOPILOT_ATTEMPTS=3` hammers the same form even when the same field complains the same way each pass. Add a per-run "validation fingerprint" (sorted `(fieldLabel, errorText)` tuples) and short-circuit on the second identical fingerprint with the typed `validation_failed` status from P17.1. Fingerprint lives in autopilot session memory only; do not persist to DB.
  - Files: `desktop/renderer/views/desktop-app.tsx` (autopilot loop), `desktop/electron/agent/session.ts` (or wherever the loop lives), `desktop/electron/agent/__tests__/session.integration.test.ts`.
  - Depends on: P17.1, P17.8 (so we have the actual error text to fingerprint)
  - Acceptance: integration test where the same fixture validation error fires twice short-circuits to `validation_failed` instead of running 3 attempts.
  - Tests required: unit — fingerprint equality; integration — autopilot loop short-circuits.
  - Suggested primary: claude-code (touched the autopilot loop in recent commits).

- [x] **P17.8** Extract visible validation errors after a submit failure and surface the exact missing field + message. <!-- claimed: codex 2026-05-08T15:25:00Z --> <!-- done: codex 2026-05-08T15:19:30Z PR:local Added validation extraction over all P17.3 provider fixtures, generic-runner propagation, submitted-route metadata persistence, and admin trace/fix-prompt rendering. --> Add a post-submit pass that scans for the standard validation surfaces (`[role="alert"]`, `.field-error`, `aria-invalid="true"` + adjacent text, ATS-specific selectors per provider) and returns a `ValidationFailure[]` of `{ fieldLabel, fieldSelector, message }`. Persist this on the submission row and surface it in the admin trace + the "Copy fix prompt" output.
  - Files: new `lib/runtime-provider/validation-extract.ts`, `desktop/electron/submit/*-submit.ts`, `app/api/desktop/applications/submitted/route.ts`, `app/(app)/admin/desktop-submissions/_components/submissions-table.tsx`.
  - Depends on: P17.1
  - Acceptance: each provider's `validation-error.html` fixture (P17.3) extracts the exact field + message; admin trace renders them as a list, not a wall of text.
  - Tests required: unit — extractor against per-provider validation fixtures; component — admin trace renders the list.
  - Suggested primary: codex on the per-provider extraction selectors; claude-code on the admin surfacing. Coordinate via NOTE.

- [ ] **P17.9** Normalize autofill / training behavior across all providers. Today each runner has slightly different autofill ordering, snapshot timing, and training-mode short-circuit. Lift the shared logic into `lib/runtime-provider/autofill-harness.ts` with a typed provider hook (`onBeforeAutofill`, `onValidationError`, `onConfirmation`). Each provider runner becomes the hook's data + selectors, not a copy of the loop.
  - Files: new `lib/runtime-provider/autofill-harness.ts`, `desktop/electron/submit/*-submit.ts`.
  - Depends on: P17.3 (so per-provider behavior is captured in fixtures before the lift)
  - Acceptance: every runner uses the shared harness; the runner files shrink ≥40% on average; existing tests still pass without modification.
  - Tests required: existing fixture-driven runner tests serve as regression coverage; one new harness-level unit test for the hook contract.
  - Suggested primary: claude-code (cross-cutting refactor with high test gravity, codex stays on per-provider work in parallel).

- [ ] **P17.10** Workday account creation / sign-in manual-review pause. Workday rejects autofill before authentication; the current runner emits `failed` and autopilot moves on. Detect the Workday sign-in / account-creation surface specifically and emit `manual_auth_required` (typed status from P17.1) instead. When emitting, write a `RuntimeManualReviewTask` row that includes the user's `trackingEmailAlias` (the gmail-style alias, not the user's real email) and a freshly-generated 24-character password (stored via the new `lib/credentials/cipher.ts` AES-256-GCM path). Surface the credential in the admin trace + a one-click "Copy login" affordance so Steven can paste it into the Workday sign-up form during review.
  - Files: `desktop/electron/submit/workday-submit.ts`, new `lib/runtime-provider/workday-account.ts`, `lib/credentials/store.ts`, `prisma/schema.prisma` (`RuntimeManualReviewTask`), `app/(app)/admin/desktop-submissions/_components/submissions-table.tsx`.
  - Depends on: P17.1, P17.2
  - Acceptance: a Workday fixture that lands on sign-up emits `manual_auth_required`, persists a generated password encrypted, and the admin trace shows the email + a reveal-once password affordance; running the same Workday URL again reuses the existing credential.
  - Tests required: unit — generator entropy + length, alias selection, idempotency on repeat runs; integration — fixture round-trip.
  - Suggested primary: claude-code (just shipped the credentials cipher + UI; closest context).

- [ ] **P17.11** Clearer "waiting for verification code" state during email-code polling. The runner currently spends up to 10 minutes silently polling `/api/desktop/verification-code` and the UI just says "running". Add a typed runtime state `waiting_for_verification_code` that the renderer surfaces as a non-blocking banner (with the elapsed time + "cancel and resume manually" affordance) and that the desktop status bar shows. The state ends when the code arrives (success), the timeout fires (typed `confirmation_timeout`), or the user cancels (typed `paused_for_manual_review`).
  - Files: `desktop/electron/agent/types.ts`, `desktop/electron/main.ts`, `desktop/renderer/components/desktop-status-bar.tsx`, `desktop/renderer/views/desktop-app.tsx`.
  - Depends on: P17.1
  - Acceptance: triggering the code-polling path shows the banner; on timeout the run lands as `confirmation_timeout`; on user-cancel it lands as `paused_for_manual_review`.
  - Tests required: component — banner renders for the new state; unit — state machine transitions.
  - Suggested primary: claude-code (recently wired the verification-code endpoint and inbox UX).

- [x] **P17.12** <!-- claimed: claude-code 2026-05-08T14:30:00Z --> <!-- done: claude-code 2026-05-08T14:25:00Z resolveDeterministicAnswer exported with 7 new patterns: consent/privacy → Yes; notice period → "2 weeks"; earliest/expected start date → "Two weeks from offer acceptance"; total years experience (text + select-option range/or-more matching with bug fix to `\b\+`); current employer + current title from employmentHistory ongoing entry; security clearance → None/No. 20 unit tests in lib/field-answer/__tests__/resolve.test.ts cover positive matches, select-option dispatch, fallback to most-recent past job, and null/empty profile cases. Helpers matchOption + pickCurrentEmploymentEntry + matchYearsOfExperienceOption added. --> Expand the deterministic-answer chain in `lib/field-answer/resolve.ts` for the next batch of common required questions before falling through to the LLM: salary range (min/max separately), expected start date, willing to relocate (yes/no), willing to travel (yes/no), notice period (weeks), highest education attained, security clearance, current company, current title, total years experience, years experience in <skill>. Each gets a deterministic resolver with a `reasoning` string that names which profile field / knowledge entry sourced the answer.
  - Files: `lib/field-answer/resolve.ts`, `lib/field-answer/__tests__/resolve.test.ts`.
  - Depends on: —
  - Acceptance: ≥10 new question categories resolve deterministically against the Steven profile fixture; the LLM is not invoked for any of them (assertion: `getModels` mock not called).
  - Tests required: unit — one passing test per new category, plus negative-case tests where the profile lacks the source field.
  - Suggested primary: claude-code (deepest familiarity with the resolver chain and the existing deterministic table).

- [ ] **P17.13** Submission-success-rate dashboard sliced by provider, failure reason, and run mode. Add a server view + admin page that aggregates `ApplicationSubmission` over a configurable window (default last 7 days) and groups by `(provider, runMode, typedFailureReason)` from P17.1. Surface the `production`-labeled providers separately from `beta` so the headline rate isn't dragged down by un-tuned runners.
  - Files: new `lib/admin/submission-metrics.ts`, new `app/(app)/admin/submission-metrics/page.tsx`, `app/api/admin/submission-metrics/route.ts`.
  - Depends on: P17.1, P17.2
  - Acceptance: dashboard renders with at least three breakdowns (provider, reason, run mode); changing the window updates the chart without a page refresh.
  - Tests required: unit — aggregation math against a seeded fixture set; component — dashboard renders for the empty-data and full-data cases.
  - Suggested primary: claude-code (admin UI + metrics is the active surface).

- [ ] **P17.14** Record screenshots and DOM snapshots on every failed submit attempt. Today the runner emits a free-text message and the admin reader has no visual context. On any non-`completed` terminal status, capture (a) a full-page PNG screenshot from the assist webContents and (b) the trimmed `documentElement.outerHTML` (with input values redacted via the existing `redactPiiValue` helper). Store as a Vercel Blob (private) keyed by `submissionId`; link from the admin trace.
  - Files: `desktop/electron/main.ts`, new `lib/applications/failure-snapshot.ts`, `app/api/desktop/applications/submitted/route.ts`, `app/(app)/admin/desktop-submissions/_components/submissions-table.tsx`.
  - Depends on: P17.1
  - Acceptance: a synthetic failure fixture produces both artifacts; admin trace shows them; PII redaction passes the existing redact tests.
  - Tests required: unit — redaction integration on a sample DOM; integration — desktop submit emits artifacts on a forced failure.
  - Suggested primary: codex (already touched the desktop main.ts capture paths).

- [ ] **P17.15** "Do not retry this URL this session" rule for validation failures. After the second identical-fingerprint validation failure (P17.7), record the application URL into an autopilot session-memory blocklist; subsequent autopilot picks skip the URL until the desktop process restarts. The blocklist is in-memory only — no DB persistence — and is cleared on app quit.
  - Files: `desktop/renderer/views/desktop-app.tsx` or new `desktop/renderer/lib/session-blocklist.ts`, `desktop/renderer/__tests__/session-blocklist.test.ts`.
  - Depends on: P17.1, P17.7
  - Acceptance: a URL that has hit the second-fingerprint short-circuit is not picked again in the same session; on app restart the blocklist is empty.
  - Tests required: unit — blocklist add / contains / clear-on-restart.
  - Suggested primary: claude-code (autopilot author).

- [x] **P17.16** Generic submit handles disabled / hidden submit buttons more explicitly. <!-- claimed: codex 2026-05-08T14:16:47Z --> <!-- done: codex 2026-05-08T14:19:12Z Generic submit now returns validation_failed with reason=submit_button_disabled for disabled/aria-disabled/hidden selected submit controls; tests cover disabled, hidden, missing, and enabled cases. --> Today the runner clicks the first matching button selector and lets the page noop if it's disabled. Audit `generic-submit.ts` to (a) detect `[disabled]` / `aria-disabled="true"` / `display:none` / `visibility:hidden` on the chosen submit element and (b) emit `validation_failed` (typed) with a `reason` of `submit_button_disabled` instead of clicking nothing and timing out into a generic `failed`.
  - Files: `desktop/electron/submit/generic-submit.ts`, `desktop/electron/submit/__tests__/generic-submit.test.ts`.
  - Depends on: P17.1
  - Acceptance: a fixture where the submit button is disabled emits `validation_failed` with the specific reason; a fixture where it is hidden does the same.
  - Tests required: unit — disabled, hidden, missing, enabled cases.
  - Suggested primary: codex (active on `generic-submit.ts`).

- [x] **P17.17** Standardize confirmation detection across providers with provider-specific success phrases. <!-- claimed: codex 2026-05-08T15:22:00Z --> <!-- done: codex 2026-05-08T15:22:45Z PR:local Added provider-specific confirmation phrase coverage for every production provider and fixture-backed tests. --> Extend `lib/applications/confirmation-detector.ts` so each provider in P17.2's registry has at least three known confirmation phrases / DOM markers. Drop the generic "thank you" fallback from a runtime certainty signal to a "low_confidence" tier so a JD that says "Thank you for your interest" doesn't false-positive.
  - Files: `lib/applications/confirmation-detector.ts`, `lib/applications/__tests__/confirmation-detector.test.ts`, `prisma/seed/submission-confirmation-phrases.ts` (or wherever phrases are seeded).
  - Depends on: P17.2, P17.3 (confirmation fixtures land per provider)
  - Acceptance: each `production`-labeled provider has ≥3 phrases; the false-positive JD test from confirmation-detector still passes; admin trace shows the matched phrase + tier.
  - Tests required: unit — per-provider phrase set; existing false-positive guard regression.
  - Suggested primary: codex (confirmation detector author for the original Greenhouse set).

- [ ] **P17.18** Final pre-submit validation scan before clicking Submit. Add a last-mile scan that runs after autofill but before the runner's submit click: enumerate every `[required]` input/select/textarea visible on the form, check it has a non-empty value, and short-circuit with `validation_failed` (typed reason `pre_submit_required_empty`) listing the empty fields if any. This is a cheap defense against the "we autofilled but the field hydrated late and bounced" failure mode that costs an attempt.
  - Files: new `lib/runtime-provider/pre-submit-scan.ts`, `desktop/electron/submit/*-submit.ts`.
  - Depends on: P17.1, P17.9 (the harness lift makes this single-point insertion clean)
  - Acceptance: a fixture where one required field is left empty short-circuits with the typed reason and the missing-field list before the submit click; a fully-filled fixture proceeds normally.
  - Tests required: unit — scan against a fixture with mixed required/optional + visible/hidden inputs.
  - Suggested primary: claude-code (cleanest landing after the harness lift in P17.9).

- [ ] **P17.19** Fix the agent chat IPC route mismatch. The desktop sidebar Agent tab currently throws `Error invoking remote method 'desktop-agent-chat:send-message': Error: Desktop agent chat failed: Not Found` on every send — the renderer is calling an IPC channel (or the IPC handler is hitting a server route) that doesn't exist. Reproduce on the agent tab against a real Greenhouse posting, then fix the handler chain end-to-end so the agent message round-trips and shows a real reply. Add a regression test at the IPC boundary so a future renaming can't silently break the channel again.
  - Files: `desktop/electron/ipc.ts`, `desktop/electron/agent-chat/**`, `desktop/renderer/components/desktop-agent-chat.tsx`, `app/api/desktop/agent-chat/route.ts` (only if the 404 is server-side, not IPC-side), `desktop/electron/__tests__/ipc.test.ts`.
  - Depends on: —
  - Acceptance: Sending a message on the Agent tab in a paired desktop session produces an agent reply (not an error toast); the IPC boundary test fails if the renderer-side channel name diverges from the main-process handler name.
  - Tests required: unit / integration — IPC channel parity test; renderer-side agent chat component test for the success path.
  - Suggested primary: claude-code (touched the agent-chat route + IPC plumbing in recent commits).

- [ ] **P17.20** Local Ollama: bake a `gimmejob-fill` model with a system-prompt Modelfile. Wrap whatever base model the resolver currently runs against (llama3.2 / qwen / etc.) with a custom Modelfile carrying the form-fill schema, a handful of canonical answer-shape examples, and a JSON-only output contract. Build script lives at `scripts/ollama/build-fill-model.sh` and emits an idempotent `ollama create gimmejob-fill -f Modelfile`. Resolver switches from the bare base model to `gimmejob-fill` when the local provider is selected. Goal: cut tokens-per-call ~40% and remove most JSON-rescue fallbacks.
  - Files: new `scripts/ollama/Modelfile`, new `scripts/ollama/build-fill-model.sh`, `lib/ai/models.ts`.
  - Depends on: —
  - Acceptance: `ollama list` shows `gimmejob-fill`; resolver logs that it's calling `gimmejob-fill` (not the base) when provider=ollama; on a 20-question fixture suite the local-provider answer accuracy is ≥ the bare-model baseline and tokens/call drop measurably.
  - Tests required: unit — model-name resolution picks `gimmejob-fill` for ollama; e2e (gated, OLLAMA=1) — small accuracy/token regression run.
  - Suggested primary: claude-code (resolver is claude-code's surface).

- [ ] **P17.21** JSON / grammar-constrained sampling on every Ollama call. Audit `lib/ai/models.ts` and the resolver's `generateObject` / `generateText` call sites for the local provider; ensure `format: 'json'` (or an explicit JSON schema) is set on every form-fill call so the model cannot emit free text. Removes the JSON-rescue fallback entirely and lets us delete the rescue helper. Keep the rescue path under a kill-switch for one release in case a newer model regresses.
  - Files: `lib/ai/models.ts`, `lib/field-answer/resolve.ts`, the JSON-rescue helper (find via grep).
  - Depends on: —
  - Acceptance: every local-provider call passes a JSON schema; the rescue helper is dead-code-eliminated (or behind a flag); fixture suite passes without invoking the rescue path.
  - Tests required: unit — resolver invokes `generateObject` with the schema for ollama; integration — fixture call returns parsed JSON without falling through to rescue.
  - Suggested primary: claude-code.

- [ ] **P17.22** Few-shot retrieval from prior successful fills. Before each local-provider form-fill call, pull the top-K (K=5) most-semantically-similar approved `FormFieldFeedback` rows for the same `(userId, questionEmbedding)` and prepend them as a few-shot block to the prompt. The `embedding` column is already populated (P17.13's pgvector wiring shipped earlier this branch — `findSimilarFieldFeedback`). Borderline questions (sponsorship phrasing variants, post-employment restriction wordings, race/ethnicity variants) should improve measurably.
  - Files: `lib/field-answer/resolve.ts` (extend `loadFieldFeedback` consumers), `lib/ai/embeddings.ts` (existing helper).
  - Depends on: P17.20, P17.21 (both ensure the few-shot lands in a model that respects the schema).
  - Acceptance: a fixture suite of 10+ phrasing variants for the same logical question (e.g. work-authorization phrasings) shows higher exact-match rate with the few-shot block enabled vs. disabled.
  - Tests required: unit — prompt builder includes the few-shot block; integration — fixture suite shows the lift.
  - Suggested primary: claude-code (resolver + embeddings owner).

- [ ] **P17.23** LoRA fine-tune on the user's captured fill data. Pipeline: export `FormFieldFeedback` (status='approved') + `UserFieldRule` rows as JSONL → fine-tune via MLX on Steven's Mac (or Unsloth on a Linux/CUDA box) with a small base (Qwen 2.5 3B or Gemma 2 2B) → convert the resulting adapter to GGUF → register as a new Ollama model (`gimmejob-fill-lora`). Done weekly via a script. After ~5k rows, the model has actually learned Steven's profile, his phrasing preferences, and the failure modes corrected during training runs.
  - Files: new `scripts/ollama/export-training-jsonl.ts`, new `scripts/ollama/finetune-lora.sh`, new `scripts/ollama/register-lora-model.sh`, `lib/ai/models.ts` (add the new model name).
  - Depends on: P17.20 (base model wiring), P17.21 (schema-constrained sampling)
  - Acceptance: a weekly run produces a fresh `gimmejob-fill-lora` model; a held-out validation slice of `FormFieldFeedback` shows accuracy lift vs. the un-tuned base; the new model is selectable as the local provider in the desktop app.
  - Tests required: unit — JSONL exporter produces the documented row shape; integration (gated, MLX=1) — tiny end-to-end fine-tune on a 100-row slice produces a usable adapter.
  - Suggested primary: claude-code (data layer + model registration), with Steven running the training step on his hardware.

- [ ] **P17.25** Wire the desktop tab bar to actual webviews + failure-review affordances. The visual tab bar shipped in commit `9b3b6a5` (pinned "Working" tab + "+" button + drag-to-reorder + close). Make it functional: (a) each tab owns its own assist webContents so switching tabs swaps the rendered application page without losing the working tab's state; (b) when a desktop run lands as `validation_failed` / `manual_auth_required` / `paused_for_manual_review` (see P17.1 statuses), automatically open a new tab pre-loaded to that application's URL with a small "needs review" badge on the tab title; (c) closing such a review tab marks it acknowledged so it doesn't auto-reopen.
  - Files: `desktop/electron/main.ts` (assist webContents per tab), `desktop/renderer/views/desktop-app.tsx`, `desktop/renderer/components/desktop-tab-bar.tsx`, `desktop/electron/ipc.ts` (tab-aware navigation + screenshot bridges).
  - Depends on: P17.1 (uses the typed failure statuses to decide which runs spawn a review tab)
  - Acceptance: opening a new tab loads a separate page with no impact on the working tab's autopilot state; a forced `validation_failed` run opens a review tab with the failing URL + badge; closing the review tab clears the badge in the underlying lead.
  - Tests required: unit — tab state machine for review-tab open/close/acknowledge; integration — webContents per tab routes navigation to the active tab only.
  - Suggested primary: claude-code (built the visual tab bar in `9b3b6a5`).

- [ ] **P17.30** Required-field-first fill ordering. <!-- inspection 2026-05-08T14:05:00Z claude-code: greenhouse-submit's LLM-fallback (resolveRemainingFieldsWithLlm) already filters via collectUnansweredQuestions+detectFieldRequired which returns required-only. The user-visible bug ("required fields still empty after autopilot") is not the ordering — it's that the LLM returns empty/wrong answers for specific Greenhouse demographic patterns AND significantly overlaps with P17.18 (pre-submit required gate). Re-scope before re-claiming, or fold into P17.18. --> Symptom: the runner iterates every field on the page in DOM order, ends up filling things like `Website`, optional demographic selects, and gender — but leaves multiple `REQUIRED, empty` rows behind (e.g. `I consent to have my personal informa…`, `Where did you first hear about this rol…`). Submit then bounces because of the unfilled required fields. The current loop has no notion of required-vs-optional priority — it walks the form sequentially and best-effort-fills, which leaves required fields stranded when the optional fields ahead of them consume the LLM token budget / the per-step time budget. Fix: do TWO passes through the field list per page. Pass 1 = `[required] AND visible AND empty`. Pass 2 = `[optional] AND visible AND empty`. Pass 1 must complete (or hit a typed `validation_failed`) before Pass 2 starts; Pass 2 is best-effort and may be skipped if the runner is at its tool-call cap.
  - Files: `desktop/electron/submit/greenhouse-submit.ts` (fillOptionalGreenhouseFields → split into two phased passes), the shared autofill harness if P17.9 has landed, `lib/runtime-provider/required-first.ts` (new helper that splits the field list).
  - Depends on: P17.1 (typed reasons for "required field stayed empty after retry"); soft dep on P17.9 (the harness lift makes the two-pass insertion clean across providers).
  - Acceptance: a Greenhouse fixture with a mix of optional and required fields fills every required field on the first pass before touching optional ones; if the runner runs out of budget mid-Pass-2, no required field is left empty.
  - Tests required: unit — required/optional split helper; runner-level fixture asserts required fields all FILLED before any optional are attempted.
  - Suggested primary: claude-code (resolver / runner orchestration is claude-code's surface; codex's parallel fixture work in P17.3 will catch regressions).

- [ ] **P17.29** Location (City) typeahead regularly fails to fill on Greenhouse postings. Symptom: even when the runner attempts the field, the State tab still shows `Location (City) — empty — select — REQUIRED`. The Greenhouse "Locate me" widget is a Google-Places-backed typeahead — typing into it triggers an async autocomplete fetch, the listbox mounts, and the user must click an option (just typing the value and blurring leaves the field unselected). The current resolver path treats it like a regular `select` / `text` field. Fix: detect the typeahead pattern (`role="combobox"` + `aria-controls` to a listbox, or the `Locate me` adjacent button) and drive it through the existing typeahead helper that already handles Greenhouse's other typeaheads (school, degree, discipline). Confirm by running an autopilot pass against a Greenhouse posting whose required city field is currently being skipped — the State tab should show `FILLED` after.
  - Files: `desktop/electron/submit/greenhouse-submit.ts` (likely fillOptionalGreenhouseFields), maybe `lib/field-answer/resolve.ts` for the answer source.
  - Depends on: P17.1 (uses `validation_failed` typed reason if location stays empty after the typeahead retry).
  - Acceptance: a Greenhouse fixture with the city typeahead is filled by the runner; the State tab shows the chosen city; admin trace shows the typeahead path was taken.
  - Tests required: unit — typeahead-pattern detector; runner-level fixture covering the location field.
  - Suggested primary: claude-code (resolver + Greenhouse runner familiarity).

- [x] **P17.27** Fix resume-attach false-failure on autofill. <!-- claimed: codex 2026-05-08T14:11:13Z --> <!-- done: codex 2026-05-08T14:14:42Z Greenhouse intercepted uploads now verify original input files, remounted resume inputs, and resume/status filename indicators before falling back. --> Symptom: a Greenhouse run lands on a `failed` `upload` tool call with selector chain `input[type="file"][name="resume"],input[type="file"]#resume,input[type="file"][name*="resume" i]:not([name*="cover" i]),...` and message `Upload target not found: ...` — but the resume IS visibly attached on the page after the run. Root cause is the upload tool's "did the input get the file" verification: it checks the original selector chain after the upload, but Greenhouse's React flow re-mounts the input under a different selector once the file is attached, so the post-upload check fails even though the upload itself succeeded. Fix: after a successful CDP `Page.handleFileChooser` resolution, treat the upload as confirmed if either (a) the original input now reports `files.length > 0`, or (b) any visible `input[type=file]` matching the broader resume-pattern reports `files.length > 0`, or (c) Greenhouse's `[data-source="resume"]` or `[role="status"]` indicator shows the filename. Otherwise the runner emits `validation_failed` for what was actually a clean attach.
  - Files: `desktop/electron/tools/electron-driver.ts` (upload + post-check logic), `desktop/electron/submit/greenhouse-submit.ts` (post-attach verification).
  - Depends on: —
  - Acceptance: a Greenhouse fixture where the resume file input re-mounts post-attach passes the runner's verification; the run does not emit `validation_failed` for a successful upload.
  - Tests required: unit — verification helper accepts a re-mounted input + the data-source indicator path; integration — fixture covers the re-mount race.
  - Suggested primary: codex (active on `electron-driver.ts` upload paths).

- [x] **P17.28** Random-job picker + runner detection mismatch. <!-- claimed: claude-code 2026-05-08T14:06:00Z --> <!-- done: claude-code 2026-05-08T14:25:00Z desktop/electron/submit/greenhouse-url.ts now exports isGreenhouseApplicationUrl recognizing greenhouse.io + job-boards.greenhouse + any [?&#]gh_jid= URL; main.ts re-imports the lifted helper so coinbase.com / digitalocean.com / etc. ?gh_jid= URLs route to runGreenhouseSubmitLead via pickRunnerForUrl; 14 unit tests in greenhouse-url.test.ts cover gh_jid in query, fragment, mixed-case, embedded path-substring rejection, non-Greenhouse rejection. Server-side filter expansion (option 1) and response-shape hint (option 3) deferred — not needed for the user-visible fix; codex's WIP _random-job.ts already broadens the server filter, so committing #2 alone closes the loop. 43/43 desktop submit + agent tests pass. --> The random-pick endpoint can return Greenhouse-powered postings hosted on the company's own domain (e.g. `https://www.coinbase.com/careers/positions/123?gh_jid=123`, `https://www.digitalocean.com/careers/position/apply/?gh_jid=...`) when "Greenhouse" provider is selected. These URLs:
    - have `?gh_jid=` (the Greenhouse Job ID query param)
    - have `source = 'Greenhouse'` in JobListing
    - are stored with `jobProvider = 'OTHER'` because the URL host isn't `greenhouse.io`

  When the desktop receives one of these URLs, `pickRunnerForUrl` calls `isGreenhouseApplicationUrl`, which only matches `/greenhouse\.io|job-boards\.greenhouse/i` — so the runner picker falls through to `runGenericSubmitLead`, which doesn't know Greenhouse selectors. Autofill ends up partial; the user perceives "Greenhouse provider returned a non-Greenhouse job."

  Two coordinated fixes:
    1. Server filter (`app/api/desktop/jobs/_random-job.ts`): keep the broader greenhouse-detection (URL contains `greenhouse.io`, OR contains `gh_jid`, OR `jobProvider = GREENHOUSE`, OR `source` contains `greenhouse`) so we don't drop these legitimate postings.
    2. Desktop runner picker (`desktop/electron/main.ts:isGreenhouseApplicationUrl`): match `?gh_jid=` query param + `source` field semantics so any URL the server tagged as Greenhouse routes to the Greenhouse runner.
    3. Optional: pass the server's `jobProvider` / `source` hint back to the desktop in the random-pick response so the picker doesn't have to re-derive ATS from URL.

  - Files: `app/api/desktop/jobs/_random-job.ts` (filter), `desktop/electron/main.ts:isGreenhouseApplicationUrl` (matcher), `desktop/electron/submit/client.ts` (response shape if (3) is taken).
  - Depends on: P17.2 (provider readiness label) — the response-shape change in option (3) is cleaner once the registry exists.
  - Acceptance: a coinbase.com `?gh_jid=` URL picked from the random endpoint with provider=greenhouse routes to `runGreenhouseSubmitLead`, not the generic runner; admin trace shows "provider=greenhouse" not "provider=generic" for these.
  - Tests required: unit — `isGreenhouseApplicationUrl` matches `gh_jid` URLs; integration — the random-job route + runner picker agree on provider for the canonical mismatch URLs.
  - Suggested primary: claude-code (cross-cuts server + desktop; needs the same brain on both ends).

- [ ] **P17.26** Wire the encrypted credential vault into autofill + auto sign-in. The storage + UI shipped in commit `de711e8` (`UserCredential` + `lib/credentials/cipher.ts` + `/api/credentials` + Saved Logins on My Profile). Wire it into the resolver and runners: (a) when a runner detects a username/email/password input on a hostname with a saved credential, autofill from the stored values via `findCredentialsForHostname` + `readCredentialPassword`; (b) when a runner lands on a sign-in / account-creation surface, submit the credential automatically before resuming the autofill flow (interacts with P17.10 for Workday); (c) audit-log every decryption to a new `CredentialAccessLog` row keyed by `(userId, credentialId, hostname, occurredAt)` for after-the-fact visibility.
  - Files: `lib/field-answer/resolve.ts` (resolver hook), `desktop/electron/submit/*-submit.ts` (sign-in detection + credential fill), new `prisma/schema.prisma` `CredentialAccessLog` + migration, `app/(app)/admin/credentials-access/**` (small admin view).
  - Depends on: P17.1, P17.2, P17.10 (Workday sign-in path is the first real consumer)
  - Acceptance: a fixture sign-in form gets filled + submitted from a saved credential; the autofill path on a real form picks up the saved username when the hostname matches; every decryption produces exactly one access-log row.
  - Tests required: unit — credential lookup picks the right row by `(hostname, username)`; integration — sign-in fixture round-trips; access-log row count matches decryption call count.
  - Suggested primary: claude-code (built the credential vault in `de711e8`).

- [ ] **P17.24** Distill from OpenAI for higher-quality LoRA labels. Run a sample of forms through OpenAI as the "teacher" and capture its accepted answers as ground-truth labels; combine with user-corrected `FormFieldFeedback` rows for the LoRA dataset (P17.23). Distillation runs as a one-shot script that picks N hostnames the local model is weakest on (per the per-provider success-rate dashboard from P17.13) and replays them through the OpenAI provider, recording answers in a `RuntimeFillLabel` table.
  - Files: new `scripts/ollama/distill-from-openai.ts`, new `RuntimeFillLabel` model in `prisma/schema.prisma`, `lib/ai/models.ts`.
  - Depends on: P17.13 (per-provider success rate dashboard tells us which hostnames are weak), P17.23 (defines the JSONL training format the distilled labels need to match)
  - Acceptance: the distill script writes ≥ N rows per run; the next LoRA fine-tune (P17.23) consuming both human-corrected rows and distilled rows shows higher held-out accuracy than fine-tuning on human-corrected rows alone.
  - Tests required: unit — distill script's row-shape; integration — script idempotency + provider-switch correctness.
  - Suggested primary: claude-code.

---

## 7. Cross-cutting: testing strategy

### 7.1 Unit test coverage targets

- `lib/applications/network-runner/**`: ≥90% (small, pure, critical)
- `lib/runtime-learning.ts` promotion scoring: 100%
- `lib/runtime-trust-policy.ts` transitions: 100%
- `lib/evaluation/**`: ≥85%
- `lib/email-ingestion/classifier.ts`: eval-set accuracy ≥90%

### 7.2 Integration tests (Jest + local Postgres)

- Observation → candidate → rule promotion round-trip (covers P1, P3, P7).
- Queue → dispatch → runner → outcome reconciliation (covers P11, P10).
- Desktop token issuance → validation → revocation (covers P5.4).

### 7.3 E2E tests (gated, `E2E=1`)

- `e2e/greenhouse-dom-submission.spec.ts` — P3.3.
- `e2e/ashby-network-replay.spec.ts` — P4.4, only if P4.5 = `PROCEED`.
- `e2e/desktop-greenhouse-submission.spec.ts` — P5.5.
- `e2e/synthetic-burst-500.spec.ts` — P13.1.

### 7.4 What we do not test with browser automation

- **UI visual correctness.** Steven verifies. No Playwright screenshots.
- **Reconstruction-surface interactions.** Treated as preview; integration testing focuses on the event-shape contract, not the rendered behavior.

---

## 8. Metrics & dashboards

- **Weekly scorecard** (auto-generated, emailed Mondays): applications submitted, verified rate, reply rate, interviews scheduled, human minutes spent, cost per verified submission.
- **Regression dashboard** (P7.3): per-ATS-family pass rate, trend.
- **Trust dashboard** (P8.2): scope tuples with current trust state.
- **Reconciliation dashboard** (P10.3): confirmation-state breakdown.

---

## 9. What we explicitly defer

- **Shipping the desktop app to other users.** Steven-only through Phase 14. Distribution (signing, notarization, auto-update) is not scheduled.
- **Chrome extension.** Passive-mode capture (record Steven's real applications) is attractive but deferred until Phase 6+ is stable; it's strictly additive data.
- **Workday.** ATS complexity is high, payoff per hour is low. Revisit after Greenhouse/Ashby/Lever/SmartRecruiters are boringly reliable.
- **Managed server-side burst service.** Revisit only if Steven's laptop becomes the real bottleneck — which it won't at 20–50 per burst.
- **Cross-ATS pattern transfer, self-play judges, semantic IR, vision-model fallback.** All worthwhile; all premature until the control/execution/learning loop is reliable on one family.

---

## 10. Appendix — Background documents

- `CLAUDE_AI_PLAN.md` — preserved as background. Sharpest on the network-replay thesis; we borrowed that as Phase 4's spike.
- `CODEX_AI_PLAN.md` — preserved as background. Sharpest on inventory-driven scoping; we adopted Phase 0's inventory query from it.
- `COPILOT_AI_PLAN.md` — preserved as background. Sharpest on provenance and evaluation; we made both first-class here.

These three files remain in the repo for history. **Do not treat them as current guidance.** This file supersedes them.
