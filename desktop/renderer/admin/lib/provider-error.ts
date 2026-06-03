// Mirrors app/(app)/admin/listings/listings-tabs.tsx::categorizeProviderError
// + getProviderErrorInfo so the desktop port renders the same human-friendly
// error labels (Out of API credits / Browser runtime required / etc.) the
// web admin shipped after the TheirStack 402 work.

export type ProviderErrorCategory =
  | 'credits'
  | 'auth'
  | 'runtime'
  | 'rateLimit'
  | 'botBlock'
  | 'transport'
  | 'failed';

export interface ProviderErrorInfo {
  category: ProviderErrorCategory;
  badgeLabel: string;
  badgeClassName: string;
  shortMessage: string;
}

const PROVIDER_ERROR_BADGES: Record<
  ProviderErrorCategory,
  { label: string; className: string }
> = {
  auth: {
    className: 'bg-amber-500/10 text-amber-300',
    label: 'API key missing',
  },
  botBlock: {
    className: 'bg-red-500/10 text-red-300',
    label: 'Bot challenge blocked',
  },
  credits: {
    className: 'bg-amber-500/10 text-amber-300',
    label: 'Out of API credits',
  },
  failed: {
    className: 'bg-red-500/10 text-red-300',
    label: 'Last run failed',
  },
  rateLimit: {
    className: 'bg-amber-500/10 text-amber-300',
    label: 'Rate limited',
  },
  runtime: {
    className: 'bg-amber-500/10 text-amber-300',
    label: 'Browser runtime required',
  },
  transport: {
    className: 'bg-red-500/10 text-red-300',
    label: 'Transport error',
  },
};

export const categorizeProviderError = (
  rawError: string | null | undefined,
): ProviderErrorCategory => {
  if (!rawError) return 'failed';
  const lower = rawError.toLowerCase();
  if (
    /\b402\b/.test(rawError) ||
    /e-?007/i.test(rawError) ||
    /not enough (api )?credits/i.test(rawError) ||
    /upgrade your plan/i.test(rawError) ||
    /credits to perform/i.test(rawError)
  ) {
    return 'credits';
  }
  if (/datadome|captcha/i.test(rawError)) return 'botBlock';
  if (/\b429\b/.test(rawError) || /rate limit/i.test(rawError)) {
    return 'rateLimit';
  }
  if (/chromium|playwright|requires a chromium runtime/i.test(rawError)) {
    return 'runtime';
  }
  if (
    /\b401\b/.test(rawError) ||
    /\b403\b/.test(rawError) ||
    /api key/i.test(lower) ||
    /required env/i.test(lower) ||
    /set [a-z0-9_]+_(api)?_?key/i.test(lower)
  ) {
    return 'auth';
  }
  if (
    /\bECONN/i.test(rawError) ||
    /timeout/i.test(rawError) ||
    /unexpected status code 413/i.test(rawError)
  ) {
    return 'transport';
  }
  return 'failed';
};

const summarizeProviderError = (
  rawError: string | null | undefined,
  category: ProviderErrorCategory,
): string => {
  if (!rawError) return PROVIDER_ERROR_BADGES[category].label;
  const jsonMatch = rawError.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as {
        error?: { title?: string; description?: string };
      };
      const title = parsed.error?.title;
      const description = parsed.error?.description;
      if (title || description) {
        return [title, description].filter(Boolean).join(' — ');
      }
    } catch {
      /* ignore */
    }
  }
  if (category === 'runtime') {
    return 'This provider needs a Chromium browser runtime to run.';
  }
  return rawError;
};

export const getProviderErrorInfo = (
  rawError: string | null | undefined,
): ProviderErrorInfo => {
  const category = categorizeProviderError(rawError);
  const badge = PROVIDER_ERROR_BADGES[category];
  return {
    badgeClassName: badge.className,
    badgeLabel: badge.label,
    category,
    shortMessage: summarizeProviderError(rawError, category),
  };
};
