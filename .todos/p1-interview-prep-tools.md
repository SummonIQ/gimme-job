# p1 — Interview Prep Tools

## Description:

Ship a full interview-prep loop: generate role/lead-specific questions, let users practice and record answers, run AI evaluations with a rubric, and persist session history with trends/feedback so users can see progress and next steps.

## Acceptance Criteria:

- [ ] Provide AI-powered interview question generation (API + UI)
- [ ] Add feedback/scoring for mock interviews
- [ ] Build interactive practice UI (record/submit answers, notes)
- [ ] Persist sessions and show history/analytics
- [ ] Common question libraries organized by job role and industry
- [ ] Track progress and identify areas for improvement

## Validation:

- [x] API routes (questions, evaluate) use correct auth pattern
- [ ] Generating a question set for a role/lead returns questions without errors.
- [ ] Submitting answers produces stored evaluations with scores/feedback visible on reload.
- [ ] Session history lists past prep runs with timestamps and key metrics.
