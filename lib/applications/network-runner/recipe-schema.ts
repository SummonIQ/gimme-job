import { z } from 'zod';

/**
 * P4.2 - Shared zod schemas for `NetworkSubmissionRecipe`.
 *
 * The Prisma model stores request sequences, variable tokens, rate
 * limits, and confirmation detectors as opaque JSONB. This module owns
 * the runtime contract those columns must satisfy: the `NetworkRecipeRunner`
 * (P4.3) will refuse to execute a recipe that does not parse here, and
 * the recipe-promotion path will refuse to flip `status=ACTIVE` without
 * a confirmation detector.
 */

export const NetworkRecipeStatus = ['ACTIVE', 'SHADOW', 'DISABLED'] as const;
export type NetworkRecipeStatus = (typeof NetworkRecipeStatus)[number];

export const NetworkRecipeSource = [
  'OWNER_CONFIRMED',
  'COMMUNITY',
  'INFERRED',
] as const;
export type NetworkRecipeSource = (typeof NetworkRecipeSource)[number];

// ----- Request sequence ----------------------------------------------

export const HttpMethodSchema = z.enum([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
]);

export const RequestStepSchema = z
  .object({
    bodyTemplate: z.string().optional(),
    expectStatus: z.array(z.number().int()).optional(),
    headers: z.record(z.string()).optional(),
    method: HttpMethodSchema,
    url: z.string().min(1),
  })
  .strict();
export type RequestStep = z.infer<typeof RequestStepSchema>;

export const RequestSequenceSchema = z.array(RequestStepSchema).min(1);

// ----- Variable tokens -----------------------------------------------

export const VariableTokenSchema = z
  .object({
    from: z.number().int().nonnegative(),
    name: z.string().min(1),
    path: z.string().min(1),
    required: z.boolean().default(true),
    source: z.enum(['response', 'header']),
  })
  .strict();
export type VariableToken = z.infer<typeof VariableTokenSchema>;

export const VariableTokensSchema = z.array(VariableTokenSchema);

// ----- Confirmation detector -----------------------------------------

const HeaderMatchSchema = z
  .object({ header: z.string().min(1), regex: z.string().min(1) })
  .strict();

/**
 * A confirmation detector must resolve to at least ONE of: an exact
 * status code, a body regex, or a header match list. A recipe without
 * any of these cannot prove submission succeeded, so promotion to
 * `ACTIVE` is refused.
 */
export const ConfirmationDetectorSchema = z
  .object({
    bodyRegex: z.string().min(1).optional(),
    headerMatches: z.array(HeaderMatchSchema).min(1).optional(),
    statusCode: z.number().int().optional(),
  })
  .strict()
  .refine(
    value =>
      value.statusCode !== undefined ||
      value.bodyRegex !== undefined ||
      (value.headerMatches !== undefined && value.headerMatches.length > 0),
    {
      message:
        'confirmationDetector must declare at least one of statusCode, bodyRegex, or headerMatches',
    },
  );
export type ConfirmationDetector = z.infer<typeof ConfirmationDetectorSchema>;

// ----- Rate limit override -------------------------------------------

export const RateLimitOverrideSchema = z
  .object({
    burst: z.number().int().positive().optional(),
    perDay: z.number().int().positive().optional(),
    perMinute: z.number().int().positive().optional(),
  })
  .strict();

// ----- Full recipe ---------------------------------------------------

export const NetworkSubmissionRecipeSchema = z
  .object({
    atsSystemId: z.string().nullable().optional(),
    confidence: z.number().min(0).max(1),
    confirmationDetector: ConfirmationDetectorSchema,
    family: z.string().min(1),
    hostname: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    rateLimit: RateLimitOverrideSchema.nullable().optional(),
    requestSequence: RequestSequenceSchema,
    source: z.enum(NetworkRecipeSource),
    status: z.enum(NetworkRecipeStatus),
    variableTokens: VariableTokensSchema.nullable().optional(),
    version: z.number().int().positive().default(1),
  })
  .strict();
export type NetworkSubmissionRecipeInput = z.infer<
  typeof NetworkSubmissionRecipeSchema
>;

/**
 * Promotion-gate check: a recipe may only be `ACTIVE` if a
 * confirmation detector is present AND non-trivial, AND every variable
 * token references an in-bounds step. Consumed by both the validator
 * tests and the P4.3 runner so promotion and execution enforce the
 * same invariant.
 */
export interface RecipeValidationResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

export function validateRecipeForPromotion(
  input: unknown,
): RecipeValidationResult {
  const parsed = NetworkSubmissionRecipeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      errors: parsed.error.issues.map(issue => formatIssue(issue)),
      ok: false,
    };
  }

  const errors: string[] = [];
  const recipe = parsed.data;
  if (recipe.variableTokens) {
    for (const token of recipe.variableTokens) {
      if (token.from >= recipe.requestSequence.length) {
        errors.push(
          `variableToken ${token.name} references step ${token.from} but only ${recipe.requestSequence.length} steps exist`,
        );
      }
    }
  }
  if (recipe.status === 'ACTIVE' && recipe.source === 'COMMUNITY') {
    errors.push(
      'status=ACTIVE recipes must be source=OWNER_CONFIRMED or source=INFERRED; COMMUNITY recipes stay SHADOW until regression parity',
    );
  }
  return { errors, ok: errors.length === 0 };
}

function formatIssue(issue: z.ZodIssue): string {
  const path = issue.path.join('.');
  return path ? `${path}: ${issue.message}` : issue.message;
}
