// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  SubmissionsTable,
  type SubmissionRow,
} from '../submissions-table';

describe('SubmissionsTable', () => {
  it('renders structured validation failures in the expanded trace', () => {
    render(
      <SubmissionsTable
        rows={[
          makeRow({
            validationFailures: [
              {
                fieldLabel: 'Email',
                fieldSelector: 'input[name="email"]',
                message: 'Email is required.',
              },
            ],
          }),
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Details' }));

    expect(screen.getByText('Validation errors')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Email is required.')).toBeInTheDocument();
    expect(screen.getByText('input[name="email"]')).toBeInTheDocument();
  });

  it('renders failure artifact links in the expanded trace', () => {
    render(
      <SubmissionsTable
        rows={[
          makeRow({
            failureArtifacts: {
              capturedAt: '2026-05-08T15:01:00.000Z',
              domUrl: 'https://blob.test/dom.html',
              error: null,
              screenshotUrl: 'https://blob.test/screenshot.png',
            },
          }),
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Details' }));

    expect(screen.getByText('Failure artifacts')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Screenshot' })).toHaveAttribute(
      'href',
      'https://blob.test/screenshot.png',
    );
    expect(screen.getByRole('link', { name: 'DOM snapshot' })).toHaveAttribute(
      'href',
      'https://blob.test/dom.html',
    );
  });
});

function makeRow(overrides: Partial<SubmissionRow> = {}): SubmissionRow {
  return {
    company: 'Fixture Co',
    createdAt: '2026-05-08T15:00:00.000Z',
    id: 'submission-1',
    failureArtifacts: null,
    jobTitle: 'Software Engineer',
    message: 'Submit failed.',
    mode: 'submit',
    providerLabel: 'Lever',
    providerReadiness: 'production',
    signals: [],
    status: 'validation_failed',
    submissionUrl: 'https://jobs.lever.co/fixtureco/123/apply',
    submittedAt: null,
    toolCallCount: 0,
    toolCalls: [],
    validationFailures: [],
    ...overrides,
  };
}
