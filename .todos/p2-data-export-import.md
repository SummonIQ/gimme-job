# p2 — Data Export & Import

## Description:
Let users export their data (leads, searches, resumes, analytics) and import contacts/leads safely with validation, so they can move data in/out without manual work.

## Acceptance Criteria:
- [ ] Export endpoints/flows exist for leads, job searches, resumes, and analytics in common formats (CSV/JSON).
- [ ] Import flow exists for contacts/leads with schema validation and error reporting.
- [ ] Imports enforce user scoping and avoid duplicates where possible.
- [ ] UI exposes export/import actions with progress/error feedback.

## Validation:
- [ ] Running an export produces a downloadable file with correct columns for a test user.
- [ ] Importing a sample CSV creates/updates records and surfaces row-level errors without partial corruption.
- [ ] Imported records appear in the UI and are scoped to the importing user only.

