import { NextResponse, type NextRequest } from 'next/server';

import { getBestApplyOption, type ApplyOption } from '@/lib/guided-applications';
import { getCurrentUser } from '@/lib/user/query';

const HIGH_BOT_PROTECTION_HOST_PATTERNS = [
  'google.com',
  'googleapis.com',
  'gstatic.com',
  'linkedin.com',
  'indeed.com',
  'glassdoor.com',
  'ziprecruiter.com',
  'monster.com',
  'simplyhired.com',
];

const isHighBotProtectionHost = (url: string): boolean => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return HIGH_BOT_PROTECTION_HOST_PATTERNS.some(
      pattern => hostname === pattern || hostname.endsWith(`.${pattern}`),
    );
  } catch {
    return false;
  }
};

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as {
    applyOptions?: Array<Partial<ApplyOption>>;
    fallbackApplyUrl?: string | null;
    jobProvider?: string | null;
  };

  const normalizedOptions = Array.isArray(body.applyOptions)
    ? body.applyOptions
        .map(option => ({
          buttonText: option.buttonText,
          link: (option.link ?? '').trim(),
          method: option.method,
          title: option.title,
        }))
        .filter(option => Boolean(option.link))
    : [];

  const provider = (body.jobProvider ?? '').trim().toUpperCase();
  const candidateOptions =
    provider === 'SERPAPI'
      ? (() => {
          const nonProtected = normalizedOptions.filter(
            option => !isHighBotProtectionHost(option.link),
          );
          return nonProtected.length > 0 ? nonProtected : normalizedOptions;
        })()
      : normalizedOptions;

  const bestOption = await getBestApplyOption(candidateOptions);
  const bestApplyUrl =
    bestOption?.link || body.fallbackApplyUrl || candidateOptions[0]?.link || null;

  return NextResponse.json({
    bestApplyUrl,
    bestOption,
  });
}
