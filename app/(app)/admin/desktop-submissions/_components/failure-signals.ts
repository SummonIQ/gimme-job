/**
 * Heuristically extract structured failure signals from a desktop run's
 * status + free-text message. Each signal carries a human-readable
 * explanation and a *recommendation* — usually "add this field to your
 * profile" or "save a field rule" — so the admin page tells you what to
 * change instead of just dumping the raw error.
 */

export interface FailureSignal {
  readonly kind:
    | 'missing_required_field'
    | 'no_confirmation'
    | 'closed_posting'
    | 'submit_button_missing'
    | 'verification_code_missing'
    | 'manual_review'
    | 'tool_error'
    | 'unknown';
  readonly title: string;
  readonly detail: string;
  readonly recommendation: string;
  readonly profileFieldHint?: string;
}

export function extractFailureSignals(input: {
  readonly message: string | null;
  readonly status: string;
}): readonly FailureSignal[] {
  const signals: FailureSignal[] = [];
  const message = (input.message ?? '').trim();
  if (!message && !/failed/i.test(input.status)) return signals;
  const lower = message.toLowerCase();

  // 1. Required-but-empty fields. The runner emits a comma-separated
  //    list of question labels here — surface each as a separate signal
  //    with a recommendation grounded in the question text.
  const requiredMatch = message.match(
    /required\s+field[s]?\s+still\s+empty:\s+([^.]+?)(?=\.|\s+\(|$)/i,
  );
  if (requiredMatch?.[1]) {
    const labels = requiredMatch[1]
      .split(/",\s*"/)
      .map(label => label.replace(/^["“]|["”]$/g, '').trim())
      .filter(Boolean);
    for (const label of labels) {
      signals.push({
        kind: 'missing_required_field',
        title: `Required field empty: "${label}"`,
        detail: `The form rejected submit because "${label}" is required and the agent could not produce an answer.`,
        recommendation: recommendationForLabel(label),
        profileFieldHint: profileFieldHintForLabel(label),
      });
    }
  }

  // 2. Confirmation timeout — the click fired but the page never showed
  //    a thank-you state. The post-flight check should normally rescue
  //    these; if it didn't, the page text doesn't match any pattern.
  if (
    /no\s+confirmation\s+page\s+(?:appeared|within)/i.test(lower) ||
    /did\s+not\s+show\s+a\s+confirmation/i.test(lower)
  ) {
    signals.push({
      kind: 'no_confirmation',
      title: 'Submit clicked but no confirmation detected',
      detail:
        'The submit button fired but the post-submit page did not match any "thank you" / "received" pattern within 30 seconds.',
      recommendation:
        'If the submission actually succeeded, paste the post-submit page text into Slack so I can add the phrase to the confirmation patterns.',
    });
  }

  // 3. Closed / unavailable posting.
  if (
    /(?:posting|listing)\s+is\s+unavailable/i.test(lower) ||
    /closed\s+(?:page|posting)/i.test(lower) ||
    input.status === 'unavailable'
  ) {
    signals.push({
      kind: 'closed_posting',
      title: 'Posting was closed before submit',
      detail:
        'The page rendered a "no longer accepting applications" banner before the agent could submit.',
      recommendation:
        'No action needed — the lead has been marked unavailable and excluded from random picks.',
    });
  }

  // 4. Submit button not found.
  if (
    /(?:submit|apply)\s+button\s+(?:was\s+not\s+found|not\s+(?:located|found))/i.test(
      lower,
    ) ||
    /could\s+not\s+locate\s+(?:a\s+)?submit\s+button/i.test(lower)
  ) {
    signals.push({
      kind: 'submit_button_missing',
      title: 'Submit button not located',
      detail:
        'The agent filled the form but could not find a button matching the submit/apply pattern for this ATS.',
      recommendation:
        'Send me the page URL so I can extend the provider runner\'s submitButtonSelectors list.',
    });
  }

  // 5. Verification-code field couldn't be filled.
  if (/verification[-\s]?code/i.test(lower) && /(?:no\s+recent|empty)/i.test(lower)) {
    signals.push({
      kind: 'verification_code_missing',
      title: 'Verification code never arrived',
      detail:
        'The form asked for an emailed code but no matching email arrived in the user\'s inbox within the polling window.',
      recommendation:
        'Check ImprovMX webhook delivery (admin → desktop audit). If emails are reaching macOS Mail but not the inbox, IMPROVMX_WEBHOOK_ALLOWED_IPS may need an update.',
    });
  }

  // 6. Manual-review / paused statuses.
  if (
    input.status === 'paused_for_manual_review' ||
    /sign\s+in\s+manually|finish\s+account\s+creation/i.test(lower)
  ) {
    signals.push({
      kind: 'manual_review',
      title: 'Run paused for manual step',
      detail:
        'The provider required a step we deliberately don\'t auto-complete (account creation, sign-in, captcha).',
      recommendation:
        'Complete the manual step in the desktop assist view, then resume the run.',
    });
  }

  // 7. Tool errors with a recognizable shape.
  const toolErrorMatch = message.match(/tool\s+["']?([a-z_]+)["']?\s+failed/i);
  if (toolErrorMatch?.[1]) {
    signals.push({
      kind: 'tool_error',
      title: `Tool error: ${toolErrorMatch[1]}`,
      detail: message,
      recommendation:
        'Check the run-log file at ~/Documents/Gimme Job/run-logs/ for the full tool-call trace.',
    });
  }

  // Catch-all: a plain "failed" status with no recognized substring.
  if (signals.length === 0 && /failed/i.test(input.status) && message) {
    signals.push({
      kind: 'unknown',
      title: 'Failed with unrecognized error',
      detail: message,
      recommendation:
        'Send the message + URL — I\'ll add a more specific pattern + recommendation to extractFailureSignals.',
    });
  }

  return signals;
}

const KEYWORD_RECOMMENDATIONS: ReadonlyArray<{
  readonly pattern: RegExp;
  readonly recommendation: string;
  readonly profileFieldHint?: string;
}> = [
  {
    pattern: /\bsalary|compensation|expectation\b/i,
    recommendation:
      'Set a default Salary Expectation in your profile so the agent can fill this without asking the LLM.',
    profileFieldHint: 'profile.salaryExpectation',
  },
  {
    pattern: /\bgithub\b/i,
    recommendation: 'Add your GitHub URL to your profile.',
    profileFieldHint: 'profile.githubUrl',
  },
  {
    pattern: /\blinkedin\b/i,
    recommendation: 'Add your LinkedIn URL to your profile.',
    profileFieldHint: 'profile.linkedinUrl',
  },
  {
    pattern: /\bwebsite|portfolio\b/i,
    recommendation: 'Add a personal website URL to your profile.',
    profileFieldHint: 'profile.websiteUrl',
  },
  {
    pattern: /\bsponsor(?:ship|ed)\b/i,
    recommendation:
      'Set Sponsorship Required (yes/no) in your profile so this auto-fills.',
    profileFieldHint: 'profile.requiresSponsorship',
  },
  {
    pattern: /\bauthor(?:ized|ization)\b.*\bwork\b/i,
    recommendation:
      'Set Work Authorization in your profile (citizen / GC / work permit / etc.).',
    profileFieldHint: 'profile.workAuthorization',
  },
  {
    pattern: /\b(?:gender|female|male|non-binary)\b/i,
    recommendation:
      'Set Gender (or Decline to State) in your profile — the agent infers from first name otherwise but a profile value wins.',
    profileFieldHint: 'profile.gender',
  },
  {
    pattern: /\bveteran\b/i,
    recommendation: 'Set Veteran Status in your profile.',
    profileFieldHint: 'profile.veteranStatus',
  },
  {
    pattern: /\bdisabilit/i,
    recommendation: 'Set Disability Status in your profile.',
    profileFieldHint: 'profile.disabilityStatus',
  },
  {
    pattern: /\b(?:race|ethnicity|hispanic|latino)\b/i,
    recommendation: 'Set Race / Ethnicity / Hispanic-Latino in your profile.',
    profileFieldHint: 'profile.race',
  },
  {
    pattern: /\b(?:non[-\s]?compete|non[-\s]?solicit|post[-\s]?employment)\b/i,
    recommendation:
      'These now auto-default to "No". If you actually have restrictions, save a field rule with the right answer.',
  },
  {
    pattern: /\bcountry\b/i,
    recommendation: 'Set Country in your profile.',
    profileFieldHint: 'profile.country',
  },
  {
    pattern: /\b(?:city|state|address|zip)\b/i,
    recommendation: 'Fill in City / State / Address in your profile.',
    profileFieldHint: 'profile.city / profile.state',
  },
  {
    pattern: /\b(?:why|tell us|describe|cover letter)\b/i,
    recommendation:
      'Long-form prompts go through the stronger LLM. Save a field rule with your preferred answer to skip the model entirely on future runs.',
  },
];

function recommendationForLabel(label: string): string {
  for (const entry of KEYWORD_RECOMMENDATIONS) {
    if (entry.pattern.test(label)) return entry.recommendation;
  }
  return 'Save a field rule (Rules tab in desktop) with your preferred answer for this question — future runs will use it without calling the LLM.';
}

function profileFieldHintForLabel(label: string): string | undefined {
  for (const entry of KEYWORD_RECOMMENDATIONS) {
    if (entry.pattern.test(label)) return entry.profileFieldHint;
  }
  return undefined;
}
