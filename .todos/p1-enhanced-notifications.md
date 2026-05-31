# p1 — Enhanced Notifications

## Description:

Ship a reliable, configurable notification system across the agentic job-search workflow so users get actionable signals (automation, approvals, reminders, search completion, shares/feedback) with clear preferences, real-time delivery, and digests.

## Acceptance Criteria:

- [ ] The codebase defines a canonical list of notification categories/event types with strict payload typings.
- [x] Preferences CRUD works end-to-end with defaults and per-channel options (IN_APP/EMAIL/PUSH + digests) persisted via the preferences API. — Routes verified, redundant null checks removed
- [ ] Real-time delivery is enabled (Pusher auth routes) and the inbox updates live; a polling fallback exists when sockets fail.
- [ ] Notification triggers exist for automation failures, approvals required, reminders due, and share feedback, with idempotency to prevent duplicates.
- [ ] Digests are generated via `app/api/notifications/digests/route.ts` using at least one template and a scheduled trigger.
- [ ] Browser notifications are gated behind permission, and email delivery (if enabled) is feature-flagged and uses `lib/email/*`.
- [ ] Smart reminders for follow-ups and important deadlines.

## Validation:

- [ ] API pref update and read tested (happy/unauth/validation errors).
- [ ] Trigger emits Notification + Delivery rows for a sample event.
- [ ] UI smoke for inbox/settings shows new notifications without page refresh and respects preferences.
