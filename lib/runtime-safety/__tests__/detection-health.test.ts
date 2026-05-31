import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  DEFAULT_THRESHOLDS,
  analyzeHostHealth,
  type HostSignals,
} from '../detection-health';

const NOW = new Date('2026-04-23T12:00:00Z');
const WINDOW_START = new Date(NOW.getTime() - 60 * 60 * 1000);

function signals(partial: Partial<HostSignals>): HostSignals {
  return {
    baselineReplyRate: null,
    baselineSubmitLatencyMs: null,
    captchaEvents: 0,
    hostname: 'job-boards.greenhouse.io',
    httpErrorEvents: 0,
    medianSubmitLatencyMs: null,
    replyRate: null,
    sessionsAbandoned: 0,
    sessionsStarted: 0,
    submitEvents: 0,
    window: { end: NOW, start: WINDOW_START },
    ...partial,
  };
}

describe('DEFAULT_THRESHOLDS', () => {
  it('has sensible baselines that are not trivially-met', () => {
    expect(DEFAULT_THRESHOLDS.captchaRatio).toBeGreaterThan(0);
    expect(DEFAULT_THRESHOLDS.captchaRatio).toBeLessThan(1);
    expect(DEFAULT_THRESHOLDS.minSampleSize).toBeGreaterThan(0);
  });
});

describe('analyzeHostHealth — CAPTCHA threshold', () => {
  it('does not trigger below the sample-size floor', () => {
    const verdict = analyzeHostHealth(
      signals({ captchaEvents: 5, submitEvents: 5 }),
    );
    expect(verdict.triggered).toHaveLength(0);
  });

  it('does not trigger when CAPTCHA ratio is under threshold', () => {
    const verdict = analyzeHostHealth(
      signals({ captchaEvents: 1, submitEvents: 50 }),
    );
    expect(verdict.triggered.map(t => t.type)).not.toContain('CAPTCHA_SPIKE');
  });

  it('triggers CAPTCHA_SPIKE when ratio >= threshold', () => {
    const verdict = analyzeHostHealth(
      signals({ captchaEvents: 4, submitEvents: 20 }), // 20%
    );
    const captcha = verdict.triggered.find(t => t.type === 'CAPTCHA_SPIKE');
    expect(captcha).toBeDefined();
    expect(captcha?.value).toBeCloseTo(0.2, 3);
  });

  it('triggers at exactly the threshold (>= is inclusive)', () => {
    const verdict = analyzeHostHealth(
      signals({ captchaEvents: 2, submitEvents: 20 }), // 10%
    );
    expect(
      verdict.triggered.map(t => t.type),
    ).toContain('CAPTCHA_SPIKE');
  });
});

describe('analyzeHostHealth — HTTP error threshold', () => {
  it('triggers on high error rate', () => {
    const verdict = analyzeHostHealth(
      signals({ httpErrorEvents: 5, submitEvents: 20 }),
    );
    expect(verdict.triggered.map(t => t.type)).toContain('HTTP_ERROR_SPIKE');
  });
});

describe('analyzeHostHealth — abandonment', () => {
  it('triggers when abandonment ratio exceeds threshold', () => {
    const verdict = analyzeHostHealth(
      signals({
        sessionsAbandoned: 7,
        sessionsStarted: 15,
      }),
    );
    expect(verdict.triggered.map(t => t.type)).toContain(
      'SESSION_ABANDONMENT_SPIKE',
    );
  });

  it('does not trigger under min sample size', () => {
    const verdict = analyzeHostHealth(
      signals({
        sessionsAbandoned: 5,
        sessionsStarted: 5,
      }),
    );
    expect(verdict.triggered.map(t => t.type)).not.toContain(
      'SESSION_ABANDONMENT_SPIKE',
    );
  });
});

describe('analyzeHostHealth — latency spike', () => {
  it('triggers when median latency >= multiplier * baseline', () => {
    const verdict = analyzeHostHealth(
      signals({
        baselineSubmitLatencyMs: 1000,
        medianSubmitLatencyMs: 2500,
      }),
    );
    expect(verdict.triggered.map(t => t.type)).toContain('LATENCY_SPIKE');
  });

  it('does not trigger when latency is near baseline', () => {
    const verdict = analyzeHostHealth(
      signals({
        baselineSubmitLatencyMs: 1000,
        medianSubmitLatencyMs: 1500,
      }),
    );
    expect(verdict.triggered.map(t => t.type)).not.toContain('LATENCY_SPIKE');
  });

  it('does not trigger when baseline is missing', () => {
    const verdict = analyzeHostHealth(
      signals({
        baselineSubmitLatencyMs: null,
        medianSubmitLatencyMs: 5000,
      }),
    );
    expect(verdict.triggered.map(t => t.type)).not.toContain('LATENCY_SPIKE');
  });
});

describe('analyzeHostHealth — reply-rate collapse', () => {
  it('triggers when reply rate drops >= 30pt below baseline', () => {
    const verdict = analyzeHostHealth(
      signals({
        baselineReplyRate: 0.5,
        replyRate: 0.15,
      }),
    );
    expect(verdict.triggered.map(t => t.type)).toContain(
      'REPLY_RATE_COLLAPSE',
    );
  });

  it('does not trigger on a small drop', () => {
    const verdict = analyzeHostHealth(
      signals({
        baselineReplyRate: 0.5,
        replyRate: 0.4,
      }),
    );
    expect(verdict.triggered.map(t => t.type)).not.toContain(
      'REPLY_RATE_COLLAPSE',
    );
  });
});

describe('analyzeHostHealth — multiple signals', () => {
  it('surfaces every signal that trips simultaneously', () => {
    const verdict = analyzeHostHealth(
      signals({
        baselineReplyRate: 0.5,
        baselineSubmitLatencyMs: 1000,
        captchaEvents: 4,
        httpErrorEvents: 6,
        medianSubmitLatencyMs: 3000,
        replyRate: 0.1,
        sessionsAbandoned: 8,
        sessionsStarted: 15,
        submitEvents: 20,
      }),
    );
    const types = new Set(verdict.triggered.map(t => t.type));
    expect(types.has('CAPTCHA_SPIKE')).toBe(true);
    expect(types.has('HTTP_ERROR_SPIKE')).toBe(true);
    expect(types.has('SESSION_ABANDONMENT_SPIKE')).toBe(true);
    expect(types.has('LATENCY_SPIKE')).toBe(true);
    expect(types.has('REPLY_RATE_COLLAPSE')).toBe(true);
  });
});

describe('analyzeHostHealth — family resolution', () => {
  it('resolves Greenhouse family from hostname', () => {
    const verdict = analyzeHostHealth(signals({}));
    expect(verdict.family).toBe('greenhouse');
  });
  it('returns null family for unknown hostname', () => {
    const verdict = analyzeHostHealth(
      signals({ hostname: 'unknown.example.com' }),
    );
    expect(verdict.family).toBeNull();
  });
});
