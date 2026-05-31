# p2 — Internationalization

## Description:
Establish reliable i18n for EN/ES: load real message bundles without runtime errors, provide a locale switcher that persists, localize the highest-traffic flows (auth, onboarding, search, notifications, settings), and ensure formatting (dates/numbers) respects locale with graceful fallbacks.

## Acceptance Criteria:
- [ ] English and Spanish message bundles exist and load without runtime errors.
- [ ] A locale switcher is available and persists the user’s choice (cookie or user setting).
- [ ] High-impact flows (auth, onboarding, search, notifications, settings) render localized strings and layouts.
- [ ] Dates and numbers render in locale-appropriate formats, and missing messages fail with a clear fallback.

## Validation:
- [ ] Manual or automated check: switching locales updates UI strings on target pages.
- [ ] No missing-message errors in console/logs for EN/ES on core routes.
