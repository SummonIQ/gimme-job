# p2 — Type Safety & Linting

## Description:
Keep the codebase type-safe and lint-clean by preventing new `any`/lint issues and documenting safe patterns.

## Acceptance Criteria:
- [ ] The codebase rejects new `any` usage in app/lib/components (lint or CI guard).
- [ ] Critical paths compile without type errors and without unsafe casts in new changes.
- [ ] Formatting and import ordering follow the documented standard across touched files.
- [ ] Patterns for narrowing and schema validation are documented and referenced in code comments or docs.

## Validation:
- [ ] Lint run passes without new warnings/errors.
- [ ] Typecheck (`bunx tsc --noEmit` or equivalent) passes after changes.
