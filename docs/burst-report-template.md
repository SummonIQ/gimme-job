<!-- markdownlint-disable MD013 MD034 -->

# Burst — &lt;YYYY-MM-DD&gt;

> Copy this file to `docs/burst-<date>.md` (where `<date>` is the burst's start date) and fill in every field. Do not delete sections — if they don't apply, write `n/a` and a one-line reason.

## Header

- **Burst date (start):** &lt;YYYY-MM-DD HH:MM PT&gt;
- **Operator:** &lt;name&gt;
- **Lead count (planned):** &lt;n&gt;
- **Lead count (actually dispatched):** &lt;n&gt;
- **ATS families included:** &lt;e.g. greenhouse, lever, ashby&gt;
- **Submission tier mix:** &lt;TARGETED: n, GENERIC: n, FIRE_AND_FORGET: n&gt;
- **Time to last submission:** &lt;mm:ss&gt;
- **Halt criteria fired:** &lt;none / list the rule that triggered a halt&gt;

## Pre-flight checklist (filled before dispatch)

- [ ] Safety gate green for every target hostname (`bun run scripts/safety-gate.ts --target=<hostname>`).
- [ ] `HostRateLimitState` budget ≥ planned dispatches per host.
- [ ] Trust dashboard spot-check: every (ATS, hostname) tuple is `MONITORED` or higher.
- [ ] Posture check: every host is `ALLOWED`. None `GRAY` or `FORBIDDEN`.
- [ ] Confirmation phrase registered for every family in scope.
- [ ] `ConfirmationInbox` reachable (last successful poll within the past 30 min).
- [ ] Desktop runner pre-paired and on the right user.

## Outcomes (fill after the burst lands)

| Family | Dispatched | EMAIL_CONFIRMED | SUBMIT_FAILED_AUTO | Manual intervention | Verified rate |
|---|---|---|---|---|---|
| greenhouse | &lt;n&gt; | &lt;n&gt; | &lt;n&gt; | &lt;n&gt; | &lt;%&gt; |
| lever | &lt;n&gt; | &lt;n&gt; | &lt;n&gt; | &lt;n&gt; | &lt;%&gt; |
| ashby | &lt;n&gt; | &lt;n&gt; | &lt;n&gt; | &lt;n&gt; | &lt;%&gt; |
| **total** | &lt;n&gt; | &lt;n&gt; | &lt;n&gt; | &lt;n&gt; | &lt;%&gt; |

- **Verified-submission rate (overall):** &lt;%&gt; (target ≥ 80%)
- **Human-intervention rate:** &lt;%&gt; (target &lt; 20%)

## Halt events

For each halt that fired, fill a row:

| Time | Trigger | Halted at lead n | Action taken |
|---|---|---|---|
| &lt;HH:MM&gt; | &lt;CAPTCHA / 3rd rate-limit rejection / reply-rate drop / other&gt; | &lt;n&gt; | &lt;list&gt; |

If no halts fired, write `none` here.

## Reconciliation

- Cron `POST /api/cron/reconcile-pending` (P10.4) — last firing: &lt;timestamp&gt;.
- Confirmation inbox poll — last firing: &lt;timestamp&gt;.
- Lead statuses still `Submitted (pending confirmation)` 24h after burst: &lt;n&gt; (target: 0).
  - If &gt; 0, list each lead ID and the diagnosis.

## Notable failures

For each failure mode that recurred, write a one-paragraph diagnosis. Include:

- The failure type (recipe rot, captcha, rate-limit response, ATS-side rejection, our-side runtime crash).
- The ATS host(s) it affected.
- Whether it was caught by the halt criteria or only by post-hoc review.
- Whether it changed the trust state for the affected hostnames.

## Trust + posture mutations

- `ATSAutomationPosture` rows changed during this burst: &lt;list with old → new posture and reason&gt;
- Trust transitions auto-demoted by P16.6: &lt;list&gt;
- Manual demotions performed: &lt;list&gt;

## Cost

- Compute spend (desktop wall time × hosts): &lt;estimate&gt;
- Any external API costs (e.g., screenshot OCR, agent SDK): &lt;estimate&gt;

## Lessons + follow-ups

- &lt;Bullet list of follow-ups, each with an owner and a P&lt;n&gt;.&lt;m&gt; ticket reference if applicable.&gt;
- &lt;If a recipe is suspected stale, file the canary scorecard event reference here.&gt;
- &lt;If a runbook step proved wrong, file a doc fix here.&gt;

## Sign-off

- **Operator:** &lt;name&gt; — &lt;date&gt;
- **Reviewer (Steven):** &lt;date&gt;
