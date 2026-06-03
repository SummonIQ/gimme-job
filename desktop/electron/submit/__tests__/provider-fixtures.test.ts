import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const PROVIDERS = [
  'ashby',
  'lever',
  'workable',
  'smartrecruiters',
  'recruitee',
  'teamtailor',
  'jobvite',
  'bamboohr',
  'personio',
  'breezy',
] as const;

const FIXTURE_FILES = [
  'apply.html',
  'required-custom-question.html',
  'resume-upload.html',
  'disabled-submit.html',
  'confirmation.html',
  'validation-error.html',
] as const;

interface FixtureSet {
  readonly apply: string;
  readonly requiredCustomQuestion: string;
  readonly resumeUpload: string;
  readonly disabledSubmit: string;
  readonly confirmation: string;
  readonly validationError: string;
}

const readFixture = async (
  provider: (typeof PROVIDERS)[number],
  file: (typeof FIXTURE_FILES)[number],
): Promise<string> =>
  readFile(new URL(`./fixtures/${provider}/${file}`, import.meta.url), 'utf8');

const readFixtureSet = async (
  provider: (typeof PROVIDERS)[number],
): Promise<FixtureSet> => ({
  apply: await readFixture(provider, 'apply.html'),
  requiredCustomQuestion: await readFixture(
    provider,
    'required-custom-question.html',
  ),
  resumeUpload: await readFixture(provider, 'resume-upload.html'),
  disabledSubmit: await readFixture(provider, 'disabled-submit.html'),
  confirmation: await readFixture(provider, 'confirmation.html'),
  validationError: await readFixture(provider, 'validation-error.html'),
});

describe('provider fixtures', () => {
  it.each(PROVIDERS)('%s has the complete P17.3 fixture set', async provider => {
    await expect(
      Promise.all(FIXTURE_FILES.map(file => readFixture(provider, file))),
    ).resolves.toHaveLength(FIXTURE_FILES.length);
  });

  it.each(PROVIDERS)(
    '%s apply fixture supports happy-path submit',
    async provider => {
      const fixtures = await readFixtureSet(provider);

      expect(fixtures.apply).toContain(`data-provider="${provider}"`);
      expect(fixtures.apply).toMatch(/<form\b/i);
      expect(fixtures.apply).toMatch(/\brequired\b/i);
      expect(fixtures.apply).toMatch(/type="file"/i);
      expect(fixtures.apply).toMatch(/type="submit"/i);
      expect(fixtures.apply).not.toMatch(/\bdisabled\b|aria-disabled="true"/i);
    },
  );

  it.each(PROVIDERS)(
    '%s captures a required custom resolver question',
    async provider => {
      const fixtures = await readFixtureSet(provider);

      expect(fixtures.requiredCustomQuestion).toMatch(/\brequired\b/i);
      expect(fixtures.requiredCustomQuestion).toMatch(
        /authorized|location|relocate|clearance|sponsorship|visa|remote|office/i,
      );
      expect(fixtures.requiredCustomQuestion).toMatch(
        /<select\b|type="radio"/i,
      );
    },
  );

  it.each(PROVIDERS)(
    '%s captures resume-upload-only behavior',
    async provider => {
      const fixtures = await readFixtureSet(provider);

      expect(fixtures.resumeUpload).toMatch(/resume|cv/i);
      expect(fixtures.resumeUpload).toMatch(/type="file"/i);
      expect(fixtures.resumeUpload).toMatch(/type="submit"/i);
    },
  );

  it.each(PROVIDERS)(
    '%s captures disabled-submit behavior',
    async provider => {
      const fixtures = await readFixtureSet(provider);

      expect(fixtures.disabledSubmit).toMatch(
        /\bdisabled\b|aria-disabled="true"|display:\s*none/i,
      );
      expect(fixtures.disabledSubmit).toMatch(/type="submit"/i);
    },
  );

  it.each(PROVIDERS)(
    '%s exposes provider confirmation text',
    async provider => {
      const fixtures = await readFixtureSet(provider);

      expect(fixtures.confirmation).toMatch(
        /application (submitted|received|complete)|successfully applied|thanks for applying/i,
      );
    },
  );

  it.each(PROVIDERS)(
    '%s exposes native validation errors',
    async provider => {
      const fixtures = await readFixtureSet(provider);

      expect(fixtures.validationError).toMatch(/\brequired\b/i);
      expect(fixtures.validationError).toMatch(
        /aria-invalid="true"|role="alert"|field-error/i,
      );
    },
  );
});
