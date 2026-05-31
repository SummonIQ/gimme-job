# p1 — User Onboarding & Guidance

## Description:

Guide new users to first value with a resumable onboarding flow, AI tips, and clear next steps.

## Acceptance Criteria:

- [x] Build interactive onboarding flow to first job search — interactive-onboarding-modal.tsx, onboarding-context.tsx exist
- [x] Include AI-guided tips and contextual help — help-button.tsx, debug-panel.tsx exist
- [x] Persist onboarding progress server-side (no client-only state) — lib/onboarding/actions.ts handles server state
- [ ] Add restart/reset option and success state with next steps

## Validation:

- [ ] A new user can complete onboarding through first search without localStorage-only state.
- [ ] Restart/reset restores the flow and clears prior onboarding state.
- [ ] AI tips/context appear where expected during the flow.
