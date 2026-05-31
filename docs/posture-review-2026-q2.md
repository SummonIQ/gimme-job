# ATS Posture Review - 2026 Q2

Reviewed: 2026-04-23
Reviewer: codex, using read-only database queries and the P0.3 inventory report.

## Scope

P14.3 requires a quarterly risk-register review for ATS families that have been bursted, with posture updates and shelving decisions when stress signals appear.

This review checked:

- Live `ATSAutomationPosture` rows.
- Automated `ApplicationSubmission` rows.
- Runtime CAPTCHA or rate-limit events.
- `HostRateLimitState` rows.
- The P0.3 inventory report in `docs/ats-inventory-2026-04-22.md`.

## Findings

- Automated submissions found: 0.
- Total submissions found: 1.
- Bursted ATS families found: none.
- Runtime CAPTCHA or rate-limit events found: 0.
- Host rate-limit rows found: 0.

Because no automated bursts have run yet, there are no observed burst stress signals to use for demotion. This review therefore records the current live posture register and keeps all non-approved families gated.

## Current Posture Register

| ATS family | Live posture | Decision | Notes |
| --- | --- | --- | --- |
| greenhouse | ALLOWED | Keep allowed with safety gates. | Highest P0.3 SWE volume. Eligible only behind the P16.1 safety gate, confirmation detection, rate limits, and targeted canary flow. |
| taleo | FORBIDDEN | Keep shelved. | Oracle-owned platform-level terms. Do not run bursts or training submissions against production Taleo hosts. |
| ashby | GRAY | Keep gated. | No burst evidence yet. Requires Steven review before any live automation beyond approved manual training. |
| bamboohr | GRAY | Keep gated. | Long-tail classifier entry. No burst evidence yet. |
| cornerstone | GRAY | Keep gated. | Long-tail classifier entry. No burst evidence yet. |
| icims | GRAY | Keep gated. | Many tenant hostnames; needs per-tenant review before any burst. |
| jobvite | GRAY | Keep gated. | No burst evidence yet. |
| lever | GRAY | Keep gated. | No burst evidence yet. |
| smartrecruiters | GRAY | Keep gated. | No burst evidence yet. |
| successfactors | GRAY | Keep gated. | SAP-owned per-tenant deployments. No burst evidence yet. |
| workday | GRAY | Keep gated. | Many tenant hostnames; needs per-tenant review before any burst. |

## Shelving Decisions

- Taleo remains shelved as `FORBIDDEN`.
- No additional families are shelved from this review because there are no burst runs, CAPTCHA trends, account warnings, rate-limit hits, or reply-rate-collapse signals in the database.

## Operational Notes

- Greenhouse being `ALLOWED` is not a blanket permission for scale. It still requires P16.1 safety-gate checks and the current trust/posture/rate-limit gates before any run.
- `GRAY` families stay blocked from bursts until Steven explicitly re-reviews the family or tenant and updates `ATSAutomationPosture`.
- Before the next quarterly review, P16.6 should make CAPTCHA ratio, session abandonment, 4xx/5xx spikes, unusual latency, and reply-rate collapse visible in one place. Today those signals are not yet first-class review inputs.
- The live posture register currently differs from the initial seed defaults for Greenhouse and Taleo. Do not rerun the posture seed in production unless those live decisions are intentionally preserved.

## Next Review Inputs

The next review should include:

- Bursts grouped by ATS family and hostname.
- Verified-submission rate and human-intervention rate.
- CAPTCHA, rate-limit, and account-warning counts.
- Reply rate by family and submission tier.
- Current `ATSAutomationPosture.reviewedAt` age.
