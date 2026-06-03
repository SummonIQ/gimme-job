import { getRuntimeProviderForUrl } from './provider-registry.js';

export interface ConfirmationVerdict {
  readonly confirmed: boolean;
  readonly reason?: string;
}

interface ConfirmationPattern {
  readonly pattern: RegExp;
  readonly reason: string;
}

const CONFIRMATION_PATTERNS: Readonly<Record<string, readonly ConfirmationPattern[]>> = {
  ashby: [
    {
      pattern: /\bApplication Received\b/i,
      reason: 'Ashby application received heading',
    },
    {
      pattern: /\bApplication submitted\b/i,
      reason: 'Ashby application submitted heading',
    },
    {
      pattern: /\bThank you for your application\b/i,
      reason: 'Ashby thank-you confirmation',
    },
  ],
  greenhouse: [
    {
      pattern: /\bApplication submitted\b/i,
      reason: 'Greenhouse application submitted copy',
    },
    {
      pattern: /\bYour application has been submitted\b/i,
      reason: 'Greenhouse submitted confirmation',
    },
    {
      pattern: /\bThanks for applying\b/i,
      reason: 'Greenhouse thanks-for-applying copy',
    },
  ],
  lever: [
    {
      pattern: /\bThanks for applying!?\b/i,
      reason: 'Lever thanks-for-applying banner',
    },
    {
      pattern: /\bYour application has been submitted to\b/i,
      reason: 'Lever submitted-to-company confirmation',
    },
    {
      pattern: /\bWe['’]ve received your application\b/i,
      reason: 'Lever received-your-application copy',
    },
  ],
  smartrecruiters: [
    {
      pattern: /\bThank you for applying\b/i,
      reason: 'SmartRecruiters thank-you heading',
    },
    {
      pattern: /\bApplication\s+(?:successfully\s+)?submitted\b/i,
      reason: 'SmartRecruiters application submitted confirmation',
    },
    {
      pattern: /\bSuccessfully applied\b/i,
      reason: 'SmartRecruiters successfully applied heading',
    },
  ],
  workable: [
    {
      pattern: /\bApplication sent successfully\b/i,
      reason: 'Workable application sent banner',
    },
    {
      pattern: /\bThank you for your application\b/i,
      reason: 'Workable thank-you confirmation',
    },
    {
      pattern: /\bYour application was successfully submitted\b/i,
      reason: 'Workable successful submission phrase',
    },
  ],
};

export function detectConfirmation(
  url: string,
  html: string,
): ConfirmationVerdict {
  const providerId = getRuntimeProviderForUrl(url).id;
  const text = normalizeHtml(html);
  const patterns = CONFIRMATION_PATTERNS[providerId] ?? [];

  for (const pattern of patterns) {
    if (pattern.pattern.test(text)) {
      return { confirmed: true, reason: pattern.reason };
    }
  }

  return { confirmed: false };
}

function normalizeHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
