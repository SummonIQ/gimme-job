interface RawApplyOption {
  applyUrl?: string;
  buttonText?: string;
  link?: string;
  title?: string;
  url?: string;
}

export interface NormalizedApplyOption {
  buttonText?: string;
  link: string;
  title?: string;
}

export function isGoogleUrl(link: string): boolean {
  try {
    const hostname = new URL(link).hostname;
    return (
      hostname === 'google.com' ||
      hostname.endsWith('.google.com') ||
      hostname.endsWith('.googleapis.com') ||
      hostname.endsWith('.gstatic.com')
    );
  } catch {
    return false;
  }
}

function normalizeSingleApplyOption(
  option: RawApplyOption,
): NormalizedApplyOption | null {
  const link =
    typeof option.link === 'string'
      ? option.link
      : typeof option.url === 'string'
        ? option.url
        : typeof option.applyUrl === 'string'
          ? option.applyUrl
          : null;

  if (!link || !link.trim()) {
    return null;
  }

  if (isGoogleUrl(link)) {
    return null;
  }

  return {
    buttonText: option.buttonText,
    link: link.trim(),
    title: option.title,
  };
}

export function normalizeApplyOptions(
  input: unknown,
): NormalizedApplyOption[] {
  if (!input) {
    return [];
  }

  const rawOptions = Array.isArray(input) ? input : [input];

  return rawOptions
    .map(option =>
      option && typeof option === 'object'
        ? normalizeSingleApplyOption(option as RawApplyOption)
        : null,
    )
    .filter((option): option is NormalizedApplyOption => Boolean(option));
}

const AGGREGATOR_HOSTNAMES = new Set([
  'indeed.com',
  'linkedin.com',
  'glassdoor.com',
  'ziprecruiter.com',
  'monster.com',
  'simplyhired.com',
  'careerbuilder.com',
  'dice.com',
  'jooble.org',
  'adzuna.com',
  'talent.com',
  'neuvoo.com',
  'jobrapido.com',
]);

function isAggregatorUrl(link: string): boolean {
  try {
    const hostname = new URL(link).hostname.toLowerCase();
    return Array.from(AGGREGATOR_HOSTNAMES).some(
      agg => hostname === agg || hostname.endsWith(`.${agg}`),
    );
  } catch {
    return false;
  }
}

export function getPreferredApplyUrl(
  input: unknown,
  fallbackUrl?: string | null,
): string | null {
  const normalizedOptions = normalizeApplyOptions(input);
  const normalizedFallback =
    typeof fallbackUrl === 'string' && fallbackUrl.trim()
      ? fallbackUrl.trim()
      : null;

  if (normalizedOptions.length === 0) {
    return normalizedFallback;
  }

  const directLink = normalizedOptions.find(
    option => !isAggregatorUrl(option.link),
  );

  return directLink?.link ?? normalizedOptions[0]?.link ?? normalizedFallback;
}
