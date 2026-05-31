import type { ConfirmationParser, ParsedConfirmation } from './types';

const SENDER_PATTERNS = [
  /@hire\.lever\.co$/i,
  /@lever\.co$/i,
  /no-?reply@[\w.-]*lever[\w.-]*/i,
];

const SUBJECT_PATTERNS = [
  /Application received(?:\s*[:\-]\s*(.+?)\s+at\s+(.+))?$/i,
  /We received your application to (.+?) at (.+)$/i,
  /Thanks for applying to (.+?) at (.+)$/i,
];

const BODY_PHRASES = [
  /we(?:['']ve| have)? received your application/i,
  /thanks for applying/i,
  /application has been received/i,
];

export const parseLeverConfirmation: ConfirmationParser = msg => {
  const senderMatch = SENDER_PATTERNS.some(re => re.test(msg.from));
  if (!senderMatch && !/lever\.co/i.test(msg.body)) return null;

  if (!BODY_PHRASES.some(re => re.test(msg.body))) return null;

  let role: string | null = null;
  let company: string | null = null;
  for (const re of SUBJECT_PATTERNS) {
    const match = msg.subject.match(re);
    if (match?.[1] && match?.[2]) {
      role = match[1].trim();
      company = match[2].trim();
      break;
    }
  }

  // Lever bodies frequently include "Your application for <Role> at <Company>
  // has been received."
  if (!role || !company) {
    const bodyMatch = msg.body.match(
      /application (?:to|for) (?:the )?(.+?) at (.+?)\s+(?:has|was)\s+(?:been\s+)?received/i,
    );
    if (bodyMatch) {
      role = role ?? bodyMatch[1]?.trim() ?? null;
      company = company ?? bodyMatch[2]?.trim() ?? null;
    }
  }

  const dashboardUrl =
    msg.body.match(/https?:\/\/(?:jobs\.)?lever\.co\/[^\s"<>]+/i)?.[0] ?? null;

  const result: ParsedConfirmation = {
    company,
    dashboardUrl,
    family: 'lever',
    receivedAt: msg.receivedAt,
    role,
    subject: msg.subject,
  };
  return result;
};
