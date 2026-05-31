# p1 — Skill Gap Analysis

## Description

Deliver a repeatable skill-gap workflow: ingest a resume + job description, detect missing or weak skills with evidence, rank gaps by impact, generate targeted learning recommendations, and persist results so users can track improvement over time. Replace any mock data with real analyses and keep history visible in analytics.

## Acceptance Criteria

- [ ] Analyze resumes vs job descriptions for missing skills
- [ ] Visual representation of skill matches and gaps
- [ ] Suggest courses/resources for upskilling
- [ ] Persist analyses and expose history/analytics
- [ ] Replace any mock skill analytics with real data
- [ ] Track skill development progress over time

## Validation

- [x] API routes use correct auth pattern (getCurrentUser + requireAuth)
- [ ] Running an analysis produces gap results with evidence for a test resume + JD.
- [ ] Recommendations are stored and viewable on a history/analytics page after reload.
- [ ] Mock data is not rendered in skill analytics for a real user.
