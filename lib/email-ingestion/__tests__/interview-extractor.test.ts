import { describe, expect, it } from 'vitest';

import {
  extractInterviewInvite,
  type ExtractedInterviewInvite,
  type InterviewFormat,
} from '../interview-extractor';
import type { EmailMessage } from '../parsers';

function msg(overrides: Partial<EmailMessage>): EmailMessage {
  return {
    body: '',
    from: 'Recruiter <recruiter@fixtureco.com>',
    receivedAt: new Date('2026-04-22T12:00:00Z'),
    subject: '',
    to: 'me@mydomain.com',
    uid: '1',
    ...overrides,
  };
}

interface Case {
  readonly label: string;
  readonly msg: EmailMessage;
  readonly expectedFormat: InterviewFormat;
  readonly expectedAtLeast: number;
  readonly expectName?: boolean;
  readonly expectMeetingLink?: boolean;
}

const GOLDEN: readonly Case[] = [
  {
    expectMeetingLink: true,
    expectName: true,
    expectedAtLeast: 1,
    expectedFormat: 'VIDEO',
    label: 'zoom link + thursday 2pm',
    msg: msg({
      body:
        "Hi Steven, let's set up a video interview on Thursday at 2pm PT. " +
        'Zoom: https://zoom.us/j/123456?pwd=abc\n\nBest,\nEmily Chen',
      from: 'Emily Chen <emily@fixtureco.com>',
      subject: 'Interview: Senior Engineer',
    }),
  },
  {
    expectMeetingLink: true,
    expectedAtLeast: 1,
    expectedFormat: 'VIDEO',
    label: 'google meet + friday 11am',
    msg: msg({
      body:
        'Join me on google meet https://meet.google.com/abc-defg-hij on ' +
        'Friday 11am for a 30-minute interview. Thanks!',
      subject: 'Interview invite',
    }),
  },
  {
    expectedAtLeast: 2,
    expectedFormat: 'VIDEO',
    label: 'three proposed times',
    msg: msg({
      body:
        "Sharing my availability for a zoom interview: Monday 3pm, " +
        'Tuesday 10am, or Wednesday 1pm.',
      subject: 'Interview availability',
    }),
  },
  {
    expectedAtLeast: 1,
    expectedFormat: 'PHONE',
    label: 'phone screen friday',
    msg: msg({
      body:
        "Can we hop on a phone screen Friday at 9am PT? Should take about 20 minutes.",
      subject: 'Quick phone screen?',
    }),
  },
  {
    expectedAtLeast: 1,
    expectedFormat: 'PHONE',
    label: 'phone call wednesday',
    msg: msg({
      body:
        'Happy to give you a call Wednesday at 4pm if that works. ' +
        'Just reply with a phone number.',
      subject: 'Phone call?',
    }),
  },
  {
    expectedAtLeast: 1,
    expectedFormat: 'ONSITE',
    label: 'onsite at our office',
    msg: msg({
      body:
        "Let's do an onsite interview at our office next Tuesday at 10am. " +
        "The address is 123 Market St.",
      subject: 'Onsite next Tuesday',
    }),
  },
  {
    expectedAtLeast: 1,
    expectedFormat: 'ONSITE',
    label: 'in-person at hq',
    msg: msg({
      body:
        "We'd love to have you visit our HQ for an in-person interview " +
        'on Thursday 2pm.',
      subject: 'In-person interview',
    }),
  },
  {
    expectMeetingLink: true,
    expectedAtLeast: 1,
    expectedFormat: 'VIDEO',
    label: 'teams link + may 5 at 3pm',
    msg: msg({
      body:
        'Please join via Microsoft Teams on May 5 at 3pm: ' +
        'https://teams.microsoft.com/l/meetup-join/abc',
      subject: 'Final-round interview',
    }),
  },
  {
    expectedAtLeast: 1,
    expectedFormat: 'VIDEO',
    label: 'video call no explicit link',
    msg: msg({
      body:
        'Would you be open to a video call on Thursday at 10am? I will ' +
        'send a calendar invite once we confirm.',
      subject: 'Interested in chatting',
    }),
  },
  {
    expectedAtLeast: 1,
    expectedFormat: 'PHONE',
    label: 'phone number embedded',
    msg: msg({
      body:
        "Here's my cell: 415-555-0137. Can you give me a call Monday 1pm PT?",
      subject: 'Interview',
    }),
  },
  {
    expectedAtLeast: 1,
    expectedFormat: 'VIDEO',
    label: 'zoom keyword only',
    msg: msg({
      body:
        "Let's do a Zoom interview on Tuesday 11am. I'll send the link closer to time.",
      subject: 'Next steps',
    }),
  },
  {
    expectedAtLeast: 1,
    expectedFormat: 'VIDEO',
    label: 'whereby link',
    msg: msg({
      body:
        "Join us on Whereby: https://whereby.com/fixture-team on Monday at 9am.",
      subject: 'Interview invite',
    }),
  },
  {
    expectMeetingLink: true,
    expectedAtLeast: 1,
    expectedFormat: 'VIDEO',
    label: 'single time via zoom',
    msg: msg({
      body:
        'Sending over the Zoom link for our 30-minute chat tomorrow at 2pm: ' +
        'https://zoom.us/j/9999',
      subject: 'Interview',
    }),
  },
  {
    expectedAtLeast: 1,
    expectedFormat: 'ONSITE',
    label: 'come to our office',
    msg: msg({
      body:
        "We'd like you to come to our office for an in-person loop. Does " +
        'Wednesday 2pm work?',
      subject: 'Onsite loop',
    }),
  },
  {
    expectedAtLeast: 1,
    expectedFormat: 'PHONE',
    label: 'give me a call tomorrow',
    msg: msg({
      body:
        "Can you give me a call tomorrow at 3pm PT? I want to walk through " +
        'the next steps.',
      subject: 'Re: Your application',
    }),
  },
  {
    expectedAtLeast: 1,
    expectedFormat: 'VIDEO',
    label: 'google meet + numeric date',
    msg: msg({
      body:
        'Please join meet.google.com/xyz on 5/10 at 11am for your final-round interview.',
      subject: 'Final round',
    }),
  },
  {
    expectedAtLeast: 2,
    expectedFormat: 'VIDEO',
    label: 'multiple zoom times',
    msg: msg({
      body:
        "I have availability for a zoom interview on Monday 9am, Monday 2pm, " +
        'or Tuesday 11am.',
      subject: 'Availability',
    }),
  },
  {
    expectedAtLeast: 1,
    expectedFormat: 'VIDEO',
    label: 'zoom + may 12 at 4pm',
    msg: msg({
      body:
        "Our interview is scheduled on zoom for May 12 at 4pm.",
      subject: 'Upcoming interview',
    }),
  },
  {
    expectedAtLeast: 1,
    expectedFormat: 'ONSITE',
    label: 'visit our campus',
    msg: msg({
      body:
        "We'd love to have you visit our campus next Friday at 10am for a " +
        'full interview day.',
      subject: 'Interview day',
    }),
  },
  {
    expectMeetingLink: true,
    expectedAtLeast: 1,
    expectedFormat: 'VIDEO',
    label: 'zoom without explicit time hint falls back to receivedAt',
    msg: msg({
      body:
        'Please use this Zoom link: https://zoom.us/j/555 on Thursday at 10am',
      subject: 'Interview',
    }),
  },
];

function passes(
  extracted: ExtractedInterviewInvite,
  c: Case,
): { pass: boolean; why: string[] } {
  const why: string[] = [];

  if (extracted.format !== c.expectedFormat) {
    why.push(`format: got ${extracted.format}, expected ${c.expectedFormat}`);
  }
  if (extracted.proposedTimes.length < c.expectedAtLeast) {
    why.push(
      `proposedTimes: got ${extracted.proposedTimes.length}, expected ≥${c.expectedAtLeast}`,
    );
  }
  if (c.expectMeetingLink && !extracted.meetingLink) {
    why.push('meetingLink missing');
  }
  if (c.expectName && !extracted.interviewerName) {
    why.push('interviewerName missing');
  }
  return { pass: why.length === 0, why };
}

describe('extractInterviewInvite (20-case golden set)', () => {
  const results = GOLDEN.map(c => ({ c, extracted: extractInterviewInvite(c.msg) }));

  it('clean extractions ≥ 15/20', () => {
    const clean = results.filter(r => passes(r.extracted, r.c).pass);
    if (clean.length < 15) {
      const failures = results
        .filter(r => !passes(r.extracted, r.c).pass)
        .map(
          r =>
            `  [${r.c.label}]: ${passes(r.extracted, r.c).why.join('; ')}`,
        )
        .join('\n');
      throw new Error(
        `Only ${clean.length}/20 clean extractions. Failures:\n${failures}`,
      );
    }
    expect(clean.length).toBeGreaterThanOrEqual(15);
  });

  it('format precision per class', () => {
    const byFormat = new Map<InterviewFormat, { correct: number; total: number }>();
    for (const r of results) {
      const bucket = byFormat.get(r.c.expectedFormat) ?? { correct: 0, total: 0 };
      bucket.total += 1;
      if (r.extracted.format === r.c.expectedFormat) bucket.correct += 1;
      byFormat.set(r.c.expectedFormat, bucket);
    }
    for (const [, bucket] of byFormat) {
      expect(bucket.correct / bucket.total).toBeGreaterThanOrEqual(0.75);
    }
  });
});

describe('extractInterviewInvite unit', () => {
  it('returns UNKNOWN format when there is no signal', () => {
    const result = extractInterviewInvite(
      msg({ body: 'Hi, no interview here.', subject: 'hello' }),
    );
    expect(result.format).toBe('UNKNOWN');
    expect(result.proposedTimes).toHaveLength(0);
  });

  it('captures a zoom link and labels VIDEO', () => {
    const result = extractInterviewInvite(
      msg({ body: 'https://zoom.us/j/42 Thursday 2pm' }),
    );
    expect(result.format).toBe('VIDEO');
    expect(result.meetingLink).toBe('https://zoom.us/j/42');
  });

  it('captures the interviewer name from the From header', () => {
    const result = extractInterviewInvite(
      msg({
        body: 'Interview Thursday 2pm',
        from: 'Jane Doe <jane@fixtureco.com>',
      }),
    );
    expect(result.interviewerName).toBe('Jane Doe');
    expect(result.interviewerEmail).toBe('jane@fixtureco.com');
  });

  it('prefers a signature name over the From header display name', () => {
    const result = extractInterviewInvite(
      msg({
        body: 'Interview Thursday 2pm.\n\nBest,\nLee Ortiz',
        from: 'Recruiter <recruiter@fixtureco.com>',
      }),
    );
    expect(result.interviewerName).toBe('Lee Ortiz');
  });

  it('resolves day-of-week + time relative to receivedAt', () => {
    const result = extractInterviewInvite(
      msg({
        body: 'Interview Thursday at 2pm',
        receivedAt: new Date('2026-04-22T12:00:00Z'), // Wednesday UTC
      }),
    );
    expect(result.proposedTimes[0]?.iso).not.toBeNull();
  });

  it('confidence is higher with more signals', () => {
    const weak = extractInterviewInvite(
      msg({ body: 'phone call sometime soon' }),
    );
    const strong = extractInterviewInvite(
      msg({
        body:
          "Zoom https://zoom.us/j/42 Thursday 2pm.\n\nBest,\nJane Doe",
        from: 'Jane Doe <jane@fixtureco.com>',
      }),
    );
    expect(strong.confidence).toBeGreaterThan(weak.confidence);
  });
});
