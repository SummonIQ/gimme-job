# p1 — Resume A/B & Outcome Attribution

## Description:

Track which resume version is used per application, compare outcomes across versions, and surface “best-performing resume” insights to guide users on which resume to use next.

## Acceptance Criteria:

- [x] Application submissions persist the resume version/ID used. — Schema has resumeId on ApplicationSubmission
- [ ] Outcomes (interview/offer/rejection) are tied back to the resume version.
- [ ] Analytics surfaces comparative performance per resume (conversion rates, interviews/offers).
- [ ] UI highlights the recommended “best resume” for new applications based on historical outcomes.

## Validation:

- [ ] A test submission stores the chosen resume ID and is visible in outcome analytics.
- [ ] Switching resume versions shows different outcome stats in the analytics UI.
- [ ] “Best resume” recommendation updates after new outcomes are recorded.
