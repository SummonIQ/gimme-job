import type { EmailMessage } from './parsers';

export type InboundEmailClass =
  | 'INTERVIEW_INVITE'
  | 'REJECTION'
  | 'AUTO_RESPONSE'
  | 'REPLY'
  | 'NOISE';

export interface ClassificationResult {
  readonly label: InboundEmailClass;
  readonly confidence: number;
  readonly reasons: readonly string[];
  /**
   * True when an `In-Reply-To` header identifies this as part of an existing
   * thread. The caller can use this together with the label to promote
   * ambiguous `REPLY` classifications.
   */
  readonly isThreadedReply: boolean;
}

export interface ClassificationInput extends EmailMessage {
  /**
   * RFC 5322 `In-Reply-To` header value, if present. Used by the thread
   * heuristic — a reply that threads against a known outbound confirmation
   * is never NOISE.
   */
  readonly inReplyTo?: string | null;
}

interface Rule {
  readonly label: InboundEmailClass;
  readonly weight: number;
  readonly match: (text: string, subject: string) => boolean;
  readonly why: string;
}

const INTERVIEW_RULES: Rule[] = [
  {
    label: 'INTERVIEW_INVITE',
    match: (text, subject) =>
      /\b(?:schedule|book|set up|arrange)\b.{0,40}\binterview\b/i.test(text) ||
      /\binterview\b.{0,60}\b(?:time|slot|availability|calendar)\b/i.test(
        text,
      ) ||
      /\binterview (?:invitation|invite)\b/i.test(subject),
    weight: 4,
    why: 'interview-schedule-phrase',
  },
  {
    label: 'INTERVIEW_INVITE',
    match: text =>
      /\b(?:are you (?:free|available)|could you do|does .{0,20}(?:work|suit))\b/i.test(
        text,
      ) && /\b(?:call|meet|chat|zoom|google meet|teams|hangout)\b/i.test(text),
    weight: 3,
    why: 'availability-+-meeting-medium',
  },
  {
    label: 'INTERVIEW_INVITE',
    match: text => /\bcalendly\.com\/|\b(zoom|meet\.google\.com|teams\.microsoft)\b/i.test(text),
    weight: 2,
    why: 'calendar-or-videolink',
  },
  {
    label: 'INTERVIEW_INVITE',
    match: (text, subject) =>
      /\b(?:interview|phone screen|phone call|video call|chat)\b/i.test(
        `${subject} ${text}`,
      ) &&
      /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d+\s*(?:am|pm)|\d+-minute|\d+\s*min(?:ute)?s?|first-round|second-round|final round)\b/i.test(
        text,
      ),
    weight: 3,
    why: 'interview-keyword-+-time-signal',
  },
  {
    label: 'INTERVIEW_INVITE',
    match: text =>
      /\b(?:sharing|share)\s+(?:my\s+)?availability\b/i.test(text) ||
      /\b(?:availability for|times? that (?:would |could )?works?|times? that suit)\b/i.test(
        text,
      ),
    weight: 2,
    why: 'availability-offer',
  },
];

const REJECTION_RULES: Rule[] = [
  {
    label: 'REJECTION',
    match: text =>
      /\b(?:unfortunately|regret to inform|we are unable)\b.{0,80}\b(?:position|role|opportunity|application|candidacy|offer)\b/i.test(
        text,
      ),
    weight: 4,
    why: 'regret-phrase-near-position',
  },
  {
    label: 'REJECTION',
    match: text =>
      /\b(?:not moving forward|will not be moving forward|won't be moving forward|not be moving forward)\b/i.test(
        text,
      ) ||
      /\b(?:decided to (?:pursue|move forward with) (?:other|another))\b/i.test(
        text,
      ) ||
      /\b(?:position has been filled|role has been filled|filled the (?:position|role))\b/i.test(
        text,
      ),
    weight: 4,
    why: 'canonical-rejection-phrase',
  },
  {
    label: 'REJECTION',
    match: (_text, subject) =>
      /\b(?:regarding your application|update on your application)\b/i.test(
        subject,
      ),
    weight: 1,
    why: 'status-update-subject',
  },
];

const AUTO_RESPONSE_RULES: Rule[] = [
  {
    label: 'AUTO_RESPONSE',
    match: text =>
      /\bthis (?:email|mailbox|message)\b.{0,40}\b(?:not monitored|unmonitored|automated|auto-?generated)\b/i.test(
        text,
      ),
    weight: 4,
    why: 'unmonitored-mailbox',
  },
  {
    label: 'AUTO_RESPONSE',
    match: text =>
      /\bdo not reply\b/i.test(text) ||
      /\bplease do not respond\b/i.test(text) ||
      /\bauto(?:matic|mated)? (?:reply|response)\b/i.test(text),
    weight: 3,
    why: 'do-not-reply',
  },
  {
    label: 'AUTO_RESPONSE',
    match: (_text, subject) =>
      /\b(?:auto(?:mated|matic)?|out of office)\b/i.test(subject),
    weight: 2,
    why: 'auto-subject',
  },
];

const REPLY_RULES: Rule[] = [
  {
    label: 'REPLY',
    match: text =>
      /\b(?:thanks for (?:reaching out|applying|your interest)|great to (?:hear|meet) you|following up|wanted to (?:follow|loop|circle) back)\b/i.test(
        text,
      ),
    weight: 2,
    why: 'recruiter-conversational',
  },
  {
    label: 'REPLY',
    match: text => /^On .{5,80} wrote:$/m.test(text),
    weight: 3,
    why: 'quoted-prior-message',
  },
];

const NOISE_RULES: Rule[] = [
  {
    label: 'NOISE',
    match: text =>
      /\b(?:unsubscribe|you received this because|manage your preferences)\b/i.test(
        text,
      ),
    weight: 3,
    why: 'marketing-footer',
  },
  {
    label: 'NOISE',
    match: (_text, subject) =>
      /\b(?:newsletter|digest|weekly roundup|webinar)\b/i.test(subject),
    weight: 2,
    why: 'newsletter-subject',
  },
];

const ALL_RULES: readonly Rule[] = [
  ...INTERVIEW_RULES,
  ...REJECTION_RULES,
  ...AUTO_RESPONSE_RULES,
  ...REPLY_RULES,
  ...NOISE_RULES,
];

interface Score {
  label: InboundEmailClass;
  score: number;
  reasons: string[];
}

export function classifyInboundEmail(
  input: ClassificationInput,
): ClassificationResult {
  const text = `${input.subject}\n${input.body}`;
  const scores = new Map<InboundEmailClass, Score>();

  for (const rule of ALL_RULES) {
    if (rule.match(input.body, input.subject)) {
      const existing = scores.get(rule.label);
      if (existing) {
        existing.score += rule.weight;
        existing.reasons.push(rule.why);
      } else {
        scores.set(rule.label, {
          label: rule.label,
          reasons: [rule.why],
          score: rule.weight,
        });
      }
    }
  }

  const isThreadedReply = !!input.inReplyTo && input.inReplyTo.trim().length > 0;
  if (isThreadedReply && !scores.has('REPLY')) {
    scores.set('REPLY', {
      label: 'REPLY',
      reasons: ['in-reply-to-header'],
      score: 1,
    });
  } else if (isThreadedReply) {
    const reply = scores.get('REPLY');
    if (reply) {
      reply.score += 1;
      reply.reasons.push('in-reply-to-header');
    }
  }

  const priority: Record<InboundEmailClass, number> = {
    INTERVIEW_INVITE: 5,
    REJECTION: 4,
    AUTO_RESPONSE: 3,
    REPLY: 2,
    NOISE: 1,
  };

  let best: Score | null = null;
  for (const score of scores.values()) {
    if (
      !best ||
      score.score > best.score ||
      (score.score === best.score &&
        priority[score.label] > priority[best.label])
    ) {
      best = score;
    }
  }

  // Tiny contextual guards:
  // - An AUTO_RESPONSE that ALSO looks like a rejection (e.g. an automated
  //   "we regret to inform you") is a rejection.
  if (
    best?.label === 'AUTO_RESPONSE' &&
    scores.has('REJECTION') &&
    (scores.get('REJECTION')?.score ?? 0) >= 3
  ) {
    best = scores.get('REJECTION') ?? best;
  }

  // Empty body + noise subject collapses to NOISE regardless of weak signals.
  const bodyTrimmed = input.body.trim();
  if (!best && bodyTrimmed.length < 20 && /\bnewsletter\b/i.test(input.subject)) {
    best = { label: 'NOISE', reasons: ['empty-body-noise-subject'], score: 1 };
  }

  if (!best) {
    return {
      confidence: isThreadedReply ? 0.4 : 0.3,
      isThreadedReply,
      label: isThreadedReply ? 'REPLY' : 'NOISE',
      reasons: isThreadedReply
        ? ['in-reply-to-header-default']
        : ['no-rule-matched'],
    };
  }

  // Confidence: score divided by a soft cap, clamped to [0.3, 0.99].
  const cap = 8;
  const confidence = Math.min(0.99, Math.max(0.3, best.score / cap));

  return {
    confidence,
    isThreadedReply,
    label: best.label,
    reasons: best.reasons,
  };
}

/** Expose rule count so tests can sanity-check the library is loaded. */
export function __ruleCount(): number {
  return ALL_RULES.length;
}
