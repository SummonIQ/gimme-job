import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DesktopSidebar } from '../desktop-sidebar';

describe('DesktopSidebar', () => {
  it('renders the desktop shell state', () => {
    render(
      <DesktopSidebar
        appUrl="https://app.gimme-job.com"
        assistUrl="https://job-boards.greenhouse.io"
        mode="Training"
        status="Ready"
        submitGuardEnabled
      />,
    );

    expect(
      screen.getByRole('complementary', { name: 'Desktop runtime sidebar' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Gimme Job' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Main app')).toBeInTheDocument();
    expect(screen.getByText('ATS assist')).toBeInTheDocument();
    expect(screen.getByText('Submit guard on')).toBeInTheDocument();
    expect(screen.getByText('No lead selected')).toBeInTheDocument();
  });
});
