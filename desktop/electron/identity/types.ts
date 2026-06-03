/**
 * P5.6 - identity-store type surface.
 *
 * The `IdentityStore` is the ONE place identity values enter the desktop
 * runtime. Everything else (the `identity_load` tool, the fill-field
 * driver, prompt-trace serialization) goes through it. Raw values never
 * pass through AI prompts; the store returns a value by logical key only.
 */

export interface IdentityStore {
  /**
   * Return the raw value for a known key. Throws on unknown keys; returns
   * `null` when the key is known but not yet populated.
   */
  read(key: IdentityKey): Promise<string | null>;

  /**
   * Persist a value for a known key. Throws when the value fails the
   * schema's validator or the key is unknown.
   */
  write(key: IdentityKey, value: string): Promise<void>;

  /**
   * Remove a value for a known key.
   */
  clear(key: IdentityKey): Promise<void>;

  /**
   * Enumerate known keys (schema-defined) and whether each has a value.
   * Intentionally does NOT return values - callers should `read` per-key.
   */
  list(): Promise<readonly { key: IdentityKey; hasValue: boolean }[]>;

  /**
   * Snapshot for the driver: returns a map of populated keys to values.
   * Use only for driver construction at session start; do not pass the
   * snapshot into prompt code.
   */
  snapshot(): Promise<Readonly<Record<string, string>>>;
}

/** See IDENTITY_SCHEMA in schema.ts for the authoritative list. */
export type IdentityKey =
  | 'first_name'
  | 'last_name'
  | 'full_name'
  | 'email'
  | 'phone'
  | 'address_line_1'
  | 'address_line_2'
  | 'city'
  | 'state'
  | 'postal_code'
  | 'country'
  | 'linkedin_url'
  | 'github_url'
  | 'portfolio_url'
  | 'website_url'
  | 'resume_pdf_path'
  | 'resume_docx_path'
  | 'cover_letter_pdf_path'
  | 'work_authorization'
  | 'sponsorship_required'
  | 'gender'
  | 'race_ethnicity'
  | 'veteran_status'
  | 'disability_status';
