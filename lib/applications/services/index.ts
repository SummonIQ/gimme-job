import { JobProvider } from '@/generated/prisma/browser';
import { companyDirectService } from './company-direct';
import { submitIndeedApplication } from './indeed-submission';
import { submitLinkedInApplication } from './linkedin-enhanced';

export interface SubmissionProvider {
  submitApplication: (params: SubmissionParams) => Promise<SubmissionResult>;
}

export interface SubmissionParams {
  jobId: string;
  jobUrl?: string;
  resumeData?: Buffer | string;
  coverLetterData?: Buffer | string;
  customFields?: Record<string, any>;
}

export interface SubmissionResult {
  success: boolean;
  applicationId?: string;
  confirmationCode?: string;
  error?: string;
  metadata?: Record<string, any>;
}

const providers: Record<JobProvider, SubmissionProvider> = {
  [JobProvider.LINKEDIN]: {
    submitApplication: submitLinkedInApplication,
  },
  [JobProvider.GOOGLE]: {
    submitApplication: async () => {
      throw new Error('Google Jobs submission not yet implemented');
    },
  },
  [JobProvider.INDEED]: {
    submitApplication: async params => {
      const { jobId, resumeData, coverLetterData, customFields } = params;
      try {
        const result = await submitIndeedApplication({
          jobLeadId: jobId,
          resumeId: customFields?.resumeId || '',
          coverLetterId: customFields?.coverLetterId,
          additionalInfo: customFields?.additionalFields,
        });

        return {
          success: result.success,
          applicationId: result.applicationId,
          error: result.success ? undefined : result.message,
          metadata: { provider: 'INDEED' },
        };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Unknown error during Indeed submission',
          metadata: { provider: 'INDEED' },
        };
      }
    },
  },
  [JobProvider.GLASSDOOR]: {
    submitApplication: async () => {
      throw new Error(
        'Glassdoor automated submission not supported - apply manually',
      );
    },
  },
  [JobProvider.ZIPRECRUITER]: {
    submitApplication: async () => {
      throw new Error(
        'ZipRecruiter automated submission not supported - apply manually',
      );
    },
  },
  [JobProvider.ANGELLIST]: {
    submitApplication: async () => {
      throw new Error(
        'AngelList automated submission not supported - apply manually',
      );
    },
  },
  [JobProvider.WELLFOUND]: {
    submitApplication: async () => {
      throw new Error(
        'Wellfound automated submission not supported - apply manually',
      );
    },
  },
  [JobProvider.MONSTER]: {
    submitApplication: async () => {
      throw new Error('Monster submission not yet implemented');
    },
  },
  [JobProvider.DICE]: {
    submitApplication: async () => {
      throw new Error('Dice submission not yet implemented');
    },
  },
  [JobProvider.FLEXJOBS]: {
    submitApplication: async () => {
      throw new Error('FlexJobs submission not yet implemented');
    },
  },
  [JobProvider.REMOTE_OK]: {
    submitApplication: async () => {
      throw new Error('Remote.co submission not yet implemented');
    },
  },
  [JobProvider.WE_WORK_REMOTELY]: {
    submitApplication: async () => {
      throw new Error('We Work Remotely submission not yet implemented');
    },
  },
  [JobProvider.COMPANY_DIRECT]: companyDirectService,
  [JobProvider.CAREER_BUILDER]: {
    submitApplication: async () => {
      throw new Error('CareerBuilder submission not yet implemented');
    },
  },
  [JobProvider.OTHER]: {
    submitApplication: async () => {
      throw new Error(
        'This job board is not supported for automated submissions',
      );
    },
  },
};

export async function getSubmissionProvider(
  jobProvider: JobProvider,
): Promise<SubmissionProvider> {
  const provider = providers[jobProvider];
  if (!provider) {
    throw new Error(
      `No submission provider available for job provider: ${jobProvider}`,
    );
  }
  return provider;
}

export async function submitToJobBoard(
  jobProvider: JobProvider,
  params: SubmissionParams,
): Promise<SubmissionResult> {
  const provider = await getSubmissionProvider(jobProvider);
  return provider.submitApplication(params);
}
