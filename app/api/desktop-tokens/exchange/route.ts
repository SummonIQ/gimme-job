import { NextResponse } from 'next/server';
import { z } from 'zod';

import { exchangePairingCode } from '@/lib/desktop-tokens';

/**
 * Unauthenticated endpoint - the desktop client calls this with the
 * pairing code the user showed it. The pairing code itself is the
 * authorization; no session cookie is required.
 */
const BodySchema = z.object({
  code: z.string().min(4).max(16),
  deviceOs: z.string().max(100).optional(),
  label: z.string().min(1).max(100),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await exchangePairingCode(parsed.data);
  if (!result.ok) {
    const status =
      result.reason === 'CODE_NOT_FOUND'
        ? 404
        : result.reason === 'CODE_EXPIRED'
          ? 410
          : 409;
    return NextResponse.json({ error: result.reason }, { status });
  }

  // The raw token is returned ONCE. The client must store it immediately.
  return NextResponse.json({
    token: result.token,
    tokenId: result.tokenId,
    userId: result.userId,
  });
}
