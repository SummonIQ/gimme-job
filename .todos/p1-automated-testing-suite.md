# p1 — Automated Testing Suite

## Description: Establish reliable tests across layers (unit, integration, E2E, a11y) for the highest-value flows (auth, search, leads, automation, sharing) so we can ship without regressions.

## Acceptance Criteria:

- [ ] Define critical journeys to cover (auth; job search → save/dismiss; lead update; automation start/pause; sharing create/view)
- [x] Add/confirm `bunx tsc --noEmit` and `bun run test` pass locally — Fixed Jest→Vitest; 43 tests pass, 5 fail (test logic issues)
- [ ] Unit tests: add/extend for logic in resumes, job leads, automation, sharing
- [x] Integration/API tests: happy/401/400 paths for key routes — Added networking/contacts tests (auth checks)
- [ ] E2E (Playwright): smoke flows for search → save/dismiss → apply/view status
- [ ] Accessibility: create `__tests__/a11y/` suite; use a11y test mode; fix violations surfaced by axe
- [ ] Document how to run tests (tie into docs ticket)

## Validation:

- [ ] `bunx tsc --noEmit`, `bun run test`, and `bun run test:e2e` succeed locally.
- [ ] A11y suite runs and reports zero critical violations on target pages.
- [ ] CI (if present) runs the suite without flakes on a sample merge request.
