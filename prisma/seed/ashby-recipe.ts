/**
 * P4.2 - Ashby NetworkSubmissionRecipe seed.
 *
 * This seed now captures the direct non-user Ashby application flow
 * from first-party public artifacts:
 * - the public application bundle (`index-CeNwiT5k.js`, 2026-04-23)
 * - a live read-only `ApiJobPosting` query against the public Apollo
 *   GraphQL application page on 2026-04-23
 *
 * We still keep the recipe `INFERRED` + `SHADOW`. P4.1 is the point
 * where Steven confirms the exact live waterfall and we can promote it
 * to `OWNER_CONFIRMED` + `ACTIVE`.
 */

import {
  type NetworkSubmissionRecipeInput,
  validateRecipeForPromotion,
} from '@/lib/applications/network-runner/recipe-schema';

const ASHBY_HOSTNAME = 'jobs.ashbyhq.com';
const ASHBY_GRAPHQL_ENDPOINT =
  'https://jobs.ashbyhq.com/api/non-user-graphql';
const ASHBY_JSON_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

const ASHBY_JOB_POSTING_QUERY = `
  query ApiJobPosting(
    $organizationHostedJobsPageName: String!
    $jobPostingId: String!
  ) {
    jobPosting(
      organizationHostedJobsPageName: $organizationHostedJobsPageName
      jobPostingId: $jobPostingId
    ) {
      id
      applicationForm {
        id
        formControls {
          identifier
          title
        }
        sourceFormDefinitionId
      }
      surveyForms {
        id
        formControls {
          identifier
          title
        }
        sourceFormDefinitionId
      }
      automatedProcessingLegalNotice {
        automatedProcessingLegalNoticeRuleId
      }
    }
  }
`.trim();

const ASHBY_SET_FORM_VALUE_MUTATION = `
  mutation ApiSetFormValue(
    $organizationHostedJobsPageName: String!
    $formRenderIdentifier: String!
    $path: String!
    $value: JSON
    $formDefinitionIdentifier: String
  ) {
    setFormValue(
      organizationHostedJobsPageName: $organizationHostedJobsPageName
      formRenderIdentifier: $formRenderIdentifier
      path: $path
      value: $value
      formDefinitionIdentifier: $formDefinitionIdentifier
    ) {
      id
    }
  }
`.trim();

const ASHBY_CREATE_FILE_UPLOAD_HANDLE_MUTATION = `
  mutation ApiCreateFileUploadHandle(
    $organizationHostedJobsPageName: String!
    $fileUploadContext: FileUploadContext!
    $filename: String!
    $contentType: String!
    $contentLength: Int!
  ) {
    fileUploadHandle: createFileUploadHandle(
      organizationHostedJobsPageName: $organizationHostedJobsPageName
      fileUploadContext: $fileUploadContext
      filename: $filename
      contentType: $contentType
      contentLength: $contentLength
    ) {
      handle
      url
      fields
    }
  }
`.trim();

const ASHBY_SET_FORM_VALUE_TO_FILE_MUTATION = `
  mutation ApiSetFormValueToFile(
    $organizationHostedJobsPageName: String!
    $formRenderIdentifier: String!
    $path: String!
    $fileHandle: String
    $formDefinitionIdentifier: String
  ) {
    setFormValueToFile(
      organizationHostedJobsPageName: $organizationHostedJobsPageName
      formRenderIdentifier: $formRenderIdentifier
      path: $path
      fileHandle: $fileHandle
      formDefinitionIdentifier: $formDefinitionIdentifier
    ) {
      id
    }
  }
`.trim();

const ASHBY_SUBMIT_MULTIPLE_FORMS_MUTATION = `
  mutation ApiSubmitMultipleFormsAction(
    $organizationHostedJobsPageName: String!
    $jobPostingId: String!
    $applicationFormRenderIdentifier: String!
    $applicationFormActionIdentifier: String!
    $applicationFormDefinitionIdentifier: String
    $surveyIdentifiers: [JSON!]!
    $recaptchaToken: String!
    $sourceAttributionCode: String
    $viewedAutomatedProcessingLegalNoticeRuleId: String
    $deviceFingerprint: String
    $applicationRequestId: String
  ) {
    submitMultipleFormsAction(
      organizationHostedJobsPageName: $organizationHostedJobsPageName
      jobPostingId: $jobPostingId
      applicationFormRenderIdentifier: $applicationFormRenderIdentifier
      applicationFormActionIdentifier: $applicationFormActionIdentifier
      applicationFormDefinitionIdentifier: $applicationFormDefinitionIdentifier
      surveyIdentifiers: $surveyIdentifiers
      recaptchaToken: $recaptchaToken
      sourceAttributionCode: $sourceAttributionCode
      viewedAutomatedProcessingLegalNoticeRuleId: $viewedAutomatedProcessingLegalNoticeRuleId
      deviceFingerprint: $deviceFingerprint
      applicationRequestId: $applicationRequestId
    ) {
      applicationFormResult {
        ... on FormRender {
          id
          errorMessages
        }
        ... on FormSubmitSuccess {
          _
        }
      }
      surveyFormResults {
        ... on FormRender {
          id
          errorMessages
        }
        ... on FormSubmitSuccess {
          _
        }
      }
      messages {
        blockMessageForCandidateHtml
      }
    }
  }
`.trim();

function buildGraphqlBody(args: {
  readonly operationName: string;
  readonly query: string;
  readonly variablesBody: string;
}): string {
  return `{"operationName":"${args.operationName}","query":${JSON.stringify(args.query)},"variables":${args.variablesBody}}`;
}

export async function seedAshbyRecipe(): Promise<void> {
  const { db } = await import('@/lib/db/client');
  const atsSystemId = await resolveAshbyAtsSystemId();
  const recipe = buildAshbyRecipe(atsSystemId);

  const validation = validateRecipeForPromotion(recipe);
  if (!validation.ok) {
    throw new Error(
      `seedAshbyRecipe: invalid recipe: ${validation.errors.join('; ')}`,
    );
  }

  await db.networkSubmissionRecipe.upsert({
    create: {
      atsSystemId: recipe.atsSystemId ?? null,
      confidence: recipe.confidence,
      confirmationDetector: recipe.confirmationDetector,
      family: recipe.family,
      hostname: recipe.hostname ?? null,
      notes: recipe.notes ?? null,
      rateLimit: recipe.rateLimit ?? undefined,
      requestSequence: recipe.requestSequence,
      source: recipe.source,
      status: recipe.status,
      variableTokens: recipe.variableTokens ?? undefined,
      version: recipe.version ?? 1,
    },
    update: {
      atsSystemId: recipe.atsSystemId ?? null,
      confidence: recipe.confidence,
      confirmationDetector: recipe.confirmationDetector,
      hostname: recipe.hostname ?? null,
      notes: recipe.notes ?? null,
      rateLimit: recipe.rateLimit ?? undefined,
      requestSequence: recipe.requestSequence,
      source: recipe.source,
      status: recipe.status,
      variableTokens: recipe.variableTokens ?? undefined,
    },
    where: {
      family_version: {
        family: recipe.family,
        version: recipe.version ?? 1,
      },
    },
  });
}

export function buildAshbyRecipe(
  atsSystemId: string | null,
): NetworkSubmissionRecipeInput {
  return {
    atsSystemId,
    confidence: 0.9,
    confirmationDetector: {
      bodyRegex: '"applicationFormResult"\\s*:\\s*\\{\\s*"_":',
      statusCode: 200,
    },
    family: 'ashby',
    hostname: ASHBY_HOSTNAME,
    notes: [
      'Derived 2026-04-23 from Ashby first-party non-user bundle index-CeNwiT5k.js and a live read-only ApiJobPosting query against the public Apollo GraphQL application page.',
      'Version 1 targets direct /:organizationHostedJobsPageName/:jobPostingId/application flows and uses ApiSubmitMultipleFormsAction so survey forms remain expressible.',
      'Step 0 survey forms feed surveyIdentifiers via surveyForms.map(({ id, formControls, sourceFormDefinitionId }) => ({ formRenderId: id, actionIdentifier: formControls[0]?.identifier, sourceFormDefinitionId })).',
      'Scalar field writes repeat ApiSetFormValue per field path. Resume/file fields use fileUploadContext=NonUserFormEngine, then direct-upload the presigned form data before ApiSetFormValueToFile.',
      'Keep this recipe SHADOW until P4.1 confirms live HAR parity and a safe-board replay proves the submit response shape.',
    ].join(' '),
    rateLimit: null,
    requestSequence: [
      {
        bodyTemplate: buildGraphqlBody({
          operationName: 'ApiJobPosting',
          query: ASHBY_JOB_POSTING_QUERY,
          variablesBody:
            '{"organizationHostedJobsPageName":"{organization_hosted_jobs_page_name}","jobPostingId":"{job_posting_id}"}',
        }),
        expectStatus: [200],
        headers: ASHBY_JSON_HEADERS,
        method: 'POST',
        url: `${ASHBY_GRAPHQL_ENDPOINT}?op=ApiJobPosting`,
      },
      {
        bodyTemplate: buildGraphqlBody({
          operationName: 'ApiSetFormValue',
          query: ASHBY_SET_FORM_VALUE_MUTATION,
          variablesBody:
            '{"organizationHostedJobsPageName":"{organization_hosted_jobs_page_name}","formRenderIdentifier":"{target_form_render_identifier}","path":"{field_path}","value":{field_value_json},"formDefinitionIdentifier":{target_form_definition_identifier_json}}',
        }),
        expectStatus: [200],
        headers: ASHBY_JSON_HEADERS,
        method: 'POST',
        url: `${ASHBY_GRAPHQL_ENDPOINT}?op=ApiSetFormValue`,
      },
      {
        bodyTemplate: buildGraphqlBody({
          operationName: 'ApiCreateFileUploadHandle',
          query: ASHBY_CREATE_FILE_UPLOAD_HANDLE_MUTATION,
          variablesBody:
            '{"organizationHostedJobsPageName":"{organization_hosted_jobs_page_name}","fileUploadContext":"NonUserFormEngine","filename":"{upload_filename}","contentType":"{upload_content_type}","contentLength":{upload_content_length}}',
        }),
        expectStatus: [200],
        headers: ASHBY_JSON_HEADERS,
        method: 'POST',
        url: `${ASHBY_GRAPHQL_ENDPOINT}?op=ApiCreateFileUploadHandle`,
      },
      {
        bodyTemplate:
          '{"multipartForm":{"fields":{file_upload_fields_json},"file":{"filename":"{upload_filename}","contentType":"{upload_content_type}","bytesBase64":"{upload_bytes_base64}"}}}',
        expectStatus: [200, 201, 204],
        method: 'POST',
        url: '{file_upload_url}',
      },
      {
        bodyTemplate: buildGraphqlBody({
          operationName: 'ApiSetFormValueToFile',
          query: ASHBY_SET_FORM_VALUE_TO_FILE_MUTATION,
          variablesBody:
            '{"organizationHostedJobsPageName":"{organization_hosted_jobs_page_name}","formRenderIdentifier":"{application_form_render_identifier}","path":"{file_field_path}","fileHandle":"{file_upload_handle}","formDefinitionIdentifier":{application_form_definition_identifier_json}}',
        }),
        expectStatus: [200],
        headers: ASHBY_JSON_HEADERS,
        method: 'POST',
        url: `${ASHBY_GRAPHQL_ENDPOINT}?op=ApiSetFormValueToFile`,
      },
      {
        bodyTemplate: buildGraphqlBody({
          operationName: 'ApiSubmitMultipleFormsAction',
          query: ASHBY_SUBMIT_MULTIPLE_FORMS_MUTATION,
          variablesBody:
            '{"organizationHostedJobsPageName":"{organization_hosted_jobs_page_name}","jobPostingId":"{job_posting_id}","applicationFormRenderIdentifier":"{application_form_render_identifier}","applicationFormActionIdentifier":"{application_form_action_identifier}","applicationFormDefinitionIdentifier":{application_form_definition_identifier_json},"surveyIdentifiers":{survey_identifiers_json},"recaptchaToken":"{recaptcha_token}","sourceAttributionCode":{source_attribution_code_json},"viewedAutomatedProcessingLegalNoticeRuleId":{automated_processing_legal_notice_rule_id_json},"deviceFingerprint":{device_fingerprint_json},"applicationRequestId":{application_request_id_json}}',
        }),
        expectStatus: [200],
        headers: ASHBY_JSON_HEADERS,
        method: 'POST',
        url: `${ASHBY_GRAPHQL_ENDPOINT}?op=ApiSubmitMultipleFormsAction`,
      },
    ],
    source: 'INFERRED',
    status: 'SHADOW',
    variableTokens: [
      {
        from: 0,
        name: 'application_form_render_identifier',
        path: '$.data.jobPosting.applicationForm.id',
        required: true,
        source: 'response',
      },
      {
        from: 0,
        name: 'application_form_action_identifier',
        path: '$.data.jobPosting.applicationForm.formControls[0].identifier',
        required: true,
        source: 'response',
      },
      {
        from: 0,
        name: 'application_form_definition_identifier_json',
        path: '$.data.jobPosting.applicationForm.sourceFormDefinitionId',
        required: false,
        source: 'response',
      },
      {
        from: 0,
        name: 'survey_identifiers_json',
        path: '$.data.jobPosting.surveyForms',
        required: false,
        source: 'response',
      },
      {
        from: 0,
        name: 'automated_processing_legal_notice_rule_id_json',
        path: '$.data.jobPosting.automatedProcessingLegalNotice.automatedProcessingLegalNoticeRuleId',
        required: false,
        source: 'response',
      },
      {
        from: 2,
        name: 'file_upload_handle',
        path: '$.data.fileUploadHandle.handle',
        required: true,
        source: 'response',
      },
      {
        from: 2,
        name: 'file_upload_url',
        path: '$.data.fileUploadHandle.url',
        required: true,
        source: 'response',
      },
      {
        from: 2,
        name: 'file_upload_fields_json',
        path: '$.data.fileUploadHandle.fields',
        required: true,
        source: 'response',
      },
    ],
    version: 1,
  };
}

async function resolveAshbyAtsSystemId(): Promise<string | null> {
  const { db } = await import('@/lib/db/client');
  const record = await db.aTSSystem.findFirst({
    select: { id: true },
    where: {
      OR: [
        { detectedDomain: ASHBY_HOSTNAME },
        { domainPatterns: { has: ASHBY_HOSTNAME } },
      ],
    },
  });

  return record?.id ?? null;
}

if (import.meta.main) {
  seedAshbyRecipe()
    .then(() => {
      console.log('Ashby NetworkSubmissionRecipe seed upserted.');
      process.exit(0);
    })
    .catch(error => {
      console.error('Ashby NetworkSubmissionRecipe seed failed:', error);
      process.exit(1);
    });
}
