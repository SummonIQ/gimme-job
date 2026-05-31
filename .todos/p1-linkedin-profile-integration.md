# p1 — LinkedIn Profile Integration (complete)

## Description:

Keep LinkedIn profile import and downstream usage stable—import data, map it to the app, and surface suggestions safely.

## Acceptance Criteria:

- [x] Allow users to import their LinkedIn profile
- [x] Extract contact information and connections
- [x] Parse profiles for readability
- [x] Suggest connections based on job leads
- [x] Add LinkedIn tools integration to job details page
- [ ] View and manage LinkedIn profile information within the app
- [ ] Compare skills from LinkedIn profile with job requirements
- [ ] Maintain rate limits and error handling for imports

## Validation:

- [ ] Importing a profile populates contacts/profile data without errors in logs.
- [ ] Rate limits are handled gracefully (retry/backoff) and surfaced to the user if exceeded.
- [ ] Suggestions render in the UI for a test lead after an import.
