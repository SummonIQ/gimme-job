import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { extractValidationFailures } from '../validation-extract';

const PROVIDERS = [
  ['ashby', 'Full name', 'Full name is required.'],
  ['lever', 'Full name', 'Name is required.'],
  ['workable', 'Email', 'Email is required.'],
  ['smartrecruiters', 'Email', 'Email is required.'],
  ['recruitee', 'Email', 'Email is required.'],
  ['teamtailor', 'Email', 'Email is required.'],
  ['jobvite', 'First name', 'First name is required.'],
  ['bamboohr', 'Email', 'Email is required.'],
  ['personio', 'Last name', 'Last name is required.'],
  ['breezy', 'Full name', 'Full name is required.'],
] as const;

describe('extractValidationFailures', () => {
  it.each(PROVIDERS)(
    'extracts %s native validation text',
    async (provider, expectedFieldLabel, expectedMessage) => {
      const html = await readFile(
        join(
          process.cwd(),
          'desktop',
          'electron',
          'submit',
          '__tests__',
          'fixtures',
          provider,
          'validation-error.html',
        ),
        'utf8',
      );

      expect(extractValidationFailures(html)).toContainEqual(
        expect.objectContaining({
          fieldLabel: expectedFieldLabel,
          message: expectedMessage,
        }),
      );
    },
  );

  it('deduplicates an aria-invalid field and matching alert', () => {
    expect(
      extractValidationFailures(`
        <form>
          <label>Email <input name="email" aria-invalid="true" required></label>
          <p role="alert">Email is required.</p>
        </form>
      `),
    ).toEqual([
      {
        fieldLabel: 'Email',
        fieldSelector: 'input[name="email"]',
        message: 'Email is required.',
      },
    ]);
  });
});
