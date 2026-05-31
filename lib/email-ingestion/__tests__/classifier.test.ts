import { describe, expect, it } from 'vitest';

import {
  __ruleCount,
  classifyInboundEmail,
  type ClassificationInput,
  type InboundEmailClass,
} from '../classifier';
import { CLASSIFIER_EVAL_SET } from './classifier-eval-set';

function make(
  partial: Partial<ClassificationInput>,
): ClassificationInput {
  return {
    body: '',
    from: 'sender@example.com',
    inReplyTo: null,
    receivedAt: new Date('2026-04-22T12:00:00Z'),
    subject: '',
    to: 'me@mydomain.com',
    uid: '1',
    ...partial,
  };
}

describe('classifyInboundEmail', () => {
  it('has rules loaded (sanity)', () => {
    expect(__ruleCount()).toBeGreaterThan(0);
  });

  it('defaults to NOISE when no rule and no thread header', () => {
    const result = classifyInboundEmail(
      make({ body: 'empty content', subject: 'hi' }),
    );
    expect(result.label).toBe('NOISE');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('routes a threaded no-match to REPLY at low confidence', () => {
    const result = classifyInboundEmail(
      make({
        body: 'thanks',
        inReplyTo: '<abc@mydomain.com>',
        subject: 'Re: hello',
      }),
    );
    expect(result.label).toBe('REPLY');
    expect(result.isThreadedReply).toBe(true);
  });

  it('interview invite with calendly link', () => {
    const result = classifyInboundEmail(
      make({
        body:
          'We would like to schedule an interview. https://calendly.com/foo/bar',
        subject: 'Interview invitation',
      }),
    );
    expect(result.label).toBe('INTERVIEW_INVITE');
  });

  it('rejection: unfortunately + position', () => {
    const result = classifyInboundEmail(
      make({
        body:
          "Unfortunately, we won't be moving forward with your candidacy for the position.",
        subject: 'Application update',
      }),
    );
    expect(result.label).toBe('REJECTION');
  });

  it('auto-response: do-not-reply beats low-signal REPLY', () => {
    const result = classifyInboundEmail(
      make({
        body: 'Do not reply to this email. Your message was received.',
        subject: 'Acknowledgement',
      }),
    );
    expect(result.label).toBe('AUTO_RESPONSE');
  });

  it('rejection content in auto-response wrapper wins as rejection', () => {
    const result = classifyInboundEmail(
      make({
        body:
          'This is an automated message. We regret to inform you that we are ' +
          'unable to move forward with your application for this position.',
        subject: 'Application decision',
      }),
    );
    expect(result.label).toBe('REJECTION');
  });

  it('newsletter is NOISE', () => {
    const result = classifyInboundEmail(
      make({
        body: 'Weekly roundup... click to unsubscribe.',
        subject: 'Newsletter',
      }),
    );
    expect(result.label).toBe('NOISE');
  });
});

describe('classifier golden eval set', () => {
  const results = CLASSIFIER_EVAL_SET.map(c => ({
    case: c,
    actual: classifyInboundEmail(c).label,
  }));

  const byClass = new Map<InboundEmailClass, { total: number; correct: number }>();
  for (const r of results) {
    const bucket = byClass.get(r.case.expected) ?? { correct: 0, total: 0 };
    bucket.total += 1;
    if (r.actual === r.case.expected) bucket.correct += 1;
    byClass.set(r.case.expected, bucket);
  }

  const overall = results.filter(r => r.actual === r.case.expected).length;

  it('reports overall accuracy ≥ 90%', () => {
    const ratio = overall / results.length;
    if (ratio < 0.9) {
      const failures = results
        .filter(r => r.actual !== r.case.expected)
        .map(
          r =>
            `  [${r.case.expected} -> ${r.actual}] subject="${r.case.subject}"`,
        )
        .join('\n');
      throw new Error(
        `Accuracy ${ratio.toFixed(2)} < 0.90. Failures:\n${failures}`,
      );
    }
    expect(ratio).toBeGreaterThanOrEqual(0.9);
  });

  for (const [cls, bucket] of byClass) {
    it(`${cls} precision ≥ 80% (got ${bucket.correct}/${bucket.total})`, () => {
      expect(bucket.correct / bucket.total).toBeGreaterThanOrEqual(0.8);
    });
  }
});
