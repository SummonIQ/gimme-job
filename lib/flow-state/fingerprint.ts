import { createHash } from 'node:crypto';

import * as cheerio from 'cheerio';

/**
 * Computes a structural fingerprint for an application page. Two visits
 * to the same conceptual page (e.g. the "Personal Info" step on
 * Greenhouse, visited for job A and job B) should produce the same
 * fingerprint so the flow state machine can recognize them as the same
 * node.
 *
 * Strategy:
 *  1. Parse the HTML.
 *  2. Enumerate every interactive field (<input>, <textarea>, <select>)
 *     that isn't hidden / disabled / a honeypot.
 *  3. For each field, compute a stable signature from a combination of
 *     `name`, `autocomplete`, `type`, `aria-label`, resolved label text,
 *     and `role`. Numeric IDs and stable selectors with random tokens
 *     are deliberately excluded.
 *  4. Sort the signatures (order-independent) and SHA-256 the joined
 *     string.
 *
 * The point isn't perfect uniqueness — it's stability across identical
 * pages with different job IDs and minor markup variations.
 */
export interface FieldSignature {
  name: string | null;
  autocomplete: string | null;
  type: string | null;
  ariaLabel: string | null;
  label: string | null;
  role: string | null;
  required: boolean;
}

export function extractFieldSignatures(html: string): FieldSignature[] {
  const $ = cheerio.load(html);
  const signatures: FieldSignature[] = [];

  const query = 'input, textarea, select';
  $(query).each((_, element) => {
    const $el = $(element);
    const type = ($el.attr('type') ?? '').toLowerCase();
    if (type === 'hidden' || type === 'submit' || type === 'button') return;
    if ($el.attr('disabled') !== undefined) return;
    if ($el.attr('aria-hidden') === 'true') return;

    const styleAttr = ($el.attr('style') ?? '').toLowerCase();
    if (/display\s*:\s*none|visibility\s*:\s*hidden/.test(styleAttr)) return;

    // Walk ancestors to pull the associated label.
    let labelText = '';
    const id = $el.attr('id');
    if (id) {
      labelText = $(`label[for="${id}"]`).first().text().trim();
    }
    if (!labelText) {
      labelText = $el.closest('label').text().trim();
    }

    signatures.push({
      autocomplete: $el.attr('autocomplete')?.trim() || null,
      ariaLabel: $el.attr('aria-label')?.trim() || null,
      label: labelText || null,
      name: $el.attr('name')?.trim() || null,
      required:
        $el.is('[required]') || $el.attr('aria-required') === 'true',
      role: $el.attr('role')?.trim() || null,
      type: type || $el.prop('tagName')?.toString().toLowerCase() || null,
    });
  });

  return signatures;
}

function signatureToken(sig: FieldSignature): string {
  // We intentionally skip pure name matches because some ATSes (Rippling,
  // Greenhouse) reuse random-ID-looking names per posting. Prefer the
  // most stable identifiers first, then fall back to labels.
  const parts = [
    sig.autocomplete,
    sig.ariaLabel?.toLowerCase() || null,
    sig.label?.toLowerCase() || null,
    sig.type,
    sig.role,
    sig.required ? 'required' : 'optional',
  ]
    .filter(Boolean)
    .map(part => String(part).replace(/\s+/g, ' ').trim());
  return parts.join('|');
}

/**
 * Compute a SHA-256 fingerprint from the given HTML. Stable, order-
 * independent, and excludes tokens that change per-posting.
 */
export function computePageFingerprint(html: string): string {
  const signatures = extractFieldSignatures(html);
  const tokens = signatures
    .map(signatureToken)
    .filter(token => token.length > 0)
    .sort();

  const hash = createHash('sha256');
  hash.update(tokens.join('\n'));
  return hash.digest('hex');
}

/**
 * Utility: group signatures into required vs optional buckets for
 * storing on the `ApplicationFlowNode` record.
 */
export function partitionSignatures(signatures: FieldSignature[]): {
  required: FieldSignature[];
  optional: FieldSignature[];
} {
  const required: FieldSignature[] = [];
  const optional: FieldSignature[] = [];
  for (const sig of signatures) {
    if (sig.required) required.push(sig);
    else optional.push(sig);
  }
  return { required, optional };
}
