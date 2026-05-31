import type { ConfirmationParser, ParsedConfirmation } from './types';

const SENDER_PATTERNS = [
  /@ashbyhq\.com$/i,
  /@mail\.ashbyhq\.com$/i,
  /no-?reply@[\w.-]*ashby[\w.-]*/i,
];

const SUBJECT_PATTERNS = [
  /(?:Application|Submission) received\s*[:\-]\s*(.+?)\s+at\s+(.+)$/i,
  /Thank you for applying to (.+?) at (.+)$/i,
  /Your application to (.+?) at (.+)$/i,
];

const BODY_PHRASES = [
  /application received/i,
  /your application has been received/i,
  /thanks? for applying/i,
];

export const parseAshbyConfirmation: ConfirmationParser = msg => {
  const senderMatch = SENDER_PATTERNS.some(re => re.test(msg.from));
  if (!senderMatch && !/ashbyhq/i.test(msg.body)) return null;

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

  if (!role || !company) {
    const bodyMatch = msg.body.match(
      /applied (?:to|for) (?:the )?(.+?) (?:role|position) at (.+?)(?:\.|,|\n|!)/i,
    );
    if (bodyMatch) {
      role = role ?? bodyMatch[1]?.trim() ?? null;
      company = company ?? bodyMatch[2]?.trim() ?? null;
    }
  }

  const dashboardUrl =
    msg.body.match(/https?:\/\/(?:jobs\.)?ashbyhq\.com\/[^\s"<>]+/i)?.[0] ??
    null;

  const result: ParsedConfirmation = {
    company,
    dashboardUrl,
    family: 'ashby',
    receivedAt: msg.receivedAt,
    role,
    subject: msg.subject,
  };
  return result;
};
