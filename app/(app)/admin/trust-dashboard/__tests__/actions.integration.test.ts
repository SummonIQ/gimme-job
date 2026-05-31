// @vitest-environment node
import { db } from '@/lib/db/client';
import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/admin/scrape-service', () => ({
  isAdminUser: vi.fn(async () => true),
}));
vi.mock('@/lib/user/query', () => ({ getCurrentUser: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));

import { getCurrentUser } from '@/lib/user/query';
import { isAdminUser } from '@/lib/admin/scrape-service';

import {
  clearTrustOverride,
  demoteTrustScope,
} from '../actions';

const HAS_DB = Boolean(process.env.DATABASE_URL);

let fixtureCounter = 0;
function nextSuffix() {
  fixtureCounter += 1;
  return `p8-2-${Date.now()}-${fixtureCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

const createdUserIds: string[] = [];

async function seedAdminUser() {
  const suffix = nextSuffix();
  const user = await db.user.create({
    data: {
      email: `trust-dash-${suffix}@test.local`,
      firstName: 'Trust',
      lastName: 'Admin',
    },
  });
  createdUserIds.push(user.id);
  vi.mocked(getCurrentUser).mockResolvedValue(user as never);
  vi.mocked(isAdminUser).mockResolvedValue(true);
  return user;
}

describe.skipIf(!HAS_DB)('trust-dashboard server actions', () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockReset();
    vi.mocked(isAdminUser).mockReset();
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

  it('demoteTrustScope writes an override + audit log row', async () => {
    const user = await seedAdminUser();

    const result = await demoteTrustScope({
      demotedTo: 'OBSERVE_ONLY',
      reason: 'captcha spike',
      scope: {
        actionType: 'submit',
        atsFamily: 'greenhouse',
        hostname: 'job-boards.greenhouse.io',
        node: null,
        transition: null,
      },
    });

    const override = await db.runtimeTrustOverride.findUniqueOrThrow({
      where: { id: result.overrideId },
    });
    expect(override.demotedTo).toBe('OBSERVE_ONLY');
    expect(override.reason).toBe('captcha spike');
    expect(override.userId).toBe(user.id);
    expect(override.clearedAt).toBeNull();

    const audit = await db.automationAuditLog.findFirst({
      where: { action: 'MANUAL_TRUST_DEMOTE', userId: user.id },
    });
    expect(audit).not.toBeNull();
    const meta = audit?.metadata as Record<string, unknown> | null;
    expect(meta?.overrideId).toBe(result.overrideId);
    expect(meta?.demotedTo).toBe('OBSERVE_ONLY');
  });

  it('rejects an invalid trust level', async () => {
    await seedAdminUser();
    await expect(
      demoteTrustScope({
        demotedTo: 'NOT_A_LEVEL' as never,
        reason: 'x',
        scope: {
          actionType: 'submit',
          atsFamily: 'greenhouse',
          hostname: 'host.example',
          node: null,
          transition: null,
        },
      }),
    ).rejects.toThrow(/Invalid trust level/);
  });

  it('rejects demoting to FULL_AUTO', async () => {
    await seedAdminUser();
    await expect(
      demoteTrustScope({
        demotedTo: 'FULL_AUTO',
        reason: 'x',
        scope: {
          actionType: 'submit',
          atsFamily: 'greenhouse',
          hostname: 'host.example',
          node: null,
          transition: null,
        },
      }),
    ).rejects.toThrow(/not a demotable target/);
  });

  it('rejects empty reason', async () => {
    await seedAdminUser();
    await expect(
      demoteTrustScope({
        demotedTo: 'OBSERVE_ONLY',
        reason: '   ',
        scope: {
          actionType: 'submit',
          atsFamily: 'greenhouse',
          hostname: 'host.example',
          node: null,
          transition: null,
        },
      }),
    ).rejects.toThrow(/reason is required/);
  });

  it('clearTrustOverride sets clearedAt and writes an audit row', async () => {
    const user = await seedAdminUser();
    const { overrideId } = await demoteTrustScope({
      demotedTo: 'OBSERVE_ONLY',
      reason: 'investigating',
      scope: {
        actionType: 'submit',
        atsFamily: 'greenhouse',
        hostname: 'job-boards.greenhouse.io',
        node: null,
        transition: null,
      },
    });

    await clearTrustOverride(overrideId);

    const cleared = await db.runtimeTrustOverride.findUniqueOrThrow({
      where: { id: overrideId },
    });
    expect(cleared.clearedAt).not.toBeNull();

    const audits = await db.automationAuditLog.findMany({
      where: {
        action: 'MANUAL_TRUST_OVERRIDE_CLEARED',
        userId: user.id,
      },
    });
    expect(audits.length).toBe(1);
  });

  it('clearTrustOverride refuses to clear another user\'s override', async () => {
    const owner = await seedAdminUser();
    const { overrideId } = await demoteTrustScope({
      demotedTo: 'OBSERVE_ONLY',
      reason: 'mine',
      scope: {
        actionType: 'submit',
        atsFamily: 'greenhouse',
        hostname: 'host.example',
        node: null,
        transition: null,
      },
    });

    const intruder = await seedAdminUser();
    expect(intruder.id).not.toBe(owner.id);

    await expect(clearTrustOverride(overrideId)).rejects.toThrow(
      /Override not found/,
    );
  });
});
