# p1 — Networking Tools

## Description:

Deliver a CRM-like networking workflow: contacts + reminders + LinkedIn suggestions, all scoped to the user and validated.

## Acceptance Criteria:

- [ ] Comprehensive contact management with filtering and sorting
- [ ] Track interactions, set reminders, and manage follow-ups
- [ ] Import contacts from LinkedIn and other sources
- [ ] AI-powered contact suggestions based on job leads
- [ ] Integrate with LinkedIn for connection suggestions
- [ ] Surface reminders in notifications
- [x] Ensure contacts/reminders APIs are auth-safe and validated — All routes use getCurrentUser() + requireAuth() correctly

## Validation:

- [x] Contacts list and reminders endpoints work with authenticated requests (no body/double-json issues). — Verified routes use correct auth pattern
- [ ] Suggestions appear for a sample lead and can be saved as contacts/reminders.
- [ ] Notifications fire for due reminders in-app.
