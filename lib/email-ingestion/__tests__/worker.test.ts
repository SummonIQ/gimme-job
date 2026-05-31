import { describe, expect, it } from 'vitest';
import { matchConfirmationToSubmission } from '../worker';
import type { ParsedConfirmation } from '../parsers';

function parsed(
  overrides: Partial<ParsedConfirmation> = {},
): ParsedConfirmation {
  return {
    company: 'Fixture Co',
    dashboardUrl: null,
    family: 'greenhouse',
    receivedAt: new Date('2026-04-22T12:00:00Z'),
    role: 'Senior Software Engineer',
    subject: 'Thanks for applying to Senior Software Engineer at Fixture Co',
    ...overrides,
  };
}

describe('matchConfirmationToSubmission', () => {
  it('returns null on empty candidate list', () => {
    expect(matchConfirmationToSubmission(parsed(), [])).toBeNull();
  });

  it('returns null when company and role do not match', () => {
    const result = matchConfirmationToSubmission(parsed(), [
      {
        company: 'Totally Different Inc',
        id: 's1',
        jobTitle: 'Product Manager',
        submittedAt: new Date(),
      },
    ]);
    expect(result).toBeNull();
  });

  it('returns the exact company + role match', () => {
    const result = matchConfirmationToSubmission(parsed(), [
      {
        company: 'Fixture Co',
        id: 'hit',
        jobTitle: 'Senior Software Engineer',
        submittedAt: new Date(),
      },
      {
        company: 'Other Co',
        id: 'miss',
        jobTitle: 'Senior Software Engineer',
        submittedAt: new Date(),
      },
    ]);
    expect(result).toBe('hit');
  });

  it('prefers the most recently submitted on tie', () => {
    const newer = new Date('2026-04-21T00:00:00Z');
    const older = new Date('2026-04-01T00:00:00Z');
    const result = matchConfirmationToSubmission(parsed(), [
      {
        company: 'Fixture Co',
        id: 'old',
        jobTitle: 'Senior Software Engineer',
        submittedAt: older,
      },
      {
        company: 'Fixture Co',
        id: 'new',
        jobTitle: 'Senior Software Engineer',
        submittedAt: newer,
      },
    ]);
    expect(result).toBe('new');
  });

  it('accepts substring matches (score 2) when exact matches are not available', () => {
    const result = matchConfirmationToSubmission(
      parsed({ company: 'Fixture', role: 'Senior Engineer' }),
      [
        {
          company: 'Fixture Co',
          id: 's1',
          jobTitle: 'Senior Software Engineer',
          submittedAt: new Date(),
        },
      ],
    );
    expect(result).toBe('s1');
  });

  it('refuses to match when neither company nor role align', () => {
    const result = matchConfirmationToSubmission(
      parsed({ company: 'Something', role: 'Nothing' }),
      [
        {
          company: 'Fixture Co',
          id: 's1',
          jobTitle: 'Senior Software Engineer',
          submittedAt: new Date(),
        },
      ],
    );
    expect(result).toBeNull();
  });
});
