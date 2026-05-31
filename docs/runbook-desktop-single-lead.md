<!-- markdownlint-disable MD013 MD034 -->

# Runbook — desktop single-lead submission

**Status:** Draft — pending end-to-end execution against a trusted ATS host (per FINAL_PLAN.md §16.3)
**Last revised:** 2026-05-03
**Cadence:** Per-lead, on demand. Use this for any one-off submission you intend to send through the desktop runtime.

This runbook is the operational counterpart to the desktop runtime that landed in P5. The CLI Greenhouse path (P3) is retired (P3.5 / `runbook-greenhouse-manual.md`) — the desktop app is the only authoritative submission surface.

## 0. Prerequisites

Before you start, confirm:

- The `gimme-job` web app is reachable for the user you'll submit as.
- A `JobLead` exists for the role and is in a state the desktop dashboard surfaces (not `APPLIED`, not `DISMISSED`).
- The hostname is `ALLOWED` in `ATSAutomationPosture` (see §2). If it's `GRAY` or `FORBIDDEN`, stop — there is no manual override path.
- A `SubmissionConfirmationPhrase` exists for the family. Without one, the post-submit confirmation detector (P3.4) cannot promote the lead to `APPLIED`.

## 1. First-run install

Skip this section after the first device pairing.

- [ ] Build / launch the desktop app: `bun run desktop:dev` (or `bun run desktop:build` for a packaged build).
- [ ] The window opens as a single shell hosting the web app and the ATS page side-by-side, with the toolbar across the top and the sidebar on the right.
- [ ] In the desktop's web pane, open `/admin/desktop-tokens` while signed in as the user who will submit.

## 2. Token handshake (pair the device)

- [ ] In `/admin/desktop-tokens`, click **Generate pairing code** (`POST /api/desktop-tokens/pair`).
- [ ] Enter the code in the desktop "Pair device" dialog (`window.gimmeJobDesktop.auth.pairWithCode`). The token is stored in the OS keychain with scope `desktop:runtime`.
- [ ] Confirm the status pill flips to **paired** and a row appears in `/admin/desktop-tokens` with `lastUsedAt` set.
- [ ] Run the safety gate against the host you'll submit to: `bun run scripts/safety-gate.ts --target=<hostname>` — must return `result: OK`. Failures (posture not `ALLOWED`, missing confirmation phrase, exhausted `HostRateLimitState`, unreachable `ConfirmationInbox`, recipe regression > 7 days, blocklisted hostname) halt this runbook; the desktop runtime is not the place to bypass safety.

## 3. Choose a lead

There are two ways:

- **Easy mode (recommended for normal use):** click the toolbar **Shuffle** button (`Pick random Greenhouse job`). The desktop calls `pickRandomGreenhouseLead`, picks one matching the active search filters, navigates the ATS pane to it, and selects it in the sidebar in one step.
- **Manual:** navigate the web pane to `/leads/<id>` (or open from the dashboard) so "Selected lead" in the sidebar reflects it, then load the application URL into the ATS pane.

If the lead has a tailored resume (P9.6), confirm the active revision via the sidebar's **Tailor resume** panel and swap it before submitting if needed.

## 4. Training run (`submit_guard=true`)

Always do this first for any new hostname or after any DOM change.

- [ ] Open the toolbar **Search filters** popover and confirm **Mode** is set to **Autofill** (this is the default and sends `mode: 'training'` to the runtime, keeping `submit_guard=true` per `desktop/electron/agent/session.ts:34` + `prompt.ts:14`).
- [ ] Click the toolbar primary action — it reads **Autofill** in this mode. The agent fills the form: identity, resume upload, custom questions. When it attempts the submit-intent click, `submit_guard` blocks it and the sidebar shows **Submit guard held** (status `blocked_by_submit_guard`).
- [ ] Open the **State** sidebar tab and confirm:
  - Every required field has a value (no `unfilled` rows).
  - The resume row points at the right revision.
  - Selectors look right.
- [ ] Fix anything wrong inline; corrections persist for that hostname and are reused on the next run.
- [ ] If the run failed before reaching submit (network error, agent gave up, captcha), **stop** — fix the upstream issue and re-run training. Do not flip to submit mode.

## 5. Submit run

Only enter this section after a clean training run on the same lead.

- [ ] Open the toolbar **Search filters** popover and switch **Mode** to **Submit**. This sends `mode: 'submit'`, which the executor honors by calling `submit_guard({ enabled: false })` with `reason: 'owner-approved submit mode'` (`desktop/electron/submit/greenhouse-submit.ts:219`). The override is per-request — it does not persist across runs.
- [ ] The toolbar primary action now reads **Submit**. Click it (or **Continue from page** if the training pause left the review screen up — the runtime resumes there if the page is still alive, otherwise re-fills from the top).
- [ ] Watch the ATS pane: submit click → success page or in-page confirmation banner. **Don't navigate away** — the confirmation detector grabs the DOM ~1.5s after submit and POSTs it to `/api/desktop/applications/confirm` (P3.4), which compares against `SubmissionConfirmationPhrase` and flips `JobLead.status → APPLIED`.
- [ ] Sidebar should show **Application submitted** (status `completed`). If it shows **Submit guard held** instead, you're still in Autofill — re-check the Mode selector in the search popover and re-run.

## 6. Reconcile the outcome

- [ ] Open the lead in the web dashboard. Status should read **Applied** with the submission timestamp from the desktop run.
- [ ] If status is still **Submitted (pending confirmation)** after 60 seconds, check `/admin/desktop-audit` for the session and inspect the captured DOM snapshot. Common reasons:
  - The confirmation phrase changed (recipe rot). File a `STALE` flag for the recipe (see `runbook-canary-weekly.md` §3).
  - Submission was actually rejected (the page rendered an error banner, not a confirmation). Roll the lead back to its prior status manually and treat as a failed submission.
  - The reconciliation cron will eventually flip it to `SUBMIT_FAILED_AUTO` after the P10.4 window. If you can confirm before that, do so manually.
- [ ] If the submission triggered an email confirmation, the inbox poller (`/admin/confirmation-inboxes`, `lib/email-ingestion/`) records the message; check that it linked back to this submission within the next polling window.

## 7. Halt criteria

Stop and escalate to the incident playbook (`runbook-incident-response.md`) if any of the following happens during this runbook:

- The page renders a CAPTCHA or anti-bot challenge at any point.
- The submit button click triggers an HTTP 4xx/5xx instead of a confirmation page.
- The confirmation detector reports a phrase you don't recognize for that family.
- You see an account warning or rate-limit notice from the ATS host.

Do **not** retry from this runbook — the next path is incident response.

## 8. Troubleshooting

### Pairing code never validates

- [ ] Confirm the code wasn't issued more than 10 minutes ago (`expiresAt` on the pairing row). If expired, generate a new one.
- [ ] Confirm both the desktop app and the browser are signed in as the same user — pairing scopes the token to that user.

### Desktop sidebar stuck on "unpaired" after entering a valid code

- [ ] Inspect the desktop app's main-process log for `auth.pairWithCode` errors. Most common: keychain write denied. Re-launch the app and grant keychain access.
- [ ] As a fallback, revoke the half-issued token in `/admin/desktop-tokens` and re-pair.

### Toolbar **Autofill** / **Submit** action stays disabled

- [ ] Verify the ATS pane has a real application URL loaded (not blank, not the marketing page).
- [ ] Verify the lead hasn't already been submitted in this desktop session (`hasSubmittedCurrentLead`) — pick a different lead (Shuffle works) or reload to reset.
- [ ] Verify `authStatus === 'paired'` (the sidebar status pill).
- [ ] Verify the **Pick random Greenhouse job** Shuffle isn't mid-fetch (`isPickingRandom` disables the run buttons while it resolves).

### Training run reaches submit button but does not block

- [ ] You're in submit mode, not training. Check the mode selector.
- [ ] If the selector shows training but the run still fired, file a P5.3 regression — the prompt + session both treat training as `submit_guard=true` by default, so this is a bug.

### Confirmation detector returns `no_match`

- [ ] Open the audit row, copy the captured DOM, and check whether the confirmation banner you saw in the browser appears in the snapshot.
  - If yes: the registered `SubmissionConfirmationPhrase` doesn't match. Add a phrase variant (do **not** broaden the existing one — log it as a new variant for the family).
  - If no: the snapshot was captured too early or too late. Treat as a P3.4 detection bug and file against that ticket.

---

<!-- The line below is filled in by Steven after a fresh desktop install
     completes a training session AND a real submission against a trusted
     ATS host using only this runbook, per FINAL_PLAN.md §16.3. Until then
     this runbook is a draft and the ticket stays in [>] state. -->

APPROVED_BY:
