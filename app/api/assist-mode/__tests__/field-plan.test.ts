// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/user/knowledge', () => ({
  getUserKnowledge: vi.fn(),
}));

vi.mock('@/lib/user/query', () => ({
  getCurrentUser: vi.fn(),
}));

import {
  buildKnownValues,
  matchKnownValue,
} from '@/app/api/assist-mode/field-plan/route';

describe('assist mode field plan known value matching', () => {
  it('separates sponsorship from work authorization fields', () => {
    const known = buildKnownValues(
      {},
      {
        requiresSponsorship: false,
        workAuthorization: 'Authorized to work in the US',
      },
      {},
    );

    expect(
      matchKnownValue(
        'Are you able to work in the United States?',
        'select',
        'select',
        undefined,
        known,
      ),
    ).toBe('Authorized to work in the US');
    expect(
      matchKnownValue(
        'Will you now or in the future require sponsorship for Employment Visa status?',
        'select',
        'select',
        undefined,
        known,
      ),
    ).toBe('No');
  });

  it('maps equal employment opportunity labels to profile values', () => {
    const known = buildKnownValues(
      { hispanicLatino: 'No' },
      {
        disabilityStatus: 'I do not want to answer',
        gender: 'Male',
        race: 'White',
        veteranStatus: 'I do not wish to answer',
      },
      {},
    );

    expect(
      matchKnownValue(
        'I identify my ethnicity as:',
        'select',
        'select',
        undefined,
        known,
      ),
    ).toBe('White');
    expect(
      matchKnownValue(
        'With which gender do you most identify?',
        'select',
        'select',
        undefined,
        known,
      ),
    ).toBe('Male');
    expect(
      matchKnownValue(
        'Are you Hispanic/Latino?',
        'select',
        'select',
        undefined,
        known,
      ),
    ).toBe('No');
    expect(
      matchKnownValue(
        'Disability Status',
        'select',
        'select',
        undefined,
        known,
      ),
    ).toBe('I do not want to answer');
    expect(
      matchKnownValue('Veteran Status', 'select', 'select', undefined, known),
    ).toBe('I do not wish to answer');
  });
});
