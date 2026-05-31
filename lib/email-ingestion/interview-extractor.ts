import type { EmailMessage } from './parsers';

export type InterviewFormat = 'PHONE' | 'VIDEO' | 'ONSITE' | 'UNKNOWN';

export interface ProposedTime {
  /**
   * Canonical ISO-8601 timestamp when we can resolve both a date and a time
   * from the message. Left null when we only got a day-of-week ("Thursday
   * 2pm PT" without a concrete date referenced nearby).
   */
  readonly iso: string | null;
  /** The exact substring we extracted the time from, for debugging. */
  readonly rawText: string;
}

export interface ExtractedInterviewInvite {
  readonly format: InterviewFormat;
  readonly interviewerName: string | null;
  readonly interviewerEmail: string | null;
  readonly proposedTimes: readonly ProposedTime[];
  readonly meetingLink: string | null;
  /** Confidence score in [0, 1]. */
  readonly confidence: number;
  readonly reasons: readonly string[];
}

const VIDEO_HOSTS = [
  'zoom.us',
  'meet.google.com',
  'teams.microsoft.com',
  'teams.live.com',
  'whereby.com',
  'skype.com',
];

const PHONE_CUES = [
  /\bphone (?:call|screen|interview|chat)\b/i,
  /\b(?:give (?:me )?a )?call\b/i,
  /\b(?:\+?\d[\d\s().-]{7,})\b/,
];

const ONSITE_CUES = [
  /\bonsite\b/i,
  /\bon-site\b/i,
  /\bin[- ]person\b/i,
  /\bat our (?:office|hq|campus)\b/i,
  /\b(?:visit|come to) our (?:office|hq)\b/i,
];

const DAY_NAMES = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

function extractMeetingLink(text: string): string | null {
  for (const host of VIDEO_HOSTS) {
    const re = new RegExp(
      `https?://[^\\s<>"]*${host.replace('.', '\\.')}[^\\s<>"]*`,
      'i',
    );
    const m = text.match(re);
    if (m) return m[0];
  }
  return null;
}

function detectFormat(text: string, meetingLink: string | null): {
  format: InterviewFormat;
  reason: string;
} {
  if (meetingLink) return { format: 'VIDEO', reason: 'video-meeting-link' };

  for (const re of ONSITE_CUES) {
    if (re.test(text)) return { format: 'ONSITE', reason: 'onsite-cue' };
  }

  if (/\b(?:video (?:call|chat|interview)|zoom|google meet|teams)\b/i.test(text)) {
    return { format: 'VIDEO', reason: 'video-keyword' };
  }

  for (const re of PHONE_CUES) {
    if (re.test(text)) return { format: 'PHONE', reason: 'phone-cue' };
  }

  return { format: 'UNKNOWN', reason: 'no-format-signal' };
}

function parseTimePhrase(raw: string, reference: Date): string | null {
  // Normalize things like "2pm", "2 PM", "2:30 pm", "14:00".
  const trimmed = raw.trim();
  const dayIndex = DAY_NAMES.findIndex(d =>
    new RegExp(`\\b${d}\\b`, 'i').test(trimmed),
  );
  const monthMatch = trimmed.match(
    new RegExp(`\\b(${MONTH_NAMES.join('|')})\\s+(\\d{1,2})\\b`, 'i'),
  );
  const timeMatch = trimmed.match(
    /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)\b/,
  );

  const target = new Date(reference.getTime());

  if (monthMatch) {
    const monthIdx = MONTH_NAMES.indexOf(monthMatch[1].toLowerCase());
    const day = Number(monthMatch[2]);
    target.setUTCMonth(monthIdx);
    target.setUTCDate(day);
  } else if (dayIndex >= 0) {
    const todayIdx = target.getUTCDay();
    const delta = (dayIndex + 1 - todayIdx + 7) % 7 || 7;
    target.setUTCDate(target.getUTCDate() + delta);
  } else if (!timeMatch) {
    return null;
  }

  if (timeMatch) {
    let hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2] ?? '0');
    const meridiem = timeMatch[3].toLowerCase();
    if (meridiem === 'pm' && hours !== 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    target.setUTCHours(hours, minutes, 0, 0);
  } else {
    // Day only — neutral midday anchor.
    target.setUTCHours(12, 0, 0, 0);
  }

  return target.toISOString();
}

function extractProposedTimes(
  text: string,
  reference: Date,
): ProposedTime[] {
  const found: ProposedTime[] = [];
  const seen = new Set<string>();

  const patterns: RegExp[] = [
    new RegExp(
      `\\b(?:${DAY_NAMES.join('|')})\\s+(?:at\\s+)?\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)\\b`,
      'gi',
    ),
    new RegExp(
      `\\b(?:${MONTH_NAMES.join('|')})\\s+\\d{1,2}(?:st|nd|rd|th)?(?:\\s+at\\s+\\d{1,2}(?::\\d{2})?\\s*(?:am|pm))?\\b`,
      'gi',
    ),
    /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi,
    /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi,
  ];

  for (const re of patterns) {
    for (const match of text.matchAll(re)) {
      const raw = match[0];
      if (seen.has(raw.toLowerCase())) continue;
      seen.add(raw.toLowerCase());
      found.push({ iso: parseTimePhrase(raw, reference), rawText: raw });
    }
  }

  return found;
}

function extractInterviewerName(
  msg: EmailMessage,
  body: string,
): { name: string | null; email: string | null } {
  const fromMatch = msg.from.match(/^\s*"?([^"<]+?)"?\s*<([^>]+)>\s*$/);
  const fromName = fromMatch?.[1]?.trim() ?? null;
  const fromEmail = fromMatch?.[2]?.trim() ?? msg.from.trim();

  // Signatures often end with "Best," or "Regards," followed by a name on
  // the next line. Pick the first line after the closing.
  const sigMatch = body.match(
    /(?:^|\n)\s*(?:best|thanks|regards|cheers|sincerely)[,!.]*\s*\n+\s*([A-Z][a-zA-Z'.-]+(?:\s+[A-Z][a-zA-Z'.-]+){0,2})/i,
  );
  const sigName = sigMatch?.[1] ?? null;

  // "This is <Name> from <Company>" style introductions.
  const introMatch = body.match(
    /\bI['']?m\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/,
  );
  const introName = introMatch?.[1] ?? null;

  const name = sigName ?? introName ?? fromName ?? null;
  return { email: fromEmail || null, name };
}

export function extractInterviewInvite(
  msg: EmailMessage,
): ExtractedInterviewInvite {
  const text = `${msg.subject}\n${msg.body}`;
  const meetingLink = extractMeetingLink(msg.body);
  const { format, reason: formatReason } = detectFormat(text, meetingLink);
  const proposedTimes = extractProposedTimes(msg.body, msg.receivedAt);
  const { name, email } = extractInterviewerName(msg, msg.body);

  const reasons: string[] = [formatReason];
  let score = 0;
  if (format !== 'UNKNOWN') score += 2;
  if (proposedTimes.length > 0) {
    score += Math.min(3, proposedTimes.length);
    reasons.push(`${proposedTimes.length}-time-candidate(s)`);
  }
  if (name) {
    score += 1;
    reasons.push('interviewer-name-resolved');
  }
  if (meetingLink) {
    score += 1;
    reasons.push('meeting-link');
  }

  const confidence = Math.min(0.99, Math.max(0.1, score / 6));

  return {
    confidence,
    format,
    interviewerEmail: email,
    interviewerName: name,
    meetingLink,
    proposedTimes,
    reasons,
  };
}
