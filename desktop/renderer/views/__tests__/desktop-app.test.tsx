// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildValidationFingerprint, DesktopApp } from '../desktop-app';

afterEach(() => {
  cleanup();
});

describe('DesktopApp', () => {
  const authGetState = vi.fn();
  const agentChat = vi.fn();
  const shellGetAssistPageContext = vi.fn();
  const shellGetState = vi.fn();
  const shellHighlightAssistField = vi.fn();
  const shellSetAssistUrl = vi.fn();
  const shellSetPanelSizes = vi.fn();
  const submitPickRandomGreenhouseLead = vi.fn();
  const submitRunLead = vi.fn();

  beforeEach(() => {
    authGetState.mockReset();
    agentChat.mockReset();
    shellGetAssistPageContext.mockReset();
    shellGetState.mockReset();
    shellHighlightAssistField.mockReset();
    shellSetAssistUrl.mockReset();
    shellSetPanelSizes.mockReset();
    submitPickRandomGreenhouseLead.mockReset();
    submitRunLead.mockReset();

    authGetState.mockResolvedValue({
      message: 'Pair this desktop from the web admin page.',
      status: 'unpaired',
    });
    shellGetState.mockResolvedValue({
      appUrl: 'http://localhost:10100',
      assistUrl: 'https://job-boards.greenhouse.io',
      isEyeSaverMode: false,
      panelSizes: {
        assist: 33,
        main: 44,
        sidebar: 23,
      },
    });
    shellGetAssistPageContext.mockResolvedValue({
      capturedAt: '2026-05-02T14:27:15.000Z',
      fields: [],
      issues: [],
      lastSubmitResult: null,
      screenshotDataUrl: null,
      title: 'Example application',
      url: 'https://job-boards.greenhouse.io',
    });
    shellSetAssistUrl.mockResolvedValue({
      appUrl: 'http://localhost:10100',
      assistUrl: 'https://job-boards.greenhouse.io',
      isEyeSaverMode: false,
      panelSizes: {
        assist: 33,
        main: 44,
        sidebar: 23,
      },
    });
    shellSetPanelSizes.mockResolvedValue({
      appUrl: 'http://localhost:10100',
      assistUrl: 'https://job-boards.greenhouse.io',
      isEyeSaverMode: false,
      panelSizes: {
        assist: 33,
        main: 44,
        sidebar: 23,
      },
    });
    shellHighlightAssistField.mockResolvedValue(true);

    Object.defineProperty(window, 'gimmeJobDesktop', {
      configurable: true,
      value: {
        agent: {
          chat: agentChat,
        },
        auth: {
          clearToken: vi.fn(),
          getState: authGetState,
          pairWithCode: vi.fn(),
        },
        shell: {
          assistGoBack: vi
            .fn()
            .mockResolvedValue({ canGoBack: false, canGoForward: false }),
          assistGoForward: vi
            .fn()
            .mockResolvedValue({ canGoBack: false, canGoForward: false }),
          getAssistNavState: vi
            .fn()
            .mockResolvedValue({ canGoBack: false, canGoForward: false }),
          getAssistPageContext: shellGetAssistPageContext,
          getState: shellGetState,
          highlightAssistField: shellHighlightAssistField,
          onAssistNavStateChange: vi.fn().mockReturnValue(() => undefined),
          setAssistEyeSaverMode: vi.fn(),
          setAssistOverlayActive: vi.fn().mockResolvedValue(undefined),
          setAssistUrl: shellSetAssistUrl,
          setPanelSizes: shellSetPanelSizes,
        },
        submit: {
          pickRandomGreenhouseLead: submitPickRandomGreenhouseLead,
          runLead: submitRunLead,
        },
        userActions: {
          onReport: vi.fn().mockReturnValue(() => undefined),
        },
      },
    });
  });

  it('renders the desktop shell with a resize handle', async () => {
    render(<DesktopApp />);

    await waitFor(() => {
      expect(screen.getByRole('toolbar', { name: 'Desktop' })).toBeTruthy();
    });

    expect(screen.getAllByRole('separator')).toHaveLength(1);
  });

  it('opens agent chat in the left sidebar from the toolbar', async () => {
    render(<DesktopApp />);

    await waitFor(() => {
      expect(screen.getByRole('toolbar', { name: 'Desktop' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Agent chat' }));

    expect(
      screen.getByRole('tab', { name: 'Agent' }).getAttribute('aria-selected'),
    ).toBe('true');
    expect(
      screen.queryByRole('complementary', { name: 'Agent chat' }),
    ).toBeNull();
  });

  it('passes the any-provider option when picking a random job', async () => {
    authGetState.mockResolvedValue({
      message: 'Paired',
      status: 'paired',
      tokenId: 'token-1',
      userId: 'user-1',
    });
    submitPickRandomGreenhouseLead.mockResolvedValue({
      applicationUrl: 'https://jobs.ashbyhq.com/example/application',
      company: 'Fixture Co',
      jobLeadId: 'lead-1',
      jobListingId: 'listing-1',
      location: 'Remote',
      source: 'Ashby',
      title: 'Software Engineer',
    });

    render(<DesktopApp />);

    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: 'Pick random job' })
          .hasAttribute('disabled'),
      ).toBe(false);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Search filters' }));
    fireEvent.change(screen.getByLabelText('Provider'), {
      target: { value: 'any' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Random' }));

    await waitFor(() => {
      expect(submitPickRandomGreenhouseLead).toHaveBeenCalledWith({
        excludeCompanies: [],
        excludeListingIds: [],
        location: '',
        provider: 'any',
        remote: false,
        search: '',
      });
    });
  });

  it('keeps Autopilot out of the mode dropdown and autofills random jobs when enabled', async () => {
    authGetState.mockResolvedValue({
      message: 'Paired',
      status: 'paired',
      tokenId: 'token-1',
      userId: 'user-1',
    });
    shellGetAssistPageContext.mockResolvedValue({
      capturedAt: '2026-05-02T14:27:15.000Z',
      fields: [
        {
          disabled: false,
          inputType: 'text',
          label: 'First name',
          required: true,
          selector: 'input#first_name',
          tagName: 'input',
          value: null,
          visible: true,
        },
      ],
      issues: [],
      lastSubmitResult: null,
      screenshotDataUrl: null,
      title: 'Example application',
      url: 'https://job-boards.greenhouse.io/example/jobs/123',
    });
    submitPickRandomGreenhouseLead.mockResolvedValue({
      applicationUrl: 'https://job-boards.greenhouse.io/example/jobs/123',
      company: 'Fixture Co',
      jobLeadId: 'lead-1',
      jobListingId: 'listing-1',
      location: 'Remote',
      source: 'Greenhouse',
      title: 'Software Engineer',
    });
    submitRunLead.mockResolvedValue({
      applicationUrl: 'https://job-boards.greenhouse.io/example/jobs/123',
      executionEnvironment: 'DESKTOP_CDP',
      message: 'Autofill reached submit guard.',
      mode: 'training',
      status: 'blocked_by_submit_guard',
      toolCalls: [],
    });

    render(<DesktopApp />);

    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: 'Pick random job' })
          .hasAttribute('disabled'),
      ).toBe(false);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Search filters' }));
    expect(screen.queryByLabelText('Mode')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Start autopilot' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick random job' }));

    await waitFor(() => {
      expect(submitRunLead).toHaveBeenCalledWith(
        expect.objectContaining({
          applicationUrl: 'https://job-boards.greenhouse.io/example/jobs/123',
          mode: 'training',
        }),
      );
    });
  });

  it('refreshes the State tab while an autofill run is pending', async () => {
    authGetState.mockResolvedValue({
      message: 'Paired',
      status: 'paired',
      tokenId: 'token-1',
      userId: 'user-1',
    });
    let resolveRun:
      | ((result: {
          applicationUrl: string;
          executionEnvironment: 'DESKTOP_CDP';
          message: string;
          mode: 'training';
          status: 'completed';
          toolCalls: [];
        }) => void)
      | null = null;
    submitRunLead.mockReturnValue(
      new Promise(resolve => {
        resolveRun = resolve;
      }),
    );

    render(<DesktopApp />);

    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: /Autofill/ })
          .hasAttribute('disabled'),
      ).toBe(false);
    });

    fireEvent.click(screen.getByRole('tab', { name: 'State' }));
    const callsBeforeRun = shellGetAssistPageContext.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /Autofill/ }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Stop the current run' }),
      ).toBeTruthy();
    });
    await waitFor(
      () => {
        expect(shellGetAssistPageContext.mock.calls.length).toBeGreaterThan(
          callsBeforeRun + 1,
        );
      },
      { timeout: 1800 },
    );

    resolveRun?.({
      applicationUrl: 'https://job-boards.greenhouse.io',
      executionEnvironment: 'DESKTOP_CDP',
      message: 'Completed',
      mode: 'training',
      status: 'completed',
      toolCalls: [],
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Autofill/ })).toBeTruthy();
    });
  });

  it('uses the live assist page URL when starting Autofill', async () => {
    authGetState.mockResolvedValue({
      message: 'Paired',
      status: 'paired',
      tokenId: 'token-1',
      userId: 'user-1',
    });
    shellGetAssistPageContext.mockResolvedValue({
      capturedAt: '2026-05-02T14:27:15.000Z',
      fields: [],
      issues: [],
      lastSubmitResult: null,
      screenshotDataUrl: null,
      title: 'Example application',
      url: 'https://job-boards.greenhouse.io/example/jobs/123',
    });
    submitRunLead.mockResolvedValue({
      applicationUrl: 'https://job-boards.greenhouse.io/example/jobs/123',
      executionEnvironment: 'DESKTOP_CDP',
      message: 'Completed',
      mode: 'training',
      status: 'completed',
      toolCalls: [],
    });

    render(<DesktopApp />);

    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: /Autofill/ })
          .hasAttribute('disabled'),
      ).toBe(false);
    });
    fireEvent.click(screen.getByRole('button', { name: /Autofill/ }));

    await waitFor(() => {
      expect(shellSetAssistUrl).toHaveBeenCalledWith(
        'https://job-boards.greenhouse.io/example/jobs/123',
      );
      expect(submitRunLead).toHaveBeenCalledWith(
        expect.objectContaining({
          applicationUrl: 'https://job-boards.greenhouse.io/example/jobs/123',
          mode: 'training',
        }),
      );
    });
  });

  it('shows field fill errors inside expanded debug events', async () => {
    authGetState.mockResolvedValue({
      message: 'Paired',
      status: 'paired',
      tokenId: 'token-1',
      userId: 'user-1',
    });
    submitRunLead.mockResolvedValue({
      applicationUrl: 'https://job-boards.greenhouse.io',
      executionEnvironment: 'DESKTOP_CDP',
      message: 'Failed',
      mode: 'training',
      status: 'failed',
      toolCalls: [
        {
          errorMessage: 'Element not found: input#email',
          input: { value: 'steven@example.com' },
          ok: false,
          reason: 'fill email',
          selector: 'input#email',
          tool: 'fill',
        },
      ],
    });

    render(<DesktopApp />);

    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: /Autofill/ })
          .hasAttribute('disabled'),
      ).toBe(false);
    });
    fireEvent.click(screen.getByRole('button', { name: /Autofill/ }));

    await waitFor(() => {
      expect(screen.getByText('fill input#email')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('fill input#email').closest('button')!);

    expect(
      screen.getByText(/field error: Element not found: input#email/),
    ).toBeTruthy();
  });
});

describe('buildValidationFingerprint', () => {
  it('returns null when there are no validation failures', () => {
    expect(buildValidationFingerprint(undefined)).toBeNull();
    expect(buildValidationFingerprint([])).toBeNull();
  });

  it('builds a stable order-independent key for the same failure set', () => {
    const a = buildValidationFingerprint([
      { fieldLabel: 'Email', fieldSelector: '#email', message: 'is required' },
      { fieldLabel: 'Phone', fieldSelector: '#phone', message: 'too short' },
    ]);
    const b = buildValidationFingerprint([
      { fieldLabel: 'Phone', fieldSelector: '#phone', message: 'too short' },
      { fieldLabel: 'Email', fieldSelector: '#email', message: 'is required' },
    ]);
    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });

  it('changes when a field or error text differs', () => {
    const base = buildValidationFingerprint([
      { fieldLabel: 'Email', fieldSelector: '#email', message: 'is required' },
    ]);
    const differentMessage = buildValidationFingerprint([
      { fieldLabel: 'Email', fieldSelector: '#email', message: 'invalid' },
    ]);
    const differentLabel = buildValidationFingerprint([
      { fieldLabel: 'Work email', fieldSelector: '#email', message: 'is required' },
    ]);
    expect(base).not.toBe(differentMessage);
    expect(base).not.toBe(differentLabel);
  });

  it('ignores selector differences (only label + message identify the failure)', () => {
    const a = buildValidationFingerprint([
      { fieldLabel: 'Email', fieldSelector: '#email', message: 'is required' },
    ]);
    const b = buildValidationFingerprint([
      { fieldLabel: 'Email', fieldSelector: 'input[name="email"]', message: 'is required' },
    ]);
    expect(a).toBe(b);
  });
});
