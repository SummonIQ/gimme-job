import { describe, expect, it } from 'vitest';

import { validateRecipeForPromotion } from '@/lib/applications/network-runner/recipe-schema';

import { buildAshbyRecipe } from '../ashby-recipe';

describe('buildAshbyRecipe', () => {
  it('builds a valid inferred shadow recipe', () => {
    const recipe = buildAshbyRecipe('ats_ashby');
    const validation = validateRecipeForPromotion(recipe);

    expect(validation.ok).toBe(true);
    expect(recipe.atsSystemId).toBe('ats_ashby');
    expect(recipe.family).toBe('ashby');
    expect(recipe.hostname).toBe('jobs.ashbyhq.com');
    expect(recipe.source).toBe('INFERRED');
    expect(recipe.status).toBe('SHADOW');
  });

  it('captures the traced Ashby request flow and response tokens', () => {
    const recipe = buildAshbyRecipe(null);

    expect(recipe.requestSequence).toHaveLength(6);
    expect(recipe.requestSequence[0]?.url).toContain('?op=ApiJobPosting');
    expect(recipe.requestSequence[2]?.url).toContain(
      '?op=ApiCreateFileUploadHandle',
    );
    expect(recipe.requestSequence[5]?.url).toContain(
      '?op=ApiSubmitMultipleFormsAction',
    );
    expect(recipe.requestSequence[3]?.url).toBe('{file_upload_url}');
    expect(recipe.requestSequence[5]?.bodyTemplate).toContain(
      '"surveyIdentifiers":{survey_identifiers_json}',
    );
    expect(recipe.confirmationDetector.bodyRegex).toContain(
      '"applicationFormResult"',
    );
    expect(
      recipe.variableTokens?.some(
        token =>
          token.name === 'application_form_render_identifier' &&
          token.path === '$.data.jobPosting.applicationForm.id',
      ),
    ).toBe(true);
    expect(
      recipe.variableTokens?.some(
        token =>
          token.name === 'file_upload_handle' &&
          token.path === '$.data.fileUploadHandle.handle',
      ),
    ).toBe(true);
  });
});
