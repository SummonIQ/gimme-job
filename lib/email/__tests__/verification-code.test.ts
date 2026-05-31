import { describe, expect, it } from 'vitest';

import { extractVerificationCode } from '../verification-code';

describe('extractVerificationCode', () => {
  it('returns the digit run after a hint phrase', () => {
    const result = extractVerificationCode(
      'Your verification code is 12345678. Do not share it.',
    );
    expect(result?.code).toBe('12345678');
    expect(result?.source).toBe('hint');
  });

  it('handles colon-style code lines', () => {
    const result = extractVerificationCode(
      'Code: 4829\nThis expires in 10 minutes.',
    );
    expect(result?.code).toBe('4829');
  });

  it('falls back to longest standalone digit run when subject hints', () => {
    const result = extractVerificationCode(
      'Please use the code below to continue.\n\n   45821937   \n\nThanks',
      'Verification code from ATS',
    );
    expect(result?.code).toBe('45821937');
  });

  it('extracts codes from HTML-only email bodies', () => {
    const result = extractVerificationCode(
      '<html><body><p>Your security code is</p><strong>83162044</strong></body></html>',
      'Greenhouse verification code',
    );
    expect(result?.code).toBe('83162044');
  });

  it('extracts alphanumeric security codes after a hint phrase', () => {
    const result = extractVerificationCode(
      'Your security code is ab12cd34. It expires in 10 minutes.',
      'Greenhouse security code',
    );
    expect(result?.code).toBe('AB12CD34');
    expect(result?.digits).toBe(8);
  });

  it('refuses to match digit runs without any hint context', () => {
    const result = extractVerificationCode(
      'Your application id is 99887766 and our office number is 555-1234.',
    );
    expect(result).toBeNull();
  });

  it('ignores 9+ digit runs (phone numbers / IDs)', () => {
    const result = extractVerificationCode(
      'Your verification code is 123456789. Phone us at 5551234567.',
    );
    // The 9-digit number should not match, but the 10-digit phone also shouldnt.
    // No 4-8 digit standalone in this body, so result is null.
    expect(result).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(extractVerificationCode(null)).toBeNull();
    expect(extractVerificationCode('')).toBeNull();
  });
});
