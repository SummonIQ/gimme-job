-- P17.1: typed desktop-runtime failure reason on ApplicationSubmission.
-- The value space is the failure subset of DESKTOP_AGENT_SESSION_STATUSES
-- (see desktop/electron/agent/types.ts). Stored as a plain TEXT column —
-- not a Prisma enum — so adding new typed reasons in future tasks does
-- not require a schema migration.

ALTER TABLE "ApplicationSubmission"
  ADD COLUMN "failureReason" TEXT;
