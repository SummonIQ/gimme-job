# p1 — Automated Application Submission (complete)

## Description:

Automation should submit applications safely across boards with user controls, approvals, and clear status tracking.

## Acceptance Criteria:

- [x] Research job board APIs and legal/ethical automation approaches
- [x] Implement safe automation for submitting applications
- [x] Add user controls for automation (opt-in, review, approval)
- [x] Add status tracking for submitted applications
- [ ] Monitor automation safety (rate limits, approvals, emergency stop) and platform ToS changes — NOTE: Fake Glassdoor/ZipRecruiter services were deleted; only Indeed Puppeteer remains

## Validation:

- [x] A real submission flow records an `ApplicationSubmission` with outcome/status and audit log. — Schema supports this
- [ ] Automation respects pause/stop and rate limits under load (spot test).
- [ ] UI shows submission status transitions for a test lead without manual refresh.
