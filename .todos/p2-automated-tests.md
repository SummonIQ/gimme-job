# p2 — Automated Tests

## Description:
Expand and stabilize automated tests across layers so critical flows (auth, search, leads, automation, sharing) stay reliable as features ship: cover logic with unit tests, APIs with integration tests, end-to-end journeys with Playwright, and accessibility with axe.

## Acceptance Criteria:
- [ ] Unit tests cover resume and job lead logic with meaningful assertions.
- [ ] Integration tests exercise core flows (job search, resume upload, application) through API boundaries with 200/400/401 cases.
- [ ] E2E tests cover the user journey search → save/dismiss → apply/view status without flakiness.
- [ ] Accessibility tests run on key screens and report zero critical violations.

## Validation:
- [ ] `bun run test` and `bun run test:e2e` pass locally.
- [ ] `bun run test:a11y` (or equivalent) runs against target pages and passes.
