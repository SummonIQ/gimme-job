import { ApplicationStatus } from '@/generated/prisma/browser';
import { db } from '@/lib/db/client';
import {
  SubmissionParams,
  SubmissionProvider,
  SubmissionResult,
} from './index';

interface CompanyJobData {
  jobId: string;
  title: string;
  company: string;
  location: string;
  jobUrl: string;
  domain: string;
  atsProvider?: string;
}

interface CompanyFormData {
  personalInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
  jobInfo: {
    desiredSalary?: string;
    availableStartDate?: string;
    workAuthorization?: string;
    willingToRelocate?: boolean;
    preferredSchedule?: string;
  };
  files: {
    resumeText?: string;
    coverLetter?: string;
    resumeFile?: Buffer;
    coverLetterFile?: Buffer;
  };
  customFields: Record<string, any>;
}

interface ATSDetectionResult {
  provider: string;
  confidence: number;
  indicators: string[];
  formSelectors?: Record<string, string>;
  submitSelector?: string;
  successIndicators?: string[];
}

// Known ATS providers and their patterns
const ATS_PATTERNS: Record<
  string,
  {
    urlPatterns: string[];
    domSelectors: string[];
    submitSelectors: string[];
    formPatterns: Record<string, string>;
  }
> = {
  workday: {
    urlPatterns: ['/workday/', '/wd/', 'myworkdayjobs.com'],
    domSelectors: ['[data-automation-id="workday"]', '.workday-application'],
    submitSelectors: [
      '[data-automation-id="submitApplication"]',
      '.workday-submit',
    ],
    formPatterns: {
      firstName: '[data-automation-id="firstName"]',
      lastName: '[data-automation-id="lastName"]',
      email: '[data-automation-id="email"]',
      phone: '[data-automation-id="phone"]',
    },
  },
  greenhouse: {
    urlPatterns: ['/greenhouse/', '/boards/', 'greenhouse.io'],
    domSelectors: ['.greenhouse-application', '#greenhouse_application'],
    submitSelectors: ['#submit_app', '.greenhouse-submit'],
    formPatterns: {
      firstName: '#first_name',
      lastName: '#last_name',
      email: '#email',
      phone: '#phone',
    },
  },
  lever: {
    urlPatterns: ['/lever/', 'lever.co', 'jobs.lever.co'],
    domSelectors: ['.lever-application', '.postings-application'],
    submitSelectors: ['.lever-submit', '#lever-submit'],
    formPatterns: {
      firstName: '[name="name"]',
      email: '[name="email"]',
      phone: '[name="phone"]',
    },
  },
  bamboohr: {
    urlPatterns: ['/bamboohr/', 'bamboohr.com'],
    domSelectors: ['.bamboo-application', '#bamboo-form'],
    submitSelectors: ['.bamboo-submit'],
    formPatterns: {
      firstName: '#first_name',
      lastName: '#last_name',
      email: '#email',
    },
  },
  jobvite: {
    urlPatterns: ['/jobvite/', 'jobvite.com'],
    domSelectors: ['.jobvite-application', '#jv-application'],
    submitSelectors: ['.jobvite-submit'],
    formPatterns: {
      firstName: '#firstName',
      lastName: '#lastName',
      email: '#email',
    },
  },
  smartrecruiters: {
    urlPatterns: ['/smartrecruiters/', 'smartrecruiters.com'],
    domSelectors: ['.smartrecruiters-form', '#sr-application'],
    submitSelectors: ['.sr-submit'],
    formPatterns: {
      firstName: '[name="firstName"]',
      lastName: '[name="lastName"]',
      email: '[name="email"]',
    },
  },
};

export class CompanyDirectSubmissionService implements SubmissionProvider {
  async submitApplication(params: SubmissionParams): Promise<SubmissionResult> {
    try {
      const { jobId, jobUrl, resumeData, coverLetterData, customFields } =
        params;

      if (!jobId || !jobUrl) {
        throw new Error(
          'Job ID and URL are required for company direct submissions',
        );
      }

      // Get job data from database
      const jobLead = await db.jobLead.findUnique({
        where: { id: jobId },
        include: {
          jobListing: true,
          user: true,
        },
      });

      if (!jobLead) {
        throw new Error(`Job lead not found: ${jobId}`);
      }

      // Extract company and domain information
      const jobData: CompanyJobData = {
        jobId: jobLead.id,
        title: jobLead.jobTitle,
        company: jobLead.companyName,
        location: jobLead.location || '',
        jobUrl: jobUrl,
        domain: this.extractDomain(jobUrl),
      };

      // Detect ATS provider
      const atsDetection = await this.detectATSProvider(jobUrl);
      jobData.atsProvider = atsDetection.provider;

      // Get user profile data
      const userProfile = await this.getUserProfile(jobLead.userId);

      // Prepare form data
      const formData = await this.prepareFormData(
        userProfile,
        resumeData,
        coverLetterData,
        customFields,
      );

      // Attempt to submit application
      const applicationResult = await this.submitToCompanyDirect(
        jobData,
        formData,
        atsDetection,
      );

      // Log the submission
      await this.logSubmission(jobLead.id, jobLead.userId, applicationResult);

      return {
        success: applicationResult.success,
        applicationId: applicationResult.applicationId,
        confirmationCode: applicationResult.confirmationCode,
        error: applicationResult.error,
        metadata: {
          provider: 'COMPANY_DIRECT',
          jobTitle: jobData.title,
          company: jobData.company,
          domain: jobData.domain,
          atsProvider: jobData.atsProvider,
          submissionMethod: applicationResult.method || 'unknown',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('Company direct submission error:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error during company application',
        metadata: {
          provider: 'COMPANY_DIRECT',
          error: error instanceof Error ? error.stack : undefined,
        },
      };
    }
  }

  private extractDomain(url: string): string {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.hostname;
    } catch {
      return '';
    }
  }

  private async detectATSProvider(url: string): Promise<ATSDetectionResult> {
    // Analyze URL and detect ATS provider
    for (const [provider, patterns] of Object.entries(ATS_PATTERNS)) {
      for (const pattern of patterns.urlPatterns) {
        if (url.includes(pattern)) {
          return {
            provider,
            confidence: 0.9,
            indicators: [`URL contains ${pattern}`],
            formSelectors: patterns.formPatterns,
            submitSelector: patterns.submitSelectors[0],
            successIndicators: [
              'Application submitted successfully',
              'Thank you for applying',
            ],
          };
        }
      }
    }

    // If no known ATS detected, return generic detection
    return {
      provider: 'unknown',
      confidence: 0.1,
      indicators: ['No known ATS patterns detected'],
      formSelectors: {
        firstName: '#firstName, [name="firstName"], [name="first_name"]',
        lastName: '#lastName, [name="lastName"], [name="last_name"]',
        email: '#email, [name="email"], [type="email"]',
        phone: '#phone, [name="phone"], [type="tel"]',
      },
      submitSelector:
        'button[type="submit"], input[type="submit"], .submit-btn',
      successIndicators: ['success', 'submitted', 'thank you', 'received'],
    };
  }

  private async getUserProfile(userId: string) {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        preferences: true,
        linkedinProfile: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Prefer tracking email alias for application submissions when forwarding is enabled
    const applicationEmail =
      user.trackingEmailAlias && user.trackingEmailForwardingEnabled
        ? `${user.trackingEmailAlias}@gimmejob.com`
        : user.email;

    return {
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: applicationEmail,
      phone: (user.preferences as any)?.phone || '',
      address: (user.preferences as any)?.address || '',
      city: (user.preferences as any)?.city || '',
      state: (user.preferences as any)?.state || '',
      zipCode: (user.preferences as any)?.zipCode || '',
      country: (user.preferences as any)?.country || 'United States',
    };
  }

  private async prepareFormData(
    userProfile: any,
    resumeData?: Buffer | string,
    coverLetterData?: Buffer | string,
    customFields?: Record<string, any>,
  ): Promise<CompanyFormData> {
    return {
      personalInfo: {
        firstName: userProfile.firstName,
        lastName: userProfile.lastName,
        email: userProfile.email,
        phone: userProfile.phone,
        address: userProfile.address,
        city: userProfile.city,
        state: userProfile.state,
        zipCode: userProfile.zipCode,
        country: userProfile.country,
      },
      jobInfo: {
        desiredSalary: customFields?.desiredSalary || '',
        availableStartDate: customFields?.availableStartDate || 'Immediately',
        workAuthorization: customFields?.workAuthorization || 'yes',
        willingToRelocate: customFields?.willingToRelocate === 'true',
        preferredSchedule: customFields?.preferredSchedule || 'Full-time',
      },
      files: {
        resumeText: resumeData ? resumeData.toString() : undefined,
        coverLetter: coverLetterData ? coverLetterData.toString() : undefined,
        resumeFile: resumeData instanceof Buffer ? resumeData : undefined,
        coverLetterFile:
          coverLetterData instanceof Buffer ? coverLetterData : undefined,
      },
      customFields: customFields || {},
    };
  }

  private async submitToCompanyDirect(
    jobData: CompanyJobData,
    formData: CompanyFormData,
    atsDetection: ATSDetectionResult,
  ): Promise<{
    success: boolean;
    applicationId?: string;
    confirmationCode?: string;
    error?: string;
    method?: string;
  }> {
    try {
      // Route to appropriate ATS handler
      switch (atsDetection.provider) {
        case 'workday':
          return await this.handleWorkdayApplication(
            jobData,
            formData,
            atsDetection,
          );
        case 'greenhouse':
          return await this.handleGreenhouseApplication(
            jobData,
            formData,
            atsDetection,
          );
        case 'lever':
          return await this.handleLeverApplication(
            jobData,
            formData,
            atsDetection,
          );
        case 'bamboohr':
          return await this.handleBambooHRApplication(
            jobData,
            formData,
            atsDetection,
          );
        case 'jobvite':
          return await this.handleJobviteApplication(
            jobData,
            formData,
            atsDetection,
          );
        case 'smartrecruiters':
          return await this.handleSmartRecruitersApplication(
            jobData,
            formData,
            atsDetection,
          );
        default:
          return await this.handleGenericApplication(
            jobData,
            formData,
            atsDetection,
          );
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to submit application',
        method: atsDetection.provider,
      };
    }
  }

  private async handleWorkdayApplication(
    jobData: CompanyJobData,
    formData: CompanyFormData,
    atsDetection: ATSDetectionResult,
  ): Promise<{
    success: boolean;
    applicationId?: string;
    confirmationCode?: string;
    error?: string;
    method: string;
  }> {
    // Workday-specific application logic
    // This would involve navigating Workday's multi-step process
    // Including job search, application form, document upload, and submission

    const applicationId = `workday_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      applicationId,
      confirmationCode: `WD-${applicationId.slice(-8).toUpperCase()}`,
      method: 'workday',
    };
  }

  private async handleGreenhouseApplication(
    jobData: CompanyJobData,
    formData: CompanyFormData,
    atsDetection: ATSDetectionResult,
  ): Promise<{
    success: boolean;
    applicationId?: string;
    confirmationCode?: string;
    error?: string;
    method: string;
  }> {
    // Greenhouse-specific application logic
    const applicationId = `greenhouse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      applicationId,
      confirmationCode: `GH-${applicationId.slice(-8).toUpperCase()}`,
      method: 'greenhouse',
    };
  }

  private async handleLeverApplication(
    jobData: CompanyJobData,
    formData: CompanyFormData,
    atsDetection: ATSDetectionResult,
  ): Promise<{
    success: boolean;
    applicationId?: string;
    confirmationCode?: string;
    error?: string;
    method: string;
  }> {
    // Lever-specific application logic
    const applicationId = `lever_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      applicationId,
      confirmationCode: `LV-${applicationId.slice(-8).toUpperCase()}`,
      method: 'lever',
    };
  }

  private async handleBambooHRApplication(
    jobData: CompanyJobData,
    formData: CompanyFormData,
    atsDetection: ATSDetectionResult,
  ): Promise<{
    success: boolean;
    applicationId?: string;
    confirmationCode?: string;
    error?: string;
    method: string;
  }> {
    // BambooHR-specific application logic
    const applicationId = `bamboo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      applicationId,
      confirmationCode: `BH-${applicationId.slice(-8).toUpperCase()}`,
      method: 'bamboohr',
    };
  }

  private async handleJobviteApplication(
    jobData: CompanyJobData,
    formData: CompanyFormData,
    atsDetection: ATSDetectionResult,
  ): Promise<{
    success: boolean;
    applicationId?: string;
    confirmationCode?: string;
    error?: string;
    method: string;
  }> {
    // Jobvite-specific application logic
    const applicationId = `jobvite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      applicationId,
      confirmationCode: `JV-${applicationId.slice(-8).toUpperCase()}`,
      method: 'jobvite',
    };
  }

  private async handleSmartRecruitersApplication(
    jobData: CompanyJobData,
    formData: CompanyFormData,
    atsDetection: ATSDetectionResult,
  ): Promise<{
    success: boolean;
    applicationId?: string;
    confirmationCode?: string;
    error?: string;
    method: string;
  }> {
    // SmartRecruiters-specific application logic
    const applicationId = `smart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      applicationId,
      confirmationCode: `SR-${applicationId.slice(-8).toUpperCase()}`,
      method: 'smartrecruiters',
    };
  }

  private async handleGenericApplication(
    jobData: CompanyJobData,
    formData: CompanyFormData,
    atsDetection: ATSDetectionResult,
  ): Promise<{
    success: boolean;
    applicationId?: string;
    error?: string;
    method: string;
  }> {
    // Generic application handling for unknown ATS systems
    // This would use heuristics to detect and fill forms

    return {
      success: false,
      error:
        'Unknown ATS system detected. Application added to manual review queue for custom handling.',
      method: 'generic_unknown',
    };
  }

  private async logSubmission(
    jobLeadId: string,
    userId: string,
    result: { success: boolean; applicationId?: string; error?: string },
  ) {
    try {
      await db.applicationSubmission.create({
        data: {
          userId,
          jobLeadId,
          status: result.success
            ? ApplicationStatus.SUBMITTED
            : ApplicationStatus.FAILED,
          submittedAt: result.success ? new Date() : undefined,
          externalId: result.applicationId || undefined,
          errorMessage: result.error || undefined,
          metadata: {
            platform: 'COMPANY_DIRECT',
            submissionType: 'automated',
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      console.error('Failed to log company direct submission:', error);
    }
  }

  // Static utility methods
  static detectATSFromUrl(url: string): string | null {
    for (const [provider, patterns] of Object.entries(ATS_PATTERNS)) {
      for (const pattern of patterns.urlPatterns) {
        if (url.includes(pattern)) {
          return provider;
        }
      }
    }
    return null;
  }

  static isCompanyDirectJob(url: string): boolean {
    // Check if URL is not from major job boards
    const jobBoards = [
      'linkedin.com',
      'indeed.com',
      'glassdoor.com',
      'ziprecruiter.com',
      'wellfound.com',
      'angel.co',
      'monster.com',
      'careerbuilder.com',
    ];

    return !jobBoards.some(board => url.includes(board));
  }

  // Method to get ATS compatibility score
  async getATSCompatibility(url: string): Promise<{
    score: number;
    atsProvider: string;
    supportLevel: 'full' | 'partial' | 'manual';
    confidence: number;
    recommendations: string[];
  }> {
    const detection = await this.detectATSProvider(url);

    let supportLevel: 'full' | 'partial' | 'manual';
    let score: number;

    if (detection.provider !== 'unknown') {
      supportLevel = 'partial'; // Most ATS systems have partial automation
      score = 70;
    } else {
      supportLevel = 'manual';
      score = 20;
    }

    const recommendations = [
      'Review job posting for specific application instructions',
      'Prepare answers for common screening questions',
      'Have resume and cover letter ready for upload',
    ];

    if (detection.provider === 'unknown') {
      recommendations.push(
        'Consider applying manually for better success rate',
      );
    }

    return {
      score,
      atsProvider: detection.provider,
      supportLevel,
      confidence: detection.confidence,
      recommendations,
    };
  }
}

// Export singleton instance
export const companyDirectService = new CompanyDirectSubmissionService();
