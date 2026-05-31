import { NextResponse } from 'next/server';

import { db } from '@/lib/db/client';
import { validateToken } from '@/lib/desktop-tokens';
import { extractVerificationCode } from '@/lib/email/verification-code';

const RECENT_WINDOW_MS = 10 * 60 * 1000;

/**
 * GET /api/desktop/verification-code
 *
 * Returns the most recent one-time verification code received in the
 * user's inbox over the last 10 minutes (if any). The desktop assist
 * runtime calls this when it sees a Greenhouse field that asks for a
 * 4-8 digit verification code mid-application — instead of asking the
 * user to copy/paste, it auto-fills from the inbox.
 *
 * Optional query params:
 *   ?digits=8   Restrict to codes of exactly this digit count.
 *   ?since=ISO  Override the lookback window start.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const header = request.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/);
  const rawToken = match?.[1]?.trim();
  if (!rawToken) {
    return NextResponse.json(
      { error: 'Missing Bearer token' },
      { status: 401 },
    );
  }

  const validation = await validateToken(rawToken, {
    requireScope: 'desktop:runtime',
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 401 });
  }

  const url = new URL(request.url);
  const digitsParam = url.searchParams.get('digits');
  const requestedDigits =
    digitsParam && /^\d+$/.test(digitsParam)
      ? Number.parseInt(digitsParam, 10)
      : null;
  const sinceParam = url.searchParams.get('since');
  const since = sinceParam
    ? new Date(sinceParam)
    : new Date(Date.now() - RECENT_WINDOW_MS);

  const recentEmails = await db.applicationEmail.findMany({
    where: {
      userId: validation.token.userId,
      receivedAt: { gte: since },
    },
    orderBy: { receivedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      fromEmail: true,
      fromName: true,
      htmlBody: true,
      subject: true,
      textBody: true,
      receivedAt: true,
    },
  });

  for (const email of recentEmails) {
    const body = [email.textBody, email.htmlBody]
      .filter((value): value is string => Boolean(value?.trim()))
      .join('\n');
    const match = extractVerificationCode(body || null, email.subject);
    if (!match) continue;
    if (requestedDigits !== null && match.digits !== requestedDigits) {
      continue;
    }
    return NextResponse.json({
      code: match.code,
      digits: match.digits,
      emailId: email.id,
      fromEmail: email.fromEmail,
      fromName: email.fromName,
      receivedAt: email.receivedAt.toISOString(),
      subject: email.subject,
    });
  }

  // No matching code yet — return 200 with a null code instead of 404. The
  // endpoint exists and the lookup ran successfully; it just hasn't found
  // anything in the inbox window. 404 was misleading (and flooded dev logs
  // with red lines on every 30s poll tick).
  return NextResponse.json({ code: null });
}
