# p1 — Application Outcome Feedback Loop

## Description:

Close the loop on applications by capturing outcomes (interview/offer/rejection), auto-updating lead status, and feeding analytics so users see the real effectiveness of their searches/resumes/automation.

## Acceptance Criteria:

- [x] Users can record or sync outcomes (interview/offer/rejection/no-response) for submissions. — ApplicationOutcomeEvent model exists in schema
- [ ] Recording an outcome updates the associated lead/application status automatically.
- [ ] Outcome data flows into analytics (conversion rates, pipeline progression).
- [ ] UI surfaces “what to do next” when an outcome is recorded (e.g., schedule follow-up, tailor resume).

## Validation:

- [ ] Creating an outcome updates the lead/application status on reload.
- [ ] Analytics reflects the new outcome counts/progression for a test user.
- [ ] Next-step prompts appear in UI after an outcome is saved.
