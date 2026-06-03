// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SubmitLeadView } from '../SubmitLeadView';

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: createStorageMock(),
  });
});

afterEach(() => {
  cleanup();
  window.localStorage?.clear?.();
});

describe('SubmitLeadView', () => {
  it('requires pairing before enabling the submit action', () => {
    render(
      <SubmitLeadView
        aiProvider="openai"
        applicationUrl="https://job-boards.greenhouse.io"
        authStatus="unpaired"
        isPickingRandom={false}
        jobLeadId=""
        mode="training"
        onSubmitLead={vi.fn()}
        selectionMessage={null}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Submit this lead' }),
    ).toHaveProperty('disabled', true);
    expect(screen.getByText('Pair this desktop before submit.')).toBeTruthy();
  });

  it('submits the current Greenhouse URL and mode', async () => {
    const onSubmitLead = vi.fn(async () => ({
      applicationUrl: 'https://job-boards.greenhouse.io/example/jobs/123',
      executionEnvironment: 'DESKTOP_CDP' as const,
      message: 'Training run reached the Greenhouse submit control.',
      mode: 'training' as const,
      status: 'blocked_by_submit_guard' as const,
      toolCalls: [],
    }));
    render(
      <SubmitLeadView
        aiProvider="openai"
        applicationUrl="https://job-boards.greenhouse.io/example/jobs/123"
        authStatus="paired"
        isPickingRandom={false}
        jobLeadId=""
        mode="training"
        onSubmitLead={onSubmitLead}
        selectionMessage={null}
      />,
    );

    const submitButton = screen.getByRole('button', {
      name: 'Submit this lead',
    });
    fireEvent.submit(submitButton.closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(onSubmitLead).toHaveBeenCalledWith({
        aiProvider: 'openai',
        applicationUrl: 'https://job-boards.greenhouse.io/example/jobs/123',
        continueFromCurrentPage: false,
        jobLeadId: undefined,
        mode: 'training',
      });
    });
    expect(await screen.findByText('Submit guard held')).toBeTruthy();
    expect(
      await screen.findByText(
        'Training run reached the submit button without firing it.',
      ),
    ).toBeTruthy();
  });
});

function createStorageMock(): Storage {
  const store = new Map<string, string>();

  return {
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    get length() {
      return store.size;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}
