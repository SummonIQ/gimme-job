# p2 — Approval Workflows Expansion

## Description:
Extend the approval pattern beyond LinkedIn content to other high-impact actions (automation submissions, risky shares, bulk updates) with consistent UI, notifications, and auditability.

## Acceptance Criteria:
- [ ] Approval APIs exist for targeted actions (automation submissions, risky shares, bulk actions) with clear states (pending/approved/rejected).
- [ ] UI lists pending approvals and allows approve/reject with reasons.
- [ ] Notifications fire to approvers/requesters on state changes.
- [ ] Approved/rejected actions are audited with timestamps and actors.

## Validation:
- [ ] Creating a pending approval for a sample action shows up in the approvals UI.
- [ ] Approve/reject updates the action state and sends notifications to the right parties.
- [ ] Audit records reflect the decision with reason and actor.

