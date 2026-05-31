# p2 — Accessibility Improvements

## Description:
Reach and maintain WCAG compliance on core flows by fixing keyboard/focus/semantics/contrast issues, ensuring controls are announced correctly, and backing it with repeatable automated a11y checks.

## Acceptance Criteria:
- [ ] Keyboard/focus, contrast, and semantics issues identified in audit are resolved on core pages.
- [ ] Icon-only controls expose accessible names.
- [ ] Dialogs, forms, and tables are screen-reader friendly with proper roles/labels.
- [ ] Automated a11y checks run on target pages with zero critical violations.

## Validation:
- [ ] `bun run test:a11y` (or equivalent) passes.
- [ ] Manual keyboard walkthrough confirms focus order and operability on core flows.
