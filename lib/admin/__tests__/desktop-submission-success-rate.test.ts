import { describe, expect, it } from 'vitest';

import type { Prisma } from '@/generated/prisma/client';

import {
  buildDesktopSubmissionSuccessRateReport,
  type DesktopSubmissionSuccessRateRow,
} from '../desktop-submission-success-rate';

describe('buildDesktopSubmissionSuccessRateReport', () => {
  it('groups desktop submissions by provider readiness, run mode, and failure reason', () => {
    const report = buildDesktopSubmissionSuccessRateReport({
      generatedAt: new Date('2026-05-08T16:00:00.000Z'),
      rows: [
        makeRow({
          id: 'greenhouse-success',
          metadata: { desktop: { mode: 'submit', status: 'completed' } },
          status: 'SUBMITTED',
          submissionUrl: 'https://job-boards.greenhouse.io/acme/jobs/123',
        }),
        makeRow({
          failureReason: 'validation_failed',
          id: 'greenhouse-validation',
          metadata: {
            desktop: { mode: 'submit', status: 'validation_failed' },
          },
          status: 'FAILED',
          submissionUrl: 'https://job-boards.greenhouse.io/acme/jobs/456',
        }),
        makeRow({
          failureReason: 'captcha_required',
          id: 'icims-captcha',
          metadata: {
            desktop: { mode: 'training', status: 'captcha_required' },
          },
          status: 'FAILED',
          submissionUrl: 'https://careers.icims.com/jobs/789',
        }),
      ],
      windowDays: 7,
    });

    expect(report.totals).toMatchObject({
      failureCount: 2,
      runCount: 3,
      successCount: 1,
      successRate: 1 / 3,
    });
    expect(report.readinessSummaries).toEqual([
      expect.objectContaining({
        failureCount: 1,
        readiness: 'production',
        runCount: 2,
        successCount: 1,
        successRate: 0.5,
      }),
      expect.objectContaining({
        failureCount: 1,
        readiness: 'beta',
        runCount: 1,
        successCount: 0,
        successRate: 0,
      }),
    ]);
    expect(report.providerSummaries).toEqual([
      expect.objectContaining({
        providerId: 'greenhouse',
        runCount: 2,
        successCount: 1,
        topFailureReason: 'validation_failed',
      }),
      expect.objectContaining({
        providerId: 'icims',
        readiness: 'beta',
        runCount: 1,
        topFailureReason: 'captcha_required',
      }),
    ]);
    expect(report.failureGroups).toEqual([
      expect.objectContaining({
        failureReason: 'validation_failed',
        providerId: 'greenhouse',
        runMode: 'submit',
      }),
      expect.objectContaining({
        failureReason: 'captcha_required',
        providerId: 'icims',
        runMode: 'training',
      }),
    ]);
  });
});

function makeRow(overrides: {
  readonly failureReason?: string | null;
  readonly id: string;
  readonly metadata?: Prisma.JsonValue | null;
  readonly status: string;
  readonly submissionUrl: string;
}): DesktopSubmissionSuccessRateRow {
  return {
    createdAt: new Date('2026-05-08T15:00:00.000Z'),
    failureReason: overrides.failureReason ?? null,
    id: overrides.id,
    metadata: overrides.metadata ?? null,
    status: overrides.status,
    submissionUrl: overrides.submissionUrl,
  };
}
