/**
 * P5.6 - identity schema.
 *
 * Pure, no side effects. Defines the closed set of logical keys the
 * identity store accepts, the shape the value must take, and a human
 * description for the admin UI that will surface the schema to Steven
 * when he seeds values (P5.5).
 *
 * Keep this list additive - removing a key is a breaking change for
 * downstream rule packs that fill fields by logical key.
 */

import type { IdentityKey } from './types.js';

export interface IdentityKeyDescriptor {
  readonly key: IdentityKey;
  readonly description: string;
  readonly required: boolean;
  /**
   * A predicate run on the raw string. Returns null when valid, a reason
   * string when invalid. Validators are lenient by design - they reject
   * obviously-wrong shapes but do not verify live identity (real email
   * existence, real phone routability, etc).
   */
  readonly validate: (value: string) => string | null;
  /**
   * Category for the admin UI grouping.
   */
  readonly group: 'core' | 'links' | 'files' | 'compliance' | 'voluntary';
}

const nonEmpty = (value: string): string | null =>
  value.trim().length === 0 ? 'value is empty' : null;

const matchesUrl = (value: string): string | null => {
  if (value.trim().length === 0) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return 'must be http(s) URL';
    }
    return null;
  } catch {
    return 'must be a valid URL';
  }
};

const matchesEmail = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return 'value is empty';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return 'must contain @ and a dot';
  }
  return null;
};

const matchesPhone = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return 'value is empty';
  // Accept E.164-ish or digits with separators; must have >=7 digits.
  const digits = trimmed.replace(/[^\d]/g, '');
  if (digits.length < 7) return 'must contain at least 7 digits';
  return null;
};

const matchesFilePath = (value: string): string | null => {
  if (value.trim().length === 0) return 'value is empty';
  if (!value.includes('/') && !value.includes('\\')) {
    return 'must be an absolute or relative file path';
  }
  return null;
};

export const IDENTITY_SCHEMA: Readonly<
  Record<IdentityKey, IdentityKeyDescriptor>
> = Object.freeze({
  address_line_1: {
    description: 'Street address line 1',
    group: 'core',
    key: 'address_line_1',
    required: false,
    validate: nonEmpty,
  },
  address_line_2: {
    description: 'Street address line 2 (apartment, suite, etc.)',
    group: 'core',
    key: 'address_line_2',
    required: false,
    validate: nonEmpty,
  },
  city: {
    description: 'City',
    group: 'core',
    key: 'city',
    required: false,
    validate: nonEmpty,
  },
  country: {
    description: 'Country (ISO 3166-1 alpha-2 or full name)',
    group: 'core',
    key: 'country',
    required: false,
    validate: nonEmpty,
  },
  cover_letter_pdf_path: {
    description: 'Absolute path to the baseline cover letter PDF',
    group: 'files',
    key: 'cover_letter_pdf_path',
    required: false,
    validate: matchesFilePath,
  },
  disability_status: {
    description: 'Voluntary disability disclosure',
    group: 'voluntary',
    key: 'disability_status',
    required: false,
    validate: nonEmpty,
  },
  email: {
    description: 'Primary contact email address',
    group: 'core',
    key: 'email',
    required: true,
    validate: matchesEmail,
  },
  first_name: {
    description: 'Legal first name for application forms',
    group: 'core',
    key: 'first_name',
    required: true,
    validate: nonEmpty,
  },
  full_name: {
    description: 'Preferred full display name',
    group: 'core',
    key: 'full_name',
    required: false,
    validate: nonEmpty,
  },
  gender: {
    description: 'Voluntary gender disclosure',
    group: 'voluntary',
    key: 'gender',
    required: false,
    validate: nonEmpty,
  },
  github_url: {
    description: 'GitHub profile URL',
    group: 'links',
    key: 'github_url',
    required: false,
    validate: matchesUrl,
  },
  last_name: {
    description: 'Legal last name for application forms',
    group: 'core',
    key: 'last_name',
    required: true,
    validate: nonEmpty,
  },
  linkedin_url: {
    description: 'LinkedIn profile URL',
    group: 'links',
    key: 'linkedin_url',
    required: false,
    validate: matchesUrl,
  },
  phone: {
    description: 'Contact phone number',
    group: 'core',
    key: 'phone',
    required: true,
    validate: matchesPhone,
  },
  portfolio_url: {
    description: 'Portfolio URL',
    group: 'links',
    key: 'portfolio_url',
    required: false,
    validate: matchesUrl,
  },
  postal_code: {
    description: 'ZIP / postal code',
    group: 'core',
    key: 'postal_code',
    required: false,
    validate: nonEmpty,
  },
  race_ethnicity: {
    description: 'Voluntary race / ethnicity disclosure',
    group: 'voluntary',
    key: 'race_ethnicity',
    required: false,
    validate: nonEmpty,
  },
  resume_docx_path: {
    description: 'Absolute path to the baseline resume .docx',
    group: 'files',
    key: 'resume_docx_path',
    required: false,
    validate: matchesFilePath,
  },
  resume_pdf_path: {
    description: 'Absolute path to the baseline resume PDF',
    group: 'files',
    key: 'resume_pdf_path',
    required: true,
    validate: matchesFilePath,
  },
  sponsorship_required: {
    description: 'Will you now or in the future require sponsorship?',
    group: 'compliance',
    key: 'sponsorship_required',
    required: true,
    validate: nonEmpty,
  },
  state: {
    description: 'State / province',
    group: 'core',
    key: 'state',
    required: false,
    validate: nonEmpty,
  },
  veteran_status: {
    description: 'Voluntary veteran status disclosure',
    group: 'voluntary',
    key: 'veteran_status',
    required: false,
    validate: nonEmpty,
  },
  website_url: {
    description: 'Personal website URL',
    group: 'links',
    key: 'website_url',
    required: false,
    validate: matchesUrl,
  },
  work_authorization: {
    description: 'Work authorization status for the target country',
    group: 'compliance',
    key: 'work_authorization',
    required: true,
    validate: nonEmpty,
  },
});

export const IDENTITY_KEYS: readonly IdentityKey[] = Object.freeze(
  Object.keys(IDENTITY_SCHEMA) as IdentityKey[],
);

export function isIdentityKey(value: unknown): value is IdentityKey {
  return typeof value === 'string' && value in IDENTITY_SCHEMA;
}

export function assertIdentityKey(key: unknown): IdentityKey {
  if (!isIdentityKey(key)) {
    throw new Error(
      `identity: unknown key "${String(key)}". Known keys: ${IDENTITY_KEYS.join(', ')}`,
    );
  }
  return key;
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly reason: string | null;
}

export function validateIdentityValue(
  key: IdentityKey,
  value: string,
): ValidationResult {
  const descriptor = IDENTITY_SCHEMA[key];
  const reason = descriptor.validate(value);
  return { ok: reason === null, reason };
}

/** Keys grouped for the admin UI (P5.5). */
export function keysByGroup(): Readonly<
  Record<IdentityKeyDescriptor['group'], readonly IdentityKey[]>
> {
  const buckets: Record<
    IdentityKeyDescriptor['group'],
    IdentityKey[]
  > = {
    compliance: [],
    core: [],
    files: [],
    links: [],
    voluntary: [],
  };
  for (const key of IDENTITY_KEYS) {
    buckets[IDENTITY_SCHEMA[key].group].push(key);
  }
  return buckets;
}
