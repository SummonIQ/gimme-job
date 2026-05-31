// @vitest-environment node
import { db } from '@/lib/db/client';
import { afterAll, describe, expect, it } from 'vitest';

import {
  DEFAULT_SCOPES,
  exchangePairingCode,
  hashToken,
  issuePairingCode,
  revokeToken,
  validateToken,
} from '../index';

const HAS_DB = Boolean(process.env.DATABASE_URL);

let fixtureCounter = 0;
function nextSuffix() {
  fixtureCounter += 1;
  return `p5-4-${Date.now()}-${fixtureCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

const createdUserIds: string[] = [];

async function seedUser() {
  const suffix = nextSuffix();
  const user = await db.user.create({
    data: {
      email: `desktop-token-${suffix}@test.local`,
      firstName: 'Desktop',
      lastName: 'Token',
    },
  });
  createdUserIds.push(user.id);
  return user;
}

describe.skipIf(!HAS_DB)('desktop-tokens lib (integration)', () => {
  afterAll(async () => {
    for (const userId of createdUserIds) {
      await db.desktopToken
        .deleteMany({ where: { userId } })
        .catch(() => undefined);
      await db.desktopPairingCode
        .deleteMany({ where: { userId } })
        .catch(() => undefined);
      await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
  });

  it('pair-code issue + exchange produces a working token', async () => {
    const user = await seedUser();
    const pairing = await issuePairingCode({ userId: user.id });
    expect(pairing.code).toMatch(/^[0-9]{6}$/);
    expect(pairing.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const exchange = await exchangePairingCode({
      code: pairing.code,
      deviceOs: 'darwin-24.4.0',
      label: 'Steven MacBook Pro',
    });
    expect(exchange.ok).toBe(true);
    if (!exchange.ok) return;
    expect(exchange.userId).toBe(user.id);
    expect(exchange.token).toMatch(/^gj_desk_/);

    const validated = await validateToken(exchange.token);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(validated.token.userId).toBe(user.id);
    expect(validated.scopes).toEqual([...DEFAULT_SCOPES]);
    // lastUsedAt was touched.
    expect(validated.token.lastUsedAt).not.toBeNull();

    // Raw token is NOT in the DB - only the hash.
    const stored = await db.desktopToken.findUniqueOrThrow({
      where: { id: exchange.tokenId },
    });
    expect(stored.tokenHash).toBe(hashToken(exchange.token));
    // The raw token string must NOT appear anywhere in the row.
    expect(JSON.stringify(stored)).not.toContain(exchange.token);
  });

  it('exchange rejects an unknown code', async () => {
    const result = await exchangePairingCode({
      code: '999999',
      label: 'x',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('CODE_NOT_FOUND');
  });

  it('exchange rejects an expired code', async () => {
    const user = await seedUser();
    const pairing = await issuePairingCode({
      ttlMs: -1000, // already expired
      userId: user.id,
    });

    const result = await exchangePairingCode({
      code: pairing.code,
      label: 'x',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('CODE_EXPIRED');
  });

  it('exchange rejects a code that has already been consumed', async () => {
    const user = await seedUser();
    const pairing = await issuePairingCode({ userId: user.id });

    const first = await exchangePairingCode({ code: pairing.code, label: 'first' });
    expect(first.ok).toBe(true);

    const second = await exchangePairingCode({ code: pairing.code, label: 'second' });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.reason).toBe('CODE_ALREADY_CONSUMED');
  });

  it('validateToken rejects an unknown token', async () => {
    const result = await validateToken('gj_desk_not-a-real-token');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('TOKEN_NOT_FOUND');
  });

  it('validateToken rejects a revoked token', async () => {
    const user = await seedUser();
    const pairing = await issuePairingCode({ userId: user.id });
    const exchange = await exchangePairingCode({
      code: pairing.code,
      label: 'to-revoke',
    });
    expect(exchange.ok).toBe(true);
    if (!exchange.ok) return;

    await revokeToken(exchange.tokenId, { reason: 'lost device' });
    const result = await validateToken(exchange.token);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('TOKEN_REVOKED');
  });

  it('validateToken rejects when the required scope is missing', async () => {
    const user = await seedUser();
    const pairing = await issuePairingCode({ userId: user.id });
    const exchange = await exchangePairingCode({
      code: pairing.code,
      label: 'limited',
    });
    expect(exchange.ok).toBe(true);
    if (!exchange.ok) return;

    const result = await validateToken(exchange.token, {
      requireScope: 'desktop:audit',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('SCOPE_MISSING');
  });

  it('revokeToken sets revokedAt and persists the reason', async () => {
    const user = await seedUser();
    const pairing = await issuePairingCode({ userId: user.id });
    const exchange = await exchangePairingCode({
      code: pairing.code,
      label: 'revoke-test',
    });
    expect(exchange.ok).toBe(true);
    if (!exchange.ok) return;

    const revoked = await revokeToken(exchange.tokenId, {
      reason: 'compromised',
    });
    expect(revoked.revokedAt).not.toBeNull();
    expect(revoked.revokedReason).toBe('compromised');
  });
});
