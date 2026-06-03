/**
 * Auto-dismiss cookie/consent banners and similar full-page overlays before
 * the runner starts interacting with the form. ATS pages embedded inside a
 * company careers site frequently inherit OneTrust / Cookiebot / TrustArc
 * banners that block clicks on the form below, so an opening "accept all"
 * keeps autofill flowing without manual intervention.
 *
 * Best-effort and idempotent — every selector is attempted independently
 * with the existing `click` tool, missing selectors are silently ignored,
 * and the function returns the count of overlays that were actually
 * clicked so the runner can log it.
 */
import { parse } from 'node-html-parser';

import type { DesktopAgentRuntimeInput } from '../agent/types.js';
import type { DesktopToolCallResult, DesktopToolName } from '../tools/types.js';

// Known accept/dismiss selectors. Order matters — most specific first.
// Each entry is tried once per call. An "Accept" win is preferred to a
// "Reject" win because some flows (Cookiebot in particular) require an
// explicit accept to dismiss; reject leaves a sticky banner.
const OVERLAY_SELECTORS: ReadonlyArray<string> = [
  // OneTrust
  '#onetrust-accept-btn-handler',
  'button#onetrust-accept-btn-handler',
  '#accept-recommended-btn-handler',
  // Cookiebot
  '#CybotCookiebotDialogBodyButtonAccept',
  '#CybotCookiebotDialogBodyLevelButtonAccept',
  '#CybotCookiebotDialogBodyLevelButtonAcceptAll',
  // TrustArc / TRUSTe
  '.truste-button2',
  '#truste-consent-button',
  '#truste-consent-required',
  // Quantcast
  '.qc-cmp2-summary-buttons button[mode="primary"]',
  // Osano
  '.osano-cm-accept-all',
  // Termly
  '.t-preference-button.t-accept-all-btn',
  // Didomi
  '#didomi-notice-agree-button',
  // Generic explicit IDs
  '#cookie-accept',
  '#accept-cookies',
  '#acceptCookies',
  '#cookiebanner-accept',
  '#cookie-consent-accept',
  '#gdpr-accept',
  // Generic data attributes
  'button[data-testid="cookie-accept"]',
  'button[data-testid="accept-cookies"]',
  'button[data-cy="cookie-accept-all"]',
  // ARIA-labeled accept buttons
  'button[aria-label="Accept all cookies"]',
  'button[aria-label="Accept cookies"]',
  'button[aria-label="Accept all"]',
];

type CallFn = (
  input: DesktopAgentRuntimeInput,
  tool: DesktopToolName,
  toolInput: unknown,
  reason: string,
) => Promise<DesktopToolCallResult>;

export async function dismissCommonOverlays(
  input: DesktopAgentRuntimeInput,
  call: CallFn,
): Promise<number> {
  // Short-circuit: snapshot once, intersect selectors against the live DOM,
  // and only attempt clicks for selectors that match. This avoids spending a
  // round-trip per missing selector — critical because most pages have zero
  // matching banners and a click-each loop would burn ~25 mock awaits per
  // application page.
  const snapshot = await call(input, 'dom_snapshot', {}, 'snapshot for overlays');
  if (!snapshot.ok) return 0;
  const data = snapshot.data as { html?: unknown } | null;
  const html = typeof data?.html === 'string' ? data.html : '';
  if (!html) return 0;
  let root: ReturnType<typeof parse>;
  try {
    root = parse(html);
  } catch {
    return 0;
  }
  const present = OVERLAY_SELECTORS.filter(selector => {
    try {
      return Boolean(root.querySelector(selector));
    } catch {
      return false;
    }
  });
  if (present.length === 0) return 0;

  let dismissed = 0;
  for (const selector of present) {
    const result = await call(
      input,
      'click',
      { selector },
      `dismiss overlay ${selector}`,
    );
    if (result.ok) dismissed += 1;
  }
  return dismissed;
}
