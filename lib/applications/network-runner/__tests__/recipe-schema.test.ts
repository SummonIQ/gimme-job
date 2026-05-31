import { describe, expect, it } from 'vitest';

import {
  ConfirmationDetectorSchema,
  NetworkSubmissionRecipeSchema,
  validateRecipeForPromotion,
} from '../recipe-schema';

const baseValidRecipe = {
  atsSystemId: null,
  confidence: 0.9,
  confirmationDetector: {
    bodyRegex: 'thanks for applying',
    statusCode: 200,
  },
  family: 'ashby',
  hostname: 'boards.ashbyhq.com',
  notes: null,
  rateLimit: null,
  requestSequence: [
    {
      headers: { Accept: 'application/json' },
      method: 'GET' as const,
      url: 'https://boards.ashbyhq.com/api/application/csrf',
    },
    {
      bodyTemplate: '{"firstName":"{first_name}"}',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': '{csrf_token}',
      },
      method: 'POST' as const,
      url: 'https://boards.ashbyhq.com/api/application/submit',
    },
  ],
  source: 'OWNER_CONFIRMED' as const,
  status: 'ACTIVE' as const,
  variableTokens: [
    {
      from: 0,
      name: 'csrf_token',
      path: '$.csrfToken',
      required: true,
      source: 'response' as const,
    },
  ],
  version: 1,
};

describe('ConfirmationDetectorSchema', () => {
  it('accepts a detector with only a statusCode', () => {
    const parsed = ConfirmationDetectorSchema.safeParse({ statusCode: 201 });
    expect(parsed.success).toBe(true);
  });

  it('accepts a detector with only a bodyRegex', () => {
    const parsed = ConfirmationDetectorSchema.safeParse({
      bodyRegex: 'submission received',
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts a detector with only header matches', () => {
    const parsed = ConfirmationDetectorSchema.safeParse({
      headerMatches: [{ header: 'x-ats-reference', regex: '^ASH-\\d+$' }],
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects an empty detector object', () => {
    const parsed = ConfirmationDetectorSchema.safeParse({});
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toMatch(
        /at least one of statusCode/,
      );
    }
  });

  it('rejects a detector with only an empty headerMatches array', () => {
    const parsed = ConfirmationDetectorSchema.safeParse({
      headerMatches: [],
    });
    expect(parsed.success).toBe(false);
  });
});

describe('NetworkSubmissionRecipeSchema', () => {
  it('parses a complete OWNER_CONFIRMED/ACTIVE recipe', () => {
    const parsed = NetworkSubmissionRecipeSchema.safeParse(baseValidRecipe);
    expect(parsed.success).toBe(true);
  });

  it('requires confirmationDetector', () => {
    const { confirmationDetector: _removed, ...rest } = baseValidRecipe;
    const parsed = NetworkSubmissionRecipeSchema.safeParse(rest);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(
        parsed.error.issues.some(i =>
          i.path.includes('confirmationDetector'),
        ),
      ).toBe(true);
    }
  });

  it('requires at least one request step', () => {
    const parsed = NetworkSubmissionRecipeSchema.safeParse({
      ...baseValidRecipe,
      requestSequence: [],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects unknown top-level fields (strict mode)', () => {
    const parsed = NetworkSubmissionRecipeSchema.safeParse({
      ...baseValidRecipe,
      secretBackdoor: 'yes',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects confidence outside [0,1]', () => {
    const parsed = NetworkSubmissionRecipeSchema.safeParse({
      ...baseValidRecipe,
      confidence: 1.5,
    });
    expect(parsed.success).toBe(false);
  });
});

describe('validateRecipeForPromotion', () => {
  it('returns ok:true for a well-formed OWNER_CONFIRMED/ACTIVE recipe', () => {
    const result = validateRecipeForPromotion(baseValidRecipe);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when confirmationDetector is missing (P4.2 acceptance test)', () => {
    const { confirmationDetector: _removed, ...rest } = baseValidRecipe;
    const result = validateRecipeForPromotion(rest);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('confirmationDetector'))).toBe(
      true,
    );
  });

  it('fails when confirmationDetector has no detector fields', () => {
    const result = validateRecipeForPromotion({
      ...baseValidRecipe,
      confirmationDetector: {},
    });
    expect(result.ok).toBe(false);
  });

  it('fails when a variableToken references an out-of-range step', () => {
    const result = validateRecipeForPromotion({
      ...baseValidRecipe,
      variableTokens: [
        {
          from: 5,
          name: 'csrf_token',
          path: '$.csrfToken',
          required: true,
          source: 'response',
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(
      result.errors.some(e => e.includes('csrf_token') && e.includes('step 5')),
    ).toBe(true);
  });

  it('refuses to promote a COMMUNITY recipe to ACTIVE', () => {
    const result = validateRecipeForPromotion({
      ...baseValidRecipe,
      source: 'COMMUNITY',
      status: 'ACTIVE',
    });
    expect(result.ok).toBe(false);
    expect(
      result.errors.some(e => e.includes('COMMUNITY recipes stay SHADOW')),
    ).toBe(true);
  });

  it('allows a COMMUNITY recipe to remain SHADOW', () => {
    const result = validateRecipeForPromotion({
      ...baseValidRecipe,
      source: 'COMMUNITY',
      status: 'SHADOW',
    });
    expect(result.ok).toBe(true);
  });
});
