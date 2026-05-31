// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  computeArchivalCutoff,
  DESKTOP_SUBMIT_REQUEST_TTL_DAYS,
} from '../durable-queue';

describe('computeArchivalCutoff', () => {
  it('returns now minus the default TTL when no override is provided', () => {
    const now = new Date('2026-05-01T00:00:00.000Z');
    const cutoff = computeArchivalCutoff(now);
    const expected = new Date(
      now.getTime() - DESKTOP_SUBMIT_REQUEST_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    expect(cutoff.toISOString()).toBe(expected.toISOString());
  });

  it('honors a custom ttlDays override', () => {
    const now = new Date('2026-05-01T00:00:00.000Z');
    const cutoff = computeArchivalCutoff(now, 1);
    expect(cutoff.toISOString()).toBe('2026-04-30T00:00:00.000Z');
  });

  it('uses the documented 14-day default', () => {
    expect(DESKTOP_SUBMIT_REQUEST_TTL_DAYS).toBe(14);
  });
});
