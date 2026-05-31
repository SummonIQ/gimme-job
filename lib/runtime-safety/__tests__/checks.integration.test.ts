// @vitest-environment node
import { db } from '@/lib/db/client';
import {
  ATSAutomationPostureLevel,
  ConfirmationInboxProvider,
} from '@/generated/prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { __TESTING__ as CONFIRMATION_INBOX_AUTH_TESTING, encryptCredential } from '@/lib/email-ingestion/auth';
import {
  checkAtsPosture,
  checkConfirmationInbox,
  checkConfirmationPhraseRegistered,
  checkHostBlocklist,
  checkRateBudget,
  checkRegressionFreshness,
  runAllChecks,
} from '../checks';

const HAS_DB = Boolean(process.env.DATABASE_URL);

const originalEncKey = process.env[CONFIRMATION_INBOX_AUTH_TESTING.ENV_VAR];

let counter = 0;
function nextSuffix() {
  counter += 1;
  return `p16-1-${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 8)}`;
}

const testHost = 'p16-1-test.greenhouse.io';
const family = 'greenhouse';
const createdUserIds: string[] = [];
const createdPostureIds: string[] = [];

async function ensurePosture(
  fam: string,
  posture: ATSAutomationPostureLevel,
) {
  const existing = await db.aTSAutomationPosture.findUnique({
    where: { family: fam },
  });
  if (existing) {
    if (existing.posture !== posture) {
      await db.aTSAutomationPosture.update({
        data: { posture },
        where: { family: fam },
      });
    }
    return existing;
  }
  const created = await db.aTSAutomationPosture.create({
    data: {
      family: fam,
      notes: 'P16.1 test',
      posture,
      reviewedAt: new Date(),
      tosUrl: 'https://example.com/tos',
    },
  });
  createdPostureIds.push(created.id);
  return created;
}

async function cleanupHost() {
  await db.submissionConfirmationPhrase
    .deleteMany({ where: { hostname: testHost } })
    .catch(() => undefined);
  await db.applicationFlowStepDefinition
    .deleteMany({ where: { flowDefinition: { hostname: testHost } } })
    .catch(() => undefined);
  await db.applicationFlowDefinition
    .deleteMany({ where: { hostname: testHost } })
    .catch(() => undefined);
  await db.hostRateLimitState
    .deleteMany({ where: { hostname: testHost } })
    .catch(() => undefined);
}

describe.skipIf(!HAS_DB)('safety-gate checks (integration)', () => {
  beforeAll(async () => {
    process.env[CONFIRMATION_INBOX_AUTH_TESTING.ENV_VAR] =
      'p16-1-integration-encryption-key';
    await cleanupHost();
  });

  afterAll(async () => {
    await cleanupHost();
    for (const userId of createdUserIds) {
      await db.confirmationInbox
        .deleteMany({ where: { userId } })
        .catch(() => undefined);
      await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    // Do NOT delete postures we touched — they're seed data (P0.4).
    if (originalEncKey === undefined) {
      delete process.env[CONFIRMATION_INBOX_AUTH_TESTING.ENV_VAR];
    } else {
      process.env[CONFIRMATION_INBOX_AUTH_TESTING.ENV_VAR] = originalEncKey;
    }
  });

  it('checkHostBlocklist flags a blocked host', async () => {
    const blocklist = new Set([testHost]);
    const fail = await checkHostBlocklist(testHost, { blocklist });
    expect(fail.ok).toBe(false);
    expect(fail.reasonCode).toBe('HOST_BLOCKLISTED');
    const pass = await checkHostBlocklist('another.host', { blocklist });
    expect(pass.ok).toBe(true);
  });

  it('checkAtsPosture passes for ALLOWED, fails for GRAY/FORBIDDEN', async () => {
    await ensurePosture(family, ATSAutomationPostureLevel.ALLOWED);
    const allow = await checkAtsPosture(testHost);
    expect(allow.ok).toBe(true);

    await ensurePosture(family, ATSAutomationPostureLevel.GRAY);
    const gray = await checkAtsPosture(testHost);
    expect(gray.ok).toBe(false);
    expect(gray.reasonCode).toBe('POSTURE_GRAY');

    await ensurePosture(family, ATSAutomationPostureLevel.FORBIDDEN);
    const forb = await checkAtsPosture(testHost);
    expect(forb.ok).toBe(false);
    expect(forb.reasonCode).toBe('POSTURE_FORBIDDEN');
  });

  it('checkConfirmationPhraseRegistered fails without rows, passes with one', async () => {
    const missing = await checkConfirmationPhraseRegistered(testHost);
    expect(missing.ok).toBe(false);
    expect(missing.reasonCode).toBe('CONFIRMATION_MISSING');

    await db.submissionConfirmationPhrase.create({
      data: {
        hostname: testHost,
        normalizedPhrase: 'application submitted',
        originalPhrase: 'Application submitted!',
      },
    });
    const present = await checkConfirmationPhraseRegistered(testHost);
    expect(present.ok).toBe(true);
  });

  it('checkRateBudget passes when no bucket, fails when tokens exhausted', async () => {
    // No bucket row yet for testHost
    const empty = await checkRateBudget(testHost);
    expect(empty.ok).toBe(true);

    await db.hostRateLimitState.create({
      data: {
        actionType: 'submit',
        capacity: 10,
        dayCount: 0,
        dayLimit: null,
        dayResetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        hostname: testHost,
        lastRefilledAt: new Date(),
        refillRatePerSec: 0,
        tokens: 0,
      },
    });
    const depleted = await checkRateBudget(testHost);
    expect(depleted.ok).toBe(false);
    expect(depleted.reasonCode).toBe('RATE_BUDGET_EMPTY');
  });

  it('checkConfirmationInbox fails with zero, passes with reachable', async () => {
    const suffix = nextSuffix();
    const user = await db.user.create({
      data: {
        email: `p16-1-${suffix}@test.local`,
        firstName: 'Safety',
        lastName: 'Gate',
      },
    });
    createdUserIds.push(user.id);

    const noInbox = await checkConfirmationInbox({ userId: user.id });
    expect(noInbox.ok).toBe(false);
    expect(noInbox.reasonCode).toBe('INBOX_UNREACHABLE');

    await db.confirmationInbox.create({
      data: {
        emailAddress: `p16-1-${suffix}@test.local`,
        encryptedSecret: encryptCredential('app-password'),
        imapHost: 'imap.example.com',
        imapPort: 993,
        imapUsername: `p16-1-${suffix}@test.local`,
        isActive: true,
        label: 'Test',
        provider: ConfirmationInboxProvider.IMAP,
        userId: user.id,
      },
    });
    const ok = await checkConfirmationInbox({ userId: user.id });
    expect(ok.ok).toBe(true);
  });

  it('checkRegressionFreshness fails when flow absent, passes when fresh', async () => {
    const missing = await checkRegressionFreshness(testHost);
    expect(missing.ok).toBe(false);
    expect(missing.reasonCode).toBe('REGRESSION_STALE');

    await db.applicationFlowDefinition.create({
      data: {
        compiledFromRuleCount: 10,
        confidence: 0.9,
        hostname: testHost,
        lastCompiledAt: new Date(),
        metadata: { regressionPassedAt: new Date().toISOString() },
        status: 'ACTIVE',
        version: 1,
      },
    });
    const fresh = await checkRegressionFreshness(testHost);
    expect(fresh.ok).toBe(true);
  });

  it('checkRegressionFreshness fails when regressionPassedAt is >7 days old', async () => {
    await db.applicationFlowDefinition.updateMany({
      data: {
        metadata: {
          regressionPassedAt: new Date(
            Date.now() - 8 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
      },
      where: { hostname: testHost },
    });
    const stale = await checkRegressionFreshness(testHost);
    expect(stale.ok).toBe(false);
    expect(stale.reasonCode).toBe('REGRESSION_STALE');
  });

  it('runAllChecks aggregates and surfaces every failing reason', async () => {
    // Reset host to a state where multiple checks fail:
    // - posture GRAY
    // - no confirmation phrase
    // - rate budget depleted (from earlier)
    await ensurePosture(family, ATSAutomationPostureLevel.GRAY);
    await db.submissionConfirmationPhrase
      .deleteMany({ where: { hostname: testHost } })
      .catch(() => undefined);

    const report = await runAllChecks({
      blocklist: new Set(),
      hostname: testHost,
    });
    expect(report.ok).toBe(false);
    expect(report.failingReasons).toContain('POSTURE_GRAY');
    expect(report.failingReasons).toContain('CONFIRMATION_MISSING');
    expect(report.failingReasons).toContain('RATE_BUDGET_EMPTY');
  });
});
