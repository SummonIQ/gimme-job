'use server';

import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db/client';
import {
  issuePairingCode,
  revokeToken,
  type IssuedPairingCode,
} from '@/lib/desktop-tokens';
import { getCurrentUser } from '@/lib/user/query';

export async function createPairingCodeAction(): Promise<IssuedPairingCode> {
  const user = await getCurrentUser();
  if (!user?.id) {
    throw new Error('Unauthorized');
  }
  const issued = await issuePairingCode({ userId: user.id });
  revalidatePath('/admin/desktop-tokens');
  return issued;
}

export async function revokeDesktopTokenAction(
  tokenId: string,
  reason?: string,
) {
  const user = await getCurrentUser();
  if (!user?.id) {
    throw new Error('Unauthorized');
  }
  const existing = await db.desktopToken.findUnique({
    where: { id: tokenId },
  });
  if (!existing || existing.userId !== user.id) {
    throw new Error('Token not found');
  }
  await revokeToken(tokenId, { reason });
  revalidatePath('/admin/desktop-tokens');
}
