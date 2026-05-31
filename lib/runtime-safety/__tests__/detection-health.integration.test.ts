// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { db } from '@/lib/db/client';
import { ATSAutomationPostureLevel } from '@/generated/prisma/client';

import {
  analyzeHostHealth,
  applyDetectionHealthActions,
} from '../detection-health';

const HAS_DB = Boolean(process.env.DATABASE_URL);
const NOW = new Date('2026-04-23T12:00:00Z');

let fixtureCounter = 0;
function nextSuffix() {
  fixtureCounter += 1;
  return `p16-6-${Date.now()}-${fixtureCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

const createdUserIds: string[] = [];

async function seedUser() {
  const suffix = nextSuffix();
  const user = await db.user.create({
    data: {
      email: `p16-6-${suffix}@test.local`,
      firstName: 'Detection',
      lastName: 'Health',
    },
  });
  createdUserIds.push(user.id);
  return user;
}

async function ensurePosture(
  family: string,
  posture: ATSAutomationPostureLevel,
) {
  const existing = await db.aTSAutomationPosture.findUnique({
    where: { family },
  });
  if (existing) {
    if (existing.posture !== posture) {
      await db.aTSAutomationPosture.update({
        data: { posture },
        where: { family },
      });
    }
    return existing;
  }
  return db.aTSAutomationPosture.create({
    data: {
      family,
      notes: 'P16.6 integration test',
      posture,
      reviewedAt: new Date(),
      tosUrl: 'https://example.com/tos',
    },
  });
}

describe.skipIf(!HAS_DB)('applyDetectionHealthActions (integration)', () => {
  beforeAll(async () => {
    await ensurePosture('greenhouse', ATSAutomationPostureLevel.ALLOWED);
  });

  afterAll(async () => {
    for (const userId of createdUserIds) {
      await db.automationAuditLog
        .deleteMany({ where: { userId } })
        .catch(() => undefined);
      await db.runtimeTrustOverride
        .deleteMany({ where: { userId } })
        .catch(() => undefined);
      await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
  });

  it('simulated CAPTCHA spike flips greenhouse posture to GRAY and writes an override + audit row', async () => {
    await ensurePosture('greenhouse', ATSAutomationPostureLevel.ALLOWED);
    const user = await seedUser();

    const verdict = analyzeHostHealth({
      baselineReplyRate: null,
      baselineSubmitLatencyMs: null,
      captchaEvents: 5,
      hostname: 'job-boards.greenhouse.io',
      httpErrorEvents: 0,
      medianSubmitLatencyMs: null,
      replyRate: null,
      sessionsAbandoned: 0,
      sessionsStarted: 0,
      submitEvents: 20,
      window: { end: NOW, start: new Date(NOW.getTime() - 3600_000) },
    });
    expect(verdict.triggered.map(t => t.type)).toContain('CAPTCHA_SPIKE');

    const result = await applyDetectionHealthActions({
      now: NOW,
      userId: user.id,
      verdict,
    });
    expect(result.posturesFlipped).toContain('greenhouse');
    expect(result.overrideIds.length).toBe(1);
    expect(result.auditLogId).not.toBeNull();

    const postureAfter = await db.aTSAutomationPosture.findUniqueOrThrow({
      where: { family: 'greenhouse' },
    });
    expect(postureAfter.posture).toBe(ATSAutomationPostureLevel.GRAY);

    const override = await db.runtimeTrustOverride.findUniqueOrThrow({
      where: { id: result.overrideIds[0] },
    });
    expect(override.demotedTo).toBe('ACTION_WITH_CONFIRMATION');
    expect(override.hostname).toBe('job-boards.greenhouse.io');
    expect(override.reason).toMatch(/CAPTCHA_SPIKE/);

    const audit = await db.automationAuditLog.findUniqueOrThrow({
      where: { id: result.auditLogId as string },
    });
    expect(audit.action).toBe('AUTO_DETECTION_HEALTH_DEMOTE');
    const meta = audit.metadata as Record<string, unknown> | null;
    expect(meta?.hostname).toBe('job-boards.greenhouse.io');
  });

  it('does not flip an already-GRAY posture', async () => {
    await ensurePosture('greenhouse', ATSAutomationPostureLevel.GRAY);
    const user = await seedUser();

    const verdict = analyzeHostHealth({
      baselineReplyRate: null,
      baselineSubmitLatencyMs: null,
      captchaEvents: 5,
      hostname: 'job-boards.greenhouse.io',
      httpErrorEvents: 0,
      medianSubmitLatencyMs: null,
      replyRate: null,
      sessionsAbandoned: 0,
      sessionsStarted: 0,
      submitEvents: 20,
      window: { end: NOW, start: new Date(NOW.getTime() - 3600_000) },
    });
    const result = await applyDetectionHealthActions({
      now: NOW,
      userId: user.id,
      verdict,
    });
    expect(result.posturesFlipped).toEqual([]);
    // But override + audit are still written — trust cap is the primary
    // safety mechanism even if posture is already downgraded.
    expect(result.overrideIds.length).toBe(1);
  });

  it('no-op when no signals tripped', async () => {
    const user = await seedUser();
    const verdict = analyzeHostHealth({
      baselineReplyRate: null,
      baselineSubmitLatencyMs: null,
      captchaEvents: 0,
      hostname: 'job-boards.greenhouse.io',
      httpErrorEvents: 0,
      medianSubmitLatencyMs: null,
      replyRate: null,
      sessionsAbandoned: 0,
      sessionsStarted: 0,
      submitEvents: 50,
      window: { end: NOW, start: new Date(NOW.getTime() - 3600_000) },
    });
    const result = await applyDetectionHealthActions({
      now: NOW,
      userId: user.id,
      verdict,
    });
    expect(result.overrideIds).toEqual([]);
    expect(result.posturesFlipped).toEqual([]);
    expect(result.auditLogId).toBeNull();
  });

  it('dryRun does not write', async () => {
    await ensurePosture('greenhouse', ATSAutomationPostureLevel.ALLOWED);
    const user = await seedUser();

    const verdict = analyzeHostHealth({
      baselineReplyRate: null,
      baselineSubmitLatencyMs: null,
      captchaEvents: 5,
      hostname: 'job-boards.greenhouse.io',
      httpErrorEvents: 0,
      medianSubmitLatencyMs: null,
      replyRate: null,
      sessionsAbandoned: 0,
      sessionsStarted: 0,
      submitEvents: 20,
      window: { end: NOW, start: new Date(NOW.getTime() - 3600_000) },
    });
    const result = await applyDetectionHealthActions({
      dryRun: true,
      now: NOW,
      userId: user.id,
      verdict,
    });
    expect(result.overrideIds).toEqual([]);
    expect(result.posturesFlipped).toEqual([]);
  });
});
