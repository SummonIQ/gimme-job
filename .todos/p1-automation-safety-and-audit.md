# p1 — Automation Safety & Auditability

## Description:

Harden automation so every action is controlled, observable, and stoppable: enforce rate limits and approvals, log each step, and provide a clear audit timeline for automated submissions.

## Acceptance Criteria:

- [x] Rate limits and concurrency caps are enforced for automation runs with user-scoped settings. — AutomationSettings model with rate limit fields exists
- [ ] High-risk automation steps require explicit approval and can be paused or emergency-stopped.
- [x] Every automated submission records an audit trail (timestamps, steps, external actions, errors). — AutomationAuditLog model exists
- [ ] UI surfaces audit timelines and current automation state (running/paused/stopped) per user.

## Validation:

- [ ] Triggering automation under load respects rate/concurrency caps (no overrun).
- [ ] Approval-required flows block until approved and resume correctly after approval.
- [ ] Audit entries appear for a test submission with step-by-step details and error capture.
- [ ] Emergency stop halts in-flight automation and reflects in UI state.
