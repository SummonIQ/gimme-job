import { createHash, randomBytes } from 'node:crypto';

import { db } from '@/lib/db/client';
import type { DesktopToken } from '@/generated/prisma/client';

export const DEFAULT_SCOPES: readonly string[] = ['desktop:runtime'];
export const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;
export const PAIRING_CODE_DIGITS = 6;
export const TOKEN_PREFIX = 'gj_desk_';
export const TOKEN_SECRET_BYTES = 32;

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

export function generateRawToken(): string {
  const suffix = randomBytes(TOKEN_SECRET_BYTES).toString('base64url');
  return `${TOKEN_PREFIX}${suffix}`;
}

export function generatePairingCode(digits: number = PAIRING_CODE_DIGITS): string {
  // Digits only - easier to type on the desktop side.
  let out = '';
  const buf = randomBytes(digits);
  for (let i = 0; i < digits; i += 1) {
    out += String(buf[i] % 10);
  }
  return out;
}

export interface IssuePairingInput {
  readonly userId: string;
  readonly now?: Date;
  readonly ttlMs?: number;
}

export interface IssuedPairingCode {
  readonly code: string;
  readonly expiresAt: Date;
  readonly id: string;
}

export async function issuePairingCode(
  input: IssuePairingInput,
): Promise<IssuedPairingCode> {
  const now = input.now ?? new Date();
  const ttlMs = input.ttlMs ?? PAIRING_CODE_TTL_MS;
  const code = generatePairingCode();
  const row = await db.desktopPairingCode.create({
    data: {
      codeHash: hashToken(code),
      expiresAt: new Date(now.getTime() + ttlMs),
      userId: input.userId,
    },
  });
  return { code, expiresAt: row.expiresAt, id: row.id };
}

export interface ExchangeInput {
  readonly code: string;
  readonly deviceOs?: string | null;
  readonly label: string;
  readonly now?: Date;
}

export type ExchangeErrorReason =
  | 'CODE_NOT_FOUND'
  | 'CODE_EXPIRED'
  | 'CODE_ALREADY_CONSUMED';

export type ExchangeResult =
  | {
      readonly ok: true;
      readonly token: string;
      readonly tokenId: string;
      readonly userId: string;
    }
  | { readonly ok: false; readonly reason: ExchangeErrorReason };

export async function exchangePairingCode(
  input: ExchangeInput,
): Promise<ExchangeResult> {
  const now = input.now ?? new Date();
  const codeHash = hashToken(input.code.trim());

  const pairing = await db.desktopPairingCode.findUnique({
    where: { codeHash },
  });
  if (!pairing) {
    return { ok: false, reason: 'CODE_NOT_FOUND' };
  }
  if (pairing.consumedAt) {
    return { ok: false, reason: 'CODE_ALREADY_CONSUMED' };
  }
  if (pairing.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, reason: 'CODE_EXPIRED' };
  }

  const rawToken = generateRawToken();

  const token = await db.desktopToken.create({
    data: {
      deviceOs: input.deviceOs ?? null,
      label: input.label,
      scopes: [...DEFAULT_SCOPES],
      tokenHash: hashToken(rawToken),
      userId: pairing.userId,
    },
  });

  await db.desktopPairingCode.update({
    data: { consumedAt: now, consumedTokenId: token.id },
    where: { id: pairing.id },
  });

  return {
    ok: true,
    token: rawToken,
    tokenId: token.id,
    userId: pairing.userId,
  };
}

export interface ValidatedToken {
  readonly token: DesktopToken;
  readonly scopes: readonly string[];
}

export type ValidationError =
  | 'TOKEN_NOT_FOUND'
  | 'TOKEN_REVOKED'
  | 'TOKEN_EXPIRED'
  | 'SCOPE_MISSING';

export async function validateToken(
  rawToken: string,
  opts: { requireScope?: string; now?: Date } = {},
): Promise<
  | { readonly ok: true; readonly token: DesktopToken; readonly scopes: readonly string[] }
  | { readonly ok: false; readonly reason: ValidationError }
> {
  const now = opts.now ?? new Date();
  const token = await db.desktopToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });
  if (!token) return { ok: false, reason: 'TOKEN_NOT_FOUND' };
  if (token.revokedAt) return { ok: false, reason: 'TOKEN_REVOKED' };
  if (token.expiresAt && token.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, reason: 'TOKEN_EXPIRED' };
  }
  if (opts.requireScope && !token.scopes.includes(opts.requireScope)) {
    return { ok: false, reason: 'SCOPE_MISSING' };
  }

  // Touch lastUsedAt - best-effort, non-transactional. If the update
  // succeeds, return the refreshed row so callers see the new timestamp.
  try {
    const updated = await db.desktopToken.update({
      data: { lastUsedAt: now },
      where: { id: token.id },
    });
    return { ok: true, scopes: updated.scopes, token: updated };
  } catch {
    return { ok: true, scopes: token.scopes, token };
  }
}

export async function revokeToken(
  tokenId: string,
  opts: { reason?: string; now?: Date } = {},
): Promise<DesktopToken> {
  const now = opts.now ?? new Date();
  return db.desktopToken.update({
    data: {
      revokedAt: now,
      revokedReason: opts.reason ?? null,
    },
    where: { id: tokenId },
  });
}

export const __TESTING__ = {
  DEFAULT_SCOPES,
  PAIRING_CODE_DIGITS,
  PAIRING_CODE_TTL_MS,
  TOKEN_PREFIX,
};
