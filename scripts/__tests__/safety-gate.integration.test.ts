// @vitest-environment node
import { db } from '@/lib/db/client';
import {
  ATSAutomationPostureLevel,
  ConfirmationInboxProvider,
} from '@/generated/prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  __TESTING__ as CONFIRMATION_INBOX_AUTH_TESTING,
  encryptCredential,
} from '@/lib/email-ingestion/auth';

import { main } from '../safety-gate';

const HAS_DB = Boolean(process.env.DATABASE_URL);

async function cleanupHost(hostname: string) {
  await db.submissionConfirmationPhrase
    .deleteMany({ where: { hostname } })
    .catch(() => undefined);
  await db.applicationFlowStepDefinition
    .deleteMany({ where: { flowDefinition: { hostname } } })
    .catch(() => undefined);
  await db.applicationFlowDefinition
    .deleteMany({ where: { hostname } })
    .catch(() => undefined);
  await db.hostRateLimitState
    .deleteMany({ where: { hostname } })
    .catch(() => undefined);
}

describe.skipIf(!HAS_DB)('safety-gate CLI main()', () => {
  const host = 'p16-1-cli.greenhouse.io';
  const createdUserIds: string[] = [];
  const originalEncKey = process.env[CONFIRMATION_INBOX_AUTH_TESTING.ENV_VAR];

  beforeAll(async () => {
    process.env[CONFIRMATION_INBOX_AUTH_TESTING.ENV_VAR] =
      'p16-1-cli-encryption-key';
    await cleanupHost(host);
    await db.aTSAutomationPosture.upsert({
      create: {
        family: 'greenhouse',
        notes: 'P16.1 CLI test',
        posture: ATSAutomationPostureLevel.ALLOWED,
        reviewedAt: new Date(),
        tosUrl: 'https://example.com/tos',
      },
      update: { posture: ATSAutomationPostureLevel.ALLOWED },
      where: { family: 'greenhouse' },
    });
  });

  afterAll(async () => {
    await cleanupHost(host);
    for (const userId of createdUserIds) {
      await db.confirmationInbox
        .deleteMany({ where: { userId } })
        .catch(() => undefined);
      await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    if (originalEncKey === undefined) {
      delete process.env[CONFIRMATION_INBOX_AUTH_TESTING.ENV_VAR];
    } else {
      process.env[CONFIRMATION_INBOX_AUTH_TESTING.ENV_VAR] = originalEncKey;
    }
  });

  it('exit 2 when --target is missing', async () => {
    const lines: string[] = [];
    const result = await main({
      argv: ['bun', 'safety-gate'],
      stdout: t => lines.push(t),
    });
    expect(result.code).toBe(2);
    expect(lines.join('\n')).toMatch(/--target/);
  });

  it('exit 1 with failing reasons when critical checks miss', async () => {
    const lines: string[] = [];
    const result = await main({
      argv: ['bun', 'safety-gate', `--target=${host}`, '--json'],
      stdout: t => lines.push(t),
    });
    expect(result.code).toBe(1);
    const body = JSON.parse(lines.join('\n')) as {
      ok: boolean;
      failingReasons: string[];
    };
    expect(body.ok).toBe(false);
    expect(body.failingReasons).toContain('CONFIRMATION_MISSING');
    expect(body.failingReasons).toContain('REGRESSION_STALE');
  });

  it('exit 0 when every check passes', async () => {
    // Re-assert ALLOWED in case a parallel test suite flipped it to GRAY
    // as part of its own assertions.
    await db.aTSAutomationPosture.update({
      data: { posture: ATSAutomationPostureLevel.ALLOWED },
      where: { family: 'greenhouse' },
    });
    await db.submissionConfirmationPhrase.create({
      data: {
        hostname: host,
        normalizedPhrase: 'application submitted',
        originalPhrase: 'Application submitted!',
      },
    });
    await db.applicationFlowDefinition.create({
      data: {
        compiledFromRuleCount: 10,
        confidence: 0.9,
        hostname: host,
        lastCompiledAt: new Date(),
        metadata: {
          regressionPassedAt: new Date().toISOString(),
        },
        status: 'ACTIVE',
        version: 1,
      },
    });
    await db.hostRateLimitState.create({
      data: {
        actionType: 'submit',
        capacity: 10,
        dayCount: 0,
        dayLimit: null,
        dayResetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        hostname: host,
        lastRefilledAt: new Date(),
        refillRatePerSec: 1,
        tokens: 10,
      },
    });

    // Seed at least one reachable ConfirmationInbox so the global check
    // passes. The CLI has no --user flag in this test.
    const suffix = `cli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const inboxUser = await db.user.create({
      data: {
        email: `safety-gate-${suffix}@test.local`,
        firstName: 'Safety',
        lastName: 'Gate',
      },
    });
    createdUserIds.push(inboxUser.id);
    await db.confirmationInbox.create({
      data: {
        emailAddress: `safety-gate-${suffix}@test.local`,
        encryptedSecret: encryptCredential('cli-test-password'),
        imapHost: 'imap.example.com',
        imapPort: 993,
        imapUsername: `safety-gate-${suffix}@test.local`,
        isActive: true,
        label: 'P16.1 CLI test',
        provider: ConfirmationInboxProvider.IMAP,
        userId: inboxUser.id,
      },
    });

    const lines: string[] = [];
    const result = await main({
      argv: ['bun', 'safety-gate', `--target=${host}`, '--json'],
      stdout: t => lines.push(t),
    });
    const body = JSON.parse(lines.join('\n')) as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(result.code).toBe(0);
  });
});
