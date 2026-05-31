'use server';

import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db/client';
import { ConfirmationInboxProvider } from '@/generated/prisma/client';
import { encryptCredential } from '@/lib/email-ingestion/auth';
import { getCurrentUser } from '@/lib/user/query';

interface CreateInboxInput {
  readonly label: string;
  readonly provider: ConfirmationInboxProvider;
  readonly emailAddress: string;
  readonly imapHost?: string;
  readonly imapPort?: number;
  readonly imapSecure?: boolean;
  readonly imapUsername?: string;
  /**
   * For IMAP: the app password. For GMAIL/OUTLOOK: a refresh token (and,
   * optionally, `access_token\nrefresh_token`).
   */
  readonly secret: string;
  readonly scope?: string;
  readonly pollingCadenceSeconds?: number;
}

function requireString(value: string | undefined, field: string): string {
  if (!value || !value.trim()) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

export async function createConfirmationInbox(input: CreateInboxInput) {
  const user = await getCurrentUser();
  if (!user?.id) {
    throw new Error('Unauthorized');
  }

  const label = requireString(input.label, 'label');
  const emailAddress = requireString(input.emailAddress, 'emailAddress');
  const secret = requireString(input.secret, 'secret');

  if (input.provider === ConfirmationInboxProvider.IMAP) {
    requireString(input.imapHost, 'imapHost');
    if (
      !input.imapPort ||
      input.imapPort <= 0 ||
      !Number.isInteger(input.imapPort)
    ) {
      throw new Error('imapPort must be a positive integer');
    }
    requireString(input.imapUsername, 'imapUsername');
  }

  const encryptedSecret = encryptCredential(secret);

  const inbox = await db.confirmationInbox.create({
    data: {
      emailAddress,
      encryptedSecret,
      imapHost: input.imapHost ?? null,
      imapPort: input.imapPort ?? null,
      imapSecure: input.imapSecure ?? true,
      imapUsername: input.imapUsername ?? null,
      label,
      pollingCadenceSeconds: input.pollingCadenceSeconds ?? 300,
      provider: input.provider,
      scope: input.scope ?? null,
      userId: user.id,
    },
  });

  revalidatePath('/admin/confirmation-inboxes');
  return { id: inbox.id };
}

export async function deleteConfirmationInbox(inboxId: string) {
  const user = await getCurrentUser();
  if (!user?.id) {
    throw new Error('Unauthorized');
  }

  const inbox = await db.confirmationInbox.findUnique({
    where: { id: inboxId },
  });
  if (!inbox || inbox.userId !== user.id) {
    throw new Error('Inbox not found');
  }

  await db.confirmationInbox.delete({ where: { id: inboxId } });
  revalidatePath('/admin/confirmation-inboxes');
}

export async function toggleConfirmationInboxActive(inboxId: string) {
  const user = await getCurrentUser();
  if (!user?.id) {
    throw new Error('Unauthorized');
  }

  const inbox = await db.confirmationInbox.findUnique({
    where: { id: inboxId },
  });
  if (!inbox || inbox.userId !== user.id) {
    throw new Error('Inbox not found');
  }

  await db.confirmationInbox.update({
    data: { isActive: !inbox.isActive },
    where: { id: inboxId },
  });
  revalidatePath('/admin/confirmation-inboxes');
}
