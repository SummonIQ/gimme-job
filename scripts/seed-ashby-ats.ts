import { db } from '@/lib/db/client';

async function main() {
  const existing = await db.aTSSystem.findFirst({
    where: {
      OR: [
        { detectedDomain: 'jobs.ashbyhq.com' },
        { domainPatterns: { has: 'jobs.ashbyhq.com' } },
      ],
    },
  });

  if (existing) {
    console.log(`Ashby ATSSystem already exists (id: ${existing.id}), updating...`);
    await db.aTSSystem.update({
      where: { id: existing.id },
      data: {
        resumeUploadGatesAutofill: true,
        resumeAutofillContainerSelector:
          '.ashby-application-form-autofill-input-base-layer',
        resumeFieldSelectors: [
          '.ashby-application-form-autofill-input-base-layer input[type="file"]',
          'input[type="file"]',
        ],
        resumeUploadApiPath:
          '/api/non-user-graphql?op=ApiCreateFileUploadHandle',
      },
    });
    console.log('Updated Ashby ATSSystem with resume autofill config.');
    return;
  }

  const record = await db.aTSSystem.create({
    data: {
      name: 'Ashby',
      vendor: 'Ashby',
      detectedDomain: 'jobs.ashbyhq.com',
      domainPatterns: ['jobs.ashbyhq.com'],
      commonStructures: {},
      formPatterns: {},
      fieldMappings: {},
      uniqueIdentifiers: {
        hostname: 'jobs.ashbyhq.com',
      },
      resumeUploadMethod: 'file-input',
      resumeFieldSelectors: [
        '.ashby-application-form-autofill-input-base-layer input[type="file"]',
        'input[type="file"]',
      ],
      resumeUploadGatesAutofill: true,
      resumeAutofillContainerSelector:
        '.ashby-application-form-autofill-input-base-layer',
      resumeUploadApiPath:
        '/api/non-user-graphql?op=ApiCreateFileUploadHandle',
      nuances: [
        'Resume upload triggers form autofill — must upload before fields populate',
        'Uses GraphQL API at /api/non-user-graphql for file uploads',
      ],
      isMultiStep: false,
      requiresInteraction: false,
      difficulty: 'Medium',
    },
  });

  console.log(`Created Ashby ATSSystem (id: ${record.id})`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
