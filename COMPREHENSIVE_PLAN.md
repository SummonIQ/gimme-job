COMPREHENSIVE_PLAN

**Overview**
This document covers a comprehensive assessment of job search functionality, a troubleshooting guide for "no job results" issues, an implementation plan for job application automation (Playwright/scrapers), and other missing features. It also includes a required changes task list with explicit agent ownership and progress tracking.

**Instructions For Agents**

- Every task and subtask line must start with `[ ]` and include `Agent: Windsurf - Codex`, `Agent: Windsurf - Claude`, or `Agent: Windsurf - Cascade`.
- Update status immediately when you start, during work, and when finished. Use `[~]` for in-progress and `[x]` for done.
- Do not pick up work that already has another agent in progress.
- Keep status changes and notes directly on the relevant task/subtask line.
- Each task and subtask must include a short `Prompt:` that tells the AI engineer exactly what to do.
- If you split work, add new subtasks and assign an agent before starting.

**Job Search Assessment**

- Entry points
- `app/(app)/jobs/page.tsx` renders `components/job-search/job-search-client.tsx` (main listings page).
- `app/(app)/jobs/search/page.tsx` renders `app/(app)/jobs/search/live-job-search.tsx` (SerpAPI live search).
- `app/(app)/jobs/searches/[id]/page.tsx` renders job search detail results with `app/(app)/jobs/searches/[id]/components/job-search-client.tsx`.
- Data sources and ingestion
- Google Jobs via SerpAPI in `lib/job-searches/services/google.ts` and `app/api/jobs/refresh/route.ts`.
- CoreSignal API via `lib/job-searches/services/coresignal.ts` and `lib/api/coresignal-client.ts`.
- TheirStack API via `lib/job-searches/services/theirstack.ts` and `lib/api/theirstack-client.ts`.
- Indeed API via `lib/job-searches/services/indeed-api.ts` and `lib/api/indeed-client.ts`.
- Storage and linking
- Job listings in `JobListing`, searches in `JobSearch`, linking via `JobSearchListing` in `prisma/schema.prisma`.
- `lib/job-searches/services/job-search-listings.ts` inserts listings and links to searches.
- Fetching
- `app/api/jobs/route.ts` returns job listings with filters and optional KV cache.
- Realtime/polling
- `lib/events/data-update.ts` sends `EventType.DataUpdate` with event name `data-update`.
- `hooks/use-job-search-progress.ts` listens on `data:update` (note the mismatch).
- Primary observed risks for "no results"
- Source selection defaults to CoreSignal only in `components/job-search/job-search-client.tsx` (default `sources: ['coresignal']`), which prevents SerpAPI refresh unless Google is selected.
- Realtime updates do not fire for job search progress because `hooks/use-job-search-progress.ts` binds `data:update` instead of `data-update`.
- Search results are fetched immediately after `createJobSearch` but are not re-fetched if realtime events fail, so newly inserted jobs can be invisible.
- Multi-source selection is present, but only one provider is used per search (priority order: CoreSignal > TheirStack > Google). Users may select multiple sources and still only get one.
- `JobSearchFilters` uses jobType values like `fulltime`, but `JobType` enums are `FULL_TIME`, `PART_TIME`, etc. The API filter in `app/api/jobs/route.ts` expects enum values, so selecting a job type can filter everything out.
- `savedOnly` in `app/api/jobs/route.ts` uses `status = ADDED_TO_LEADS`, but the UI save flow sets `JobListing.saved = true` in `lib/job-listings/save.ts`. Saved-only filters can show zero results.
- `searchIndeedJobsViaAPI` updates `JobSearch` with `status: "ERROR"` and `error` fields, which are not valid in the schema. This will throw and can leave searches failed without data.
- Long-running search work is executed via `after()` in `lib/job-searches/create.ts`, which is fragile for serverless environments and does not provide durable retries.

**No Results Troubleshooting Guide**

- Verify data ingestion
- Check recent `JobSearch` entries and status (`QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`) and `errorMessage` values.
- Confirm job listings exist for the user and are linked to the search in `JobSearchListing`.
- Confirm CoreSignal/SerpAPI keys are configured (`CORESIGNAL_API_KEY`, `SERP_API_SECRET`).
- Confirm TheirStack key is configured and not rate-limited.
- Verify event and refresh behavior
- Confirm Pusher event name matches `data-update` and UI is listening to the same event.
- Ensure searches trigger re-fetch after completion or while processing (polling when active).
- Validate UI filters
- Ensure `sources` includes the provider that actually ingested data.
- Confirm job type filter values match the Prisma enum values in `JobType`.
- Disable filters like `savedOnly`, `excludeDismissed`, and `postedWithin` when diagnosing.
- Validate ingestion-specific assumptions
- Google SerpAPI results should set `jobBoard = GOOGLE` and have stable `jobId` to avoid duplicate skips.
- CoreSignal should return job IDs and `collect` should populate `source = CoreSignal`.
- If using Indeed, confirm `INDEED_PUBLISHER_ID` is configured and the schema updates use valid fields.
- Reproduce with a clean, forced refresh
- Use `noCache=true` in the `/api/jobs` request.
- Trigger `/api/jobs/refresh` for a known location and confirm `JobListing` rows appear.

**Job Listings Strategy (Options + Recommendation)**

- Current behavior stores all listings into `JobListing` on each search. This is expensive, noisy, and makes filtering and deduplication harder at scale.
- Goal: Decouple “search results displayed to a user” from “jobs persisted in the database.”
- Option A: On-demand fetch + ephemeral cache (recommended for near-term)
- Fetch results from providers at search time, store in a short-lived cache (Redis/KV or a `JobListingCache` table).
- Persist only user actions: saved jobs, job leads, and applications. Create canonical `JobListing` records only for those.
- Pros: Lower storage, fewer duplicates, faster iteration; Cons: Requires cache infra and re-fetch when cache expires.
- Option B: Background indexer (daily/hourly ingestion)
- Run a worker that ingests from providers into the database continuously; searches hit the DB only.
- Pros: Fast search UX and stable results; Cons: expensive ingestion, harder to stay in sync, potential provider ToS issues.
- Option C: Hybrid (best long-term)
- On-demand results shown immediately, then backfilled by a background indexer. Jobs become searchable later from DB.
- Pros: Great UX + longer-term searchable corpus; Cons: higher complexity and infra.
- Recommendation: Start with Option A, then evolve toward Option C if usage and cost justify it.
- Minimum viable changes for Option A
- Add a lightweight cache for search results keyed by user + query + provider.
- Update UI to display “Live Results” vs “Saved/Indexed Results.”
- Persist only when user saves, adds to leads, or applies.

**Job Application Automation Plan (Playwright + Scrapers)**

- Strategy
- Move to Playwright for a single automation stack (project already includes Playwright for tests).
- Implement a dedicated automation worker service to run browsers outside the Next.js request lifecycle.
- Use a queue (BullMQ, Inngest, or Temporal) for durability, retries, and rate limits.
- Architecture
- Application automation pipeline
- Canonical application schema (resume, cover letter, custom fields, questions, and attachments).
- Platform adapter interface with capabilities and supported flows (Easy Apply, external ATS, etc).
- Job application runner (Playwright) with session management, proxy rotation, and timeout policies.
- Human-in-the-loop checkpoints for captcha, 2FA, or ambiguous fields.
- Data and security
- Encrypted credential vault (per user) with rotation and explicit user consent.
- Strict audit logging and opt-in automation settings.
- Risk controls (daily/hourly caps, per-company caps, duplicate detection, safety rules).
- Delivery plan
- Phase 1: infrastructure for queue + Playwright worker + runbook
- Phase 2: LinkedIn and Indeed adapters (Easy Apply first, fallback to manual)
- Phase 3: Common ATS adapters (Greenhouse, Lever, Workday, Ashby)
- Phase 4: UI approvals, field-mapping editor, and retries dashboard

**Other Missing Features / Gaps**

- Job scraper tool is a UI stub in `app/(app)/tools/job-scraper/page.tsx`, and `scrapers/` contains interfaces but no implementation.
- Saved-only filtering uses `status` instead of `saved`, and `excludeApplied` is defined in UI but not implemented in the jobs API filter.
- Multi-source search is not implemented. Selecting Google, TheirStack, and CoreSignal still runs only one provider.
- There is no durable background worker for long-running scraping or automation tasks.
- Indeed search integration requires `INDEED_PUBLISHER_ID` and is not present in `.env`, so that path will fail.

**Required Changes Task List**

- [~] Task: Implement live multi-provider job search with persisted actions | Agent: Windsurf - Cascade | Prompt: Goal: return live-only results from CoreSignal, TheirStack, and Google (no DB writes/caching) while allowing users to open details and save/add to leads by persisting the chosen job. Steps: 1) Create live provider search helpers that return normalized JobListing-like objects without DB writes. 2) Add a live aggregation API that returns combined results with provider labels and pagination meta, no caching. 3) Update the jobs UI to call the live API and render results. 4) Ensure job details modal opens from live data and adds-to-leads/save flow persists the selected job to the DB before actions. Deliverable: live search + persisted actions working end-to-end. Acceptance: search results show from all providers, clicking a job opens modal, and saving/adding to leads persists and succeeds.

- [ ] Task: End-to-end audit of job search flow for "no results" and create a reproducible checklist | Agent: Windsurf - Codex | Prompt: Goal: produce a deterministic, step-by-step playbook for reproducing missing results. Steps: 1) Read `components/job-search/job-search-client.tsx`, `components/job-search/job-search-bar.tsx`, `app/api/jobs/route.ts`, `lib/job-searches/create.ts`, `lib/job-searches/services/job-search-listings.ts`, and `lib/job-searches/services/*` to map the end-to-end flow. 2) Enumerate every point where results can be dropped (filters, provider selection, insert/linking, realtime, caching). 3) List the exact API calls and query params used for the first page load and after refresh. 4) Add example DB checks for `JobSearch`, `JobSearchListing`, `JobListing`, and `JobLead`. Deliverable: a reproducible checklist with concrete requests, expected DB rows, and failure signatures. Acceptance: a new engineer can follow the list and identify at least one concrete root cause within 30 minutes.
    - [ ] Subtask: Trace request lifecycle from UI to data | Agent: Windsurf - Codex | Prompt: Steps: 1) Identify the exact UI handler that fires on search submit and where it calls server actions or API routes. 2) Trace through `createJobSearch` to provider selection and job insert/link. 3) Trace the UI refresh path and where `/api/jobs` is called. 4) Capture any intermediate caching or SWR/react-query usage. Deliverable: an ordered list of function calls with file paths and the data passed between each step. Acceptance: list includes function names, parameters, and return types for each hop.
    - [ ] Subtask: Validate filter defaults and initial fetch timing | Agent: Windsurf - Codex | Prompt: Steps: 1) Identify default filter values in `components/job-search/job-search-client.tsx` and related filter state modules. 2) Capture the first `/api/jobs` request payload (query params and body). 3) Identify default filters that can exclude all results (sources, jobType, postedWithin, savedOnly, excludeDismissed, excludeApplied). 4) Propose a "diagnostic mode" default set that guarantees broad results. Deliverable: table of defaults vs risk of filtering out results with recommended changes. Acceptance: table includes source file and line refs for each default.
    - [x] Subtask: Fix realtime event mismatch for job search progress | Agent: Windsurf - Codex | Prompt: Steps: 1) Confirm backend event name from `lib/events/data-update.ts`. 2) Update `hooks/use-job-search-progress.ts` to subscribe to the correct event name. 3) Verify event payload shape and update handler accordingly. 4) Add a small manual test plan (trigger a search, verify UI refresh). Deliverable: code change + manual test steps. Acceptance: a new search updates the UI without a manual refresh when data arrives. Notes: Manual test: trigger a job search, verify toast progress updates and results refresh without a manual page reload.
    - [ ] Subtask: Add polling fallback when realtime fails | Agent: Windsurf - Codex | Prompt: Steps: 1) Define active statuses (`QUEUED`, `PROCESSING`) and terminal statuses. 2) Implement a controlled polling loop in the job search UI (backoff, max attempts, stop on completion). 3) Ensure polling does not run when there are no active searches. 4) Document expected polling intervals and how to disable for debugging. Deliverable: polling implementation + documentation notes. Acceptance: if realtime events are disabled, results still appear within the polling window.
    - [x] Subtask: Align jobType filter values with `JobType` enum | Agent: Windsurf - Codex | Prompt: Steps: 1) Inventory job type values emitted by UI filters. 2) Compare with Prisma `JobType` enum values in `prisma/schema.prisma`. 3) Add mapping in the API or UI to translate values (e.g., `fulltime` -> `FULL_TIME`). 4) Add a small unit test or integration test covering mapping. Deliverable: mapping implementation + test. Acceptance: selecting each job type returns results when data exists. Notes: Added JOB_TYPE_MAP in both /api/jobs/route.ts and /api/jobs/live/route.ts to map UI values (fulltime, parttime, contract, internship) to Prisma enum values (FULL_TIME, PART_TIME, CONTRACT, INTERNSHIP). Removed invalid 'temporary' option from UI filter. Live route now filters by jobType after aggregating provider results.
    - [ ] Subtask: Correct saved-only filter behavior | Agent: Windsurf - Codex | Prompt: Steps: 1) Determine actual source of truth for saved jobs (`JobListing.saved` vs status flags). 2) Update `/api/jobs` filtering logic to match that source. 3) Align any save actions to set the same field. 4) Add a regression test for saved-only filter. Deliverable: updated filter + test. Acceptance: saved-only view shows all saved items and no unsaved items.
    - [ ] Subtask: Implement `excludeApplied` logic | Agent: Windsurf - Codex | Prompt: Steps: 1) Decide applied-source-of-truth (e.g., `ApplicationSubmission`, `JobLead` status). 2) Add Prisma query logic in `/api/jobs` to exclude applied jobs. 3) Ensure query is efficient (index if needed). 4) Add a regression test with applied and non-applied data. Deliverable: filter implementation + test. Acceptance: enabling excludeApplied removes applied results only.
    - [ ] Subtask: Add filter contract tests for `/api/jobs` | Agent: Windsurf - Codex | Prompt: Steps: 1) Create a test fixture dataset with varied job types, sources, saved status, dismissed status, and applied status. 2) Add tests that call the route handler with combinations of filters. 3) Assert counts and IDs match expected results. 4) Document how to run the tests. Deliverable: tests under `tests/` or `app/api` test area + run command. Acceptance: tests pass locally and cover all filter combinations.
- [ ] Task: Provider and ingestion validation | Agent: Windsurf - Cascade | Prompt: Goal: verify each provider inserts and links data correctly. Steps: 1) Identify required env vars for each provider. 2) Run or simulate a search for each provider with known results. 3) Verify inserted `JobListing` rows and `JobSearchListing` links. 4) Confirm errors surface to `JobSearch.errorMessage` and do not crash the pipeline. Deliverable: per-provider validation notes with success/failure signals. Acceptance: each provider has a green path checklist and a red path checklist.
    - [ ] Subtask: Validate TheirStack ingestion | Agent: Windsurf - Cascade | Prompt: Steps: 1) Inspect `lib/job-searches/services/theirstack.ts` mapping and required env vars. 2) Run a sample request and capture raw response fields. 3) Verify stable `jobId`, `source`, `company`, and `jobBoard` fields. 4) Ensure duplicates are handled consistently. Deliverable: mapping verification notes + any fixes needed. Acceptance: TheirStack results appear in UI and are linked to `JobSearch`.
    - [ ] Subtask: Validate SerpAPI ingestion | Agent: Windsurf - Cascade | Prompt: Steps: 1) Inspect `lib/job-searches/services/google.ts` mapping. 2) Verify SerpAPI env var names and rate limit handling. 3) Confirm `jobId` stability and `jobBoard = GOOGLE` mapping. 4) Ensure errors populate `JobSearch.errorMessage`. Deliverable: verification notes + any fixes. Acceptance: Google results appear after refresh with correct source labels.
    - [ ] Subtask: Validate CoreSignal ingestion | Agent: Windsurf - Cascade | Prompt: Steps: 1) Inspect `lib/job-searches/services/coresignal.ts` and `lib/api/coresignal-client.ts`. 2) Verify pagination and multi-page fetch behavior. 3) Confirm `collect` pipeline sets canonical `jobId`, `source`, `company`, and location fields. 4) Ensure no overwrite issues across pages. Deliverable: verification notes + any fixes. Acceptance: CoreSignal results appear consistently across multiple searches.
    - [ ] Subtask: Ensure `searchIndeedJobsViaAPI` uses valid schema fields | Agent: Windsurf - Cascade | Prompt: Steps: 1) Find `searchIndeedJobsViaAPI` and identify schema mismatches (`status: "ERROR"`, `error`). 2) Replace with `JobSearchStatus.FAILED` and `errorMessage`. 3) Add a negative-path test or manual reproduction to ensure failures are recorded without crashing. Deliverable: code changes + test notes. Acceptance: failing Indeed searches are marked FAILED and do not break other searches.
    - [ ] Subtask: Review `after()` usage for long-running jobs | Agent: Windsurf - Cascade | Prompt: Steps: 1) Inventory all uses of `after()` in `lib/job-searches/create.ts` and related files. 2) Document failure modes in serverless/edge environments. 3) Propose a background worker replacement (queue, schedule, retries). 4) Add a migration plan for moving workloads off `after()`. Deliverable: recommendation section with options and tradeoffs. Acceptance: a clear, implementable replacement plan exists.
    - [ ] Subtask: Create provider health checklist | Agent: Windsurf - Cascade | Prompt: Steps: 1) For each provider, define env vars, sample query, expected response fields, and minimum row insert count. 2) Specify where logs and errors appear (Sentry, console, DB). 3) Add remediation steps for rate limits and auth failures. Deliverable: checklist table stored in this plan or a linked doc. Acceptance: checklist can be used by on-call to validate provider health in under 10 minutes.
- [ ] Task: UX improvements for search state visibility | Agent: Windsurf - Claude | Prompt: Goal: make it obvious why results are missing and how to recover. Steps: 1) Inventory UI states (idle, running, failed, empty, filtered). 2) Define copy and CTAs for each state. 3) Add visual indicators for search progress and provider selection. 4) Ensure accessibility for all states. Deliverable: UI updates + copy + basic a11y checks. Acceptance: user can tell within one screen whether the issue is provider failure, filters, or no results.
    - [ ] Subtask: Default source behavior | Agent: Windsurf - Claude | Prompt: Steps: 1) Decide product default provider order and multi-source behavior. 2) Update UI defaults and selection logic. 3) Add helper text that explains impact of each source. 4) Verify no default choice silently excludes SerpAPI or other providers. Deliverable: updated UI defaults + copy. Acceptance: default search returns results for a common query without manual source changes.
    - [ ] Subtask: Empty state and error messaging | Agent: Windsurf - Claude | Prompt: Steps: 1) Define distinct empty states for "no data", "failed search", and "filtered out". 2) Add suggestions for each (clear filters, switch sources, retry). 3) Ensure messages are non-technical and actionable. 4) Add a quick UI snapshot or story if available. Deliverable: copy + UI changes. Acceptance: each empty state has a unique message and CTA.
    - [ ] Subtask: Search progress UI | Agent: Windsurf - Claude | Prompt: Steps: 1) Surface `JobSearchStatus` and last updated timestamp in the UI. 2) Add a subtle progress indicator that does not block interaction. 3) Ensure updates occur via realtime or polling. 4) Add a manual refresh action for failsafe. Deliverable: UI changes + brief usage notes. Acceptance: during searches, users see progress within 5 seconds.
- [ ] Task: Job application automation architecture spec | Agent: Windsurf - Cascade | Prompt: Goal: produce an implementation-ready architecture spec. Steps: 1) Define system boundaries (Next.js app vs worker service). 2) Choose queue system and justify (BullMQ/Inngest/Temporal). 3) Define adapter interfaces and failure/retry strategy. 4) Specify session vault and credential handling. 5) Include a data model section and security considerations. Deliverable: spec document with diagrams, interfaces, and open questions. Acceptance: another engineer can start implementation without additional clarification.
    - [ ] Subtask: Convert existing Puppeteer flows to Playwright | Agent: Windsurf - Cascade | Prompt: Steps: 1) Locate Puppeteer usage in `lib/applications/services/indeed-submission.ts` and `lib/applications/services/linkedin.ts`. 2) Identify feature parity gaps in Playwright. 3) Draft migration steps, including API changes and dependency cleanup. 4) Propose a staging plan to avoid dual stacks. Deliverable: migration plan with file-level changes and risk list. Acceptance: plan includes rollout sequence and rollback steps.
    - [ ] Subtask: Adapter roadmap for ATS platforms | Agent: Windsurf - Claude | Prompt: Steps: 1) Evaluate market share and complexity for Greenhouse, Lever, Workday, Ashby. 2) Define MVP automation capabilities for each (form fill, resume upload, screening questions). 3) Note blockers (captcha, 2FA, dynamic fields). 4) Produce a prioritized roadmap with milestones. Deliverable: roadmap section with phases and constraints. Acceptance: roadmap clearly explains why each ATS is ordered.
    - [ ] Subtask: Define automation consent and safety UX | Agent: Windsurf - Claude | Prompt: Steps: 1) Draft consent screens for credential storage, automation actions, and legal disclaimers. 2) Add safety toggles (daily caps, company caps, pause all). 3) Provide an audit/history screen concept. 4) Include fallback flows for captcha/2FA. Deliverable: UX flow outline and copy suggestions. Acceptance: flows include explicit opt-in and easy opt-out.
    - [ ] Subtask: Define automation job schema | Agent: Windsurf - Codex | Prompt: Steps: 1) Propose Prisma models for `ApplicationRun`, `ApplicationAttempt`, and `AutomationArtifact`. 2) Define relationships to `JobListing`, `JobLead`, and `User`. 3) Specify retention for logs/screenshots and storage location. 4) Include fields for status, timestamps, error messages, and retry count. Deliverable: schema proposal with field list and relationships. Acceptance: schema supports retries, auditing, and artifact retention.
- [ ] Task: Job scraper implementation plan | Agent: Windsurf - Codex | Prompt: Goal: turn `scrapers/` into a working pipeline. Steps: 1) Identify existing interfaces in `scrapers/` and document required contracts. 2) Define a runner (CLI or worker) with config, scheduling, and progress reporting. 3) Define persistence (DB or cache) and normalization into `JobListing` or cache. 4) Add monitoring and failure handling. Deliverable: implementation plan with modules, responsibilities, and entry points. Acceptance: plan includes a minimal runnable path with one provider.
    - [ ] Subtask: Build missing job-scraper UI flow | Agent: Windsurf - Claude | Prompt: Steps: 1) Inspect `app/(app)/tools/job-scraper/page.tsx`. 2) Define UI actions for starting a scrape, showing progress, and viewing history. 3) Add status states (queued/running/failed/completed). 4) Ensure a11y and empty states. Deliverable: UI plan or implementation notes. Acceptance: UI describes the full scrape lifecycle.
    - [ ] Subtask: Add scraper execution model | Agent: Windsurf - Codex | Prompt: Steps: 1) Decide how scrapers run (CLI command, worker queue, cron). 2) Define input parameters (source, keywords, location, limits). 3) Define progress events and where they are stored. 4) Define retry policy and failure logging. Deliverable: execution model spec + sample invocation. Acceptance: another engineer can implement the runner from this spec.
    - [ ] Subtask: Add scraper provider templates | Agent: Windsurf - Codex | Prompt: Steps: 1) Create template adapter structure with required methods and error handling. 2) Implement one or two example adapters (dummy or real) to validate the template. 3) Document mapping rules to normalized job fields. 4) Add tests or mock runs. Deliverable: adapter templates + example provider. Acceptance: template can be used to add a new provider in under an hour.
- [ ] Task: Observability and error reporting for search + automation | Agent: Windsurf - Cascade | Prompt: Goal: make failures traceable and actionable. Steps: 1) Add Sentry breadcrumbs at provider fetch, insert/link, and API filter boundaries. 2) Add correlation IDs (jobSearchId, provider, userId) across logs. 3) Define user-facing error surfaces for common failure types. 4) Add runbook entries for triage. Deliverable: instrumentation changes + runbook notes. Acceptance: a failed search yields a traceable Sentry event with enough context to debug.
    - [ ] Subtask: Add structured logging for job search | Agent: Windsurf - Cascade | Prompt: Steps: 1) Define a structured log schema (event, jobSearchId, provider, count, duration, error). 2) Add logs around provider fetch, insert/link, and `/api/jobs` filtering. 3) Ensure logs are correlated across steps. 4) Update any logging config if needed. Deliverable: structured logs in relevant services. Acceptance: logs can be filtered by jobSearchId to reconstruct a run.
    - [ ] Subtask: Add Sentry alerts for ingestion failures | Agent: Windsurf - Cascade | Prompt: Steps: 1) Define alert thresholds (e.g., error rate, repeated empty results). 2) Add Sentry alert configuration guidance or code comments. 3) Update runbook with response steps. Deliverable: alert configuration plan and runbook entry. Acceptance: on-call has clear steps to validate and mitigate.
- [ ] Task: Choose and implement job listings storage strategy | Agent: Windsurf - Codex | Prompt: Goal: decide and implement Option A/B/C with minimal disruption. Steps: 1) Write a short decision record comparing options with current constraints. 2) Choose an approach and outline data flow changes. 3) Update storage/persistence logic to align with the choice. 4) Update API and UI to handle live vs saved results. Deliverable: decision record + implementation plan. Acceptance: plan includes schema changes, migration steps, and rollback strategy.
    - [ ] Subtask: Build ephemeral results cache | Agent: Windsurf - Codex | Prompt: Steps: 1) Decide cache backend (KV/Redis/DB table) and TTL. 2) Define cache key schema (user + query + provider + filters). 3) Implement fetch-or-refresh logic with stale handling. 4) Add cache invalidation rules. Deliverable: cache spec + implementation steps. Acceptance: cached results reduce repeated provider calls for identical searches.
    - [ ] Subtask: Update UI to reflect live vs saved results | Agent: Windsurf - Claude | Prompt: Steps: 1) Add UI labels for "Live Results" and "Saved/Indexed". 2) Add filters or tabs to switch views. 3) Ensure actions (save, add to leads, apply) persist the job record. 4) Update empty states accordingly. Deliverable: UI updates with clear labels. Acceptance: users understand the difference between live and saved results.
    - [ ] Subtask: Add migration and backfill plan | Agent: Windsurf - Codex | Prompt: Steps: 1) Inventory existing `JobListing` rows and which are saved/leads/applied. 2) Define a backfill script or migration to preserve important rows. 3) Define cleanup for orphaned listings. 4) Provide rollback instructions. Deliverable: migration plan with steps and commands. Acceptance: no saved or applied data is lost during migration.
    - [ ] Subtask: Update documentation and runbook | Agent: Windsurf - Codex | Prompt: Steps: 1) Document the new data flow for job search results. 2) Add troubleshooting steps for cache vs DB results. 3) Update runbook for provider failures and cache invalidation. 4) Include developer commands for verification. Deliverable: updated docs in `README.md` or a new runbook file. Acceptance: new engineer can debug search results using the docs alone.
