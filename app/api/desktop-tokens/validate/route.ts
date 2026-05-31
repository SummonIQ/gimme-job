import { NextResponse } from 'next/server';

import { validateToken } from '@/lib/desktop-tokens';

/**
 * Desktop clients post their token here to verify it. Mostly a debugging /
 * warm-path aid; real token checks happen inline in each API route via
 * validateToken() directly.
 */
export async function POST(request: Request) {
  const header = request.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/);
  const rawToken = match?.[1]?.trim();

  if (!rawToken) {
    return NextResponse.json({ error: 'Missing Bearer token' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requireScope = searchParams.get('scope') ?? undefined;

  const result = await validateToken(rawToken, { requireScope });
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 401 });
  }

  return NextResponse.json({
    scopes: result.scopes,
    tokenId: result.token.id,
    userId: result.token.userId,
  });
}
