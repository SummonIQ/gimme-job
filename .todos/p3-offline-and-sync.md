# p3 — Offline & Sync for Mobile Web

## Description:
Provide basic offline support for recent searches/leads and a safe sync strategy when reconnecting, so mobile users can view and queue actions with minimal data loss.

## Acceptance Criteria:
- [ ] Recent searches and leads are cached for offline viewing on mobile.
- [ ] User actions taken offline (e.g., save/dismiss) queue and sync when back online.
- [ ] Conflict handling rules are defined and applied on sync (server wins/client wins or merge rules).
- [ ] UI indicates offline/online state and sync status to the user.

## Validation:
- [ ] Turning off connectivity still shows cached recent items on mobile.
- [ ] Offline actions apply on reconnect and are reflected in server data.
- [ ] Conflicting updates follow the defined resolution rules with clear user feedback.

