<!-- markdownlint-disable MD013 MD034 -->

# Runbook — Incident response

**Status:** Draft — pending Steven tabletop per FINAL_PLAN.md §16.7
**Last revised:** 2026-04-23

## 0. How to use this runbook

Four scenarios, each with the same five-step pattern:

1. **Contain** — stop whatever's in flight so we don't make it worse.
2. **Preserve evidence** — snapshot the DB rows, logs, and artifacts we'll need later.
3. **Rollback** — undo automation-side state so the system is coherent.
4. **Communicate** — tell whoever needs to know.
5. **Post-mortem** — file what happened and what we changed.

Pre-incident: keep these handy so you don't have to find them mid-event:
- Safety gate: `bun run scripts/safety-gate.ts --target=<hostname>` (§16.1)
- Trust dashboard: `/admin/trust-dashboard` (§8.2)
- Detection-health dashboard: `/admin/detection-health` (§16.6)
- Confirmation-inbox admin: `/admin/confirmation-inboxes` (§10.5)
- Queue admin (with archived tab + restore): `/admin/queue` (§2.3, §2.4)

---

## Scenario A — Host starts CAPTCHA-challenging

**Signals that fire first:**
- `/admin/detection-health` shows an `AUTO_DETECTION_HEALTH_DEMOTE` audit row for the host with `CAPTCHA_SPIKE` in its triggered list (§16.6).
- `ApplicationRuntimeEvent` rows with `eventType='captcha'` or `errorCode='CAPTCHA'` appearing in a short window.
- Sudden drop in submission throughput for a single ATS family.

**1. Contain (within 5 minutes)**
- [ ] Pause any active burst: the `confirmBurst` UI has no live run concept yet, so instead call:
  - `UPDATE "ATSAutomationPosture" SET posture='GRAY' WHERE family='<family>';` (or flip via `/admin/confirmation-inboxes` once the posture UI lands).
  - If detection-health hasn't already demoted the host, add a manual `RuntimeTrustOverride` via `/admin/trust-dashboard` capping at `OBSERVE_ONLY` with reason `captcha-spike:<date>`.
- [ ] Verify new submissions are blocked:
  - `bun run scripts/safety-gate.ts --target=<hostname>` should return non-zero with `POSTURE_GRAY` in `failingReasons`.

**2. Preserve evidence**
- [ ] Snapshot the last hour of runtime events for the host:
  ```sql
  SELECT * FROM "ApplicationRuntimeEvent"
   WHERE "url" ILIKE '%<hostname>%'
     AND "createdAt" > now() - interval '2 hours'
   ORDER BY "createdAt" DESC;
  ```
  Save to `docs/incidents/<YYYY-MM-DD>-captcha-<hostname>/runtime-events.csv`.
- [ ] Save any `ReplayArtifact` rows referenced by those sessions (the `domSnapshots` Bytes column is the most diagnostic — do not skip it).
- [ ] Capture a screenshot of `/admin/detection-health` showing the offending row.

**3. Rollback**
- [ ] Mark any in-flight `JobQueueItem` rows of type `DESKTOP_SUBMIT_REQUEST` for this host as `DEAD`:
  ```sql
  UPDATE "JobQueueItem"
     SET "status"='DEAD', "lastError"='captcha_incident:<date>'
   WHERE "type"='DESKTOP_SUBMIT_REQUEST'
     AND "status" IN ('PENDING','PROCESSING')
     AND "payload"->>'applicationUrl' ILIKE '%<hostname>%';
  ```
- [ ] Check `ApplicationSubmission` rows that transitioned to `ATS_CONFIRMED` during the affected window — the phrase detector (§3.4) is guarded but review the last ten by hand.

**4. Communicate**
- [ ] Post a short note in the internal incident channel: host, earliest signal time, containment actions, expected re-evaluation time.
- [ ] No external comms unless the ATS contacts us first (see Scenario B).

**5. Post-mortem**
- [ ] File `docs/incidents/<YYYY-MM-DD>-captcha-<hostname>/post-mortem.md` with:
  - Timeline pulled from runtime events + detection-health audit log.
  - What the safety gate would have caught (and what it missed).
  - Whether trust-ladder / posture thresholds should move (§16.6 `DEFAULT_THRESHOLDS`).
  - Whether a new `SubmissionConfirmationPhrase` should be registered from the captured HTML.

---

## Scenario B — ATS sends a cease-and-desist

**Signals:** direct email to Steven from the ATS vendor, or a legal notice on the host.

**1. Contain (within 1 hour)**
- [ ] **Full stop** on the affected family:
  - `UPDATE "ATSAutomationPosture" SET posture='FORBIDDEN', notes='C&D received <date>' WHERE family='<family>';`
  - Every `RuntimeTrustOverride` for hostnames in this family, capped at `OBSERVE_ONLY`.
- [ ] Safety gate verification: `bun run scripts/safety-gate.ts --target=<hostname>` returns non-zero with `POSTURE_FORBIDDEN`.
- [ ] Disable any crons that consume the queue for this family until legal review is complete.

**2. Preserve evidence**
- [ ] Save the original C&D (PDF / email) into `docs/incidents/<YYYY-MM-DD>-cd-<family>/`.
- [ ] Export every `ApplicationSubmission` and `AutomationAuditLog` row tied to this family in the last 90 days; this is the most likely evidence set legal will ask about.
- [ ] Do **not** delete any `ReplayArtifact`, `ApplicationRuntimeEvent`, or `AutomationAuditLog` row from this family. If storage pressure requires pruning elsewhere, this family is off-limits until sign-off.

**3. Rollback**
- [ ] Withdraw any active `confirmBurst` dispatches for the family (same SQL pattern as Scenario A, scoped on `jobProviderUrl LIKE '%<family-pattern>%'`).
- [ ] If any submission in the last 30 days reached `EMAIL_CONFIRMED` or `DASHBOARD_CONFIRMED` and the C&D relates to it, note it in the post-mortem — it is **not** rolled back. The submission existed; denying it would be worse.

**4. Communicate**
- [ ] Steven is the sole external contact. Do not reply to the ATS without legal.
- [ ] Add `docs/incidents/<YYYY-MM-DD>-cd-<family>/response-draft.md` for review.

**5. Post-mortem**
- [ ] File the post-mortem with:
  - The policy change that blocks re-entry (this family goes to a permanent blocklist; see `docs/hostname-blocklist.md`).
  - Which other tasks this unblocks/blocks on the plan board (e.g. P11.4 / P14.2 for this family).
  - A lessons-learned paragraph: what posture heuristic missed it, what we'll change next burst.

---

## Scenario C — The confirmation inbox locks

**Signals:**
- `/admin/confirmation-inboxes` shows every inbox as paused or the `lastPolledAt` timestamps are all >3× polling cadence in the past.
- Email provider sends a "suspicious activity" / IMAP auth failure notification.
- Reconciliation dashboard shows a growing backlog of `PENDING` submissions that should have been `EMAIL_CONFIRMED` by now.

**1. Contain (within 30 minutes)**
- [ ] Pause the ingestion cron — set the `isActive` column on every affected `ConfirmationInbox` row to `false`.
- [ ] Freeze new submissions until confirmation coverage is restored:
  - Flip postures for every family that relies on email confirmation from this inbox to `GRAY` (the safety gate's `INBOX_UNREACHABLE` check will also fire and block bursts).

**2. Preserve evidence**
- [ ] Do **not** rotate the IMAP / OAuth secret yet. If the lock was an attack we need the raw failure events; rotation destroys them. (Safe to rotate after evidence is captured.)
- [ ] Save provider notification email.
- [ ] Export the last 48h of `ApplicationSubmission` rows whose `confirmationState` is `PENDING` and whose `submittedAt` is older than 12h — these are the reconciliation gap.

**3. Rollback**
- [ ] Run `POST /api/cron/reconcile-pending` (§10.4) so stale `PENDING` rows auto-flip to `PRESUMED_FAILED`. This clears the ambiguous state so the dashboard reflects reality instead of masking it.
- [ ] Any submission you can prove succeeded by checking the ATS dashboard directly can be manually marked via `/dashboard/submissions` (§10.3).

**4. Communicate**
- [ ] Quick internal note: inbox name, when it was paused, expected unpause window. No external comms required.
- [ ] If the lock is provider-initiated (Google / Microsoft flagged the account), follow the provider's recovery steps **before** anything else. Do not argue with the safety system.

**5. Post-mortem**
- [ ] File with:
  - Root cause (password rotated, OAuth scope expired, volume spike tripped provider heuristics, etc).
  - Whether `pollingCadenceSeconds` should change.
  - Whether a secondary inbox should be added so a single lock doesn't break reconciliation.

---

## Scenario D — Burst goes wrong mid-flight

**Signals:**
- Queue admin (§2.3, §2.4) shows a `PROCESSING` item that hasn't advanced in >N minutes.
- `AUTO_DETECTION_HEALTH_DEMOTE` fires inside an active burst window.
- Reconciliation dashboard shows a sudden cluster of new `PRESUMED_FAILED` rows.
- Operator notices an obviously-wrong dispatch (wrong lead, wrong mode) in the UI.

**1. Contain (within 10 minutes)**
- [ ] **Halt** — there's no one-button burst stop yet; until there is, use:
  - Mark every `PENDING` + `PROCESSING` `DESKTOP_SUBMIT_REQUEST` for this operator as `DEAD` with reason `burst-halt:<date>`.
  - If any `RuntimeTrustOverride` would let remaining items slip past, add a wildcard override demoting the family to `OBSERVE_ONLY`.
- [ ] Safety-gate every affected host: `bun run scripts/safety-gate.ts --target=<hostname>` for each. Anything that returns green during a bad burst is a bug — file it under post-mortem.

**2. Preserve evidence**
- [ ] Snapshot the full queue state at the moment of halt:
  ```sql
  SELECT * FROM "JobQueueItem"
   WHERE "type"='DESKTOP_SUBMIT_REQUEST'
     AND "updatedAt" > now() - interval '2 hours';
  ```
- [ ] Snapshot the `ApplicationRuntimeEvent` rows for every session in the burst window.
- [ ] Screenshot the burst-report output (§13.2) if the runner generated one; otherwise run `renderBurstReport` against the captured log.

**3. Rollback**
- [ ] For every lead that was actually submitted before halt: leave the row alone (submitting twice is worse than rolling back once).
- [ ] For every lead marked `PROCESSING` that had not yet hit the ATS: flip the `JobLead` status back to `OPTIMIZED` or its prior state and requeue only after the post-mortem.
- [ ] Any `FollowUpDraft` (§12.3) auto-generated during the halt window that references failed submissions — flip its status to `DISMISSED` so a future daily batch doesn't accidentally send stale drafts.

**4. Communicate**
- [ ] Short internal note with the burst ID, how many submissions actually landed, how many were halted, and whether any external message (to a recruiter) needs a corrective follow-up from Steven directly.

**5. Post-mortem**
- [ ] File with:
  - Halt trigger (what signal, what timestamp).
  - Whether the safety gate + `confirmBurst` eligibility filters should have caught it.
  - Whether a new reason code should be added (§11.2 `EligibilityDenialReason`).
  - What was preserved, what was rolled back, and what shipped despite the halt.

---

## Appendix — Universal halt checklist

A copy-paste block for when things are moving faster than the rest of this document:

```
INCIDENT HALT — <datetime UTC>
 [ ] Posture flipped GRAY or FORBIDDEN for every affected family
 [ ] RuntimeTrustOverride added capping hostname at OBSERVE_ONLY
 [ ] ConfirmationInbox(es) paused if email dimension affected
 [ ] JobQueueItem rows for affected hosts marked DEAD
 [ ] Safety gate returns non-zero for the affected target
 [ ] Internal note posted (time / hosts / containment)
 [ ] Incident directory created at docs/incidents/<date>-<kind>/
 [ ] Post-mortem stub committed so the timeline doesn't drift
```

---

<!-- The line below is filled in by Steven at the end of the tabletop exercise per
     FINAL_PLAN.md §16.7. Until it is signed, this runbook is a draft and the
     ticket stays in [>] state. -->

APPROVED_BY:
