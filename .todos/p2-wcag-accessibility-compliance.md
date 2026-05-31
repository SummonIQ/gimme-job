# p2 — WCAG Accessibility Compliance

## Description: Reach WCAG 2.1 AA for core flows (search, leads, notifications, onboarding, settings) with working automated a11y checks.

## Acceptance Criteria:
- [ ] Create `__tests__/a11y/` and make `bun run test:a11y` pass
- [ ] Keyboard/focus audit for key pages; fix focus traps and tabbable order
- [ ] Ensure icon-only buttons have accessible names; fix form labels/errors
- [ ] Improve table/report semantics; check status badges/contrast
- [ ] Add lint/test guardrails to prevent regressions

## Validation:
- [ ] `bun run test:a11y` (or equivalent) passes.
- [ ] Manual keyboard walkthrough on core flows confirms correct focus order and operability.
