import type { ConfirmationParser, ParsedConfirmation } from './types';

const SENDER_PATTERNS = [
  /@greenhouse\.io$/i,
  /@(?:us-)?greenhouse-mail\.io$/i,
  /no-?reply@([\w.-]+)>?\s*$/i,
];

const SUBJECT_PATTERNS = [
  /Thank you for applying to (.+?) at (.+)$/i,
  /Thanks for applying to (.+?) at (.+)$/i,
  /We received your application (?:to|for) (.+?) at (.+)$/i,
  /Application received: (.+?) at (.+)$/i,
];

const BODY_CONFIRMATION_PHRASES = [
  /thanks for applying/i,
  /thank you for applying/i,
  /your application (?:has been )?received/i,
  /application has been submitted/i,
];

function looksLikeGreenhouseSender(from: string): boolean {
  return SENDER_PATTERNS.some(re => re.test(from));
}

function hasGreenhouseFingerprint(body: string): boolean {
  if (BODY_CONFIRMATION_PHRASES.some(re => re.test(body))) return true;
  // Greenhouse emails frequently include the product footer.
  return /powered by greenhouse/i.test(body) || /greenhouse\.io/i.test(body);
}

export const parseGreenhouseConfirmation: ConfirmationParser = msg => {
  if (!looksLikeGreenhouseSender(msg.from) && !/greenhouse/i.test(msg.body)) {
    return null;
  }

  if (!hasGreenhouseFingerprint(msg.body)) return null;

  let role: string | null = null;
  let company: string | null = null;
  for (const re of SUBJECT_PATTERNS) {
    const match = msg.subject.match(re);
    if (match) {
      role = match[1]?.trim() ?? null;
      company = match[2]?.trim() ?? null;
      break;
    }
  }

  // Last-ditch body extraction: "apply(ing|ied) to the <Role> position at <Company>"
  if (!role || !company) {
    const bodyMatch = msg.body.match(
      /app(?:ly|ied|lying) (?:to|for) (?:the )?(.+?)(?: position)? at (.+?)(?:\.|,|!|\n)/i,
    );
    if (bodyMatch) {
      role = role ?? bodyMatch[1]?.trim() ?? null;
      company = company ?? bodyMatch[2]?.trim() ?? null;
    }
  }

  const dashboardUrl =
    msg.body.match(/https?:\/\/[^\s"<>]*greenhouse[^\s"<>]*/i)?.[0] ?? null;

  const confirmation: ParsedConfirmation = {
    company,
    dashboardUrl,
    family: 'greenhouse',
    receivedAt: msg.receivedAt,
    role,
    subject: msg.subject,
  };
  return confirmation;
};
