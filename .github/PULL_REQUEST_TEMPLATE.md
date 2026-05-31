## Summary
- [ ] Linked Linear issue: <!-- e.g. BRI-123 -->
- [ ] User-facing or accessibility-impacting changes noted below

## Testing
- [ ] `bun run test:a11y`
- [ ] `bunx playwright test tests/e2e/accessibility/ci-smoke.spec.ts --project=chromium`
- [ ] Additional coverage (attach logs or notes)

## Accessibility Checklist
- [ ] Reviewed relevant items in `docs/a11y/checklist.md`
- [ ] jest-axe baseline remains passing (see `docs/a11y/ci.md` for invocation details)
- [ ] Playwright accessibility smoke suite remains passing (artifacts attached when feasible)
- [ ] Documented new a11y behaviors or remediation steps when needed
