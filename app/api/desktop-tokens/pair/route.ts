import { NextResponse } from 'next/server';

import { issuePairingCode } from '@/lib/desktop-tokens';
import { getCurrentUser } from '@/lib/user/query';

export async function POST() {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pairing = await issuePairingCode({ userId: user.id });

  return NextResponse.json({
    code: pairing.code,
    expiresAt: pairing.expiresAt.toISOString(),
    id: pairing.id,
  });
}
