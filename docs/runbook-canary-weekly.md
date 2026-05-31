<!-- markdownlint-disable MD013 MD034 -->

# Runbook — weekly canary operations

**Status:** Draft — pending two consecutive canary cycles per FINAL_PLAN.md §16.5
**Last revised:** 2026-04-23
**Cadence:** Monday morning, before any burst work for the week.

## 0. What the weekly canary is

One real submission per **ACTIVE** recipe/rule pack (`ApplicationFlowDefinition` rows with `status='ACTIVE'`), scheduled by the P14.1 canary cron. Results feed the regression dashboard (P7.3). The point is to notice recipe rot before a real burst hits it — not to move candidate volume.

Every ACTIVE recipe should run exactly one canary submission per week. The cron fires on Monday at 07:00 America/Los_Angeles; arrive at the Monday scorecard within four hours of that run.

## 1. Pre-flight (Monday morning, before reading the scorecard)

- [ ] Safety gate the canary workspace:
  ```
  bun run scripts/safety-gate.ts --target=<canary-hostname>
  ```
  Canary hostnames live in a dedicated fixture set. If the gate fails, the canary for that family is skipped this week — do not retry from the Monday scorecard.
- [ ] Confirm the reconciliation cron ran over the weekend:
  - `POST /api/cron/reconcile-pending` (P10.4) should have fired Sunday at midnight. `/dashboard/submissions` is the source of truth.

## 2. Reading the Monday scorecard

- [ ] Open the regression dashboard at `/admin/regression` (P7.3 — **pending; until that ships, read from `docs/regression-<date>.md`**).
- [ ] For each family (greenhouse, lever, ashby, smartrecruiters, …):
  - Week-over-week pass rate — the single most important number on the page.
  - Per-step pass rate — surfaces a single broken step before it drags the family rate down enough to trip the halt threshold.
  - `STALE` recipe flags (see §3).
- [ ] Green means pass rate is within −5 percentage points of the last-recorded high for the family (the threshold from P7.3). Anything redder than that is not "wait and see", it is "open §3".

What "good" looks like on the scorecard:

- Every ACTIVE recipe produced exactly one canary submission over the weekend.
- Pass rate is steady or up vs last week.
- No `STALE` flags.
- No detection-health audit rows (`/admin/detection-health`, P16.6) for the canary window.

## 3. Handling a STALE recipe flag

A `STALE` flag means the replay harness (P7.1) produced a divergence against the current recipe — the DOM or flow changed in a way the rules no longer cover.

- [ ] Click through to the flagged session. Review the divergence point. Three outcomes:
  - **Hostname changed its DOM.** Enqueue retraining: mark the active `ApplicationFlowDefinition` row as `status='CANDIDATE_RETRAIN'` and insert a `ATSAnalysisJob` row targeted at the hostname (the P6 training pipeline will pick it up). Do **not** disable the family.
  - **One rule regressed, the rest are fine.** Flip the single offending `ATSRule.enabled` to `false` and file the remediation as a retraining job for that hostname. Leave the rest of the recipe ACTIVE.
  - **Full recipe failure (every rule misaligned).** Treat this as Scenario A in the incident-response runbook (P16.7). Stop using canary work as the remediation path — it's now an incident.
- [ ] Every retraining queue event must cite the canary run that surfaced it. The audit trail is what lets us tell a stale-recipe retrain from an opportunistic one.

## 4. Kill-switch (disable a recipe family without a deploy)

There are three layers; use the smallest one that does the job.

### 4.a. Single hostname kill-switch

If one hostname in a family is misbehaving but the rest are fine:

```sql
-- Flip posture to GRAY so confirmBurst (P11.2) refuses to dispatch.
UPDATE "ATSAutomationPosture"
   SET posture='GRAY',
       notes = concat(coalesce(notes, ''), E'\nKILL-SWITCH <date>: <reason>')
 WHERE family='<family>';
```

Safety-gate verification:
```
bun run scripts/safety-gate.ts --target=<hostname>
# expect: result: FAIL with POSTURE_GRAY
```

### 4.b. Full-family kill-switch

If the whole family is unsafe (cease-and-desist risk, detection-health spike, etc.):

```sql
UPDATE "ATSAutomationPosture" SET posture='FORBIDDEN' WHERE family='<family>';
```

Follow up with Scenario B in the incident-response runbook for evidence preservation + communication steps.

### 4.c. Recipe-level kill-switch (mid-family)

If the family is fine but a specific recipe version is bad:

```sql
UPDATE "ApplicationFlowDefinition"
   SET status='DEPRECATED',
       metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{deprecatedReason}', '"canary stale <date>"')
 WHERE hostname='<hostname>' AND version=<version>;
```

The dispatcher only reads `status='ACTIVE'` so the recipe stops being used immediately. No deploy required.

## 5. After the cycle

- [ ] File the scorecard read + any actions taken as `docs/canary-<YYYY-MM-DD>.md`. Template (fill in the fields):

  ```
  # Canary — <date>
  - Cycles run: <count>
  - Pass-rate delta per family:
    - greenhouse: <last> -> <this> (<delta>pp)
    - lever: ...
  - STALE flags: <list or "none">
  - Actions taken: <list or "none">
  - Kill-switches fired: <list or "none">
  ```

- [ ] Update the plan-board status if any P7 / P14 task shifted because of this canary.
- [ ] If everything was green two weeks in a row, add a note to §16.5 in FINAL_PLAN.md and consider whether canary cadence can stretch (not automatic — Steven decides).

## 6. Troubleshooting

### Canary did not run at all

- [ ] Check `/admin/detection-health` for auto-posture-flips over the weekend (P16.6). If every ACTIVE family was auto-demoted to GRAY, the canary had nothing eligible to submit to.
- [ ] Check the cron logs: `POST /api/cron/canary` (P14.1, **pending until that ticket lands**) should have fired. Absence of the cron is itself a red flag — file a bug against the cron infrastructure before doing anything else.

### Scorecard shows duplicate canary submissions

- [ ] The cron uses a deduplication key scoped to the ISO week; if you see duplicates, the key is broken. File against P14.1.
- [ ] Do **not** manually delete duplicate rows from the production DB until the root cause is understood.

### Stale flag count is unusually high across multiple families

- [ ] Unlikely to be a recipe-rot problem — more likely a replay-harness change or a baseline issue in P7.3. Stop doing per-family remediation until the harness report itself is trusted again.

---

<!-- The line below is filled in by Steven after two consecutive canary cycles
     executed following this runbook, including at least one intentional stale-
     flag scenario, per FINAL_PLAN.md §16.5. Until then this runbook is a
     draft and the ticket stays in [>] state. -->

APPROVED_BY:
