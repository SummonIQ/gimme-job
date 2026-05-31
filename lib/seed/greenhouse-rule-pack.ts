/**
 * P3.1 — Greenhouse DOM rule pack (pure).
 *
 * Generates a canonical list of `ATSRule` rows for the two dominant
 * Greenhouse-hosted domains (`job-boards.greenhouse.io`,
 * `boards.greenhouse.io`). The script at
 * `prisma/seed/greenhouse-rule-pack.ts` consumes these and upserts them.
 *
 * Selectors are drawn from the public Greenhouse job-board application
 * form shape (name="first_name", #first_name, etc.). Confidence is pinned
 * at 0.9 per §3.1 and `sourceTrainingSessionIds` records the bootstrap
 * batch.
 */

export const GREENHOUSE_BOOTSTRAP_SESSION_ID =
  'bootstrap:greenhouse:2026-04';

export const GREENHOUSE_HOSTNAMES: readonly string[] = [
  'job-boards.greenhouse.io',
  'boards.greenhouse.io',
];

export const GREENHOUSE_BOOTSTRAP_CONFIDENCE = 0.9;

export interface ATSRuleInput {
  readonly hostname: string;
  readonly action: 'continue' | 'skip';
  readonly actionType: 'fill' | 'click' | 'upload' | 'activate';
  readonly stableSelector: string;
  readonly tagName: string;
  readonly fieldName: string | null;
  readonly fieldLabel: string | null;
  readonly ariaLabel: string | null;
  readonly role: string | null;
  readonly stepIndex: number;
  readonly reason: string;
  readonly confidence: number;
  readonly sourceTrainingSessionIds: readonly string[];
}

interface FillFieldTemplate {
  readonly fieldName: string;
  readonly label: string;
  readonly tagName?: string; // default 'input'
  readonly role?: string | null;
}

const CONTACT_FIELDS: readonly FillFieldTemplate[] = [
  { fieldName: 'first_name', label: 'First Name', tagName: 'input' },
  { fieldName: 'last_name', label: 'Last Name', tagName: 'input' },
  { fieldName: 'email', label: 'Email', tagName: 'input' },
  { fieldName: 'phone', label: 'Phone', tagName: 'input' },
  { fieldName: 'location', label: 'Location', tagName: 'input' },
];

const LINK_FIELDS: readonly FillFieldTemplate[] = [
  { fieldName: 'urls[LinkedIn]', label: 'LinkedIn', tagName: 'input' },
  { fieldName: 'urls[Portfolio]', label: 'Portfolio', tagName: 'input' },
  { fieldName: 'urls[GitHub]', label: 'GitHub', tagName: 'input' },
  { fieldName: 'urls[Website]', label: 'Website', tagName: 'input' },
];

const WORK_FIELDS: readonly FillFieldTemplate[] = [
  { fieldName: 'current_company', label: 'Current Company', tagName: 'input' },
  { fieldName: 'current_title', label: 'Current Title', tagName: 'input' },
  {
    fieldName: 'years_experience',
    label: 'Years of Experience',
    tagName: 'input',
  },
];

const COMPLIANCE_FIELDS: readonly FillFieldTemplate[] = [
  {
    fieldName: 'question_authorized',
    label: 'Are you authorized to work in the country of this position?',
    tagName: 'select',
  },
  {
    fieldName: 'question_sponsorship',
    label: 'Will you now or in the future require sponsorship?',
    tagName: 'select',
  },
  {
    fieldName: 'question_gender',
    label: 'Gender (voluntary)',
    tagName: 'select',
  },
  { fieldName: 'question_race', label: 'Race (voluntary)', tagName: 'select' },
  {
    fieldName: 'question_veteran',
    label: 'Veteran status (voluntary)',
    tagName: 'select',
  },
  {
    fieldName: 'question_disability',
    label: 'Disability status (voluntary)',
    tagName: 'select',
  },
];

function fillRule(
  hostname: string,
  template: FillFieldTemplate,
  stepIndex: number,
): ATSRuleInput {
  const tagName = template.tagName ?? 'input';
  const selector =
    tagName === 'select'
      ? `${tagName}[name="${template.fieldName}"]`
      : `input#${template.fieldName.replace(/\[|\]/g, '').replace(/_/g, '_')},input[name="${template.fieldName}"]`;

  return {
    action: 'continue',
    actionType: 'fill',
    ariaLabel: template.label,
    confidence: GREENHOUSE_BOOTSTRAP_CONFIDENCE,
    fieldLabel: template.label,
    fieldName: template.fieldName,
    hostname,
    reason: `Bootstrap fill rule for Greenhouse "${template.label}" field`,
    role: template.role ?? null,
    sourceTrainingSessionIds: [GREENHOUSE_BOOTSTRAP_SESSION_ID],
    stableSelector: selector,
    stepIndex,
    tagName,
  };
}

function resumeUploadRule(hostname: string): ATSRuleInput[] {
  return [
    {
      action: 'continue',
      actionType: 'upload',
      ariaLabel: 'Resume',
      confidence: GREENHOUSE_BOOTSTRAP_CONFIDENCE,
      fieldLabel: 'Resume',
      fieldName: 'resume',
      hostname,
      reason: 'Bootstrap rule for Greenhouse resume upload input',
      role: null,
      sourceTrainingSessionIds: [GREENHOUSE_BOOTSTRAP_SESSION_ID],
      stableSelector: 'input[type="file"][name="resume"]',
      stepIndex: 1,
      tagName: 'input',
    },
    {
      action: 'continue',
      actionType: 'click',
      ariaLabel: 'Attach resume',
      confidence: GREENHOUSE_BOOTSTRAP_CONFIDENCE,
      fieldLabel: 'Attach resume',
      fieldName: null,
      hostname,
      reason:
        'Bootstrap rule for Greenhouse "Attach" button that reveals the resume upload input',
      role: 'button',
      sourceTrainingSessionIds: [GREENHOUSE_BOOTSTRAP_SESSION_ID],
      stableSelector:
        'button[data-qa="attach-resume"],button.attach-resume,button[aria-label*="resume" i]',
      stepIndex: 1,
      tagName: 'button',
    },
  ];
}

function coverLetterUploadRule(hostname: string): ATSRuleInput {
  return {
    action: 'continue',
    actionType: 'upload',
    ariaLabel: 'Cover Letter',
    confidence: GREENHOUSE_BOOTSTRAP_CONFIDENCE,
    fieldLabel: 'Cover Letter',
    fieldName: 'cover_letter',
    hostname,
    reason: 'Bootstrap rule for Greenhouse cover letter upload input',
    role: null,
    sourceTrainingSessionIds: [GREENHOUSE_BOOTSTRAP_SESSION_ID],
    stableSelector: 'input[type="file"][name="cover_letter"]',
    stepIndex: 1,
    tagName: 'input',
  };
}

function submitClickRule(hostname: string): ATSRuleInput {
  return {
    action: 'continue',
    actionType: 'click',
    ariaLabel: 'Submit Application',
    confidence: GREENHOUSE_BOOTSTRAP_CONFIDENCE,
    fieldLabel: 'Submit Application',
    fieldName: null,
    hostname,
    reason: 'Bootstrap rule for Greenhouse submit button',
    role: 'button',
    sourceTrainingSessionIds: [GREENHOUSE_BOOTSTRAP_SESSION_ID],
    stableSelector:
      'button#submit_app,button[type="submit"][data-qa="submit-application"],button.template-btn-submit',
    stepIndex: 3,
    tagName: 'button',
  };
}

export interface BuiltRulePack {
  readonly rules: readonly ATSRuleInput[];
  /** Per-hostname step blueprint for ApplicationFlowDefinition compile. */
  readonly steps: ReadonlyArray<{
    readonly hostname: string;
    readonly stepIndex: number;
    readonly stepLabel: string;
    readonly labels: readonly string[];
    readonly primarySelector: string;
  }>;
}

type MutableSteps = Array<BuiltRulePack['steps'][number]>;

export function buildGreenhouseRulePack(
  hostnames: readonly string[] = GREENHOUSE_HOSTNAMES,
): BuiltRulePack {
  const rules: ATSRuleInput[] = [];
  const steps: MutableSteps = [];

  for (const hostname of hostnames) {
    for (const field of CONTACT_FIELDS) {
      rules.push(fillRule(hostname, field, 0));
    }
    for (const field of LINK_FIELDS) {
      rules.push(fillRule(hostname, field, 0));
    }
    for (const field of WORK_FIELDS) {
      rules.push(fillRule(hostname, field, 0));
    }
    for (const field of COMPLIANCE_FIELDS) {
      rules.push(fillRule(hostname, field, 2));
    }
    rules.push(...resumeUploadRule(hostname));
    rules.push(coverLetterUploadRule(hostname));
    rules.push(submitClickRule(hostname));

    steps.push(
      {
        hostname,
        labels: ['Contact Information', 'Links', 'Work'],
        primarySelector: 'fieldset#section_contact,input#first_name',
        stepIndex: 0,
        stepLabel: 'Contact Information',
      },
      {
        hostname,
        labels: ['Resume', 'Cover Letter'],
        primarySelector:
          'fieldset#section_resume,input[type="file"][name="resume"]',
        stepIndex: 1,
        stepLabel: 'Resume & Cover Letter',
      },
      {
        hostname,
        labels: ['Additional Information', 'Compliance'],
        primarySelector:
          'fieldset#section_questions,select[name^="question_"]',
        stepIndex: 2,
        stepLabel: 'Additional Questions',
      },
      {
        hostname,
        labels: ['Submit'],
        primarySelector: 'button#submit_app,button[type="submit"]',
        stepIndex: 3,
        stepLabel: 'Review & Submit',
      },
    );
  }

  return { rules, steps };
}

/**
 * Schema-level validator so tests can prove rows are shaped for
 * `db.aTSRule.create()` without round-tripping through the DB.
 */
export function validateATSRuleInput(row: ATSRuleInput): string[] {
  const errors: string[] = [];
  if (!row.hostname) errors.push('hostname-missing');
  if (!row.action) errors.push('action-missing');
  if (!row.actionType) errors.push('actionType-missing');
  if (!row.stableSelector) errors.push('stableSelector-missing');
  if (!row.tagName) errors.push('tagName-missing');
  if (typeof row.stepIndex !== 'number' || row.stepIndex < 0) {
    errors.push('stepIndex-invalid');
  }
  if (row.confidence < 0 || row.confidence > 1) {
    errors.push('confidence-out-of-range');
  }
  if (row.sourceTrainingSessionIds.length === 0) {
    errors.push('sourceTrainingSessionIds-empty');
  }
  return errors;
}
