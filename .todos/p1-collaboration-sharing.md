# p1 — Collaboration / Sharing

## Description:

Enable secure sharing of leads/resumes with permissions, feedback loops, and reliable notifications.

## Acceptance Criteria:

- [ ] Allow users to share job leads with friends, mentors, or colleagues
- [ ] Allow users to share resumes for feedback
- [ ] Control access levels (view, comment, edit) for shared resources
- [ ] Add feedback collection UI and notify owners
- [ ] Time-limited share links with expiration settings
- [ ] Secure public share pages with proper access validation

## Validation:

- [x] Sharing API routes use correct auth pattern and zod validation
- [ ] Creating a share link succeeds with configurable access/expiry and is persisted.
- [ ] Public share page renders for allowed users and denies access when permissions expire/mismatch.
- [ ] Feedback submission notifies the owner and is visible in-app.
