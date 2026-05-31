import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

import { db } from '@/lib/db/client';
import {
  ConfirmationInboxProvider,
  type ConfirmationInbox,
} from '@/generated/prisma/client';

const ENC_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const CURRENT_KEY_VERSION = 1;
const ENV_VAR = 'CONFIRMATION_INBOX_ENCRYPTION_KEY';

function getEncryptionKey(): Buffer {
  const raw = process.env[ENV_VAR];
  if (!raw) {
    throw new Error(
      `${ENV_VAR} is required to encrypt or decrypt confirmation-inbox credentials.`,
    );
  }
  // SHA-256 derives a 32-byte key from any-length input so we don't require
  // callers to supply exactly 32 bytes of base64.
  return createHash('sha256').update(raw, 'utf8').digest();
}

export function encryptCredential(plaintext: string): string {
  if (!plaintext) {
    throw new Error('encryptCredential: plaintext must not be empty');
  }
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ENC_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    `v${CURRENT_KEY_VERSION}`,
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

export function decryptCredential(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 4) {
    throw new Error('decryptCredential: malformed payload');
  }
  const [version, ivB64, tagB64, dataB64] = parts;
  if (version !== `v${CURRENT_KEY_VERSION}`) {
    throw new Error(`decryptCredential: unsupported key version ${version}`);
  }
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  if (iv.length !== IV_LENGTH || tag.length !== AUTH_TAG_LENGTH) {
    throw new Error('decryptCredential: invalid iv or tag length');
  }
  const key = getEncryptionKey();
  const decipher = createDecipheriv(ENC_ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return plaintext.toString('utf8');
}

export interface ImapConnectionConfig {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly username: string;
  readonly password: string;
}

export interface OAuthTokenBundle {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly scope: string | null;
}

export type InboxAuthResult =
  | {
      readonly provider: typeof ConfirmationInboxProvider.IMAP;
      readonly imap: ImapConnectionConfig;
      readonly lastSeenUid: string | null;
    }
  | {
      readonly provider:
        | typeof ConfirmationInboxProvider.GMAIL
        | typeof ConfirmationInboxProvider.OUTLOOK;
      readonly oauth: OAuthTokenBundle;
      readonly lastSeenUid: string | null;
    };

export function resolveInboxAuth(inbox: ConfirmationInbox): InboxAuthResult {
  const secret = decryptCredential(inbox.encryptedSecret);

  if (inbox.provider === ConfirmationInboxProvider.IMAP) {
    if (!inbox.imapHost || !inbox.imapPort || !inbox.imapUsername) {
      throw new Error(
        `Inbox ${inbox.id} (IMAP) is missing host/port/username.`,
      );
    }
    return {
      imap: {
        host: inbox.imapHost,
        password: secret,
        port: inbox.imapPort,
        secure: inbox.imapSecure,
        username: inbox.imapUsername,
      },
      lastSeenUid: inbox.lastSeenUid,
      provider: ConfirmationInboxProvider.IMAP,
    };
  }

  // Stored credential for OAuth providers is `refresh_token` (single value) or
  // `access_token\nrefresh_token` if both are cached. P10.5 ships without an
  // auto-refresh client — the OAuth codepath is stubbed and will be completed
  // by the P10.2 worker once the real Gmail/Outlook clients are wired.
  const lines = secret.split('\n');
  const refreshToken = lines[lines.length - 1] ?? '';
  const accessToken = lines.length > 1 ? (lines[0] ?? '') : '';

  return {
    lastSeenUid: inbox.lastSeenUid,
    oauth: {
      accessToken,
      refreshToken,
      scope: inbox.scope,
    },
    provider: inbox.provider,
  };
}

export async function loadAuthenticatedInbox(
  inboxId: string,
): Promise<InboxAuthResult> {
  const inbox = await db.confirmationInbox.findUniqueOrThrow({
    where: { id: inboxId },
  });
  if (!inbox.isActive) {
    throw new Error(`Inbox ${inboxId} is inactive`);
  }
  return resolveInboxAuth(inbox);
}

export async function recordPoll(
  inboxId: string,
  lastSeenUid: string | null,
  now: Date = new Date(),
): Promise<void> {
  await db.confirmationInbox.update({
    data: {
      lastPolledAt: now,
      ...(lastSeenUid !== null ? { lastSeenUid } : {}),
    },
    where: { id: inboxId },
  });
}

export const __TESTING__ = {
  CURRENT_KEY_VERSION,
  ENV_VAR,
};
