import { describe, expect, it } from 'vitest';

import {
  compactWorkExperience,
  extractWorkExperienceFromResumeJson,
  parseStoredWorkExperience,
} from '../work-experience';

describe('work experience profile helpers', () => {
  it('keeps separate bullet item inputs when compacting work experience', () => {
    expect(
      compactWorkExperience([
        {
          bulletItems: [
            { text: 'Built accessible React workflows.' },
            { text: ' ' },
            { text: 'Reduced deployment time by 80%.' },
          ],
          company: 'SummonIQ',
          description: 'Lead product engineering.',
          endMonth: 3,
          endYear: 2026,
          startMonth: 0,
          startYear: 2022,
          title: 'Principal Engineer',
        },
      ]),
    ).toEqual([
      {
        bulletItems: [
          { text: 'Built accessible React workflows.' },
          { text: 'Reduced deployment time by 80%.' },
        ],
        company: 'SummonIQ',
        description: 'Lead product engineering.',
        endDate: '',
        endMonth: 3,
        endYear: 2026,
        startDate: '',
        startMonth: 0,
        startYear: 2022,
        title: 'Principal Engineer',
      },
    ]);
  });

  it('backfills bullet items from legacy newline descriptions', () => {
    expect(
      compactWorkExperience([
        {
          description:
            '- Owned application form automation\n- Improved resume parsing',
        },
      ]),
    ).toEqual([
      {
        bulletItems: [
          { text: 'Owned application form automation' },
          { text: 'Improved resume parsing' },
        ],
        company: '',
        description:
          '- Owned application form automation\n- Improved resume parsing',
        endDate: '',
        startDate: '',
        title: '',
      },
    ]);
  });

  it('extracts bullet item objects before falling back to resume JSON highlights', () => {
    expect(
      extractWorkExperienceFromResumeJson({
        work: [
          {
            bulletItems: [{ text: 'Parsed job bullets into separate fields.' }],
            company: 'Gimme Job',
            endDate: 'Apr 2026',
            position: 'Staff Engineer',
            startDate: 'Jan 2024',
            summary: 'Resume automation.',
          },
        ],
      }),
    ).toEqual([
      {
        bulletItems: [{ text: 'Parsed job bullets into separate fields.' }],
        company: 'Gimme Job',
        description: 'Resume automation.',
        endDate: 'Apr 2026',
        endYear: 2026,
        startDate: 'Jan 2024',
        startYear: 2024,
        title: 'Staff Engineer',
      },
    ]);
  });

  it('parses saved work experience from user knowledge', () => {
    expect(
      parseStoredWorkExperience(
        JSON.stringify([
          {
            bulletItems: ['Built desktop resume upload selection.'],
            company: 'Gimme Job',
            title: 'Engineer',
          },
        ]),
      ),
    ).toEqual([
      {
        bulletItems: [{ text: 'Built desktop resume upload selection.' }],
        company: 'Gimme Job',
        description: '',
        endDate: '',
        startDate: '',
        title: 'Engineer',
      },
    ]);
  });
});
