-- Adds enum values for every fetcher in lib/admin/scrape-service.ts
-- that was previously writing JobProvider.OTHER, and backfills existing
-- JobListing rows whose jobBoard='OTHER' to their real provider based
-- on the jobId prefix. After this migration the analytics
-- "Provider Breakdown" stops lumping ~18k listings into "Other".
--
-- Schema mirrors the JobProvider enum additions in prisma/schema.prisma.

ALTER TYPE "JobBoard" ADD VALUE IF NOT EXISTS 'NODESK';
ALTER TYPE "JobBoard" ADD VALUE IF NOT EXISTS 'OPENJOBS';
ALTER TYPE "JobBoard" ADD VALUE IF NOT EXISTS 'JOBSPRESSO';
ALTER TYPE "JobBoard" ADD VALUE IF NOT EXISTS 'PYTHON_ORG';
ALTER TYPE "JobBoard" ADD VALUE IF NOT EXISTS 'DJANGO_JOB_BOARD';
ALTER TYPE "JobBoard" ADD VALUE IF NOT EXISTS 'REMOTE_JOBS_ORG';
ALTER TYPE "JobBoard" ADD VALUE IF NOT EXISTS 'CLAW_JOBS';
ALTER TYPE "JobBoard" ADD VALUE IF NOT EXISTS 'COMEET';
ALTER TYPE "JobBoard" ADD VALUE IF NOT EXISTS 'JOB_DATA_API';
ALTER TYPE "JobBoard" ADD VALUE IF NOT EXISTS 'FINDWORK';
ALTER TYPE "JobBoard" ADD VALUE IF NOT EXISTS 'WORKDAY';
ALTER TYPE "JobBoard" ADD VALUE IF NOT EXISTS 'BREEZY_HR';
ALTER TYPE "JobBoard" ADD VALUE IF NOT EXISTS 'JAZZHR';
ALTER TYPE "JobBoard" ADD VALUE IF NOT EXISTS 'JOBVITE';
ALTER TYPE "JobBoard" ADD VALUE IF NOT EXISTS 'RECRUITEE';
ALTER TYPE "JobBoard" ADD VALUE IF NOT EXISTS 'WORKABLE';
ALTER TYPE "JobBoard" ADD VALUE IF NOT EXISTS 'TEAMTAILOR';
ALTER TYPE "JobBoard" ADD VALUE IF NOT EXISTS 'BAMBOOHR';
ALTER TYPE "JobBoard" ADD VALUE IF NOT EXISTS 'PERSONIO';
ALTER TYPE "JobBoard" ADD VALUE IF NOT EXISTS 'PALLET';
ALTER TYPE "JobBoard" ADD VALUE IF NOT EXISTS 'PINPOINT';
ALTER TYPE "JobBoard" ADD VALUE IF NOT EXISTS 'CRUNCHBOARD';

-- Postgres requires the ALTER TYPE ADD VALUE to commit before the new
-- enum values can be used. Wrap the backfill in a separate statement.
COMMIT;
BEGIN;

-- Backfill existing OTHER rows by jobId prefix. Each fetcher's prefix
-- is documented next to the UPDATE so a future rename is searchable.

-- Built In           → BUILT_IN
UPDATE "JobListing" SET "jobBoard" = 'BUILT_IN'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'builtin-%';

-- Welcome to the Jungle → WELCOME_TO_THE_JUNGLE
UPDATE "JobListing" SET "jobBoard" = 'WELCOME_TO_THE_JUNGLE'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'welcometothejungle-%';

-- The Muse           → THE_MUSE
UPDATE "JobListing" SET "jobBoard" = 'THE_MUSE'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'themuse-%';

-- CareerBuilder      → CAREER_BUILDER
UPDATE "JobListing" SET "jobBoard" = 'CAREER_BUILDER'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'careerbuilder-%';

-- Work At A Startup  → WORK_AT_A_STARTUP
UPDATE "JobListing" SET "jobBoard" = 'WORK_AT_A_STARTUP'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'workatastartup-%';

-- NoDesk
UPDATE "JobListing" SET "jobBoard" = 'NODESK'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'nodesk-%';

-- OpenJobs
UPDATE "JobListing" SET "jobBoard" = 'OPENJOBS'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'openjobs-%';

-- Jobspresso
UPDATE "JobListing" SET "jobBoard" = 'JOBSPRESSO'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'jobspresso-%';

-- Python.org Jobs    → PYTHON_ORG
UPDATE "JobListing" SET "jobBoard" = 'PYTHON_ORG'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'python-org-%';

-- Django Job Board   → DJANGO_JOB_BOARD
UPDATE "JobListing" SET "jobBoard" = 'DJANGO_JOB_BOARD'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'django-job-board-%';

-- Jobicy             → JOBICY
UPDATE "JobListing" SET "jobBoard" = 'JOBICY'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'jobicy-%';

-- Remotive           → REMOTIVE
UPDATE "JobListing" SET "jobBoard" = 'REMOTIVE'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'remotive-%';

-- Himalayas          → HIMALAYAS
UPDATE "JobListing" SET "jobBoard" = 'HIMALAYAS'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'himalayas-%';

-- Arbeitnow          → ARBEITNOW
UPDATE "JobListing" SET "jobBoard" = 'ARBEITNOW'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'arbeitnow-%';

-- Remote First Jobs  → REMOTE_FIRST_JOBS
UPDATE "JobListing" SET "jobBoard" = 'REMOTE_FIRST_JOBS'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'remotefirstjobs-%';

-- RemoteJobs.org     → REMOTE_JOBS_ORG
UPDATE "JobListing" SET "jobBoard" = 'REMOTE_JOBS_ORG'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'remotejobs-org-%';

-- ClawJobs           → CLAW_JOBS
UPDATE "JobListing" SET "jobBoard" = 'CLAW_JOBS'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'clawjobs-%';

-- Comeet
UPDATE "JobListing" SET "jobBoard" = 'COMEET'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'comeet-%';

-- JobDataAPI         → JOB_DATA_API
UPDATE "JobListing" SET "jobBoard" = 'JOB_DATA_API'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'jobdataapi-%';

-- Findwork
UPDATE "JobListing" SET "jobBoard" = 'FINDWORK'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'findwork-%';

-- Workday Boards     → WORKDAY
UPDATE "JobListing" SET "jobBoard" = 'WORKDAY'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'workday-%';

-- BreezyHR Boards    → BREEZY_HR
UPDATE "JobListing" SET "jobBoard" = 'BREEZY_HR'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'breezy-%';

-- JazzHR Boards      → JAZZHR
UPDATE "JobListing" SET "jobBoard" = 'JAZZHR'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'jazzhr-boards-%';

-- Jobvite Boards     → JOBVITE
UPDATE "JobListing" SET "jobBoard" = 'JOBVITE'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'jobvite-boards-%';

-- Adzuna             → ADZUNA
UPDATE "JobListing" SET "jobBoard" = 'ADZUNA'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'adzuna-%';

-- Jooble             → JOOBLE
UPDATE "JobListing" SET "jobBoard" = 'JOOBLE'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'jooble-%';

-- DevITjobs          → DEV_IT_JOBS
UPDATE "JobListing" SET "jobBoard" = 'DEV_IT_JOBS'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'devitjobs-%';

-- Working Nomads     → WORKING_NOMADS
UPDATE "JobListing" SET "jobBoard" = 'WORKING_NOMADS'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'workingnomads-%';

-- Hacker News        → HACKER_NEWS
UPDATE "JobListing" SET "jobBoard" = 'HACKER_NEWS'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'hn-%';

-- Greenhouse Boards  → GREENHOUSE
UPDATE "JobListing" SET "jobBoard" = 'GREENHOUSE'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'gh-%';

-- Lever Boards       → LEVER
UPDATE "JobListing" SET "jobBoard" = 'LEVER'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'lever-%';

-- Ashby Boards       → ASHBY
UPDATE "JobListing" SET "jobBoard" = 'ASHBY'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'ashby-%';

-- SmartRecruiters Boards → SMART_RECRUITERS
UPDATE "JobListing" SET "jobBoard" = 'SMART_RECRUITERS'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'sr-%';

-- Recruitee Boards
UPDATE "JobListing" SET "jobBoard" = 'RECRUITEE'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'recruitee-%';

-- Workable Boards    → WORKABLE
UPDATE "JobListing" SET "jobBoard" = 'WORKABLE'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'wkb-%';

-- Teamtailor Boards  → TEAMTAILOR
UPDATE "JobListing" SET "jobBoard" = 'TEAMTAILOR'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'tt-%';

-- BambooHR Boards    → BAMBOOHR
UPDATE "JobListing" SET "jobBoard" = 'BAMBOOHR'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'bh-%';

-- Personio Boards    → PERSONIO
UPDATE "JobListing" SET "jobBoard" = 'PERSONIO'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'pn-%';

-- Pallet Boards      → PALLET
UPDATE "JobListing" SET "jobBoard" = 'PALLET'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'pl-%';

-- Pinpoint Boards    → PINPOINT
UPDATE "JobListing" SET "jobBoard" = 'PINPOINT'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'pp-%';

-- CrunchBoard        → CRUNCHBOARD
UPDATE "JobListing" SET "jobBoard" = 'CRUNCHBOARD'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'cb-%';

-- TheirStack         → THEIRSTACK (had enum value, just OTHER write bug)
UPDATE "JobListing" SET "jobBoard" = 'THEIRSTACK'
  WHERE "jobBoard" = 'OTHER' AND "jobId" LIKE 'theirstack-%';
