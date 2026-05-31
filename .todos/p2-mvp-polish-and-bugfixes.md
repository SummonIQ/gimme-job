# p2 — MVP Polish & Bugfixes

## Description:
Tighten the core experience by fixing edge cases, improving errors, and eliminating mock/dead paths.

## Acceptance Criteria:
- [ ] Audit and improve error handling across all flows
- [ ] Address edge cases in job search, resume upload, and application flows
- [ ] Ensure robust fallback for failed AI or scraping operations
- [ ] Clean up dead links/mocks; prefer real data paths

## Validation:
- [ ] Core flows (search, resume upload, apply) handle error/empty/retry states visibly.
- [ ] AI/scraping fallbacks return actionable errors instead of silent failures.
- [ ] No user-facing mocks/dead links remain on sampled pages.
