import { load } from 'cheerio';

import { ApplicationConfirmationState } from '@/generated/prisma/client';
import { db } from '@/lib/db/client';

/**
 * P3.4 - family-aware confirmation detector.
 *
 * Builds on top of the existing generic `detectSubmissionConfirmation`
 * module by layering ATS-family-specific patterns (Greenhouse first,
 * since it's the highest volume per docs/ats-inventory-2026-04-22.md)
 * and by wiring detection into a single `applyConfirmationToSubmission`
 * helper that writes `ApplicationSubmission.confirmationState =
 * ATS_CONFIRMED`, stamps `verifiedAt`, and writes an audit log row.
 *
 * The runtime executor (P3.2/P3.3 - still in flight) calls
 * `applyConfirmationToSubmission({ submissionId, html, ... })` after a
 * submit action lands. Until then the detector ships stand-alone so
 * callers can unit-test against fixture HTML.
 */

export type ConfirmationFamily =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'smartrecruiters'
  | 'workable'
  | 'recruitee'
  | 'teamtailor'
  | 'jobvite'
  | 'bamboohr'
  | 'personio'
  | 'breezy'
  | 'icims'
  | 'workday'
  | 'generic';

export interface ConfirmationDetection {
  readonly family: ConfirmationFamily;
  readonly variant: string;
  readonly reason: string;
  readonly matchedPhrase: string;
  readonly contextSnippet: string;
  readonly confidence: number;
}

export interface FamilyPattern {
  readonly family: ConfirmationFamily;
  readonly variant: string;
  readonly pattern: RegExp;
  readonly reason: string;
  readonly confidence: number;
}

/**
 * Guard pattern used to reject a match that only occurs inside a
 * job-description or similar reference block. Every candidate match is
 * additionally checked against this so a posting that includes the phrase
 * "application submitted" as a sentence fragment does not false-positive.
 */
const JOB_DESCRIPTION_GUARD_RE =
  /\b(job\s*description|responsibilities|qualifications|about the role|what you'?ll do|requirements)\b/i;

/**
 * Greenhouse canonical confirmation ("Your application has been
 * received") plus three variants the public board API is known to emit.
 */
export const GREENHOUSE_PATTERNS: readonly FamilyPattern[] = [
  {
    confidence: 0.98,
    family: 'greenhouse',
    pattern: /\bApplication submitted!?\b/i,
    reason: 'Greenhouse canonical "Application submitted!" banner',
    variant: 'canonical',
  },
  {
    confidence: 0.95,
    family: 'greenhouse',
    pattern:
      /\bThanks? (?:so much )?for applying to (?:the )?[^.!?\n]{1,80}? at [^.!?\n]{1,80}\b/i,
    reason: 'Greenhouse "Thanks for applying to <role> at <company>" phrase',
    variant: 'thanks-for-applying-to',
  },
  {
    confidence: 0.93,
    family: 'greenhouse',
    pattern: /\bWe(?: have|['\u2019]ve)\s+received your application\b/i,
    reason: 'Greenhouse "We have received your application" phrase',
    variant: 'received-your-application',
  },
  {
    confidence: 0.9,
    family: 'greenhouse',
    pattern: /\bPowered by Greenhouse\b/i,
    reason: 'Greenhouse product-footer fingerprint',
    variant: 'powered-by-footer',
  },
];

/**
 * Lower-priority family patterns. These are best-effort fallbacks when
 * the caller does not provide the ATS family explicitly.
 */
export const OTHER_FAMILY_PATTERNS: readonly FamilyPattern[] = [
  // Lever — `jobs.lever.co/<co>/<id>/apply` redirects to a "/thanks"
  // page on success and renders one of these banners.
  {
    confidence: 0.9,
    family: 'lever',
    pattern: /\bThanks for applying!?\b/i,
    reason: 'Lever "Thanks for applying!" banner',
    variant: 'thanks-for-applying',
  },
  {
    confidence: 0.9,
    family: 'lever',
    pattern: /\bYour application has been submitted to\b/i,
    reason: 'Lever "Your application has been submitted to <company>"',
    variant: 'submitted-to-company',
  },
  {
    confidence: 0.9,
    family: 'lever',
    pattern: /\bWe['’]ve received your application\b/i,
    reason: 'Lever "We\'ve received your application" follow-up',
    variant: 'received-your-application',
  },

  // Ashby — `jobs.ashbyhq.com/<co>/<id>` shows "Application Received"
  // or transitions to a confirmation card on submit.
  {
    confidence: 0.9,
    family: 'ashby',
    pattern: /\bApplication Received\b/i,
    reason: 'Ashby "Application Received" heading',
    variant: 'application-received',
  },
  {
    confidence: 0.9,
    family: 'ashby',
    pattern: /\bApplication submitted\b/i,
    reason: 'Ashby "Application submitted" heading',
    variant: 'application-submitted',
  },
  {
    confidence: 0.9,
    family: 'ashby',
    pattern: /\bThank you for your application\b/i,
    reason: 'Ashby "Thank you for your application" follow-up',
    variant: 'thank-you-for-application',
  },
  {
    confidence: 0.88,
    family: 'ashby',
    pattern:
      /\bWe['’]ll be in touch soon\b|\bsomeone from our team will reach out\b/i,
    reason: 'Ashby reach-out follow-up phrase',
    variant: 'will-be-in-touch',
  },

  // SmartRecruiters — `careers.smartrecruiters.com/<co>/<id>` confirmation.
  {
    confidence: 0.9,
    family: 'smartrecruiters',
    pattern: /\bThank you for applying\b/i,
    reason: 'SmartRecruiters "Thank you for applying" heading',
    variant: 'thank-you-for-applying',
  },
  {
    confidence: 0.9,
    family: 'smartrecruiters',
    pattern: /\bApplication\s+(?:successfully\s+)?submitted\b/i,
    reason: 'SmartRecruiters "Application submitted" / "successfully submitted"',
    variant: 'application-submitted',
  },
  {
    confidence: 0.9,
    family: 'smartrecruiters',
    pattern: /\bSuccessfully applied\b/i,
    reason: 'SmartRecruiters "Successfully applied" heading',
    variant: 'successfully-applied',
  },
  {
    confidence: 0.88,
    family: 'smartrecruiters',
    pattern: /\bYour profile has been (?:created|saved|submitted)\b/i,
    reason: 'SmartRecruiters profile-creation confirmation',
    variant: 'profile-created',
  },

  // Workable — `apply.workable.com/<co>/j/<id>` confirmation.
  {
    confidence: 0.92,
    family: 'workable',
    pattern: /\bApplication sent successfully\b/i,
    reason: 'Workable "Application sent successfully" banner',
    variant: 'application-sent-successfully',
  },
  {
    confidence: 0.9,
    family: 'workable',
    pattern: /\bThank you for your application\b/i,
    reason: 'Workable "Thank you for your application" heading',
    variant: 'thank-you-for-application',
  },
  {
    confidence: 0.9,
    family: 'workable',
    pattern: /\bYour application was successfully submitted\b/i,
    reason: 'Workable successful application submission phrase',
    variant: 'successfully-submitted',
  },
  {
    confidence: 0.88,
    family: 'workable',
    pattern: /\bWe['’]ll review your application\b/i,
    reason: 'Workable "We\'ll review your application" follow-up',
    variant: 'will-review',
  },

  // Recruitee — `apply.recruitee.com/o/<job>` confirmation.
  {
    confidence: 0.9,
    family: 'recruitee',
    pattern: /\bApplication submitted\b/i,
    reason: 'Recruitee "Application submitted" heading',
    variant: 'application-submitted',
  },
  {
    confidence: 0.9,
    family: 'recruitee',
    pattern: /\bYour application has been received\b/i,
    reason: 'Recruitee "Your application has been received" phrase',
    variant: 'application-received',
  },
  {
    confidence: 0.88,
    family: 'recruitee',
    pattern: /\bThanks for applying\b/i,
    reason: 'Recruitee "Thanks for applying" phrase',
    variant: 'thanks-for-applying',
  },

  // Teamtailor — `<company>.teamtailor.com/jobs/<id>` confirmation.
  {
    confidence: 0.9,
    family: 'teamtailor',
    pattern: /\bApplication received\b/i,
    reason: 'Teamtailor "Application received" heading',
    variant: 'application-received',
  },
  {
    confidence: 0.9,
    family: 'teamtailor',
    pattern: /\bWe have received your application\b/i,
    reason: 'Teamtailor "We have received your application" phrase',
    variant: 'received-your-application',
  },
  {
    confidence: 0.88,
    family: 'teamtailor',
    pattern: /\bThanks for applying\b/i,
    reason: 'Teamtailor "Thanks for applying" phrase',
    variant: 'thanks-for-applying',
  },

  // Jobvite — `jobs.jobvite.com/<company>/job/<id>` confirmation.
  {
    confidence: 0.9,
    family: 'jobvite',
    pattern: /\bApplication complete\b/i,
    reason: 'Jobvite "Application complete" heading',
    variant: 'application-complete',
  },
  {
    confidence: 0.9,
    family: 'jobvite',
    pattern: /\bYour application has been successfully submitted\b/i,
    reason: 'Jobvite successful submission phrase',
    variant: 'successfully-submitted',
  },
  {
    confidence: 0.88,
    family: 'jobvite',
    pattern: /\bThank you for applying\b/i,
    reason: 'Jobvite "Thank you for applying" phrase',
    variant: 'thank-you-for-applying',
  },

  // BambooHR — `<company>.bamboohr.com/careers/<id>` confirmation.
  {
    confidence: 0.9,
    family: 'bamboohr',
    pattern: /\bApplication submitted\b/i,
    reason: 'BambooHR "Application submitted" heading',
    variant: 'application-submitted',
  },
  {
    confidence: 0.9,
    family: 'bamboohr',
    pattern: /\bYour application was received\b/i,
    reason: 'BambooHR "Your application was received" phrase',
    variant: 'application-received',
  },
  {
    confidence: 0.88,
    family: 'bamboohr',
    pattern: /\bThanks for applying\b/i,
    reason: 'BambooHR "Thanks for applying" phrase',
    variant: 'thanks-for-applying',
  },

  // Personio — `jobs.personio.com/<company>/job/<id>` confirmation.
  {
    confidence: 0.9,
    family: 'personio',
    pattern: /\bApplication received\b/i,
    reason: 'Personio "Application received" heading',
    variant: 'application-received',
  },
  {
    confidence: 0.9,
    family: 'personio',
    pattern: /\bYour application has been submitted\b/i,
    reason: 'Personio submitted application phrase',
    variant: 'application-submitted',
  },
  {
    confidence: 0.88,
    family: 'personio',
    pattern: /\bThank you\b.{0,80}\byour application\b/i,
    reason: 'Personio thank-you application phrase',
    variant: 'thank-you-application',
  },

  // BreezyHR — `<company>.breezy.hr/p/<id>` confirmation.
  {
    confidence: 0.9,
    family: 'breezy',
    pattern: /\bSuccessfully applied\b/i,
    reason: 'BreezyHR "Successfully applied" heading',
    variant: 'successfully-applied',
  },
  {
    confidence: 0.9,
    family: 'breezy',
    pattern: /\bYour application has been received\b/i,
    reason: 'BreezyHR "Your application has been received" phrase',
    variant: 'application-received',
  },
  {
    confidence: 0.88,
    family: 'breezy',
    pattern: /\bThanks for applying\b/i,
    reason: 'BreezyHR "Thanks for applying" phrase',
    variant: 'thanks-for-applying',
  },

  // iCIMS — `<co>.icims.com/jobs/.../login` post-submit confirmation.
  {
    confidence: 0.92,
    family: 'icims',
    pattern: /\bApplication Submitted\b/i,
    reason: 'iCIMS "Application Submitted" heading',
    variant: 'application-submitted',
  },
  {
    confidence: 0.9,
    family: 'icims',
    pattern: /\bSuccessfully Submitted\b/i,
    reason: 'iCIMS "Successfully Submitted" heading',
    variant: 'successfully-submitted',
  },
  {
    confidence: 0.88,
    family: 'icims',
    pattern: /\bThank you for completing the application\b/i,
    reason: 'iCIMS "Thank you for completing the application" follow-up',
    variant: 'thank-you-for-completing',
  },

  // Workday — `<co>.wd<n>.myworkdayjobs.com/...` confirmation.
  {
    confidence: 0.92,
    family: 'workday',
    pattern: /\bApplication complete\b/i,
    reason: 'Workday "Application complete" heading',
    variant: 'application-complete',
  },
  {
    confidence: 0.9,
    family: 'workday',
    pattern: /\bYou have successfully (?:submitted|applied)\b/i,
    reason: 'Workday "You have successfully submitted/applied" phrase',
    variant: 'successfully-submitted',
  },
  {
    confidence: 0.88,
    family: 'workday',
    pattern: /\bThank you for considering a career\b/i,
    reason: 'Workday "Thank you for considering a career" follow-up',
    variant: 'considering-career',
  },
];

export const GENERIC_PATTERNS: readonly FamilyPattern[] = [
  {
    confidence: 0.75,
    family: 'generic',
    pattern:
      /\b(?:your\s+application\s+has\s+been\s+(?:submitted|received|sent))\b/i,
    reason: 'Generic "your application has been ..." confirmation',
    variant: 'application-has-been',
  },
  {
    confidence: 0.7,
    family: 'generic',
    pattern: /\bApplication\s+(?:complete|confirmed|successful)\b/i,
    reason: 'Generic "application complete/confirmed/successful" state',
    variant: 'application-terminal-state',
  },
];

export function normalizeHtmlToText(html: string): string {
  try {
    const $ = load(html);
    // Insert a space after every element's closing tag so adjacent blocks
    // (`<h2>foo</h2><p>bar</p>`) don't concatenate into `foobar`. Without
    // this, word-boundary guards break against real-world markup.
    $('body *').each((_, el) => {
      $(el).append(' ');
    });
    return $('body').text().replace(/\s+/g, ' ').trim();
  } catch {
    return html
      .replace(/<\/?[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

interface DetectInput {
  readonly html: string;
  readonly family?: ConfirmationFamily | null;
}

function scanForPattern(
  text: string,
  pattern: FamilyPattern,
): ConfirmationDetection | null {
  const match = text.match(pattern.pattern);
  if (!match) return null;
  const idx = match.index ?? text.indexOf(match[0]);
  const start = Math.max(0, idx - 80);
  const end = Math.min(text.length, idx + match[0].length + 80);
  const contextSnippet = text.slice(start, end).trim();

  // Reject false positives that only show up alongside job-description
  // markers and NOT alongside any explicit success affirmation in the
  // surrounding window.
  if (
    JOB_DESCRIPTION_GUARD_RE.test(contextSnippet) &&
    !/\b(thanks?|thank you|received|confirmed|submitted successfully|your application)\b/i.test(
      contextSnippet.replace(match[0], ''),
    )
  ) {
    return null;
  }

  return {
    confidence: pattern.confidence,
    contextSnippet,
    family: pattern.family,
    matchedPhrase: match[0],
    reason: pattern.reason,
    variant: pattern.variant,
  };
}

/**
 * Pure - detects a confirmation from raw HTML. If `family` is supplied,
 * the matching family's patterns are tried first; otherwise the detector
 * walks every family in priority order (Greenhouse -> Lever -> Ashby ->
 * SmartRecruiters -> generic). Returns the highest-confidence match or
 * null if no pattern fires.
 */
export function detectConfirmation({
  html,
  family,
}: DetectInput): ConfirmationDetection | null {
  const text = normalizeHtmlToText(html);

  if (family) {
    const familyPatterns = [
      ...GREENHOUSE_PATTERNS,
      ...OTHER_FAMILY_PATTERNS,
    ].filter(pattern => pattern.family === family);
    const familyHit = findBestPatternMatch(text, familyPatterns);
    if (familyHit) return familyHit;
  }

  const ordered: readonly FamilyPattern[] = family
    ? [
        ...GREENHOUSE_PATTERNS.filter(p => p.family !== family),
        ...OTHER_FAMILY_PATTERNS.filter(p => p.family !== family),
        ...GENERIC_PATTERNS,
      ]
    : [...GREENHOUSE_PATTERNS, ...OTHER_FAMILY_PATTERNS, ...GENERIC_PATTERNS];

  return findBestPatternMatch(text, ordered);
}

function findBestPatternMatch(
  text: string,
  patterns: readonly FamilyPattern[],
): ConfirmationDetection | null {
  let best: ConfirmationDetection | null = null;
  for (const pattern of patterns) {
    const hit = scanForPattern(text, pattern);
    if (hit && (!best || hit.confidence > best.confidence)) {
      best = hit;
    }
  }
  return best;
}

export interface ApplyInput {
  readonly submissionId: string;
  readonly html: string;
  readonly hostname?: string | null;
  readonly family?: ConfirmationFamily | null;
  readonly now?: Date;
}

export interface ApplyResult {
  readonly detected: ConfirmationDetection | null;
  readonly transitioned: boolean;
  readonly previousState: ApplicationConfirmationState | null;
}

/**
 * Runs the detector against `html` and, if positive, transitions the
 * named `ApplicationSubmission` to `ATS_CONFIRMED` + stamps `verifiedAt`.
 * Records an `AutomationAuditLog` row so the decision is visible.
 *
 * The caller (runtime executor in P3.2/P3.3) should invoke this after a
 * submit action lands, passing the final page's HTML.
 */
export async function applyConfirmationToSubmission(
  input: ApplyInput,
): Promise<ApplyResult> {
  const now = input.now ?? new Date();
  const submission = await db.applicationSubmission.findUnique({
    select: { confirmationState: true, userId: true, verifiedAt: true },
    where: { id: input.submissionId },
  });
  if (!submission) {
    return { detected: null, previousState: null, transitioned: false };
  }

  const detection = detectConfirmation({
    family: input.family ?? null,
    html: input.html,
  });

  if (!detection) {
    return {
      detected: null,
      previousState: submission.confirmationState,
      transitioned: false,
    };
  }

  if (
    submission.confirmationState ===
      ApplicationConfirmationState.EMAIL_CONFIRMED ||
    submission.confirmationState ===
      ApplicationConfirmationState.DASHBOARD_CONFIRMED ||
    submission.confirmationState ===
      ApplicationConfirmationState.VERIFIED_FAILED
  ) {
    // Don't downgrade a better confirmation state.
    return {
      detected: detection,
      previousState: submission.confirmationState,
      transitioned: false,
    };
  }

  await db.$transaction([
    db.applicationSubmission.update({
      data: {
        confirmationState: ApplicationConfirmationState.ATS_CONFIRMED,
        verifiedAt: submission.verifiedAt ?? now,
      },
      where: { id: input.submissionId },
    }),
    db.automationAuditLog.create({
      data: {
        action: 'ATS_CONFIRMATION_DETECTED',
        actionType: 'RECONCILE',
        applicationSubmissionId: input.submissionId,
        metadata: {
          confidence: detection.confidence,
          contextSnippet: detection.contextSnippet,
          family: detection.family,
          hostname: input.hostname ?? null,
          matchedPhrase: detection.matchedPhrase,
          reason: detection.reason,
          variant: detection.variant,
        },
        userId: submission.userId,
      },
    }),
  ]);

  return {
    detected: detection,
    previousState: submission.confirmationState,
    transitioned: true,
  };
}

export const __TESTING__ = {
  GENERIC_PATTERNS,
  GREENHOUSE_PATTERNS,
  JOB_DESCRIPTION_GUARD_RE,
  OTHER_FAMILY_PATTERNS,
};
