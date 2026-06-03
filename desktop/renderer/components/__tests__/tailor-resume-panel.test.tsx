// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DesktopAssistPageContext } from '../../desktop-api';
import {
  isGreenhouseApplicationForm,
  TailorResumePanel,
} from '../tailor-resume-panel';

afterEach(() => {
  cleanup();
});

function makeField(
  overrides: Partial<DesktopAssistPageContext['fields'][number]> = {},
): DesktopAssistPageContext['fields'][number] {
  return {
    ariaLabel: null,
    autocomplete: null,
    candidateSelectors: [],
    checked: null,
    disabled: false,
    id: null,
    inputType: 'text',
    label: null,
    name: null,
    options: [],
    placeholder: null,
    required: false,
    selector: 'input',
    tagName: 'input',
    value: null,
    visible: true,
    ...overrides,
  };
}

function makeContext(
  overrides: Partial<DesktopAssistPageContext> = {},
): DesktopAssistPageContext {
  return {
    capturedAt: '2026-05-03T00:00:00.000Z',
    fields: [],
    issues: [],
    lastSubmitResult: null,
    screenshotDataUrl: null,
    title: 'Apply',
    url: 'https://job-boards.greenhouse.io/example/jobs/123',
    ...overrides,
  };
}

describe('isGreenhouseApplicationForm', () => {
  it('returns true when a greenhouse URL has a resume file input and a submit button', () => {
    const context = makeContext({
      fields: [
        makeField({
          id: 'resume',
          inputType: 'file',
          name: 'resume',
          tagName: 'input',
        }),
        makeField({
          label: 'Submit Application',
          tagName: 'button',
          value: 'Submit Application',
        }),
      ],
    });
    expect(isGreenhouseApplicationForm(context)).toBe(true);
  });

  it('returns false when there is no resume file input', () => {
    const context = makeContext({
      fields: [
        makeField({
          label: 'Submit Application',
          tagName: 'button',
          value: 'Submit Application',
        }),
      ],
    });
    expect(isGreenhouseApplicationForm(context)).toBe(false);
  });

  it('returns false on a non-greenhouse URL', () => {
    const context = makeContext({
      fields: [
        makeField({
          id: 'resume',
          inputType: 'file',
          name: 'resume',
          tagName: 'input',
        }),
        makeField({
          label: 'Submit Application',
          tagName: 'button',
          value: 'Submit Application',
        }),
      ],
      url: 'https://jobs.lever.co/example/123',
    });
    expect(isGreenhouseApplicationForm(context)).toBe(false);
  });
});

describe('TailorResumePanel', () => {
  const baseContext = makeContext({
    fields: [
      makeField({
        id: 'resume',
        inputType: 'file',
        name: 'resume',
        tagName: 'input',
      }),
      makeField({
        label: 'Submit Application',
        tagName: 'button',
        value: 'Submit Application',
      }),
    ],
  });

  it('renders nothing when the page is not a greenhouse application form', () => {
    const { container } = render(
      <TailorResumePanel
        context={makeContext({ url: 'https://example.com' })}
        jobLeadId="lead-1"
        onTailor={vi.fn()}
        onUseInAssist={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('disables the tailor button when no jobLeadId is set', () => {
    render(
      <TailorResumePanel
        context={baseContext}
        jobLeadId={null}
        onTailor={vi.fn()}
        onUseInAssist={vi.fn()}
      />,
    );
    const button = screen.getByRole('button', { name: /tailor resume/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders the result and calls onUseInAssist with the tailored record', async () => {
    const tailored = {
      emphasizedKeywords: ['typescript', 'aws'],
      formats: { docx: 'https://blob/docx', pdf: 'https://blob/pdf' },
      revisionId: 'rev-1',
      summary: 'Tailored for the role',
    };
    const onTailor = vi.fn().mockResolvedValue(tailored);
    const onUseInAssist = vi.fn().mockResolvedValue({ injected: true });

    render(
      <TailorResumePanel
        context={baseContext}
        jobLeadId="lead-1"
        onTailor={onTailor}
        onUseInAssist={onUseInAssist}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /tailor resume/i }));

    await waitFor(() =>
      expect(screen.getByText(/Tailored for the role/i)).toBeInTheDocument(),
    );
    expect(onTailor).toHaveBeenCalledWith('lead-1');

    fireEvent.click(screen.getByRole('button', { name: /use this resume/i }));

    await waitFor(() =>
      expect(onUseInAssist).toHaveBeenCalledWith(tailored),
    );
    await waitFor(() =>
      expect(
        screen.getByText(/Tailored resume injected/i),
      ).toBeInTheDocument(),
    );
  });

  it('shows the failure reason when the injection script returns false', async () => {
    const onTailor = vi.fn().mockResolvedValue({
      emphasizedKeywords: [],
      formats: { docx: 'https://blob/docx', pdf: 'https://blob/pdf' },
      revisionId: 'rev-1',
      summary: 'Tailored',
    });
    const onUseInAssist = vi.fn().mockResolvedValue({
      injected: false,
      reason: 'No matching <input type="file"> was found.',
    });

    render(
      <TailorResumePanel
        context={baseContext}
        jobLeadId="lead-1"
        onTailor={onTailor}
        onUseInAssist={onUseInAssist}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /tailor resume/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /use this resume/i })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /use this resume/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/No matching <input type="file"> was found/i),
      ).toBeInTheDocument(),
    );
  });
});
