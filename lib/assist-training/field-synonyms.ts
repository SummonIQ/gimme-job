/**
 * Maps diverse field label variations to a canonical field name so the
 * training system and assist runtime can match "First Name", "Given
 * Name", "Legal First Name", "Applicant First Name" to the same concept
 * without needing embeddings. The synonym list is exhaustive for common
 * ATS fields and grows as new patterns are observed.
 *
 * Usage:
 *   const canonical = resolveCanonicalField('Legal First Name');
 *   // 'first_name'
 */

const SYNONYM_MAP: Record<string, string[]> = {
  first_name: [
    'first name',
    'given name',
    'legal first name',
    'applicant first name',
    'first',
    'fname',
    'first_name',
    'firstname',
    'vorname',
    'prénom',
    'nombre',
  ],
  last_name: [
    'last name',
    'family name',
    'surname',
    'legal last name',
    'applicant last name',
    'last',
    'lname',
    'last_name',
    'lastname',
    'nachname',
    'nom',
    'apellido',
  ],
  full_name: [
    'full name',
    'name',
    'your name',
    'applicant name',
    'candidate name',
    'legal name',
    'full_name',
    'fullname',
  ],
  email: [
    'email',
    'email address',
    'e-mail',
    'e-mail address',
    'your email',
    'contact email',
    'work email',
    'personal email',
  ],
  phone: [
    'phone',
    'phone number',
    'telephone',
    'tel',
    'mobile',
    'mobile number',
    'cell phone',
    'cell',
    'contact number',
    'daytime phone',
  ],
  location: [
    'location',
    'city',
    'city, state',
    'city/state',
    'current location',
    'where are you located',
    'address',
    'mailing address',
    'street address',
  ],
  state: ['state', 'state/province', 'province', 'region'],
  zip: ['zip', 'zip code', 'postal code', 'postcode', 'zip/postal code'],
  country: ['country', 'country/region', 'nation'],
  linkedin: [
    'linkedin',
    'linkedin url',
    'linkedin profile',
    'linkedin profile url',
    'linkedin link',
  ],
  website: [
    'website',
    'website url',
    'portfolio',
    'portfolio url',
    'personal website',
    'personal url',
    'homepage',
    'blog',
  ],
  github: ['github', 'github url', 'github profile', 'github link'],
  resume: [
    'resume',
    'resume/cv',
    'cv',
    'curriculum vitae',
    'upload resume',
    'attach resume',
  ],
  cover_letter: [
    'cover letter',
    'covering letter',
    'letter of interest',
    'upload cover letter',
  ],
  salary: [
    'salary',
    'salary expectation',
    'expected salary',
    'desired salary',
    'salary expectations',
    'compensation',
    'desired compensation',
  ],
  start_date: [
    'start date',
    'available start date',
    'earliest start date',
    'when can you start',
    'availability',
    'date available',
  ],
  sponsorship: [
    'sponsorship',
    'work authorization',
    'visa sponsorship',
    'do you require sponsorship',
    'will you now or in the future require sponsorship',
    'are you authorized to work',
    'work permit',
    'eligible to work',
  ],
  gender: ['gender', 'sex', 'gender identity'],
  race: [
    'race',
    'ethnicity',
    'race/ethnicity',
    'racial/ethnic identification',
  ],
  veteran: [
    'veteran',
    'veteran status',
    'are you a veteran',
    'protected veteran',
  ],
  disability: [
    'disability',
    'disability status',
    'do you have a disability',
  ],
  education: [
    'education',
    'highest education',
    'degree',
    'school',
    'university',
    'college',
  ],
  company: [
    'current company',
    'current employer',
    'company',
    'employer',
    'most recent employer',
  ],
  title: [
    'current title',
    'job title',
    'title',
    'current job title',
    'position title',
    'role',
  ],
  years_experience: [
    'years of experience',
    'experience',
    'total experience',
    'how many years',
    'years in industry',
  ],
  referral: [
    'referral',
    'how did you hear about us',
    'referred by',
    'source',
    'how did you hear about this job',
    'how did you find us',
  ],
  pronouns: ['pronouns', 'preferred pronouns', 'your pronouns'],
};

// Build reverse lookup: normalized synonym → canonical name
const REVERSE_MAP = new Map<string, string>();
for (const [canonical, synonyms] of Object.entries(SYNONYM_MAP)) {
  for (const syn of synonyms) {
    REVERSE_MAP.set(syn.toLowerCase().trim(), canonical);
  }
}

/**
 * Resolve a field label to its canonical name. Returns the canonical key
 * (e.g. `'first_name'`) or `null` if no match is found.
 */
export function resolveCanonicalField(label: string): string | null {
  const normalized = label.toLowerCase().replace(/[*:?]/g, '').trim();
  return REVERSE_MAP.get(normalized) ?? null;
}

/**
 * Check whether two field labels refer to the same canonical concept.
 */
export function fieldsMatch(labelA: string, labelB: string): boolean {
  const a = resolveCanonicalField(labelA);
  const b = resolveCanonicalField(labelB);
  return a !== null && a === b;
}

/**
 * Get all known synonyms for a canonical field name.
 */
export function getSynonyms(canonical: string): string[] {
  return SYNONYM_MAP[canonical] ?? [];
}

/**
 * Get the full list of canonical field names.
 */
export function getCanonicalFieldNames(): string[] {
  return Object.keys(SYNONYM_MAP);
}
