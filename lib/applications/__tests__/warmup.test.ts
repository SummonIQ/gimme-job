import { describe, expect, it, vi } from 'vitest';

import { runPreBurstWarmup, type WarmupTailorResult } from '../warmup';

function tailorOk(): WarmupTailorResult {
  return { missingContext: [], skipped: false };
}

function tailorSkipped(reason: string): WarmupTailorResult {
  return {
    missingContext: ['cover_letter_style'],
    skipped: true,
    skippedReason: reason,
  };
}

describe('runPreBurstWarmup', () => {
  it('aborts before starting when estimate exceeds the budget', async () => {
    const tailor = vi.fn(async () => tailorOk());

    const report = await runPreBurstWarmup({
      budgetTokens: 1_000,
      leadIds: ['a', 'b', 'c'],
      perLeadTokenEstimate: 500,
      tailor,
    });

    expect(report.aborted).toBe(true);
    expect(report.abortReason).toContain('exceeds budget');
    expect(report.outcomes).toHaveLength(0);
    expect(tailor).not.toHaveBeenCalled();
  });

  it('runs each lead and reports completed/skipped/failed counts', async () => {
    const tailor = vi.fn(async (leadId: string) => {
      if (leadId === 'b') return tailorSkipped('missing context');
      if (leadId === 'c') throw new Error('boom');
      return tailorOk();
    });

    const report = await runPreBurstWarmup({
      budgetTokens: 100_000,
      concurrency: 2,
      leadIds: ['a', 'b', 'c', 'd'],
      perLeadTokenEstimate: 100,
      tailor,
    });

    expect(report.aborted).toBe(false);
    expect(report.completedCount).toBe(2);
    expect(report.skippedCount).toBe(1);
    expect(report.failedCount).toBe(1);
    expect(report.outcomes.map(o => o.status)).toEqual([
      'completed',
      'skipped',
      'failed',
      'completed',
    ]);
    expect(tailor).toHaveBeenCalledTimes(4);
  });

  it('respects concurrency cap', async () => {
    let inFlight = 0;
    let peak = 0;
    const tailor = vi.fn(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise(resolve => setTimeout(resolve, 5));
      inFlight -= 1;
      return tailorOk();
    });

    await runPreBurstWarmup({
      budgetTokens: 100_000,
      concurrency: 2,
      leadIds: ['a', 'b', 'c', 'd', 'e', 'f'],
      tailor,
    });

    expect(peak).toBeLessThanOrEqual(2);
    expect(peak).toBeGreaterThan(0);
  });

  it('marks remaining leads as aborted when signal fires mid-run', async () => {
    const controller = new AbortController();
    const tailor = vi.fn(async (leadId: string) => {
      if (leadId === 'b') controller.abort();
      return tailorOk();
    });

    const report = await runPreBurstWarmup({
      abortSignal: controller.signal,
      budgetTokens: 100_000,
      concurrency: 1,
      leadIds: ['a', 'b', 'c', 'd'],
      tailor,
    });

    expect(report.aborted).toBe(true);
    const statuses = report.outcomes.map(o => o.status);
    expect(statuses[0]).toBe('completed');
    expect(statuses[1]).toBe('completed');
    expect(statuses[2]).toBe('aborted');
    expect(statuses[3]).toBe('aborted');
  });

  it('aborts immediately when signal is already triggered', async () => {
    const controller = new AbortController();
    controller.abort();
    const tailor = vi.fn(async () => tailorOk());

    const report = await runPreBurstWarmup({
      abortSignal: controller.signal,
      budgetTokens: 100_000,
      leadIds: ['a', 'b'],
      tailor,
    });

    expect(report.aborted).toBe(true);
    expect(report.outcomes).toHaveLength(0);
    expect(tailor).not.toHaveBeenCalled();
  });
});
