<!-- markdownlint-disable MD013 MD034 -->

# Runbook — small controlled burst (20–50 leads)

**Status:** Draft — pending the first burst executed end-to-end via this runbook (per FINAL_PLAN.md §16.4)
**Last revised:** 2026-05-03
**Cadence:** Per-burst, on demand. Use this once we are out of single-lead territory but before any larger campaign.

This runbook layers on top of `runbook-desktop-single-lead.md` (P16.3). Read that first — pairing, identity, and the training-mode habit are prerequisites.

## 0. When to use this runbook

- The single-lead path has worked clean against the families you are bursting (no `STALE` flags in the canary log within the last week, no incident scenarios open).
- The lead set is **pre-reviewed by a human** — every lead has an explicit `submissionTier` set; you have not auto-classified.
- You have time to babysit a 20–50 minute live run. Do not start a burst you cannot watch.

If any of those is false, stop. There is no "kick it off and walk away" option for a controlled burst.

## 1. Pre-flight checks (the moment you start, before clicking anything)

Run each of these. Record the result in the burst report from the start; do not "remember to write it down later".

### 1.a. Safety gate per host

```
for h in $(cut -f2 leads-to-burst.tsv | sort -u); do
  bun run scripts/safety-gate.ts --target=$h || echo "FAIL $h"
done
```

Any `FAIL` line removes that hostname's leads from this burst. Do not bypass.

### 1.b. Per-host rate-limit budget

```
bun run scripts/host-rate-budget.ts --target=<hostname>
```

(Or query `HostRateLimitState` directly: `bucketKey=(hostname, 'application_submit')`, `tokensRemaining` ≥ planned dispatches for that hostname). If a host doesn't have budget, slice it out — do not let the bucket auto-deny mid-burst (it will halt the runner; see §4).

### 1.c. Trust dashboard spot-check (P8.2)

- [ ] Open `/admin/trust`.
- [ ] For every (ATS, hostname) tuple in scope: trust state is `MONITORED` or `FULL_AUTO`. None `OBSERVED` or below.
- [ ] Note any "last change reason" within the past 7 days. Recently downgraded tuples come out of the burst.

### 1.d. Posture check

- [ ] `ATSAutomationPosture.posture = 'ALLOWED'` for every family in scope.
- [ ] If a posture row is missing for a host you intend to submit to, add the row with the correct posture **before** dispatching. Do not let a missing row pass as "ALLOWED by default" — `confirmBurst` rejects rows with no posture.

### 1.e. Confirmation infrastructure

- [ ] Every family in scope has at least one `SubmissionConfirmationPhrase` row.
- [ ] `ConfirmationInbox` polled within the past 30 minutes (`/admin/confirmation-inboxes`).
- [ ] The reconciliation cron (`POST /api/cron/reconcile-pending`) ran in the past 24h.

### 1.f. Desktop runner

- [ ] Desktop app is running, paired, on the user who owns the leads.
- [ ] No prior burst session is mid-flight (`/admin/desktop-audit` shows no `IN_PROGRESS` campaign rows for this user).
- [ ] The runner can hit `lib/applications/rate-limit/` — `desktop/electron/campaign/rate-limit-bridge.ts` is the contract.

## 2. Dispatching the burst

- [ ] Open `/campaigns`. The page surfaces eligible leads with their `submissionTier`, current trust tuple, and per-host bucket headroom.
- [ ] Filter to the planned set. **Verify by eye that the count matches what you wrote in §1.** If the page shows fewer leads than expected, one of the §1 checks pruned them — read the disabled-row reason before continuing.
- [ ] Click **Dispatch burst**. The client posts to `POST /api/campaigns/confirm-burst` (`lib/campaigns/confirm-burst`) with `{ leadIds, mode }`. The server creates one `JobQueueItem` per lead, routed by tier:
  - `TARGETED` → desktop `assist` mode (per-lead manual confirmation).
  - `GENERIC` → desktop `auto` mode on `ALLOWED` posture.
  - `FIRE_AND_FORGET` → only routes if trust is `FULL_AUTO`; otherwise the row is rejected before enqueue and reported back in the response.
- [ ] The response includes `enqueued`, `rejected`, and `rejectionReasons`. Read the rejection list — those leads are not in this burst, and you must decide whether to fix and re-dispatch them or drop them.

## 3. Live monitoring (the entire burst window)

- [ ] Open three tabs: `/campaigns/<burst-id>` (live progress), `/admin/desktop-audit` (per-tool calls), `/admin/detection-health` (P16.6 — auto-posture-flips and CAPTCHA spikes).
- [ ] Eyeball every confirmation: each `EMAIL_CONFIRMED` should land within ~90s of the submit click. If you see one stall past 5 minutes, click into it and check whether the page actually rendered a confirmation banner.
- [ ] Watch the per-host bucket levels in the live progress sidebar. If a bucket drops below 10% headroom, that host stops accepting more dispatches in this run — that is a halt, not a slowdown.

## 4. Halt criteria (mandatory — fire on the first occurrence of any)

Any one of these triggers an immediate halt. Do not continue the burst. Do not "let the last few finish" — issue the halt now.

- **CAPTCHA event.** Any tool call that surfaces a captcha-shaped page (the `submit_guard` block reason includes `captcha` or the agent reports `human-challenge-detected`).
- **Three rate-limit rejections.** Three or more `429` responses across the burst, regardless of host. (One per host means the limit was wrong; three across hosts means we are being noticed.)
- **Reply-rate collapse.** If the running 1-hour reply rate (across all submissions made via this user this week, including pre-burst) drops below 40% of the trailing-30-day baseline reported on the trust dashboard, halt.
- **Confirmation detector starts reporting `no_match` on a family that previously matched.** That is recipe rot mid-burst. Halt and treat as a `STALE` flag (§3 of `runbook-canary-weekly.md`).
- **Operator-judgment halt.** You are watching the burst. If something feels wrong, halt. We will pay this cost rather than the cost of a runaway run.

How to halt: stop the desktop runner (`Cmd-Q` is fine — the queue items it has not picked up stay in `JobQueueItem.status='PENDING'` and the recipe stays consistent). Then mark the burst aborted in `/campaigns/<burst-id>` so the dashboard reflects truth.

## 5. Post-burst reconciliation (within 1 hour of the last submit)

- [ ] Wait for the in-flight reconciliation pass: `POST /api/cron/reconcile-pending` runs every 30 min. Manually invoke it from `/admin/cron` if you do not want to wait.
- [ ] Pull the burst into the report template: copy `docs/burst-report-template.md` to `docs/burst-<YYYY-MM-DD>.md` and start filling. Fill the **Outcomes** table from the campaign page; fill **Halt events** as you go even if zero halts fired (write "none").
- [ ] For each `Submitted (pending confirmation)` lead remaining 24h after the burst: open the lead, read the audit DOM, and decide manually. Do not let them age into auto-fail without diagnosis.
- [ ] Push every recipe-rot / detection-health follow-up to the right tickets the same day. Do not let the report sit unfiled.

## 6. After-action

- [ ] Compare verified-submission rate to the 80% target. If &lt;80%, the next burst is paused until the cause is fixed and a single-lead run on the affected family lands clean.
- [ ] Compare human-intervention rate to the 20% target. If &gt;20%, the burst was not actually "controlled" — review the prep work to find what we missed.
- [ ] If trust state changed for any tuple, the change is recorded in P8.2; cite the burst report in the change reason.
- [ ] File `docs/burst-<YYYY-MM-DD>.md` and link it from the burst page so the next operator can read it.

## 7. Embedded burst report template

The exact template lives in `docs/burst-report-template.md`. Copy it; do not edit the template in place.

```
cp docs/burst-report-template.md docs/burst-$(date +%F).md
```

---

<!-- The line below is filled in by Steven after one burst executed
     end-to-end via this runbook with verified rate ≥ 80% and a completed
     burst report, per FINAL_PLAN.md §16.4. Until then this runbook is a
     draft and the ticket stays in [>] state. -->

APPROVED_BY:
