// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DesktopSidebar, type DesktopSidebarTab } from '../desktop-sidebar';

afterEach(() => {
  cleanup();
});

describe('DesktopSidebar', () => {
  function renderSidebar({
    initialTab = 'debug',
    onFocusAssistField = vi.fn(),
  }: {
    readonly initialTab?: DesktopSidebarTab;
    readonly onFocusAssistField?: ReturnType<typeof vi.fn>;
  } = {}) {
    function Harness() {
      const [activeTab, setActiveTab] = useState<DesktopSidebarTab>(initialTab);
      return (
        <DesktopSidebar
          activeTab={activeTab}
          agentChatView={<div>Agent chat content</div>}
          assistPageContext={{
            capturedAt: '2026-05-02T14:27:15.000Z',
            fields: [
              {
                ariaLabel: null,
                autocomplete: 'given-name',
                candidateSelectors: ['input#first_name'],
                checked: null,
                disabled: false,
                id: 'first_name',
                inputType: 'text',
                label: 'First name',
                name: 'first_name',
                options: [],
                placeholder: null,
                required: true,
                selector: 'input#first_name',
                tagName: 'input',
                value: 'Steven',
                visible: true,
                wasAutofilled: {
                  action: 'fill',
                  ok: true,
                  reason: 'profile identity',
                  value: 'Steven',
                },
              },
              {
                ariaLabel: null,
                autocomplete: null,
                candidateSelectors: ['textarea#why'],
                checked: null,
                disabled: false,
                id: 'why',
                inputType: null,
                label: 'Why do you want to work here?',
                name: 'why',
                options: [],
                placeholder: null,
                required: true,
                selector: 'textarea#why',
                tagName: 'textarea',
                value: null,
                visible: true,
              },
            ],
            issues: [
              {
                fieldSelector: 'textarea#why',
                message:
                  'Why do you want to work here? is required and currently empty.',
                severity: 'warning',
              },
            ],
            lastSubmitResult: null,
            screenshotDataUrl: null,
            title: 'Example application',
            url: 'https://job-boards.greenhouse.io/example',
          }}
          debugEvents={[]}
          fieldObservations={[]}
          history={[]}
          observations={[]}
          onFocusAssistField={onFocusAssistField}
          onLoadSavedJob={vi.fn()}
          onRefreshAssistPageContext={vi.fn()}
          onTabChange={setActiveTab}
          savedDrafts={[]}
        />
      );
    }

    render(<Harness />);
  }

  it('renders Agent, State, Debug, and History tabs in order', () => {
    renderSidebar();

    expect(
      screen.getByRole('complementary', { name: 'Desktop runtime sidebar' }),
    ).toBeTruthy();
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Agent',
      'State',
      'Debug',
      'History',
    ]);
  });

  it('switches to Agent tab on click', () => {
    renderSidebar();

    fireEvent.click(screen.getByRole('tab', { name: 'Agent' }));
    expect(screen.getByText('Agent chat content')).toBeTruthy();
  });

  it('switches to State tab on click and shows fields table', () => {
    renderSidebar();

    fireEvent.click(screen.getByRole('tab', { name: 'State' }));
    expect(screen.getByText('Fields')).toBeTruthy();
    expect(screen.getByText('First name')).toBeTruthy();
    expect(screen.getByText('Why do you want to work here?')).toBeTruthy();
    expect(screen.getByText('required')).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Page fields' })).toBeTruthy();
  });

  it('requests assist field focus when a field row is clicked', () => {
    const onFocusAssistField = vi.fn();
    renderSidebar({ initialTab: 'state', onFocusAssistField });

    fireEvent.click(screen.getByText('First name'));

    expect(onFocusAssistField).toHaveBeenCalledWith(
      expect.objectContaining({ selector: 'input#first_name' }),
    );
    expect(screen.getByText(/Agent guess/)).toBeTruthy();

    fireEvent.click(screen.getByText('First name'));
    expect(screen.queryByText(/Agent guess/)).toBeNull();
  });

  it('expands a field row to reveal candidate selectors', () => {
    renderSidebar();

    fireEvent.click(screen.getByRole('tab', { name: 'State' }));
    const expandButtons = screen.getAllByRole('button', {
      name: 'Expand field',
    });
    fireEvent.click(expandButtons[0]);
    expect(screen.getByText(/Agent guess/)).toBeTruthy();
    expect(screen.getByText('Selectors')).toBeTruthy();
  });

  it('switches to History tab on click', () => {
    renderSidebar();

    fireEvent.click(screen.getByRole('tab', { name: 'History' }));
    expect(screen.getByText('Submissions')).toBeTruthy();
    expect(screen.getByText('Saved jobs')).toBeTruthy();
  });
});
