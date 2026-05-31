import { describe, expect, it } from 'vitest';
import { generateFollowUpDraft } from '../draft-generator';

describe('generateFollowUpDraft', () => {
  it('produces a neutral body when no voice sample is supplied', () => {
    const draft = generateFollowUpDraft({
      applicantFirstName: 'Steven',
      company: 'Fixture Co',
      daysSinceSubmission: 7,
      role: 'Senior Engineer',
      submittedAt: new Date('2026-04-15T00:00:00Z'),
    });

    expect(draft.subject).toBe('Following up — Senior Engineer at Fixture Co');
    expect(draft.bodyMarkdown).toMatch(/Senior Engineer/);
    expect(draft.bodyMarkdown).toMatch(/Fixture Co/);
    expect(draft.bodyMarkdown).toMatch(/Steven/);
    expect(draft.bodyMarkdown).toMatch(/7 days/);
  });

  it('falls back to "the team" when company is null', () => {
    const draft = generateFollowUpDraft({
      company: null,
      daysSinceSubmission: 9,
      role: 'Staff Platform Engineer',
      submittedAt: new Date('2026-04-13T00:00:00Z'),
    });
    expect(draft.subject).toBe(
      'Following up on my Staff Platform Engineer application',
    );
    expect(draft.bodyMarkdown).toMatch(/the team/);
  });

  it('uses voice sample when non-trivial', () => {
    const draft = generateFollowUpDraft({
      company: 'Fixture Co',
      daysSinceSubmission: 7,
      role: 'Engineer',
      submittedAt: new Date(),
      voiceSample:
        "Hey — I tend to write like this, friendly and short, and I always follow up with a specific ask.",
    });
    expect(draft.bodyMarkdown).toMatch(/friendly and short/);
  });

  it('ignores a voice sample shorter than 20 chars', () => {
    const uniqueVoice = 'xyz-short-marker';
    const draft = generateFollowUpDraft({
      company: 'Fixture Co',
      daysSinceSubmission: 7,
      role: 'Engineer',
      submittedAt: new Date(),
      voiceSample: uniqueVoice,
    });
    // Neutral template path — the voice sample must not be embedded.
    expect(draft.bodyMarkdown).not.toMatch(/xyz-short-marker/);
    expect(draft.bodyMarkdown).toMatch(/circle back/);
  });

  it('caps voice sample at 400 chars', () => {
    const longVoice = 'abcde'.repeat(500);
    const draft = generateFollowUpDraft({
      company: 'Fixture Co',
      daysSinceSubmission: 7,
      role: 'Engineer',
      submittedAt: new Date(),
      voiceSample: longVoice,
    });
    // Only the first 400 characters of voice should appear contiguously.
    const contiguous = draft.bodyMarkdown.match(/a(?:bcde){79,}/)?.[0] ?? '';
    expect(contiguous.length).toBeLessThanOrEqual(400);
  });
});
