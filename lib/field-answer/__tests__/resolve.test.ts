// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  isOllamaJsonRescueEnabled,
  resolveDeterministicAnswer,
} from '../resolve';

type Profile = Parameters<typeof resolveDeterministicAnswer>[0]['profile'];
type Employment = Parameters<
  typeof resolveDeterministicAnswer
>[0]['employmentHistory'][number];

const baseProfile: Profile = {
  canadaWorkPreference: null,
  citizenshipStatus: null,
  city: null,
  country: 'US',
  disabilityStatus: null,
  email: null,
  firstName: null,
  fullName: null,
  gender: null,
  githubUrl: null,
  hispanicLatino: null,
  languages: null,
  lastName: null,
  linkedinUrl: null,
  personalWebsiteUrl: null,
  phone: null,
  preferredName: null,
  pronouns: null,
  race: null,
  referralSource: null,
  requiresSponsorship: null,
  salaryExpectation: null,
  state: null,
  transgenderIdentity: null,
  veteranStatus: null,
  websiteUrl: null,
  workAuthorization: null,
  yearsOfExperience: null,
};

const callResolver = (overrides: {
  question: string;
  fieldType?: string;
  options?: readonly string[];
  profile?: Partial<Profile>;
  employmentHistory?: readonly Employment[];
}) =>
  resolveDeterministicAnswer({
    employmentHistory: overrides.employmentHistory ?? [],
    fieldType: overrides.fieldType ?? 'text',
    jobContext: null,
    options: overrides.options ?? [],
    profile: { ...baseProfile, ...(overrides.profile ?? {}) },
    question: overrides.question,
  });

describe('resolveDeterministicAnswer — P17.12 patterns', () => {
  describe('consent / data-processing', () => {
    it('answers Yes to "I consent to processing of my personal data"', () => {
      const result = callResolver({
        fieldType: 'checkbox',
        options: ['Yes', 'No'],
        question: 'I consent to the processing of my personal data',
      });
      expect(result?.answer).toMatch(/yes/i);
    });

    it('answers Yes to "I agree to the collection and storage of my information"', () => {
      const result = callResolver({
        fieldType: 'checkbox',
        options: ['Yes', 'No'],
        question:
          'I agree to the collection and storage of my information for recruitment purposes',
      });
      expect(result?.answer).toMatch(/yes/i);
    });

    it('answers Yes to "I authorize the collection of my data"', () => {
      const result = callResolver({
        fieldType: 'checkbox',
        options: ['Yes', 'No'],
        question: 'I authorize the collection of my data',
      });
      expect(result?.answer).toMatch(/yes/i);
    });
  });

  describe('notice period', () => {
    it('returns "2 weeks" for notice-period question', () => {
      const result = callResolver({
        question: 'What is your notice period?',
      });
      expect(result?.answer).toBe('2 weeks');
    });

    it('returns "2 weeks" for "How much notice do you need to give?"', () => {
      const result = callResolver({
        question: 'How much notice do you need to give your current employer?',
      });
      expect(result?.answer).toBe('2 weeks');
    });
  });

  describe('start date', () => {
    it('returns "Two weeks from offer acceptance" for earliest start date', () => {
      const result = callResolver({
        question: 'Earliest possible start date?',
      });
      expect(result?.answer).toBe('Two weeks from offer acceptance');
    });

    it('returns "Two weeks from offer acceptance" for "When can you start?"', () => {
      const result = callResolver({
        question: 'When can you start?',
      });
      expect(result?.answer).toBe('Two weeks from offer acceptance');
    });

    it('returns "Two weeks from offer acceptance" for plain "Start date"', () => {
      const result = callResolver({
        question: 'Start date',
      });
      expect(result?.answer).toBe('Two weeks from offer acceptance');
    });
  });

  describe('total years of experience', () => {
    it('returns profile yearsOfExperience verbatim for text fields', () => {
      const result = callResolver({
        fieldType: 'text',
        profile: { yearsOfExperience: '7' },
        question: 'Total years of professional experience?',
      });
      expect(result?.answer).toBe('7');
    });

    it('returns null for text fields when profile is missing the value', () => {
      const result = callResolver({
        fieldType: 'text',
        question: 'Total years of professional experience?',
      });
      expect(result).toBeNull();
    });

    it('matches a select range option (3-5) when profile is "4"', () => {
      const result = callResolver({
        fieldType: 'select',
        options: ['0-2', '3-5', '6-9', '10+'],
        profile: { yearsOfExperience: '4' },
        question: 'How many years of experience do you have?',
      });
      expect(result?.answer).toBe('3-5');
    });

    it('matches an "or more" select option (10+) when profile is "12"', () => {
      const result = callResolver({
        fieldType: 'select',
        options: ['0-2', '3-5', '6-9', '10+'],
        profile: { yearsOfExperience: '12' },
        question: 'Years of experience',
      });
      expect(result?.answer).toBe('10+');
    });

    it('matches a "Less than 1 year" option when profile is "0"', () => {
      const result = callResolver({
        fieldType: 'select',
        options: ['Less than 1 year', '1-3 years', '4-6 years', '7+ years'],
        profile: { yearsOfExperience: '0' },
        question: 'Years of experience',
      });
      expect(result?.answer).toBe('Less than 1 year');
    });
  });

  describe('current employer / title', () => {
    const ongoing: Employment = {
      company: 'Stripe',
      endDate: null,
      startDate: '2023-01-01',
      title: 'Senior Software Engineer',
    };
    const past: Employment = {
      company: 'Datadog',
      endDate: '2022-12-31',
      startDate: '2020-01-01',
      title: 'Software Engineer',
    };

    it('returns the no-end-date entry company for current-employer questions', () => {
      const result = callResolver({
        employmentHistory: [past, ongoing],
        question: 'Who is your current employer?',
      });
      expect(result?.answer).toBe('Stripe');
    });

    it('returns the no-end-date entry title for current-title questions', () => {
      const result = callResolver({
        employmentHistory: [past, ongoing],
        question: 'What is your current title?',
      });
      expect(result?.answer).toBe('Senior Software Engineer');
    });

    it('falls back to the most-recent entry when every job has an end date', () => {
      const result = callResolver({
        employmentHistory: [past],
        question: 'Where are you currently working?',
      });
      expect(result?.answer).toBe('Datadog');
    });

    it('returns null when employment history is empty', () => {
      const result = callResolver({
        question: 'Current employer',
      });
      expect(result).toBeNull();
    });
  });

  describe('security clearance', () => {
    it('answers No on a yes/no field', () => {
      const result = callResolver({
        fieldType: 'radio',
        options: ['Yes', 'No'],
        question: 'Do you currently hold a security clearance?',
      });
      expect(result?.answer).toMatch(/no/i);
    });

    it('picks the "None" option on a select', () => {
      const result = callResolver({
        fieldType: 'select',
        options: ['None', 'Secret', 'Top Secret'],
        question: 'Security clearance level',
      });
      expect(result?.answer).toBe('None');
    });

    it('falls through to "No" answer on a text field', () => {
      const result = callResolver({
        fieldType: 'text',
        question: 'Do you have an active security clearance?',
      });
      expect(result?.answer).toMatch(/^no$/i);
    });
  });
});

describe('isOllamaJsonRescueEnabled (P17.21)', () => {
  const originalValue = process.env.GIMMEJOB_OLLAMA_JSON_RESCUE;

  beforeEach(() => {
    delete process.env.GIMMEJOB_OLLAMA_JSON_RESCUE;
  });

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.GIMMEJOB_OLLAMA_JSON_RESCUE;
    } else {
      process.env.GIMMEJOB_OLLAMA_JSON_RESCUE = originalValue;
    }
  });

  it('is off when the env flag is unset', () => {
    expect(isOllamaJsonRescueEnabled()).toBe(false);
  });

  it('is on when the env flag is "1"', () => {
    process.env.GIMMEJOB_OLLAMA_JSON_RESCUE = '1';
    expect(isOllamaJsonRescueEnabled()).toBe(true);
  });

  it('is on when the env flag is "true"', () => {
    process.env.GIMMEJOB_OLLAMA_JSON_RESCUE = 'true';
    expect(isOllamaJsonRescueEnabled()).toBe(true);
  });

  it('is off for any other value', () => {
    for (const value of ['0', 'false', 'yes', '', 'on']) {
      process.env.GIMMEJOB_OLLAMA_JSON_RESCUE = value;
      expect(isOllamaJsonRescueEnabled()).toBe(false);
    }
  });
});
