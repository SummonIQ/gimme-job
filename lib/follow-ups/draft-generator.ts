export interface DraftInput {
  readonly role: string;
  readonly company: string | null;
  readonly submittedAt: Date;
  readonly daysSinceSubmission: number;
  /**
   * Free-form voice snippet pulled from UserKnowledge.coverLetterStyle.
   * Empty string is fine — the generator falls back to a neutral template.
   */
  readonly voiceSample?: string;
  readonly applicantFirstName?: string;
}

export interface GeneratedDraft {
  readonly subject: string;
  readonly bodyMarkdown: string;
}

function neutralBody(input: DraftInput): string {
  const company = input.company ?? 'the team';
  const role = input.role;
  const firstName = input.applicantFirstName ?? '';

  return [
    `Hi,`,
    ``,
    `I wanted to circle back on my application for the ${role} role at ${company}. ` +
      `It's been about ${input.daysSinceSubmission} days since I submitted and I'm still very interested — ` +
      `if there's anything I can clarify or any next steps on your end, I'd love to hear from you.`,
    ``,
    `Thanks for your time,`,
    firstName,
  ]
    .filter(line => line !== undefined)
    .join('\n');
}

function voiceInfusedBody(input: DraftInput): string {
  const company = input.company ?? 'the team';
  const role = input.role;
  const firstName = input.applicantFirstName ?? '';
  const voice = (input.voiceSample ?? '').trim();

  return [
    `Hi,`,
    ``,
    voice.slice(0, 400) || `Just checking in on my application.`,
    ``,
    `Quick note that I applied to the ${role} role at ${company} about ${input.daysSinceSubmission} days ago. ` +
      `Still excited about the opportunity — if you have any updates or want me to share more context, let me know.`,
    ``,
    `Thanks,`,
    firstName,
  ].join('\n');
}

export function generateFollowUpDraft(input: DraftInput): GeneratedDraft {
  const subject = input.company
    ? `Following up — ${input.role} at ${input.company}`
    : `Following up on my ${input.role} application`;

  const bodyMarkdown =
    input.voiceSample && input.voiceSample.trim().length >= 20
      ? voiceInfusedBody(input)
      : neutralBody(input);

  return { bodyMarkdown, subject };
}
