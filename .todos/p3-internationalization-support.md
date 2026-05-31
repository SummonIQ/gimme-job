# p3 — Internationalization Support

## Description: Add i18n foundation (EN/ES MVP) with locale switching and resilient message loading so future locales don’t require rewrites.

## Acceptance Criteria:
- [ ] Create `messages/en/*` and `messages/es/*`; update `i18n.ts` to load safely
- [ ] Choose routing (locale prefix vs cookie/header) and add `middleware.ts` if needed
- [ ] Add language switcher; persist preference (cookie/user setting)
- [ ] Localize high-impact flows (auth, onboarding, search, notifications, settings)
- [ ] Ensure dates/numbers format per locale and missing messages fail gracefully

## Validation:
- [ ] Switching between EN/ES updates UI strings on target pages without missing-message errors.
- [ ] Locale preference persists across reloads/sessions.
- [ ] Date/number formatting reflects the selected locale in sampled views.
