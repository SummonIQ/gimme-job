-- Squashed baseline. Replaces ~36 prior migrations whose history was
-- broken (some migrations were applied to prod via `db push` and never
-- got migration files committed; some files committed never reached
-- prod). Generated via:
--   prisma migrate diff --from-empty --to-config-datasource ./prisma.config.ts --script
-- against the live Neon DB on 2026-05-08. All prior _prisma_migrations
-- rows were cleared and this migration was marked applied via
-- `prisma migrate resolve --applied`.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."ATSAutomationPostureLevel" AS ENUM ('ALLOWED', 'GRAY', 'FORBIDDEN');

-- CreateEnum
CREATE TYPE "public"."ApplicationConfirmationState" AS ENUM ('PENDING', 'ATS_CONFIRMED', 'EMAIL_CONFIRMED', 'DASHBOARD_CONFIRMED', 'PRESUMED_FAILED', 'VERIFIED_FAILED');

-- CreateEnum
CREATE TYPE "public"."ApplicationEmailStatus" AS ENUM ('PENDING', 'ANALYZING', 'ANALYZED', 'NOT_JOB_RELATED', 'MATCHED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."ApplicationRuntimeExecutionEnvironment" AS ENUM ('WEB_RECONSTRUCTION', 'DESKTOP_CDP', 'REMOTE_WORKER', 'REPLAY', 'SYNTHETIC');

-- CreateEnum
CREATE TYPE "public"."ApplicationRuntimeSource" AS ENUM ('RECONSTRUCTION', 'TRUE_EXECUTION', 'REPLAY', 'SYNTHETIC_FIXTURE', 'OWNER_OVERRIDE', 'AI_SELF_PLAY', 'BOOTSTRAP', 'LEGACY', 'OWNER_CONFIRMED');

-- CreateEnum
CREATE TYPE "public"."ApplicationStatus" AS ENUM ('PENDING', 'SUBMITTED', 'FAILED', 'REJECTED', 'UNDER_REVIEW', 'INTERVIEW_REQUESTED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'OFFER_RECEIVED', 'OFFER_ACCEPTED', 'OFFER_REJECTED', 'WITHDRAWN', 'NOT_SELECTED');

-- CreateEnum
CREATE TYPE "public"."CodeReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'MERGED', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."CompanySize" AS ENUM ('ENTERPRISE', 'MID_SIZE', 'SMALL');

-- CreateEnum
CREATE TYPE "public"."ConfirmationInboxProvider" AS ENUM ('IMAP', 'GMAIL', 'OUTLOOK');

-- CreateEnum
CREATE TYPE "public"."DeploymentStatus" AS ENUM ('SUCCESS', 'FAILED', 'ROLLBACK', 'IN_PROGRESS');

-- CreateEnum
CREATE TYPE "public"."ExperienceLevel" AS ENUM ('ENTRY_LEVEL', 'MID_LEVEL', 'SENIOR_LEVEL');

-- CreateEnum
CREATE TYPE "public"."FieldSuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'MODIFIED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "public"."FollowUpDraftStatus" AS ENUM ('DRAFT', 'DISMISSED', 'SENT');

-- CreateEnum
CREATE TYPE "public"."GuidedApplicationStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'PAUSED', 'ANALYZING', 'READY_TO_SUBMIT', 'SUBMITTING', 'SUBMITTED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."JobBoard" AS ENUM ('CAREER_BUILDER', 'GOOGLE', 'LINKEDIN', 'INDEED', 'GLASSDOOR', 'ZIPRECRUITER', 'ANGELLIST', 'WELLFOUND', 'MONSTER', 'DICE', 'FLEXJOBS', 'REMOTE_OK', 'WE_WORK_REMOTELY', 'COMPANY_DIRECT', 'OTHER', 'THEIRSTACK', 'CORESIGNAL', 'FANTASTIC_JOBS', 'USAJOBS', 'BUILT_IN', 'WELCOME_TO_THE_JUNGLE', 'THE_MUSE', 'WORK_AT_A_STARTUP', 'JOBICY', 'REMOTIVE', 'HIMALAYAS', 'ARBEITNOW', 'REMOTE_FIRST_JOBS', 'ADZUNA', 'JOOBLE', 'DEV_IT_JOBS', 'WORKING_NOMADS', 'HACKER_NEWS', 'GREENHOUSE', 'LEVER', 'ASHBY', 'SMART_RECRUITERS');

-- CreateEnum
CREATE TYPE "public"."JobFitAnalysisStatus" AS ENUM ('ANALYZING', 'COMPLETED', 'FAILED', 'QUEUED');

-- CreateEnum
CREATE TYPE "public"."JobLeadOptimizationStatus" AS ENUM ('ANALYZING', 'COMPLETED', 'FAILED', 'OPTIMIZING', 'QUEUED');

-- CreateEnum
CREATE TYPE "public"."JobLeadStatus" AS ENUM ('ADDED', 'ANALYZING', 'ANALYZED', 'ANALYSIS_FAILED', 'OPTIMIZING', 'OPTIMIZED', 'OPTIMIZATION_FAILED', 'APPLYING', 'APPLIED', 'REJECTED', 'ADVANCED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_CANCELLED', 'INTERVIEW_COMPLETED', 'INTERVIEWED_NOT_SELECTED', 'OFFER', 'OFFER_DECLINED', 'HIRED', 'REMOVED', 'QUEUED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "public"."JobListingStatus" AS ENUM ('ADDED_TO_LEADS', 'DISMISSED', 'UNREVIEWED');

-- CreateEnum
CREATE TYPE "public"."JobSearchStatus" AS ENUM ('COMPLETED', 'FAILED', 'PROCESSING', 'QUEUED');

-- CreateEnum
CREATE TYPE "public"."JobType" AS ENUM ('CONTRACT', 'FULL_TIME', 'FULL_TIME_AND_PART_TIME', 'INTERNSHIP', 'PART_TIME', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "public"."NetworkRecipeSource" AS ENUM ('OWNER_CONFIRMED', 'COMMUNITY', 'INFERRED');

-- CreateEnum
CREATE TYPE "public"."NetworkRecipeStatus" AS ENUM ('ACTIVE', 'SHADOW', 'DISABLED');

-- CreateEnum
CREATE TYPE "public"."NotificationCategory" AS ENUM ('APPLICATION_STATUS', 'INTERVIEW_REQUEST', 'JOB_SEARCH', 'RESUME_ANALYSIS', 'AUTOMATION', 'SYSTEM', 'NETWORKING', 'SHARE_ACTIVITY', 'RESUME_FEEDBACK');

-- CreateEnum
CREATE TYPE "public"."NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH', 'SMS');

-- CreateEnum
CREATE TYPE "public"."NotificationDigest" AS ENUM ('NONE', 'DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "public"."NotificationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "public"."NotificationStatus" AS ENUM ('READ', 'UNREAD', 'PENDING', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."PlanBoardEventType" AS ENUM ('STATUS_CHANGED', 'AGENT_ASSIGNED', 'NOTE_ADDED', 'SIMULATION_STEP');

-- CreateEnum
CREATE TYPE "public"."PlanBoardStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE');

-- CreateEnum
CREATE TYPE "public"."ResumeAnalysisStatus" AS ENUM ('ANALYZING', 'COMPLETED', 'PROCESSING', 'FAILED', 'QUEUED');

-- CreateEnum
CREATE TYPE "public"."ResumeFormat" AS ENUM ('PDF', 'WORD');

-- CreateEnum
CREATE TYPE "public"."ResumeOptimizationStatus" AS ENUM ('ANALYZING', 'COMPLETED', 'FAILED', 'OPTIMIZING', 'PROCESSING', 'QUEUED', 'REVISING', 'ANALYZED');

-- CreateEnum
CREATE TYPE "public"."ResumeRevisionStatus" AS ENUM ('ANALYZING', 'COMPLETED', 'FAILED', 'PROCESSING', 'REVISING', 'QUEUED');

-- CreateEnum
CREATE TYPE "public"."ResumeRevisionType" AS ENUM ('JOB_LEAD', 'NEW_RESUME');

-- CreateEnum
CREATE TYPE "public"."ResumeType" AS ENUM ('ORIGINAL', 'REVISION');

-- CreateEnum
CREATE TYPE "public"."RuntimeTrainingReviewDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."ScrapeSessionEventKind" AS ENUM ('PROGRESS', 'REQUEST_LOG', 'LOG');

-- CreateEnum
CREATE TYPE "public"."ScrapeSessionStatus" AS ENUM ('RUNNING', 'COMPLETE', 'ERROR', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."SubmissionTier" AS ENUM ('TARGETED', 'GENERIC', 'FIRE_AND_FORGET');

-- CreateTable
CREATE TABLE "public"."ATSAnalysisJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "searchQueries" TEXT[],
    "totalUrls" INTEGER NOT NULL DEFAULT 0,
    "processedUrls" INTEGER NOT NULL DEFAULT 0,
    "foundSystems" INTEGER NOT NULL DEFAULT 0,
    "serpApiOffset" INTEGER NOT NULL DEFAULT 0,
    "serpApiPage" INTEGER NOT NULL DEFAULT 0,
    "serpApiNextToken" TEXT,
    "processedJobIds" TEXT[],
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "ATSAnalysisJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ATSAutomationPosture" (
    "id" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "posture" "public"."ATSAutomationPostureLevel" NOT NULL,
    "tosUrl" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ATSAutomationPosture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ATSFieldObservation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "pathname" TEXT,
    "atsSystemId" TEXT,
    "selector" TEXT NOT NULL,
    "tagName" TEXT NOT NULL,
    "inputType" TEXT,
    "fieldName" TEXT,
    "fieldId" TEXT,
    "fieldLabel" TEXT,
    "ariaLabel" TEXT,
    "placeholder" TEXT,
    "autocomplete" TEXT,
    "action" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "aiReason" TEXT,
    "valueFilled" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observationCount" INTEGER NOT NULL DEFAULT 1,
    "role" TEXT,
    "sessionId" TEXT,
    "stableSelector" TEXT,
    "stepIndex" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fieldConstraints" JSONB,
    "fieldDisplayName" TEXT,
    "inputMode" TEXT,
    "maxLength" INTEGER,
    "minLength" INTEGER,
    "pattern" TEXT,
    "isHoneypot" BOOLEAN NOT NULL DEFAULT false,
    "postConditionMet" BOOLEAN,
    "source" "public"."ApplicationRuntimeSource" NOT NULL DEFAULT 'LEGACY',

    CONSTRAINT "ATSFieldObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ATSRule" (
    "id" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "atsSystemId" TEXT,
    "action" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "stableSelector" TEXT NOT NULL,
    "tagName" TEXT NOT NULL,
    "fieldName" TEXT,
    "fieldLabel" TEXT,
    "ariaLabel" TEXT,
    "role" TEXT,
    "stepIndex" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "observationCount" INTEGER NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "sourceTrainingSessionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" "public"."ApplicationRuntimeSource" NOT NULL DEFAULT 'LEGACY',

    CONSTRAINT "ATSRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ATSSystem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendor" TEXT,
    "detectedDomain" TEXT,
    "domainPatterns" TEXT[],
    "apiEndpoints" JSONB,
    "networkPatterns" JSONB,
    "xhrCalls" JSONB,
    "cookieRequirements" JSONB,
    "csrfTokenPatterns" JSONB,
    "commonStructures" JSONB NOT NULL,
    "formPatterns" JSONB NOT NULL,
    "fieldMappings" JSONB NOT NULL,
    "requiredFields" TEXT[],
    "optionalFields" TEXT[],
    "hiddenFields" JSONB,
    "resumeUploadMethod" TEXT,
    "resumeFieldSelectors" TEXT[],
    "supportedFileTypes" TEXT[],
    "maxFileSize" INTEGER,
    "isMultiStep" BOOLEAN NOT NULL DEFAULT false,
    "stepCount" INTEGER,
    "stepPatterns" JSONB,
    "uniqueIdentifiers" JSONB NOT NULL,
    "metaTags" JSONB,
    "scriptUrls" TEXT[],
    "styleUrls" TEXT[],
    "nuances" TEXT[],
    "javascriptDependency" TEXT,
    "waitTimeNeeded" INTEGER,
    "requiresInteraction" BOOLEAN NOT NULL DEFAULT false,
    "aiVisualAnalysis" TEXT,
    "aiUxPatterns" TEXT[],
    "aiKeyObservations" TEXT[],
    "aiRecommendedApproach" TEXT,
    "difficulty" TEXT,
    "successRate" DOUBLE PRECISION,
    "avgCompletionTime" INTEGER,
    "sampleUrls" TEXT[],
    "screenshotUrls" TEXT[],
    "lastAnalyzed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAnalyzed" INTEGER NOT NULL DEFAULT 0,
    "lastSuccessfulSubmit" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resumeAutofillContainerSelector" TEXT,
    "resumeUploadApiPath" TEXT,
    "resumeUploadGatesAutofill" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ATSSystem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ApplicationEmail" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "textBody" TEXT,
    "htmlBody" TEXT,
    "messageId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "status" "public"."ApplicationEmailStatus" NOT NULL DEFAULT 'PENDING',
    "isJobRelated" BOOLEAN NOT NULL DEFAULT false,
    "detectedStatus" TEXT,
    "detectedCompany" TEXT,
    "detectedJobTitle" TEXT,
    "aiAnalysis" JSONB,
    "jobLeadId" TEXT,
    "applicationSubmissionId" TEXT,

    CONSTRAINT "ApplicationEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ApplicationFlowDefinition" (
    "id" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "atsSystemId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "compiledFromRuleCount" INTEGER NOT NULL DEFAULT 0,
    "lastCompiledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationFlowDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ApplicationFlowNode" (
    "id" TEXT NOT NULL,
    "atsSystemId" TEXT,
    "hostname" TEXT NOT NULL,
    "pageFingerprint" TEXT NOT NULL,
    "nodeLabel" TEXT,
    "requiredFields" JSONB NOT NULL DEFAULT '[]',
    "optionalFields" JSONB NOT NULL DEFAULT '[]',
    "exitConditions" JSONB NOT NULL DEFAULT '[]',
    "observationCount" INTEGER NOT NULL DEFAULT 1,
    "visitCount" INTEGER NOT NULL DEFAULT 0,
    "successfulExitCount" INTEGER NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationFlowNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ApplicationFlowStepDefinition" (
    "id" TEXT NOT NULL,
    "flowDefinitionId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "stepLabel" TEXT,
    "primarySelector" TEXT,
    "enabledRuleCount" INTEGER NOT NULL DEFAULT 0,
    "averageConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "labels" TEXT[],
    "selectors" TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationFlowStepDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ApplicationFlowTransition" (
    "id" TEXT NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    "triggerSelector" TEXT NOT NULL,
    "triggerLabel" TEXT,
    "actionType" TEXT NOT NULL DEFAULT 'click',
    "observationCount" INTEGER NOT NULL DEFAULT 1,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationFlowTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ApplicationOutcomeEvent" (
    "id" TEXT NOT NULL,
    "applicationSubmissionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "previousStatus" "public"."ApplicationStatus",
    "newStatus" "public"."ApplicationStatus" NOT NULL,
    "metadata" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "ApplicationOutcomeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ApplicationRuntimeEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "url" TEXT,
    "stepIndex" INTEGER,
    "selector" TEXT,
    "fieldName" TEXT,
    "fieldLabel" TEXT,
    "actionType" TEXT,
    "valueRedacted" TEXT,
    "success" BOOLEAN,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "public"."ApplicationRuntimeSource" NOT NULL DEFAULT 'LEGACY',

    CONSTRAINT "ApplicationRuntimeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ApplicationRuntimeSession" (
    "id" TEXT NOT NULL,
    "guidedApplicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "atsSystemId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'SUGGEST_ONLY',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "webviewInstanceId" TEXT,
    "currentUrl" TEXT,
    "currentStepIndex" INTEGER NOT NULL DEFAULT 0,
    "currentStepLabel" TEXT,
    "domFingerprint" TEXT,
    "pageFingerprintVersion" INTEGER NOT NULL DEFAULT 1,
    "lastActionAt" TIMESTAMP(3),
    "lastUserInterventionAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "runtimeMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "executionEnvironment" "public"."ApplicationRuntimeExecutionEnvironment" NOT NULL DEFAULT 'WEB_RECONSTRUCTION',

    CONSTRAINT "ApplicationRuntimeSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ApplicationSubmission" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorMessage" TEXT,
    "id" TEXT NOT NULL,
    "jobLeadId" TEXT NOT NULL,
    "metadata" JSONB,
    "resumeId" TEXT,
    "status" "public"."ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "submissionUrl" TEXT,
    "submittedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "userAgent" TEXT,
    "wasAutomated" BOOLEAN NOT NULL DEFAULT false,
    "daysSinceSubmission" INTEGER,
    "daysToFinalOutcome" INTEGER,
    "daysToResponse" INTEGER,
    "finalOutcomeAt" TIMESTAMP(3),
    "interviewCount" INTEGER NOT NULL DEFAULT 0,
    "lastStatusChangeAt" TIMESTAMP(3),
    "responseReceivedAt" TIMESTAMP(3),
    "confirmationState" "public"."ApplicationConfirmationState" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "ApplicationSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AssistTrainingSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "targetUrl" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "jobLeadId" TEXT,
    "totalSteps" INTEGER NOT NULL DEFAULT 0,
    "completedSteps" INTEGER NOT NULL DEFAULT 0,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stepLogs" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "observationsCreated" INTEGER NOT NULL DEFAULT 0,
    "rulesPromoted" INTEGER NOT NULL DEFAULT 0,
    "atsSystemName" TEXT,
    "atsSystemId" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "trainingType" TEXT,

    CONSTRAINT "AssistTrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AutomationAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "metadata" JSONB,
    "jobLeadId" TEXT,
    "applicationSubmissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AutomationScheduledApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobLeadId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "lastAttemptAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationScheduledApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AutomationSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requireUserApproval" BOOLEAN NOT NULL DEFAULT true,
    "preventDuplicateApplications" BOOLEAN NOT NULL DEFAULT true,
    "enableCompanyBlacklist" BOOLEAN NOT NULL DEFAULT false,
    "companyBlacklist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enableKeywordBlacklist" BOOLEAN NOT NULL DEFAULT false,
    "keywordBlacklist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enableSalaryThreshold" BOOLEAN NOT NULL DEFAULT false,
    "minSalaryThreshold" INTEGER NOT NULL DEFAULT 50000,
    "maxApplicationsPerCompany" INTEGER NOT NULL DEFAULT 3,
    "pauseOnConsecutiveFailures" BOOLEAN NOT NULL DEFAULT true,
    "consecutiveFailureThreshold" INTEGER NOT NULL DEFAULT 3,
    "applicationsPerHour" INTEGER NOT NULL DEFAULT 10,
    "applicationsPerDay" INTEGER NOT NULL DEFAULT 50,
    "minIntervalMinutes" INTEGER NOT NULL DEFAULT 5,
    "respectJobBoardLimits" BOOLEAN NOT NULL DEFAULT true,
    "enableSmartScheduling" BOOLEAN NOT NULL DEFAULT true,
    "scheduleWeekdaysOnly" BOOLEAN NOT NULL DEFAULT true,
    "scheduleBusinessHoursOnly" BOOLEAN NOT NULL DEFAULT true,
    "preferredStartHour" INTEGER NOT NULL DEFAULT 9,
    "preferredEndHour" INTEGER NOT NULL DEFAULT 17,
    "userTimezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "prioritizeNewListings" BOOLEAN NOT NULL DEFAULT true,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "pausedAt" TIMESTAMP(3),
    "pauseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClosedPostingPhrase" (
    "id" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "normalizedPhrase" TEXT NOT NULL,
    "originalPhrase" TEXT NOT NULL,
    "detectorReason" TEXT,
    "exampleUrl" TEXT,
    "observationCount" INTEGER NOT NULL DEFAULT 1,
    "firstObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClosedPostingPhrase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CodeMetric" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT,
    "pullRequestId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "public"."CodeReviewStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "mergedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "reviewTimeHours" DOUBLE PRECISION,
    "timeToMergeHours" DOUBLE PRECISION,
    "numberOfReviewers" INTEGER NOT NULL DEFAULT 0,
    "numberOfComments" INTEGER NOT NULL DEFAULT 0,
    "numberOfApprovals" INTEGER NOT NULL DEFAULT 0,
    "numberOfChanges" INTEGER NOT NULL DEFAULT 0,
    "testCoverage" DOUBLE PRECISION,
    "complexityScore" DOUBLE PRECISION,
    "duplicateLines" INTEGER,
    "codeSmells" INTEGER,
    "securityIssues" INTEGER,
    "linesAdded" INTEGER NOT NULL DEFAULT 0,
    "linesRemoved" INTEGER NOT NULL DEFAULT 0,
    "filesChanged" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CodeMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConfirmationInbox" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "provider" "public"."ConfirmationInboxProvider" NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "imapHost" TEXT,
    "imapPort" INTEGER,
    "imapSecure" BOOLEAN NOT NULL DEFAULT true,
    "imapUsername" TEXT,
    "encryptedSecret" TEXT NOT NULL,
    "encryptionKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "scope" TEXT,
    "lastSeenUid" TEXT,
    "lastPolledAt" TIMESTAMP(3),
    "pollingCadenceSeconds" INTEGER NOT NULL DEFAULT 300,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfirmationInbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CoverLetter" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "id" TEXT NOT NULL,
    "json" JSONB,
    "leadId" TEXT,
    "markdown" TEXT,
    "name" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "CoverLetter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DORABenchmark" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "deployFrequency" TEXT NOT NULL,
    "deployFrequencyValue" DOUBLE PRECISION,
    "leadTime" TEXT NOT NULL,
    "leadTimeHours" DOUBLE PRECISION,
    "mttr" TEXT NOT NULL,
    "mttrMinutes" DOUBLE PRECISION,
    "changeFailureRate" TEXT NOT NULL,
    "changeFailurePercent" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DORABenchmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DeploymentMetric" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT,
    "deploymentId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "status" "public"."DeploymentStatus" NOT NULL,
    "deployedAt" TIMESTAMP(3) NOT NULL,
    "deploymentDuration" INTEGER,
    "commitSha" TEXT NOT NULL,
    "commitMessage" TEXT,
    "pullRequestId" TEXT,
    "branchName" TEXT,
    "linesAdded" INTEGER,
    "linesRemoved" INTEGER,
    "filesChanged" INTEGER,
    "commitDate" TIMESTAMP(3) NOT NULL,
    "mergeDate" TIMESTAMP(3),
    "leadTimeHours" DOUBLE PRECISION,
    "isRollback" BOOLEAN NOT NULL DEFAULT false,
    "failureReason" TEXT,
    "recoveryTimeMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeploymentMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DesktopAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenId" TEXT,
    "desktopSessionId" TEXT,
    "runtimeSessionId" TEXT,
    "jobLeadId" TEXT,
    "toolName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "outcome" TEXT,
    "payload" JSONB NOT NULL,
    "redactedKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesktopAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DesktopPairingCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "consumedTokenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesktopPairingCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DesktopToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "deviceOs" TEXT,
    "tokenHash" TEXT NOT NULL,
    "scopes" TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesktopToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DeveloperMetric" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "buildTimeSeconds" DOUBLE PRECISION,
    "ciPipelineMinutes" DOUBLE PRECISION,
    "testExecutionMinutes" DOUBLE PRECISION,
    "setupTimeHours" DOUBLE PRECISION,
    "environmentIssues" INTEGER NOT NULL DEFAULT 0,
    "toolingSatisfaction" DOUBLE PRECISION,
    "docsContributed" INTEGER NOT NULL DEFAULT 0,
    "docsConsumed" INTEGER NOT NULL DEFAULT 0,
    "documentationQuality" DOUBLE PRECISION,
    "onboardingDays" DOUBLE PRECISION,
    "mentorshipHours" DOUBLE PRECISION,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeveloperMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FollowUpDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationSubmissionId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyMarkdown" TEXT NOT NULL,
    "daysSinceSubmission" INTEGER NOT NULL,
    "status" "public"."FollowUpDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUpDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FormFieldFeedback" (
    "applicationUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "feedback" TEXT NOT NULL,
    "fieldLabel" TEXT NOT NULL,
    "fieldSelector" TEXT,
    "fieldType" TEXT,
    "hostname" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "snapshotId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "filledValue" TEXT,
    "rejectReason" TEXT,
    "status" TEXT,

    CONSTRAINT "FormFieldFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GuidedApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobLeadId" TEXT,
    "applicationUrl" TEXT NOT NULL,
    "company" TEXT,
    "jobTitle" TEXT,
    "jobBoard" "public"."JobBoard",
    "status" "public"."GuidedApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "totalSteps" INTEGER,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "lastScreenshotUrl" TEXT,
    "formAnalysis" JSONB,
    "detectedFields" JSONB,
    "userAgent" TEXT,
    "sessionCookies" JSONB,
    "resumeId" TEXT,
    "coverLetterId" TEXT,
    "errorMessage" TEXT,
    "pausedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "applicationSubmissionId" TEXT,

    CONSTRAINT "GuidedApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GuidedFieldSuggestion" (
    "id" TEXT NOT NULL,
    "guidedApplicationId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "fieldLabel" TEXT,
    "fieldType" TEXT NOT NULL,
    "fieldSelector" TEXT,
    "currentValue" TEXT,
    "suggestedValue" TEXT,
    "suggestedSource" TEXT,
    "confidence" DOUBLE PRECISION,
    "status" "public"."FieldSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "userValue" TEXT,
    "aiReasoning" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuidedFieldSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HostRateLimitState" (
    "id" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "tokens" DOUBLE PRECISION NOT NULL,
    "capacity" DOUBLE PRECISION NOT NULL,
    "refillRatePerSec" DOUBLE PRECISION NOT NULL,
    "lastRefilledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dayCount" INTEGER NOT NULL DEFAULT 0,
    "dayLimit" INTEGER,
    "dayResetAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HostRateLimitState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IncidentMetric" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "teamId" TEXT,
    "incidentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "public"."IncidentSeverity" NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "timeToDetectMinutes" INTEGER,
    "timeToAckMinutes" INTEGER,
    "timeToResolveMinutes" INTEGER,
    "usersAffected" INTEGER,
    "servicesAffected" TEXT[],
    "deploymentId" TEXT,
    "rootCause" TEXT,
    "postMortemUrl" TEXT,
    "actionItems" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncidentMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InterviewQuestion" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "description" TEXT,
    "difficulty" TEXT NOT NULL,
    "jobLeadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "InterviewQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InterviewResponse" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "feedback" TEXT,
    "score" DOUBLE PRECISION,
    "quality" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "InterviewResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InterviewSession" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "totalScore" DOUBLE PRECISION,
    "averageScore" DOUBLE PRECISION,
    "source" TEXT,
    "sourceEmailId" TEXT,
    "metadata" JSONB,
    "jobLeadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "InterviewSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JobFitAnalysis" (
    "additionalMetrics" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "educationRelevanceScore" INTEGER NOT NULL,
    "experienceRelevanceScore" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "jobLeadId" TEXT,
    "jobListingId" TEXT,
    "keywordMatch" JSONB NOT NULL,
    "missingKeywords" TEXT[],
    "overallMatchScore" INTEGER NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "recommendations" TEXT[],
    "resumeId" TEXT,
    "resumeRevisionId" TEXT,
    "skillsAlignment" JSONB NOT NULL,
    "status" "public"."JobFitAnalysisStatus" NOT NULL DEFAULT 'QUEUED',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,

    CONSTRAINT "JobFitAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JobLead" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" TEXT NOT NULL,
    "jobListingId" TEXT NOT NULL,
    "jobSearchId" TEXT,
    "status" "public"."JobLeadStatus" NOT NULL DEFAULT 'ADDED',
    "title" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "tailoredCoverLetterId" TEXT,
    "tailoredResumeRevisionId" TEXT,
    "submissionTier" "public"."SubmissionTier" NOT NULL DEFAULT 'TARGETED',

    CONSTRAINT "JobLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JobLeadOptimization" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" TEXT NOT NULL,
    "jobFitAnalysisId" TEXT,
    "jobLeadId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "resumeRevisionId" TEXT,
    "status" "public"."JobLeadOptimizationStatus" NOT NULL DEFAULT 'QUEUED',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "JobLeadOptimization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JobListing" (
    "applyOptions" JSONB,
    "benefits" TEXT[],
    "company" TEXT,
    "companyLogoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dentalCoverage" BOOLEAN,
    "description" TEXT,
    "detectedExtensions" JSONB,
    "extendedDetailsCollected" BOOLEAN DEFAULT false,
    "extensions" TEXT[],
    "healthInsurance" BOOLEAN,
    "id" TEXT NOT NULL,
    "jobBoard" "public"."JobBoard",
    "jobBoardUrl" TEXT,
    "jobId" TEXT NOT NULL,
    "jobType" "public"."JobType",
    "location" TEXT,
    "paidTimeOff" BOOLEAN,
    "postedAt" TIMESTAMP(3),
    "qualifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "remote" BOOLEAN,
    "requirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "responsibilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "salary" TEXT,
    "saved" BOOLEAN NOT NULL DEFAULT false,
    "scheduleType" TEXT,
    "source" TEXT,
    "status" "public"."JobListingStatus" NOT NULL DEFAULT 'UNREVIEWED',
    "title" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "workFromHome" BOOLEAN,

    CONSTRAINT "JobListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JobQueueItem" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "processAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "deduplicationKey" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JobSearch" (
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "id" TEXT NOT NULL,
    "jobBoard" "public"."JobBoard",
    "jobBoardUrl" TEXT,
    "location" TEXT,
    "nextToken" TEXT,
    "pageDelay" INTEGER,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "remote" BOOLEAN,
    "searchTerm" TEXT NOT NULL,
    "status" "public"."JobSearchStatus" NOT NULL DEFAULT 'QUEUED',
    "totalJobs" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "metadata" JSONB,
    "errorMessage" TEXT,
    "saved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "JobSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JobSearchListing" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jobSearchId" TEXT NOT NULL,
    "jobListingId" TEXT NOT NULL,

    CONSTRAINT "JobSearchListing_pkey" PRIMARY KEY ("jobSearchId","jobListingId")
);

-- CreateTable
CREATE TABLE "public"."LinkedInProfile" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT,
    "firstName" TEXT NOT NULL,
    "headline" TEXT,
    "id" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL,
    "lastName" TEXT NOT NULL,
    "linkedInId" TEXT NOT NULL,
    "locationCity" TEXT,
    "locationCountry" TEXT,
    "profileData" JSONB,
    "profilePictureUrl" TEXT,
    "publicProfileUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "LinkedInProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LocalFormSnapshot" (
    "applicationUrl" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fields" JSONB NOT NULL,
    "filePath" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "jobLeadId" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "LocalFormSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MobileResponsivenessAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" INTEGER NOT NULL,
    "highSeverityIssues" INTEGER NOT NULL,
    "mediumSeverityIssues" INTEGER NOT NULL,
    "lowSeverityIssues" INTEGER NOT NULL,
    "totalIssues" INTEGER NOT NULL,
    "auditData" JSONB,

    CONSTRAINT "MobileResponsivenessAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NetworkSubmissionRecipe" (
    "id" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "hostname" TEXT,
    "atsSystemId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "public"."NetworkRecipeStatus" NOT NULL DEFAULT 'SHADOW',
    "source" "public"."NetworkRecipeSource" NOT NULL DEFAULT 'COMMUNITY',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "requestSequence" JSONB NOT NULL,
    "variableTokens" JSONB,
    "confirmationDetector" JSONB NOT NULL,
    "rateLimit" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkSubmissionRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "actionLabel" TEXT,
    "actionUrl" TEXT,
    "expiresAt" TIMESTAMP(3),
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "priority" "public"."NotificationPriority" NOT NULL DEFAULT 'MEDIUM',
    "type" "public"."NotificationCategory" NOT NULL DEFAULT 'SYSTEM',
    "channels" "public"."NotificationChannel"[],
    "eventType" TEXT,
    "status" "public"."NotificationStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NotificationDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "channel" "public"."NotificationChannel" NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "public"."NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "payload" JSONB,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "channel" "public"."NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "digest" "public"."NotificationDigest" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PeopleProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "title" TEXT,
    "linkedinUrl" TEXT,
    "summary" TEXT,
    "experience" TEXT[],
    "education" TEXT[],
    "skills" TEXT[],
    "articles" TEXT[],
    "socialProfiles" JSONB,
    "personalityData" JSONB,
    "interviewStrategy" JSONB,
    "researchSources" TEXT[],
    "notes" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "researchedAt" TIMESTAMP(3),

    CONSTRAINT "PeopleProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PlanBoardEvent" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "eventType" "public"."PlanBoardEventType" NOT NULL,
    "fromStatus" "public"."PlanBoardStatus",
    "toStatus" "public"."PlanBoardStatus",
    "agentHandle" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignmentReason" TEXT,
    "nextAgentHandle" TEXT,
    "previousAgentHandle" TEXT,

    CONSTRAINT "PlanBoardEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PlanBoardTask" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "sourceFile" TEXT NOT NULL DEFAULT 'FINAL_PLAN.md',
    "status" "public"."PlanBoardStatus" NOT NULL DEFAULT 'TODO',
    "agentHandle" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assignmentReason" TEXT,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "PlanBoardTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductivityMetric" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "periodType" TEXT NOT NULL,
    "storyPointsCompleted" DOUBLE PRECISION,
    "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
    "bugsFixed" INTEGER NOT NULL DEFAULT 0,
    "featuresDelivered" INTEGER NOT NULL DEFAULT 0,
    "cycleTimeHours" DOUBLE PRECISION,
    "workInProgress" DOUBLE PRECISION,
    "flowEfficiency" DOUBLE PRECISION,
    "focusTimeHours" DOUBLE PRECISION,
    "meetingTimeHours" DOUBLE PRECISION,
    "contextSwitches" INTEGER,
    "defectRate" DOUBLE PRECISION,
    "reworkRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductivityMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReplayArtifact" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "domSnapshots" BYTEA,
    "domSnapshotsMimeType" TEXT DEFAULT 'application/gzip',
    "screenshotUrls" TEXT[],
    "eventBundle" JSONB NOT NULL,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReplayArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Resume" (
    "analysisId" TEXT,
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "defaultRevisionId" TEXT,
    "description" TEXT,
    "format" "public"."ResumeFormat",
    "json" JSONB,
    "markdown" TEXT,
    "name" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "url" TEXT,
    "userId" TEXT NOT NULL,
    "filename" TEXT,

    CONSTRAINT "Resume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResumeAnalysis" (
    "achievements" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "formatting" JSONB,
    "grammar" JSONB,
    "id" TEXT NOT NULL,
    "keywords" JSONB,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "readability" JSONB,
    "recommendations" JSONB,
    "score" INTEGER,
    "sections" JSONB,
    "resumeId" TEXT,
    "resumeRevisionId" TEXT,
    "spelling" JSONB,
    "status" "public"."ResumeAnalysisStatus" NOT NULL DEFAULT 'QUEUED',
    "strengths" TEXT[],
    "summary" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "weaknesses" TEXT[],
    "likeability" JSONB,

    CONSTRAINT "ResumeAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResumeOptimization" (
    "analysisId" TEXT,
    "estimatedVisibilityBoost" TEXT,
    "projectedShortlistProbability" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" TEXT NOT NULL,
    "jobFitAnalysisId" TEXT,
    "jobLeadId" TEXT,
    "optimizationStrategy" TEXT,
    "scoreImprovement" DOUBLE PRECISION,
    "score" DOUBLE PRECISION,
    "status" "public"."ResumeOptimizationStatus" NOT NULL DEFAULT 'QUEUED',
    "previousScore" INTEGER,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "resumeId" TEXT,
    "resumeRevisionId" TEXT,
    "scoreDelta" DOUBLE PRECISION,
    "scorePercentChange" DOUBLE PRECISION,
    "significantImprovements" TEXT[],
    "summary" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "changelog" JSONB,

    CONSTRAINT "ResumeOptimization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResumePerformanceMetric" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeId" TEXT,
    "resumeRevisionId" TEXT,
    "totalApplications" INTEGER NOT NULL DEFAULT 0,
    "totalResponses" INTEGER NOT NULL DEFAULT 0,
    "totalInterviews" INTEGER NOT NULL DEFAULT 0,
    "totalOffers" INTEGER NOT NULL DEFAULT 0,
    "responseRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "interviewRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "offerRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "atsScore" INTEGER,
    "atsScoreHistory" JSONB,
    "optimizationScore" INTEGER,
    "optimizationHistory" JSONB,
    "avgResponseTime" DOUBLE PRECISION,
    "avgInterviewTime" DOUBLE PRECISION,
    "avgOfferTime" DOUBLE PRECISION,
    "keywordEffectiveness" JSONB,
    "sectionEffectiveness" JSONB,
    "lengthOptimal" BOOLEAN,
    "industryBenchmark" JSONB,
    "personalBest" BOOLEAN NOT NULL DEFAULT false,
    "improvementFromPrevious" DOUBLE PRECISION,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataRange" JSONB,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumePerformanceMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResumeRevision" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "format" "public"."ResumeFormat",
    "jobLeadId" TEXT,
    "json" JSONB,
    "markdown" TEXT,
    "name" TEXT NOT NULL,
    "pdfDocumentUrl" TEXT,
    "resumeAnalysisId" TEXT,
    "resumeId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "wordDocumentUrl" TEXT,
    "userId" TEXT NOT NULL,
    "formats" JSONB,

    CONSTRAINT "ResumeRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RulePromotionCandidate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "atsSystemId" TEXT,
    "hostname" TEXT NOT NULL,
    "stableSelector" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "fieldName" TEXT,
    "fieldLabel" TEXT,
    "role" TEXT,
    "tagName" TEXT,
    "candidateFingerprint" TEXT NOT NULL,
    "observationCount" INTEGER NOT NULL DEFAULT 1,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "userOverrideCount" INTEGER NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "promotionStatus" TEXT NOT NULL DEFAULT 'OBSERVATION',
    "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RulePromotionCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RuntimeTrainingReview" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "candidateId" TEXT,
    "ruleId" TEXT,
    "userId" TEXT NOT NULL,
    "decision" "public"."RuntimeTrainingReviewDecision" NOT NULL,
    "reviewerNote" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuntimeTrainingReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RuntimeTrustOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "atsFamily" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "node" TEXT,
    "transition" TEXT,
    "actionType" TEXT NOT NULL,
    "demotedTo" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "clearedAt" TIMESTAMP(3),

    CONSTRAINT "RuntimeTrustOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ScrapeSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scrapeId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "public"."ScrapeSessionStatus" NOT NULL DEFAULT 'RUNNING',
    "trigger" TEXT,
    "mode" TEXT,
    "searchTerm" TEXT,
    "city" TEXT,
    "stateCode" TEXT,
    "country" TEXT,
    "remote" BOOLEAN NOT NULL DEFAULT false,
    "globalDateRange" TEXT,
    "globalMaxPages" INTEGER,
    "providersRequested" TEXT[],
    "providerOverrides" JSONB,
    "summary" JSONB,

    CONSTRAINT "ScrapeSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ScrapeSessionEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "emittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" "public"."ScrapeSessionEventKind" NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "ScrapeSessionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SubmissionConfirmationPhrase" (
    "id" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "atsSystemId" TEXT,
    "normalizedPhrase" TEXT NOT NULL,
    "originalPhrase" TEXT NOT NULL,
    "exampleUrl" TEXT,
    "observationCount" INTEGER NOT NULL DEFAULT 1,
    "firstObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubmissionConfirmationPhrase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Subscription" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "id" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "priceId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserFieldRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hostname" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserFieldRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserJobPreferences" (
    "city" TEXT,
    "companySize" "public"."CompanySize",
    "companyType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "experienceLevel" "public"."ExperienceLevel",
    "id" TEXT NOT NULL,
    "jobTitles" TEXT[],
    "preferRemote" BOOLEAN,
    "remoteOnly" BOOLEAN,
    "state" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "zipCode" TEXT,
    "timezone" TEXT DEFAULT 'America/New_York',

    CONSTRAINT "UserJobPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserKnowledge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserKnowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserProfile" (
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "educationDegree" TEXT,
    "educationEndMonth" INTEGER,
    "educationEndYear" INTEGER,
    "educationInstitution" TEXT,
    "educationInstitutionLocation" TEXT,
    "educationStartMonth" INTEGER,
    "educationStartYear" INTEGER,
    "emailAddress" TEXT,
    "firstName" TEXT,
    "githubUrl" TEXT,
    "id" TEXT NOT NULL,
    "lastName" TEXT,
    "linkedinUrl" TEXT,
    "phoneNumber" TEXT,
    "state" TEXT,
    "streetAddress" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "websiteUrl" TEXT,
    "zipCode" TEXT,
    "disabilityStatus" TEXT,
    "earliestStartDate" TEXT,
    "gender" TEXT,
    "race" TEXT,
    "requiresSponsorship" BOOLEAN,
    "salaryExpectation" TEXT,
    "veteranStatus" TEXT,
    "workAuthorization" TEXT,
    "yearsOfExperience" TEXT,
    "preferredName" TEXT,
    "pronouns" TEXT,
    "transgenderIdentity" TEXT,
    "personalWebsiteUrl" TEXT,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationToken" (
    "expires" TIMESTAMP(3),
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "public"."_InterviewSessionQuestions" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_InterviewSessionQuestions_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_InterviewSessionResponses" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_InterviewSessionResponses_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."account" (
    "accessToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" TEXT NOT NULL,
    "idToken" TEXT,
    "password" TEXT,
    "providerId" TEXT NOT NULL,
    "refreshToken" TEXT,
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."session" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "id" TEXT NOT NULL,
    "ipAddress" TEXT,
    "token" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "defaultResumeId" TEXT,
    "defaultRevisionId" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "firstName" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "image" TEXT DEFAULT '/user.png',
    "lastName" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "phoneVerified" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "trackingEmailAlias" TEXT,
    "trackingEmailForwardingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "trackingEmailSetupAt" TIMESTAMP(3),
    "useOptimizedResumeOnSubmit" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ATSAnalysisJob_status_idx" ON "public"."ATSAnalysisJob"("status" ASC);

-- CreateIndex
CREATE INDEX "ATSAnalysisJob_userId_idx" ON "public"."ATSAnalysisJob"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ATSAutomationPosture_family_key" ON "public"."ATSAutomationPosture"("family" ASC);

-- CreateIndex
CREATE INDEX "ATSFieldObservation_atsSystemId_idx" ON "public"."ATSFieldObservation"("atsSystemId" ASC);

-- CreateIndex
CREATE INDEX "ATSFieldObservation_hostname_idx" ON "public"."ATSFieldObservation"("hostname" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ATSFieldObservation_hostname_stableSelector_action_actionTy_key" ON "public"."ATSFieldObservation"("hostname" ASC, "stableSelector" ASC, "action" ASC, "actionType" ASC);

-- CreateIndex
CREATE INDEX "ATSFieldObservation_hostname_stepIndex_idx" ON "public"."ATSFieldObservation"("hostname" ASC, "stepIndex" ASC);

-- CreateIndex
CREATE INDEX "ATSFieldObservation_hostname_tagName_idx" ON "public"."ATSFieldObservation"("hostname" ASC, "tagName" ASC);

-- CreateIndex
CREATE INDEX "ATSFieldObservation_sessionId_idx" ON "public"."ATSFieldObservation"("sessionId" ASC);

-- CreateIndex
CREATE INDEX "ATSFieldObservation_userId_idx" ON "public"."ATSFieldObservation"("userId" ASC);

-- CreateIndex
CREATE INDEX "ATSRule_atsSystemId_idx" ON "public"."ATSRule"("atsSystemId" ASC);

-- CreateIndex
CREATE INDEX "ATSRule_hostname_idx" ON "public"."ATSRule"("hostname" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ATSRule_hostname_stableSelector_action_key" ON "public"."ATSRule"("hostname" ASC, "stableSelector" ASC, "action" ASC);

-- CreateIndex
CREATE INDEX "ATSRule_hostname_stepIndex_idx" ON "public"."ATSRule"("hostname" ASC, "stepIndex" ASC);

-- CreateIndex
CREATE INDEX "ATSRule_source_idx" ON "public"."ATSRule"("source" ASC);

-- CreateIndex
CREATE INDEX "ATSSystem_detectedDomain_idx" ON "public"."ATSSystem"("detectedDomain" ASC);

-- CreateIndex
CREATE INDEX "ATSSystem_name_idx" ON "public"."ATSSystem"("name" ASC);

-- CreateIndex
CREATE INDEX "ATSSystem_vendor_idx" ON "public"."ATSSystem"("vendor" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationEmail_messageId_key" ON "public"."ApplicationEmail"("messageId" ASC);

-- CreateIndex
CREATE INDEX "ApplicationEmail_toEmail_idx" ON "public"."ApplicationEmail"("toEmail" ASC);

-- CreateIndex
CREATE INDEX "ApplicationEmail_userId_idx" ON "public"."ApplicationEmail"("userId" ASC);

-- CreateIndex
CREATE INDEX "ApplicationEmail_userId_status_idx" ON "public"."ApplicationEmail"("userId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "ApplicationFlowDefinition_atsSystemId_idx" ON "public"."ApplicationFlowDefinition"("atsSystemId" ASC);

-- CreateIndex
CREATE INDEX "ApplicationFlowDefinition_hostname_idx" ON "public"."ApplicationFlowDefinition"("hostname" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationFlowDefinition_hostname_version_key" ON "public"."ApplicationFlowDefinition"("hostname" ASC, "version" ASC);

-- CreateIndex
CREATE INDEX "ApplicationFlowNode_atsSystemId_idx" ON "public"."ApplicationFlowNode"("atsSystemId" ASC);

-- CreateIndex
CREATE INDEX "ApplicationFlowNode_hostname_idx" ON "public"."ApplicationFlowNode"("hostname" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationFlowNode_hostname_pageFingerprint_key" ON "public"."ApplicationFlowNode"("hostname" ASC, "pageFingerprint" ASC);

-- CreateIndex
CREATE INDEX "ApplicationFlowNode_pageFingerprint_idx" ON "public"."ApplicationFlowNode"("pageFingerprint" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationFlowStepDefinition_flowDefinitionId_stepIndex_key" ON "public"."ApplicationFlowStepDefinition"("flowDefinitionId" ASC, "stepIndex" ASC);

-- CreateIndex
CREATE INDEX "ApplicationFlowStepDefinition_stepIndex_idx" ON "public"."ApplicationFlowStepDefinition"("stepIndex" ASC);

-- CreateIndex
CREATE INDEX "ApplicationFlowTransition_fromNodeId_idx" ON "public"."ApplicationFlowTransition"("fromNodeId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationFlowTransition_fromNodeId_triggerSelector_toNode_key" ON "public"."ApplicationFlowTransition"("fromNodeId" ASC, "triggerSelector" ASC, "toNodeId" ASC);

-- CreateIndex
CREATE INDEX "ApplicationFlowTransition_toNodeId_idx" ON "public"."ApplicationFlowTransition"("toNodeId" ASC);

-- CreateIndex
CREATE INDEX "ApplicationRuntimeEvent_eventType_createdAt_idx" ON "public"."ApplicationRuntimeEvent"("eventType" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "ApplicationRuntimeEvent_sessionId_createdAt_idx" ON "public"."ApplicationRuntimeEvent"("sessionId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "ApplicationRuntimeEvent_userId_createdAt_idx" ON "public"."ApplicationRuntimeEvent"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "ApplicationRuntimeSession_atsSystemId_idx" ON "public"."ApplicationRuntimeSession"("atsSystemId" ASC);

-- CreateIndex
CREATE INDEX "ApplicationRuntimeSession_guidedApplicationId_idx" ON "public"."ApplicationRuntimeSession"("guidedApplicationId" ASC);

-- CreateIndex
CREATE INDEX "ApplicationRuntimeSession_status_updatedAt_idx" ON "public"."ApplicationRuntimeSession"("status" ASC, "updatedAt" ASC);

-- CreateIndex
CREATE INDEX "ApplicationRuntimeSession_userId_status_idx" ON "public"."ApplicationRuntimeSession"("userId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "AssistTrainingSession_hostname_idx" ON "public"."AssistTrainingSession"("hostname" ASC);

-- CreateIndex
CREATE INDEX "AssistTrainingSession_status_idx" ON "public"."AssistTrainingSession"("status" ASC);

-- CreateIndex
CREATE INDEX "AssistTrainingSession_userId_idx" ON "public"."AssistTrainingSession"("userId" ASC);

-- CreateIndex
CREATE INDEX "AutomationAuditLog_action_idx" ON "public"."AutomationAuditLog"("action" ASC);

-- CreateIndex
CREATE INDEX "AutomationAuditLog_userId_createdAt_idx" ON "public"."AutomationAuditLog"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "AutomationScheduledApplication_scheduledFor_idx" ON "public"."AutomationScheduledApplication"("scheduledFor" ASC);

-- CreateIndex
CREATE INDEX "AutomationScheduledApplication_status_idx" ON "public"."AutomationScheduledApplication"("status" ASC);

-- CreateIndex
CREATE INDEX "AutomationScheduledApplication_userId_status_scheduledFor_idx" ON "public"."AutomationScheduledApplication"("userId" ASC, "status" ASC, "scheduledFor" ASC);

-- CreateIndex
CREATE INDEX "AutomationSettings_userId_idx" ON "public"."AutomationSettings"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AutomationSettings_userId_key" ON "public"."AutomationSettings"("userId" ASC);

-- CreateIndex
CREATE INDEX "ClosedPostingPhrase_hostname_idx" ON "public"."ClosedPostingPhrase"("hostname" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ClosedPostingPhrase_hostname_normalizedPhrase_key" ON "public"."ClosedPostingPhrase"("hostname" ASC, "normalizedPhrase" ASC);

-- CreateIndex
CREATE INDEX "ClosedPostingPhrase_lastObservedAt_idx" ON "public"."ClosedPostingPhrase"("lastObservedAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CodeMetric_pullRequestId_key" ON "public"."CodeMetric"("pullRequestId" ASC);

-- CreateIndex
CREATE INDEX "CodeMetric_status_idx" ON "public"."CodeMetric"("status" ASC);

-- CreateIndex
CREATE INDEX "CodeMetric_teamId_createdAt_idx" ON "public"."CodeMetric"("teamId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "CodeMetric_userId_createdAt_idx" ON "public"."CodeMetric"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "ConfirmationInbox_isActive_idx" ON "public"."ConfirmationInbox"("isActive" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ConfirmationInbox_userId_emailAddress_key" ON "public"."ConfirmationInbox"("userId" ASC, "emailAddress" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "DORABenchmark_level_year_key" ON "public"."DORABenchmark"("level" ASC, "year" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "DeploymentMetric_deploymentId_key" ON "public"."DeploymentMetric"("deploymentId" ASC);

-- CreateIndex
CREATE INDEX "DeploymentMetric_environment_idx" ON "public"."DeploymentMetric"("environment" ASC);

-- CreateIndex
CREATE INDEX "DeploymentMetric_status_idx" ON "public"."DeploymentMetric"("status" ASC);

-- CreateIndex
CREATE INDEX "DeploymentMetric_teamId_deployedAt_idx" ON "public"."DeploymentMetric"("teamId" ASC, "deployedAt" ASC);

-- CreateIndex
CREATE INDEX "DeploymentMetric_userId_deployedAt_idx" ON "public"."DeploymentMetric"("userId" ASC, "deployedAt" ASC);

-- CreateIndex
CREATE INDEX "DesktopAuditLog_desktopSessionId_createdAt_idx" ON "public"."DesktopAuditLog"("desktopSessionId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "DesktopAuditLog_jobLeadId_createdAt_idx" ON "public"."DesktopAuditLog"("jobLeadId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "DesktopAuditLog_runtimeSessionId_createdAt_idx" ON "public"."DesktopAuditLog"("runtimeSessionId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "DesktopAuditLog_toolName_createdAt_idx" ON "public"."DesktopAuditLog"("toolName" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "DesktopAuditLog_userId_createdAt_idx" ON "public"."DesktopAuditLog"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "DesktopPairingCode_codeHash_key" ON "public"."DesktopPairingCode"("codeHash" ASC);

-- CreateIndex
CREATE INDEX "DesktopPairingCode_consumedAt_idx" ON "public"."DesktopPairingCode"("consumedAt" ASC);

-- CreateIndex
CREATE INDEX "DesktopPairingCode_userId_expiresAt_idx" ON "public"."DesktopPairingCode"("userId" ASC, "expiresAt" ASC);

-- CreateIndex
CREATE INDEX "DesktopToken_revokedAt_idx" ON "public"."DesktopToken"("revokedAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "DesktopToken_tokenHash_key" ON "public"."DesktopToken"("tokenHash" ASC);

-- CreateIndex
CREATE INDEX "DesktopToken_userId_idx" ON "public"."DesktopToken"("userId" ASC);

-- CreateIndex
CREATE INDEX "DeveloperMetric_userId_createdAt_idx" ON "public"."DeveloperMetric"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperMetric_userId_periodStart_key" ON "public"."DeveloperMetric"("userId" ASC, "periodStart" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "FollowUpDraft_applicationSubmissionId_key" ON "public"."FollowUpDraft"("applicationSubmissionId" ASC);

-- CreateIndex
CREATE INDEX "FollowUpDraft_userId_generatedAt_idx" ON "public"."FollowUpDraft"("userId" ASC, "generatedAt" ASC);

-- CreateIndex
CREATE INDEX "FollowUpDraft_userId_status_idx" ON "public"."FollowUpDraft"("userId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "FormFieldFeedback_userId_fieldLabel_idx" ON "public"."FormFieldFeedback"("userId" ASC, "fieldLabel" ASC);

-- CreateIndex
CREATE INDEX "FormFieldFeedback_userId_hostname_idx" ON "public"."FormFieldFeedback"("userId" ASC, "hostname" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "GuidedApplication_applicationSubmissionId_key" ON "public"."GuidedApplication"("applicationSubmissionId" ASC);

-- CreateIndex
CREATE INDEX "GuidedApplication_status_idx" ON "public"."GuidedApplication"("status" ASC);

-- CreateIndex
CREATE INDEX "GuidedApplication_userId_idx" ON "public"."GuidedApplication"("userId" ASC);

-- CreateIndex
CREATE INDEX "GuidedApplication_userId_status_idx" ON "public"."GuidedApplication"("userId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "GuidedFieldSuggestion_guidedApplicationId_idx" ON "public"."GuidedFieldSuggestion"("guidedApplicationId" ASC);

-- CreateIndex
CREATE INDEX "GuidedFieldSuggestion_guidedApplicationId_status_idx" ON "public"."GuidedFieldSuggestion"("guidedApplicationId" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "HostRateLimitState_hostname_actionType_key" ON "public"."HostRateLimitState"("hostname" ASC, "actionType" ASC);

-- CreateIndex
CREATE INDEX "HostRateLimitState_hostname_idx" ON "public"."HostRateLimitState"("hostname" ASC);

-- CreateIndex
CREATE INDEX "IncidentMetric_deploymentId_idx" ON "public"."IncidentMetric"("deploymentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "IncidentMetric_incidentId_key" ON "public"."IncidentMetric"("incidentId" ASC);

-- CreateIndex
CREATE INDEX "IncidentMetric_severity_idx" ON "public"."IncidentMetric"("severity" ASC);

-- CreateIndex
CREATE INDEX "IncidentMetric_teamId_detectedAt_idx" ON "public"."IncidentMetric"("teamId" ASC, "detectedAt" ASC);

-- CreateIndex
CREATE INDEX "InterviewQuestion_jobLeadId_idx" ON "public"."InterviewQuestion"("jobLeadId" ASC);

-- CreateIndex
CREATE INDEX "InterviewQuestion_userId_createdAt_idx" ON "public"."InterviewQuestion"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "InterviewResponse_questionId_idx" ON "public"."InterviewResponse"("questionId" ASC);

-- CreateIndex
CREATE INDEX "InterviewResponse_userId_createdAt_idx" ON "public"."InterviewResponse"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "InterviewSession_jobLeadId_idx" ON "public"."InterviewSession"("jobLeadId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "InterviewSession_sourceEmailId_key" ON "public"."InterviewSession"("sourceEmailId" ASC);

-- CreateIndex
CREATE INDEX "InterviewSession_userId_createdAt_idx" ON "public"."InterviewSession"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "JobFitAnalysis_jobLeadId_key" ON "public"."JobFitAnalysis"("jobLeadId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "JobLead_jobListingId_key" ON "public"."JobLead"("jobListingId" ASC);

-- CreateIndex
CREATE INDEX "JobLead_userId_createdAt_idx" ON "public"."JobLead"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "JobLead_userId_status_idx" ON "public"."JobLead"("userId" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "JobLeadOptimization_jobFitAnalysisId_key" ON "public"."JobLeadOptimization"("jobFitAnalysisId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "JobLeadOptimization_jobLeadId_key" ON "public"."JobLeadOptimization"("jobLeadId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "JobLeadOptimization_resumeRevisionId_key" ON "public"."JobLeadOptimization"("resumeRevisionId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "JobListing_jobId_key" ON "public"."JobListing"("jobId" ASC);

-- CreateIndex
CREATE INDEX "JobListing_source_idx" ON "public"."JobListing"("source" ASC);

-- CreateIndex
CREATE INDEX "JobListing_userId_createdAt_idx" ON "public"."JobListing"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "JobListing_userId_postedAt_idx" ON "public"."JobListing"("userId" ASC, "postedAt" ASC);

-- CreateIndex
CREATE INDEX "JobListing_userId_saved_idx" ON "public"."JobListing"("userId" ASC, "saved" ASC);

-- CreateIndex
CREATE INDEX "JobListing_userId_status_idx" ON "public"."JobListing"("userId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "JobListing_userId_status_postedAt_idx" ON "public"."JobListing"("userId" ASC, "status" ASC, "postedAt" ASC);

-- CreateIndex
CREATE INDEX "JobQueueItem_deduplicationKey_idx" ON "public"."JobQueueItem"("deduplicationKey" ASC);

-- CreateIndex
CREATE INDEX "JobQueueItem_status_processAfter_priority_idx" ON "public"."JobQueueItem"("status" ASC, "processAfter" ASC, "priority" ASC);

-- CreateIndex
CREATE INDEX "JobQueueItem_type_idx" ON "public"."JobQueueItem"("type" ASC);

-- CreateIndex
CREATE INDEX "JobQueueItem_userId_idx" ON "public"."JobQueueItem"("userId" ASC);

-- CreateIndex
CREATE INDEX "JobSearch_userId_createdAt_idx" ON "public"."JobSearch"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "JobSearch_userId_saved_idx" ON "public"."JobSearch"("userId" ASC, "saved" ASC);

-- CreateIndex
CREATE INDEX "JobSearch_userId_status_idx" ON "public"."JobSearch"("userId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "JobSearchListing_jobListingId_idx" ON "public"."JobSearchListing"("jobListingId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "LinkedInProfile_userId_linkedInId_key" ON "public"."LinkedInProfile"("userId" ASC, "linkedInId" ASC);

-- CreateIndex
CREATE INDEX "LocalFormSnapshot_hostname_idx" ON "public"."LocalFormSnapshot"("hostname" ASC);

-- CreateIndex
CREATE INDEX "LocalFormSnapshot_jobLeadId_idx" ON "public"."LocalFormSnapshot"("jobLeadId" ASC);

-- CreateIndex
CREATE INDEX "LocalFormSnapshot_userId_capturedAt_idx" ON "public"."LocalFormSnapshot"("userId" ASC, "capturedAt" ASC);

-- CreateIndex
CREATE INDEX "MobileResponsivenessAudit_userId_idx" ON "public"."MobileResponsivenessAudit"("userId" ASC);

-- CreateIndex
CREATE INDEX "NetworkSubmissionRecipe_atsSystemId_idx" ON "public"."NetworkSubmissionRecipe"("atsSystemId" ASC);

-- CreateIndex
CREATE INDEX "NetworkSubmissionRecipe_family_idx" ON "public"."NetworkSubmissionRecipe"("family" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "NetworkSubmissionRecipe_family_version_key" ON "public"."NetworkSubmissionRecipe"("family" ASC, "version" ASC);

-- CreateIndex
CREATE INDEX "NetworkSubmissionRecipe_hostname_idx" ON "public"."NetworkSubmissionRecipe"("hostname" ASC);

-- CreateIndex
CREATE INDEX "NetworkSubmissionRecipe_status_updatedAt_idx" ON "public"."NetworkSubmissionRecipe"("status" ASC, "updatedAt" ASC);

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "public"."Notification"("userId" ASC);

-- CreateIndex
CREATE INDEX "NotificationDelivery_notificationId_idx" ON "public"."NotificationDelivery"("notificationId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_eventType_channel_key" ON "public"."NotificationPreference"("userId" ASC, "eventType" ASC, "channel" ASC);

-- CreateIndex
CREATE INDEX "NotificationPreference_userId_idx" ON "public"."NotificationPreference"("userId" ASC);

-- CreateIndex
CREATE INDEX "PeopleProfile_userId_createdAt_idx" ON "public"."PeopleProfile"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "PeopleProfile_userId_idx" ON "public"."PeopleProfile"("userId" ASC);

-- CreateIndex
CREATE INDEX "PlanBoardEvent_eventType_createdAt_idx" ON "public"."PlanBoardEvent"("eventType" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "PlanBoardEvent_taskId_createdAt_idx" ON "public"."PlanBoardEvent"("taskId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "PlanBoardTask_status_claimedAt_idx" ON "public"."PlanBoardTask"("status" ASC, "claimedAt" ASC);

-- CreateIndex
CREATE INDEX "PlanBoardTask_status_updatedAt_idx" ON "public"."PlanBoardTask"("status" ASC, "updatedAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PlanBoardTask_taskId_key" ON "public"."PlanBoardTask"("taskId" ASC);

-- CreateIndex
CREATE INDEX "ProductivityMetric_teamId_periodStart_idx" ON "public"."ProductivityMetric"("teamId" ASC, "periodStart" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ProductivityMetric_userId_periodStart_periodType_key" ON "public"."ProductivityMetric"("userId" ASC, "periodStart" ASC, "periodType" ASC);

-- CreateIndex
CREATE INDEX "ReplayArtifact_sessionId_createdAt_idx" ON "public"."ReplayArtifact"("sessionId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Resume_analysisId_key" ON "public"."Resume"("analysisId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Resume_defaultRevisionId_key" ON "public"."Resume"("defaultRevisionId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ResumeAnalysis_resumeId_key" ON "public"."ResumeAnalysis"("resumeId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ResumeAnalysis_resumeRevisionId_key" ON "public"."ResumeAnalysis"("resumeRevisionId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ResumeOptimization_analysisId_key" ON "public"."ResumeOptimization"("analysisId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ResumeOptimization_jobFitAnalysisId_key" ON "public"."ResumeOptimization"("jobFitAnalysisId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ResumeOptimization_resumeId_key" ON "public"."ResumeOptimization"("resumeId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ResumeOptimization_resumeRevisionId_key" ON "public"."ResumeOptimization"("resumeRevisionId" ASC);

-- CreateIndex
CREATE INDEX "ResumePerformanceMetric_personalBest_idx" ON "public"."ResumePerformanceMetric"("personalBest" ASC);

-- CreateIndex
CREATE INDEX "ResumePerformanceMetric_resumeId_idx" ON "public"."ResumePerformanceMetric"("resumeId" ASC);

-- CreateIndex
CREATE INDEX "ResumePerformanceMetric_resumeRevisionId_idx" ON "public"."ResumePerformanceMetric"("resumeRevisionId" ASC);

-- CreateIndex
CREATE INDEX "ResumePerformanceMetric_userId_calculatedAt_idx" ON "public"."ResumePerformanceMetric"("userId" ASC, "calculatedAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ResumeRevision_jobLeadId_key" ON "public"."ResumeRevision"("jobLeadId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ResumeRevision_resumeAnalysisId_key" ON "public"."ResumeRevision"("resumeAnalysisId" ASC);

-- CreateIndex
CREATE INDEX "RulePromotionCandidate_atsSystemId_idx" ON "public"."RulePromotionCandidate"("atsSystemId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "RulePromotionCandidate_hostname_candidateFingerprint_key" ON "public"."RulePromotionCandidate"("hostname" ASC, "candidateFingerprint" ASC);

-- CreateIndex
CREATE INDEX "RulePromotionCandidate_hostname_promotionStatus_idx" ON "public"."RulePromotionCandidate"("hostname" ASC, "promotionStatus" ASC);

-- CreateIndex
CREATE INDEX "RulePromotionCandidate_userId_promotionStatus_idx" ON "public"."RulePromotionCandidate"("userId" ASC, "promotionStatus" ASC);

-- CreateIndex
CREATE INDEX "RuntimeTrainingReview_candidateId_idx" ON "public"."RuntimeTrainingReview"("candidateId" ASC);

-- CreateIndex
CREATE INDEX "RuntimeTrainingReview_ruleId_idx" ON "public"."RuntimeTrainingReview"("ruleId" ASC);

-- CreateIndex
CREATE INDEX "RuntimeTrainingReview_sessionId_createdAt_idx" ON "public"."RuntimeTrainingReview"("sessionId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "RuntimeTrainingReview_userId_createdAt_idx" ON "public"."RuntimeTrainingReview"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "RuntimeTrustOverride_clearedAt_expiresAt_idx" ON "public"."RuntimeTrustOverride"("clearedAt" ASC, "expiresAt" ASC);

-- CreateIndex
CREATE INDEX "RuntimeTrustOverride_userId_atsFamily_hostname_idx" ON "public"."RuntimeTrustOverride"("userId" ASC, "atsFamily" ASC, "hostname" ASC);

-- CreateIndex
CREATE INDEX "ScrapeSession_scrapeId_idx" ON "public"."ScrapeSession"("scrapeId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ScrapeSession_scrapeId_key" ON "public"."ScrapeSession"("scrapeId" ASC);

-- CreateIndex
CREATE INDEX "ScrapeSession_userId_startedAt_idx" ON "public"."ScrapeSession"("userId" ASC, "startedAt" DESC);

-- CreateIndex
CREATE INDEX "ScrapeSessionEvent_sessionId_sequence_idx" ON "public"."ScrapeSessionEvent"("sessionId" ASC, "sequence" ASC);

-- CreateIndex
CREATE INDEX "SubmissionConfirmationPhrase_atsSystemId_idx" ON "public"."SubmissionConfirmationPhrase"("atsSystemId" ASC);

-- CreateIndex
CREATE INDEX "SubmissionConfirmationPhrase_hostname_idx" ON "public"."SubmissionConfirmationPhrase"("hostname" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionConfirmationPhrase_hostname_normalizedPhrase_key" ON "public"."SubmissionConfirmationPhrase"("hostname" ASC, "normalizedPhrase" ASC);

-- CreateIndex
CREATE INDEX "SubmissionConfirmationPhrase_lastObservedAt_idx" ON "public"."SubmissionConfirmationPhrase"("lastObservedAt" ASC);

-- CreateIndex
CREATE INDEX "Subscription_stripeCustomerId_idx" ON "public"."Subscription"("stripeCustomerId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "public"."Subscription"("stripeCustomerId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "public"."Subscription"("stripeSubscriptionId" ASC);

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "public"."Subscription"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "public"."Subscription"("userId" ASC);

-- CreateIndex
CREATE INDEX "UserFieldRule_userId_hostname_idx" ON "public"."UserFieldRule"("userId" ASC, "hostname" ASC);

-- CreateIndex
CREATE INDEX "UserFieldRule_userId_question_idx" ON "public"."UserFieldRule"("userId" ASC, "question" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "UserJobPreferences_userId_key" ON "public"."UserJobPreferences"("userId" ASC);

-- CreateIndex
CREATE INDEX "UserKnowledge_userId_idx" ON "public"."UserKnowledge"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "UserKnowledge_userId_key_key" ON "public"."UserKnowledge"("userId" ASC, "key" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "public"."UserProfile"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "public"."VerificationToken"("identifier" ASC, "token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "public"."VerificationToken"("token" ASC);

-- CreateIndex
CREATE INDEX "_InterviewSessionQuestions_B_index" ON "public"."_InterviewSessionQuestions"("B" ASC);

-- CreateIndex
CREATE INDEX "_InterviewSessionResponses_B_index" ON "public"."_InterviewSessionResponses"("B" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "public"."session"("token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_defaultResumeId_key" ON "public"."user"("defaultResumeId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_defaultRevisionId_key" ON "public"."user"("defaultRevisionId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "public"."user"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_phone_key" ON "public"."user"("phone" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_trackingEmailAlias_key" ON "public"."user"("trackingEmailAlias" ASC);

-- AddForeignKey
ALTER TABLE "public"."ATSAnalysisJob" ADD CONSTRAINT "ATSAnalysisJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ATSFieldObservation" ADD CONSTRAINT "ATSFieldObservation_atsSystemId_fkey" FOREIGN KEY ("atsSystemId") REFERENCES "public"."ATSSystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ATSFieldObservation" ADD CONSTRAINT "ATSFieldObservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ATSRule" ADD CONSTRAINT "ATSRule_atsSystemId_fkey" FOREIGN KEY ("atsSystemId") REFERENCES "public"."ATSSystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApplicationEmail" ADD CONSTRAINT "ApplicationEmail_applicationSubmissionId_fkey" FOREIGN KEY ("applicationSubmissionId") REFERENCES "public"."ApplicationSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApplicationEmail" ADD CONSTRAINT "ApplicationEmail_jobLeadId_fkey" FOREIGN KEY ("jobLeadId") REFERENCES "public"."JobLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApplicationEmail" ADD CONSTRAINT "ApplicationEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApplicationFlowDefinition" ADD CONSTRAINT "ApplicationFlowDefinition_atsSystemId_fkey" FOREIGN KEY ("atsSystemId") REFERENCES "public"."ATSSystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApplicationFlowNode" ADD CONSTRAINT "ApplicationFlowNode_atsSystemId_fkey" FOREIGN KEY ("atsSystemId") REFERENCES "public"."ATSSystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApplicationFlowStepDefinition" ADD CONSTRAINT "ApplicationFlowStepDefinition_flowDefinitionId_fkey" FOREIGN KEY ("flowDefinitionId") REFERENCES "public"."ApplicationFlowDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApplicationFlowTransition" ADD CONSTRAINT "ApplicationFlowTransition_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "public"."ApplicationFlowNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApplicationFlowTransition" ADD CONSTRAINT "ApplicationFlowTransition_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "public"."ApplicationFlowNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApplicationOutcomeEvent" ADD CONSTRAINT "ApplicationOutcomeEvent_applicationSubmissionId_fkey" FOREIGN KEY ("applicationSubmissionId") REFERENCES "public"."ApplicationSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApplicationRuntimeEvent" ADD CONSTRAINT "ApplicationRuntimeEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."ApplicationRuntimeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApplicationRuntimeEvent" ADD CONSTRAINT "ApplicationRuntimeEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApplicationRuntimeSession" ADD CONSTRAINT "ApplicationRuntimeSession_atsSystemId_fkey" FOREIGN KEY ("atsSystemId") REFERENCES "public"."ATSSystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApplicationRuntimeSession" ADD CONSTRAINT "ApplicationRuntimeSession_guidedApplicationId_fkey" FOREIGN KEY ("guidedApplicationId") REFERENCES "public"."GuidedApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApplicationRuntimeSession" ADD CONSTRAINT "ApplicationRuntimeSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApplicationSubmission" ADD CONSTRAINT "ApplicationSubmission_jobLeadId_fkey" FOREIGN KEY ("jobLeadId") REFERENCES "public"."JobLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApplicationSubmission" ADD CONSTRAINT "ApplicationSubmission_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "public"."Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApplicationSubmission" ADD CONSTRAINT "ApplicationSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssistTrainingSession" ADD CONSTRAINT "AssistTrainingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AutomationAuditLog" ADD CONSTRAINT "AutomationAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AutomationScheduledApplication" ADD CONSTRAINT "AutomationScheduledApplication_jobLeadId_fkey" FOREIGN KEY ("jobLeadId") REFERENCES "public"."JobLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AutomationScheduledApplication" ADD CONSTRAINT "AutomationScheduledApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AutomationSettings" ADD CONSTRAINT "AutomationSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CodeMetric" ADD CONSTRAINT "CodeMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConfirmationInbox" ADD CONSTRAINT "ConfirmationInbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CoverLetter" ADD CONSTRAINT "CoverLetter_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."JobLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CoverLetter" ADD CONSTRAINT "CoverLetter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeploymentMetric" ADD CONSTRAINT "DeploymentMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesktopAuditLog" ADD CONSTRAINT "DesktopAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesktopPairingCode" ADD CONSTRAINT "DesktopPairingCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesktopToken" ADD CONSTRAINT "DesktopToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeveloperMetric" ADD CONSTRAINT "DeveloperMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FollowUpDraft" ADD CONSTRAINT "FollowUpDraft_applicationSubmissionId_fkey" FOREIGN KEY ("applicationSubmissionId") REFERENCES "public"."ApplicationSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FollowUpDraft" ADD CONSTRAINT "FollowUpDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FormFieldFeedback" ADD CONSTRAINT "FormFieldFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuidedApplication" ADD CONSTRAINT "GuidedApplication_applicationSubmissionId_fkey" FOREIGN KEY ("applicationSubmissionId") REFERENCES "public"."ApplicationSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuidedApplication" ADD CONSTRAINT "GuidedApplication_coverLetterId_fkey" FOREIGN KEY ("coverLetterId") REFERENCES "public"."CoverLetter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuidedApplication" ADD CONSTRAINT "GuidedApplication_jobLeadId_fkey" FOREIGN KEY ("jobLeadId") REFERENCES "public"."JobLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuidedApplication" ADD CONSTRAINT "GuidedApplication_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "public"."Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuidedApplication" ADD CONSTRAINT "GuidedApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuidedFieldSuggestion" ADD CONSTRAINT "GuidedFieldSuggestion_guidedApplicationId_fkey" FOREIGN KEY ("guidedApplicationId") REFERENCES "public"."GuidedApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IncidentMetric" ADD CONSTRAINT "IncidentMetric_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "public"."DeploymentMetric"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IncidentMetric" ADD CONSTRAINT "IncidentMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InterviewQuestion" ADD CONSTRAINT "InterviewQuestion_jobLeadId_fkey" FOREIGN KEY ("jobLeadId") REFERENCES "public"."JobLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InterviewQuestion" ADD CONSTRAINT "InterviewQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InterviewResponse" ADD CONSTRAINT "InterviewResponse_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."InterviewQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InterviewResponse" ADD CONSTRAINT "InterviewResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InterviewSession" ADD CONSTRAINT "InterviewSession_jobLeadId_fkey" FOREIGN KEY ("jobLeadId") REFERENCES "public"."JobLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InterviewSession" ADD CONSTRAINT "InterviewSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobFitAnalysis" ADD CONSTRAINT "JobFitAnalysis_jobLeadId_fkey" FOREIGN KEY ("jobLeadId") REFERENCES "public"."JobLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobFitAnalysis" ADD CONSTRAINT "JobFitAnalysis_jobListingId_fkey" FOREIGN KEY ("jobListingId") REFERENCES "public"."JobListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobFitAnalysis" ADD CONSTRAINT "JobFitAnalysis_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "public"."Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobFitAnalysis" ADD CONSTRAINT "JobFitAnalysis_resumeRevisionId_fkey" FOREIGN KEY ("resumeRevisionId") REFERENCES "public"."ResumeRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobFitAnalysis" ADD CONSTRAINT "JobFitAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobLead" ADD CONSTRAINT "JobLead_jobListingId_fkey" FOREIGN KEY ("jobListingId") REFERENCES "public"."JobListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobLead" ADD CONSTRAINT "JobLead_jobSearchId_fkey" FOREIGN KEY ("jobSearchId") REFERENCES "public"."JobSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobLead" ADD CONSTRAINT "JobLead_tailoredCoverLetterId_fkey" FOREIGN KEY ("tailoredCoverLetterId") REFERENCES "public"."CoverLetter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobLead" ADD CONSTRAINT "JobLead_tailoredResumeRevisionId_fkey" FOREIGN KEY ("tailoredResumeRevisionId") REFERENCES "public"."ResumeRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobLead" ADD CONSTRAINT "JobLead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobLeadOptimization" ADD CONSTRAINT "JobLeadOptimization_jobFitAnalysisId_fkey" FOREIGN KEY ("jobFitAnalysisId") REFERENCES "public"."JobFitAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobLeadOptimization" ADD CONSTRAINT "JobLeadOptimization_jobLeadId_fkey" FOREIGN KEY ("jobLeadId") REFERENCES "public"."JobLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobLeadOptimization" ADD CONSTRAINT "JobLeadOptimization_resumeRevisionId_fkey" FOREIGN KEY ("resumeRevisionId") REFERENCES "public"."ResumeRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobLeadOptimization" ADD CONSTRAINT "JobLeadOptimization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobListing" ADD CONSTRAINT "JobListing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobSearch" ADD CONSTRAINT "JobSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobSearchListing" ADD CONSTRAINT "JobSearchListing_jobListingId_fkey" FOREIGN KEY ("jobListingId") REFERENCES "public"."JobListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobSearchListing" ADD CONSTRAINT "JobSearchListing_jobSearchId_fkey" FOREIGN KEY ("jobSearchId") REFERENCES "public"."JobSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LinkedInProfile" ADD CONSTRAINT "LinkedInProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LocalFormSnapshot" ADD CONSTRAINT "LocalFormSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MobileResponsivenessAudit" ADD CONSTRAINT "MobileResponsivenessAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NetworkSubmissionRecipe" ADD CONSTRAINT "NetworkSubmissionRecipe_atsSystemId_fkey" FOREIGN KEY ("atsSystemId") REFERENCES "public"."ATSSystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "public"."Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PeopleProfile" ADD CONSTRAINT "PeopleProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlanBoardEvent" ADD CONSTRAINT "PlanBoardEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."PlanBoardTask"("taskId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductivityMetric" ADD CONSTRAINT "ProductivityMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReplayArtifact" ADD CONSTRAINT "ReplayArtifact_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."ApplicationRuntimeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Resume" ADD CONSTRAINT "Resume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResumeAnalysis" ADD CONSTRAINT "ResumeAnalysis_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "public"."Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResumeAnalysis" ADD CONSTRAINT "ResumeAnalysis_resumeRevisionId_fkey" FOREIGN KEY ("resumeRevisionId") REFERENCES "public"."ResumeRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResumeAnalysis" ADD CONSTRAINT "ResumeAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResumeOptimization" ADD CONSTRAINT "ResumeOptimization_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "public"."ResumeAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResumeOptimization" ADD CONSTRAINT "ResumeOptimization_jobFitAnalysisId_fkey" FOREIGN KEY ("jobFitAnalysisId") REFERENCES "public"."JobFitAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResumeOptimization" ADD CONSTRAINT "ResumeOptimization_jobLeadId_fkey" FOREIGN KEY ("jobLeadId") REFERENCES "public"."JobLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResumeOptimization" ADD CONSTRAINT "ResumeOptimization_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "public"."Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResumeOptimization" ADD CONSTRAINT "ResumeOptimization_resumeRevisionId_fkey" FOREIGN KEY ("resumeRevisionId") REFERENCES "public"."ResumeRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResumeOptimization" ADD CONSTRAINT "ResumeOptimization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResumePerformanceMetric" ADD CONSTRAINT "ResumePerformanceMetric_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "public"."Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResumePerformanceMetric" ADD CONSTRAINT "ResumePerformanceMetric_resumeRevisionId_fkey" FOREIGN KEY ("resumeRevisionId") REFERENCES "public"."ResumeRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResumePerformanceMetric" ADD CONSTRAINT "ResumePerformanceMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResumeRevision" ADD CONSTRAINT "ResumeRevision_jobLeadId_fkey" FOREIGN KEY ("jobLeadId") REFERENCES "public"."JobLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResumeRevision" ADD CONSTRAINT "ResumeRevision_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "public"."Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResumeRevision" ADD CONSTRAINT "ResumeRevision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RulePromotionCandidate" ADD CONSTRAINT "RulePromotionCandidate_atsSystemId_fkey" FOREIGN KEY ("atsSystemId") REFERENCES "public"."ATSSystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RulePromotionCandidate" ADD CONSTRAINT "RulePromotionCandidate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RuntimeTrainingReview" ADD CONSTRAINT "RuntimeTrainingReview_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "public"."RulePromotionCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RuntimeTrainingReview" ADD CONSTRAINT "RuntimeTrainingReview_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "public"."ATSRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RuntimeTrainingReview" ADD CONSTRAINT "RuntimeTrainingReview_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."ApplicationRuntimeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RuntimeTrainingReview" ADD CONSTRAINT "RuntimeTrainingReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RuntimeTrustOverride" ADD CONSTRAINT "RuntimeTrustOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScrapeSession" ADD CONSTRAINT "ScrapeSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScrapeSessionEvent" ADD CONSTRAINT "ScrapeSessionEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."ScrapeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubmissionConfirmationPhrase" ADD CONSTRAINT "SubmissionConfirmationPhrase_atsSystemId_fkey" FOREIGN KEY ("atsSystemId") REFERENCES "public"."ATSSystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserFieldRule" ADD CONSTRAINT "UserFieldRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserJobPreferences" ADD CONSTRAINT "UserJobPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserKnowledge" ADD CONSTRAINT "UserKnowledge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_InterviewSessionQuestions" ADD CONSTRAINT "_InterviewSessionQuestions_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."InterviewQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_InterviewSessionQuestions" ADD CONSTRAINT "_InterviewSessionQuestions_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_InterviewSessionResponses" ADD CONSTRAINT "_InterviewSessionResponses_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."InterviewResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_InterviewSessionResponses" ADD CONSTRAINT "_InterviewSessionResponses_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

