// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SessionList } from '../session-list';
import type { RuntimeSessionListItem } from '../types';

describe('SessionList', () => {
  it('renders an empty runtime session state', () => {
    render(<SessionList sessions={[]} />);

    expect(
      screen.getByText('No runtime sessions recorded yet.'),
    ).toBeInTheDocument();
  });

  it('links each runtime session to its review page', () => {
    render(<SessionList sessions={[makeSession()]} />);

    expect(screen.getByText('Senior Engineer')).toBeInTheDocument();
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('READY')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute(
      'href',
      '/admin/sessions/session-1',
    );
  });
});

function makeSession(): RuntimeSessionListItem {
  return {
    artifactCount: 2,
    company: 'Acme',
    completedAt: null,
    currentUrl: 'https://jobs.example.com/apply',
    eventCount: 4,
    hostname: 'jobs.example.com',
    id: 'session-1',
    jobTitle: 'Senior Engineer',
    lastScreenshotUrl: 'https://cdn.example.com/screenshot.png',
    mode: 'SUGGEST_ONLY',
    startedAt: '2026-04-22T12:00:00.000Z',
    status: 'READY',
    updatedAt: '2026-04-22T12:05:00.000Z',
  };
}
