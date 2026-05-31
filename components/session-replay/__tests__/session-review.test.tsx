// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SessionReview } from '../session-review';
import type { RuntimeSessionDetail } from '../types';

describe('SessionReview', () => {
  it('renders events, screenshots, and candidate review controls', () => {
    render(
      <SessionReview
        bulkApproveAction={vi.fn()}
        reviewCandidateAction={vi.fn()}
        session={makeSession()}
      />,
    );

    expect(screen.getByText('Senior Engineer')).toBeInTheDocument();
    expect(screen.getByText('Event timeline')).toBeInTheDocument();
    expect(screen.getByText('first_name')).toBeInTheDocument();
    expect(screen.getAllByText('#first-name')).toHaveLength(2);
    expect(screen.getByAltText('Runtime replay screenshot')).toHaveAttribute(
      'src',
      'https://cdn.example.com/replay.png',
    );
    expect(
      screen.getByRole('button', { name: 'Bulk approve trivial' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
  });

  it('renders empty states when a session has no review artifacts', () => {
    render(
      <SessionReview
        bulkApproveAction={vi.fn()}
        reviewCandidateAction={vi.fn()}
        session={{
          ...makeSession(),
          artifacts: [],
          candidates: [],
          events: [],
        }}
      />,
    );

    expect(screen.getByText('No events recorded.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'No promotion candidates for this session hostname yet.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('No screenshots captured for this session.'),
    ).toBeInTheDocument();
  });
});

function makeSession(): RuntimeSessionDetail {
  return {
    artifacts: [
      {
        createdAt: '2026-04-22T12:02:00.000Z',
        id: 'artifact-1',
        screenshotUrls: ['https://cdn.example.com/replay.png'],
        sizeBytes: 1234,
      },
    ],
    candidates: [
      {
        actionType: 'fill',
        confidence: 0.86,
        failureCount: 0,
        fieldLabel: 'First name',
        fieldName: 'first_name',
        hostname: 'jobs.example.com',
        id: 'candidate-1',
        observationCount: 3,
        promotionStatus: 'CANDIDATE',
        stableSelector: '#first-name',
        successCount: 3,
        updatedAt: '2026-04-22T12:03:00.000Z',
        userOverrideCount: 0,
      },
    ],
    company: 'Acme',
    currentStepIndex: 2,
    currentUrl: 'https://jobs.example.com/apply',
    events: [
      {
        actionType: 'fill',
        createdAt: '2026-04-22T12:01:00.000Z',
        errorMessage: null,
        eventType: 'FIELD_FILLED',
        fieldLabel: null,
        fieldName: 'first_name',
        id: 'event-1',
        selector: '#first-name',
        source: 'LEGACY',
        stepIndex: 1,
        success: true,
        url: 'https://jobs.example.com/apply',
      },
    ],
    hostname: 'jobs.example.com',
    id: 'session-1',
    jobTitle: 'Senior Engineer',
    mode: 'SUGGEST_ONLY',
    startedAt: '2026-04-22T12:00:00.000Z',
    status: 'READY',
    updatedAt: '2026-04-22T12:05:00.000Z',
  };
}
