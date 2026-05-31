import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { Page } from '@/components/layout/page';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';

import {
  DesktopTokensClient,
  type TokenRow,
} from './_components/tokens-client';

export const metadata: Metadata = {
  description: 'Manage desktop pairing and long-lived API tokens.',
  title: 'Desktop devices | Gimme Job',
};

export default async function DesktopTokensPage() {
  const user = await getCurrentUser();
  if (!user?.id) redirect('/login');

  const tokens = await db.desktopToken.findMany({
    orderBy: [{ revokedAt: 'asc' }, { issuedAt: 'desc' }],
    where: { userId: user.id },
  });

  const rows: TokenRow[] = tokens.map(token => ({
    deviceOs: token.deviceOs,
    id: token.id,
    issuedAt: token.issuedAt.toISOString(),
    label: token.label,
    lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
    revokedAt: token.revokedAt?.toISOString() ?? null,
    scopes: token.scopes,
  }));

  return (
    <Page name="admin_desktop_tokens">
      <DesktopTokensClient tokens={rows} />
    </Page>
  );
}
