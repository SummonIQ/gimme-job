import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  GREENHOUSE_PATTERNS,
  OTHER_FAMILY_PATTERNS,
  type ConfirmationFamily,
  detectConfirmation,
  normalizeHtmlToText,
} from '../confirmation-detector';
import { RUNTIME_PROVIDERS } from '@/lib/runtime-provider/registry';

function html(body: string): string {
  return `<!doctype html><html><head><title>t</title></head><body>${body}</body></html>`;
}

describe('Greenhouse pattern coverage', () => {
  it('Greenhouse pattern set has the canonical + >=3 variants', () => {
    const variants = new Set(GREENHOUSE_PATTERNS.map(p => p.variant));
    expect(variants.has('canonical')).toBe(true);
    expect(variants.size).toBeGreaterThanOrEqual(4);
  });

  it('every production provider has at least three confirmation patterns', () => {
    const allPatterns = [...GREENHOUSE_PATTERNS, ...OTHER_FAMILY_PATTERNS];
    const productionProviders = RUNTIME_PROVIDERS.filter(
      provider => provider.readiness === 'production',
    );

    for (const provider of productionProviders) {
      const family = provider.id as ConfirmationFamily;
      const patterns = allPatterns.filter(pattern => pattern.family === family);
      expect(
        patterns.length,
        `${provider.id} confirmation pattern count`,
      ).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('detectConfirmation - P17.3 provider fixtures', () => {
  it.each([
    ['ashby', 'ashby'],
    ['lever', 'lever'],
    ['workable', 'workable'],
    ['smartrecruiters', 'smartrecruiters'],
    ['recruitee', 'recruitee'],
    ['teamtailor', 'teamtailor'],
    ['jobvite', 'jobvite'],
    ['bamboohr', 'bamboohr'],
    ['personio', 'personio'],
    ['breezy', 'breezy'],
  ] as const)('detects %s confirmation fixture', async (provider, family) => {
    const fixture = await readFile(
      join(
        process.cwd(),
        'desktop',
        'electron',
        'submit',
        '__tests__',
        'fixtures',
        provider,
        'confirmation.html',
      ),
      'utf8',
    );

    expect(detectConfirmation({ family, html: fixture })).toMatchObject({
      family,
    });
  });
});

describe('detectConfirmation - 10 positive cases', () => {
  it('1. canonical Greenhouse banner', () => {
    const result = detectConfirmation({
      html: html('<h1>Application submitted!</h1><p>Thanks.</p>'),
    });
    expect(result?.family).toBe('greenhouse');
    expect(result?.variant).toBe('canonical');
  });

  it('2. Greenhouse "Thanks for applying to <role> at <company>"', () => {
    const result = detectConfirmation({
      html: html(
        '<p>Thanks for applying to Senior Engineer at Fixture Co. Powered by Greenhouse.</p>',
      ),
    });
    expect(result?.family).toBe('greenhouse');
  });

  it('3. Greenhouse "We have received your application"', () => {
    const result = detectConfirmation({
      html: html("<p>We have received your application. You'll hear back.</p>"),
    });
    expect(result?.family).toBe('greenhouse');
    expect(result?.variant).toBe('received-your-application');
  });

  it('4. Greenhouse "Powered by Greenhouse" footer', () => {
    const result = detectConfirmation({
      html: html(
        '<p>Your submission is complete.</p><footer>Powered by Greenhouse</footer>',
      ),
    });
    expect(result).not.toBeNull();
  });

  it('5. Lever "Thanks for applying!" banner', () => {
    const result = detectConfirmation({
      html: html(
        '<div class="posting-submitted"><h2>Thanks for applying!</h2></div>',
      ),
    });
    expect(result?.family).toBe('lever');
  });

  it('6. Ashby "Application Received"', () => {
    const result = detectConfirmation({
      html: html(
        '<div data-stage="confirmation"><h1>Application Received</h1></div>',
      ),
    });
    expect(result?.family).toBe('ashby');
  });

  it('7. SmartRecruiters "Thank you for applying"', () => {
    const result = detectConfirmation({
      html: html('<h1>Thank you for applying</h1><p>We will be in touch.</p>'),
    });
    expect(result?.family).toBe('smartrecruiters');
  });

  it('8. generic "your application has been received"', () => {
    const result = detectConfirmation({
      html: html('<h2>Done</h2><p>Your application has been received.</p>'),
    });
    expect(result).not.toBeNull();
  });

  it('9. generic "application successful"', () => {
    const result = detectConfirmation({
      html: html('<p>Application Successful.</p>'),
    });
    expect(result).not.toBeNull();
  });

  it('10. confirmation appears alongside other marketing content', () => {
    const result = detectConfirmation({
      html: html(
        '<nav>Menu</nav><main><h1>Application submitted!</h1></main><footer>Subscribe to our newsletter.</footer>',
      ),
    });
    expect(result?.family).toBe('greenhouse');
  });
});

describe('detectConfirmation - 10 negative / false-positive regression cases', () => {
  it('1. blank page', () => {
    expect(detectConfirmation({ html: html('<p></p>') })).toBeNull();
  });

  it('2. marketing email about a product launch', () => {
    const result = detectConfirmation({
      html: html('<h1>New feature launch</h1><p>See what is new at Acme.</p>'),
    });
    expect(result).toBeNull();
  });

  it('3. JD text mentioning "Application submitted" as a sentence fragment', () => {
    // THIS is the regression the spec calls out: a job description mentioning
    // "application submitted" must NOT match.
    const result = detectConfirmation({
      html: html(
        '<section class="job-description"><h2>About the role</h2><p>You will own the end-to-end process from application submitted through candidate offered.</p><ul><li>Responsibilities</li><li>Qualifications</li></ul></section>',
      ),
    });
    expect(result).toBeNull();
  });

  it('4. "we will review" inside a JD bullet list', () => {
    const result = detectConfirmation({
      html: html(
        '<section class="job-description"><h2>Responsibilities</h2><p>Build systems that decide which candidates we will review.</p></section>',
      ),
    });
    expect(result).toBeNull();
  });

  it('5. generic webpage with the word "applying" elsewhere', () => {
    const result = detectConfirmation({
      html: html('<p>Consider applying our standard review process.</p>'),
    });
    expect(result).toBeNull();
  });

  it('6. error page with "application failed"', () => {
    const result = detectConfirmation({
      html: html('<h1>Application failed</h1><p>Please try again.</p>'),
    });
    expect(result).toBeNull();
  });

  it('7. login / auth page', () => {
    const result = detectConfirmation({
      html: html('<form><label>Email</label><input type="email"/></form>'),
    });
    expect(result).toBeNull();
  });

  it('8. JD with "greenhouse" mentioned as a vendor but no confirmation phrase', () => {
    const result = detectConfirmation({
      html: html(
        '<section class="job-description"><h2>Qualifications</h2><p>Experience integrating with ATS vendors such as Greenhouse and Lever.</p></section>',
      ),
    });
    expect(result).toBeNull();
  });

  it('9. empty confirmation banner shell (no copy yet)', () => {
    const result = detectConfirmation({
      html: html('<div id="confirmation"></div>'),
    });
    expect(result).toBeNull();
  });

  it('10. "application received" inside a FAQ about application tracking systems', () => {
    // Still inside a JD-ish context + no thanks/received-your/submitted-affirmation
    // phrase pairing. Should be rejected by the JD guard.
    const result = detectConfirmation({
      html: html(
        '<section class="job-description"><h2>About the role</h2><p>You will help candidates understand how an application received by our ATS moves through stages.</p><ul><li>Requirements</li></ul></section>',
      ),
    });
    expect(result).toBeNull();
  });
});

describe('detectConfirmation - family biasing', () => {
  it('prefers an explicit family match', () => {
    const body = html('<p>Thanks for applying! Powered by Greenhouse.</p>');
    const withoutFamily = detectConfirmation({ html: body });
    const withFamily = detectConfirmation({ family: 'lever', html: body });

    // Without a hint, Greenhouse's "Powered by Greenhouse" wins by
    // confidence. With "lever" hint, Lever's own pattern is tried first -
    // and since the HTML also matches "Thanks for applying!" (Lever's
    // canonical), it wins.
    expect(withoutFamily?.family).toBe('greenhouse');
    expect(withFamily?.family).toBe('lever');
  });

  it('returns the highest-confidence family match when several patterns hit', () => {
    const result = detectConfirmation({
      html: html(
        '<h1>Application submitted!</h1><p>Thanks for applying! Powered by Greenhouse.</p>',
      ),
    });
    expect(result?.variant).toBe('canonical');
    expect(result?.confidence).toBeGreaterThanOrEqual(0.95);
  });
});

describe('normalizeHtmlToText', () => {
  it('strips tags and collapses whitespace', () => {
    expect(
      normalizeHtmlToText('<div>Hello\n\n  <span>world</span></div>'),
    ).toBe('Hello world');
  });
});
