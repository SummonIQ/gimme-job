# p2 — Interactive User Onboarding

## Description: Deliver a guided onboarding that gets new users to first value (profile + preferences + resume + first search) with resumable progress and clear next steps.

## Acceptance Criteria:
- [ ] Define milestones (profile, job prefs, resume upload, optional integrations, first search, lead/save step)
- [ ] Build/confirm multi-step wizard with progress + skip/restart
- [ ] Persist progress server-side (use cookies/DB flags, not just localStorage)
- [ ] Validate inputs with Zod; show friendly errors
- [ ] Trigger onboarding on first login; add “restart onboarding” in settings
- [ ] Add AI-guided tips/contextual help where useful
- [ ] Telemetry: track completion per step (optional)

## Validation:
- [ ] First-login flow routes new users into onboarding and completes through first search.
- [ ] Restart/skip behaves correctly and persists/clears state server-side.
- [ ] Form validation errors render correctly for each step.
