import { JobProvider } from '@/generated/prisma/browser';

export interface FieldDefinition {
  id: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'url' | 'textarea' | 'select' | 'checkbox' | 'file' | 'date';
  required: boolean;
  placeholder?: string;
  options?: string[];
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    format?: 'email' | 'phone' | 'url' | 'date';
  };
  helpText?: string;
  category: 'personal' | 'contact' | 'work' | 'preferences' | 'documents' | 'custom';
}

export interface PlatformFieldMapping {
  platform: JobProvider;
  fields: FieldDefinition[];
  requiredFields: string[];
  conditionalFields?: Record<string, { condition: string; fields: string[] }>;
  customValidation?: (data: Record<string, any>) => { valid: boolean; errors: string[] };
}

// Universal fields that apply to most platforms
const UNIVERSAL_FIELDS: FieldDefinition[] = [
  {
    id: 'firstName',
    label: 'First Name',
    type: 'text',
    required: true,
    category: 'personal',
    validation: { minLength: 2, maxLength: 50 },
  },
  {
    id: 'lastName',
    label: 'Last Name',
    type: 'text',
    required: true,
    category: 'personal',
    validation: { minLength: 2, maxLength: 50 },
  },
  {
    id: 'email',
    label: 'Email Address',
    type: 'email',
    required: true,
    category: 'contact',
    validation: { format: 'email' },
  },
  {
    id: 'phone',
    label: 'Phone Number',
    type: 'tel',
    required: false,
    category: 'contact',
    validation: { format: 'phone' },
    placeholder: '(555) 123-4567',
  },
  {
    id: 'resume',
    label: 'Resume',
    type: 'file',
    required: false,
    category: 'documents',
    helpText: 'Upload your resume (PDF, DOC, DOCX)',
  },
  {
    id: 'coverLetter',
    label: 'Cover Letter',
    type: 'textarea',
    required: false,
    category: 'documents',
    validation: { maxLength: 2000 },
    placeholder: 'Write a compelling cover letter...',
  },
];

// Platform-specific field mappings
export const PLATFORM_FIELD_MAPPINGS: Record<JobProvider, PlatformFieldMapping> = {
  [JobProvider.LINKEDIN]: {
    platform: JobProvider.LINKEDIN,
    fields: [
      ...UNIVERSAL_FIELDS,
      {
        id: 'linkedinProfile',
        label: 'LinkedIn Profile URL',
        type: 'url',
        required: false,
        category: 'contact',
        validation: { pattern: 'linkedin\\.com' },
        placeholder: 'https://linkedin.com/in/yourprofile',
      },
      {
        id: 'currentTitle',
        label: 'Current Job Title',
        type: 'text',
        required: false,
        category: 'work',
        placeholder: 'Software Engineer',
      },
      {
        id: 'currentCompany',
        label: 'Current Company',
        type: 'text',
        required: false,
        category: 'work',
        placeholder: 'Tech Corp',
      },
    ],
    requiredFields: ['firstName', 'lastName', 'email'],
  },

  [JobProvider.INDEED]: {
    platform: JobProvider.INDEED,
    fields: [
      ...UNIVERSAL_FIELDS,
      {
        id: 'address',
        label: 'Address',
        type: 'text',
        required: false,
        category: 'contact',
        placeholder: '123 Main St',
      },
      {
        id: 'city',
        label: 'City',
        type: 'text',
        required: false,
        category: 'contact',
        placeholder: 'San Francisco',
      },
      {
        id: 'state',
        label: 'State',
        type: 'text',
        required: false,
        category: 'contact',
        placeholder: 'CA',
      },
      {
        id: 'zipCode',
        label: 'ZIP Code',
        type: 'text',
        required: false,
        category: 'contact',
        placeholder: '94105',
        validation: { pattern: '^\\d{5}(-\\d{4})?$' },
      },
      {
        id: 'desiredSalary',
        label: 'Desired Salary',
        type: 'text',
        required: false,
        category: 'preferences',
        placeholder: '$80,000',
      },
    ],
    requiredFields: ['firstName', 'lastName', 'email'],
  },

  [JobProvider.GLASSDOOR]: {
    platform: JobProvider.GLASSDOOR,
    fields: [
      ...UNIVERSAL_FIELDS,
      {
        id: 'workAuthorization',
        label: 'Work Authorization',
        type: 'select',
        required: false,
        category: 'work',
        options: [
          'Authorized to work in the US',
          'Require sponsorship for work visa',
          'Student visa (F-1, J-1)',
          'Other',
        ],
      },
      {
        id: 'willingToRelocate',
        label: 'Willing to Relocate',
        type: 'checkbox',
        required: false,
        category: 'preferences',
      },
      {
        id: 'experienceYears',
        label: 'Years of Experience',
        type: 'select',
        required: false,
        category: 'work',
        options: ['0-1', '2-4', '5-7', '8-10', '10+'],
      },
      {
        id: 'expectedSalary',
        label: 'Expected Salary Range',
        type: 'text',
        required: false,
        category: 'preferences',
        placeholder: '$70,000 - $90,000',
      },
    ],
    requiredFields: ['firstName', 'lastName', 'email'],
  },

  [JobProvider.ZIPRECRUITER]: {
    platform: JobProvider.ZIPRECRUITER,
    fields: [
      ...UNIVERSAL_FIELDS.map(field => 
        field.id === 'phone' ? { ...field, required: true } : field
      ),
      {
        id: 'address',
        label: 'Full Address',
        type: 'text',
        required: true,
        category: 'contact',
        placeholder: '123 Main St, City, State, ZIP',
        helpText: 'ZipRecruiter requires complete address for job matching',
      },
      {
        id: 'commute',
        label: 'Maximum Commute Distance',
        type: 'select',
        required: false,
        category: 'preferences',
        options: ['5 miles', '10 miles', '25 miles', '50 miles', '100+ miles'],
      },
      {
        id: 'availableStartDate',
        label: 'Available Start Date',
        type: 'date',
        required: false,
        category: 'preferences',
      },
      {
        id: 'jobType',
        label: 'Job Type Preference',
        type: 'select',
        required: false,
        category: 'preferences',
        options: ['Full-time', 'Part-time', 'Contract', 'Temporary', 'Internship'],
      },
    ],
    requiredFields: ['firstName', 'lastName', 'email', 'phone', 'address'],
  },

  [JobProvider.ANGELLIST]: {
    platform: JobProvider.ANGELLIST,
    fields: [
      ...UNIVERSAL_FIELDS,
      {
        id: 'portfolioUrl',
        label: 'Portfolio Website',
        type: 'url',
        required: false,
        category: 'contact',
        placeholder: 'https://yourportfolio.com',
        helpText: 'Showcase your work to startup employers',
      },
      {
        id: 'githubUrl',
        label: 'GitHub Profile',
        type: 'url',
        required: false,
        category: 'contact',
        validation: { pattern: 'github\\.com' },
        placeholder: 'https://github.com/yourusername',
      },
      {
        id: 'linkedinUrl',
        label: 'LinkedIn Profile',
        type: 'url',
        required: false,
        category: 'contact',
        validation: { pattern: 'linkedin\\.com' },
        placeholder: 'https://linkedin.com/in/yourprofile',
      },
      {
        id: 'equityInterest',
        label: 'Interested in Equity Compensation',
        type: 'checkbox',
        required: false,
        category: 'preferences',
        helpText: 'Many startups offer equity as part of compensation',
      },
      {
        id: 'remoteWork',
        label: 'Open to Remote Work',
        type: 'checkbox',
        required: false,
        category: 'preferences',
      },
      {
        id: 'startupExperience',
        label: 'Startup Experience',
        type: 'textarea',
        required: false,
        category: 'work',
        placeholder: 'Describe your experience working at startups or founding companies...',
        validation: { maxLength: 500 },
      },
      {
        id: 'motivationLetter',
        label: 'Why are you interested in this role?',
        type: 'textarea',
        required: false,
        category: 'custom',
        placeholder: 'Explain your motivation and how you can contribute to the company...',
        validation: { maxLength: 1000 },
      },
    ],
    requiredFields: ['firstName', 'lastName', 'email'],
    conditionalFields: {
      technical: {
        condition: 'jobTitle contains "engineer" or "developer"',
        fields: ['githubUrl'],
      },
    },
  },

  [JobProvider.WELLFOUND]: {
    platform: JobProvider.WELLFOUND,
    fields: [
      ...UNIVERSAL_FIELDS,
      {
        id: 'portfolioUrl',
        label: 'Portfolio Website',
        type: 'url',
        required: false,
        category: 'contact',
        placeholder: 'https://yourportfolio.com',
      },
      {
        id: 'githubUrl',
        label: 'GitHub Profile',
        type: 'url',
        required: false,
        category: 'contact',
        validation: { pattern: 'github\\.com' },
        placeholder: 'https://github.com/yourusername',
      },
      {
        id: 'equityRange',
        label: 'Desired Equity Range',
        type: 'select',
        required: false,
        category: 'preferences',
        options: ['0.01-0.1%', '0.1-0.5%', '0.5-1%', '1-2%', '2%+', 'Not important'],
      },
      {
        id: 'salaryRange',
        label: 'Desired Salary Range',
        type: 'select',
        required: false,
        category: 'preferences',
        options: ['$50k-70k', '$70k-90k', '$90k-120k', '$120k-150k', '$150k+'],
      },
      {
        id: 'companyStage',
        label: 'Preferred Company Stage',
        type: 'select',
        required: false,
        category: 'preferences',
        options: ['Pre-seed', 'Seed', 'Series A', 'Series B+', 'No preference'],
      },
    ],
    requiredFields: ['firstName', 'lastName', 'email'],
  },

  [JobProvider.COMPANY_DIRECT]: {
    platform: JobProvider.COMPANY_DIRECT,
    fields: [
      ...UNIVERSAL_FIELDS,
      {
        id: 'address',
        label: 'Address',
        type: 'text',
        required: false,
        category: 'contact',
        placeholder: '123 Main St',
      },
      {
        id: 'city',
        label: 'City',
        type: 'text',
        required: false,
        category: 'contact',
        placeholder: 'San Francisco',
      },
      {
        id: 'state',
        label: 'State/Province',
        type: 'text',
        required: false,
        category: 'contact',
        placeholder: 'California',
      },
      {
        id: 'country',
        label: 'Country',
        type: 'text',
        required: false,
        category: 'contact',
        placeholder: 'United States',
      },
      {
        id: 'workAuthorization',
        label: 'Work Authorization Status',
        type: 'select',
        required: false,
        category: 'work',
        options: [
          'Authorized to work',
          'Require sponsorship',
          'Student visa',
          'Other',
        ],
      },
      {
        id: 'availableStartDate',
        label: 'Available Start Date',
        type: 'date',
        required: false,
        category: 'preferences',
      },
      {
        id: 'willingToRelocate',
        label: 'Willing to Relocate',
        type: 'checkbox',
        required: false,
        category: 'preferences',
      },
      {
        id: 'customQuestions',
        label: 'Additional Information',
        type: 'textarea',
        required: false,
        category: 'custom',
        placeholder: 'Any additional information for your application...',
        validation: { maxLength: 1000 },
      },
    ],
    requiredFields: ['firstName', 'lastName', 'email'],
    customValidation: (data) => {
      const errors: string[] = [];
      
      // ATS-specific validation rules can be added here
      if (data.atsProvider === 'workday') {
        if (!data.phone) {
          errors.push('Phone number is required for Workday applications');
        }
      }
      
      return { valid: errors.length === 0, errors };
    },
  },

  // Default mappings for platforms not yet implemented
  [JobProvider.GOOGLE]: {
    platform: JobProvider.GOOGLE,
    fields: UNIVERSAL_FIELDS,
    requiredFields: ['firstName', 'lastName', 'email'],
  },
  [JobProvider.MONSTER]: {
    platform: JobProvider.MONSTER,
    fields: UNIVERSAL_FIELDS,
    requiredFields: ['firstName', 'lastName', 'email'],
  },
  [JobProvider.DICE]: {
    platform: JobProvider.DICE,
    fields: UNIVERSAL_FIELDS,
    requiredFields: ['firstName', 'lastName', 'email'],
  },
  [JobProvider.CAREER_BUILDER]: {
    platform: JobProvider.CAREER_BUILDER,
    fields: UNIVERSAL_FIELDS,
    requiredFields: ['firstName', 'lastName', 'email'],
  },
  [JobProvider.FLEXJOBS]: {
    platform: JobProvider.FLEXJOBS,
    fields: UNIVERSAL_FIELDS,
    requiredFields: ['firstName', 'lastName', 'email'],
  },
  [JobProvider.REMOTE_OK]: {
    platform: JobProvider.REMOTE_OK,
    fields: UNIVERSAL_FIELDS,
    requiredFields: ['firstName', 'lastName', 'email'],
  },
  [JobProvider.WE_WORK_REMOTELY]: {
    platform: JobProvider.WE_WORK_REMOTELY,
    fields: UNIVERSAL_FIELDS,
    requiredFields: ['firstName', 'lastName', 'email'],
  },
  [JobProvider.OTHER]: {
    platform: JobProvider.OTHER,
    fields: UNIVERSAL_FIELDS,
    requiredFields: ['firstName', 'lastName', 'email'],
  },
};

export class FieldMappingService {
  /**
   * Get field mapping for a specific platform
   */
  static getFieldMapping(platform: JobProvider): PlatformFieldMapping {
    return PLATFORM_FIELD_MAPPINGS[platform] || PLATFORM_FIELD_MAPPINGS[JobProvider.OTHER];
  }

  /**
   * Get all fields for a platform
   */
  static getFields(platform: JobProvider): FieldDefinition[] {
    return this.getFieldMapping(platform).fields;
  }

  /**
   * Get required fields for a platform
   */
  static getRequiredFields(platform: JobProvider): string[] {
    return this.getFieldMapping(platform).requiredFields;
  }

  /**
   * Validate form data against platform requirements
   */
  static validateFormData(
    platform: JobProvider,
    data: Record<string, any>
  ): { valid: boolean; errors: string[]; warnings: string[] } {
    const mapping = this.getFieldMapping(platform);
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    for (const fieldId of mapping.requiredFields) {
      if (!data[fieldId] || (typeof data[fieldId] === 'string' && data[fieldId].trim() === '')) {
        const field = mapping.fields.find(f => f.id === fieldId);
        errors.push(`${field?.label || fieldId} is required`);
      }
    }

    // Validate individual fields
    for (const field of mapping.fields) {
      const value = data[field.id];
      if (value) {
        const fieldErrors = this.validateField(field, value);
        errors.push(...fieldErrors);
      }
    }

    // Run custom validation if available
    if (mapping.customValidation) {
      const customResult = mapping.customValidation(data);
      if (!customResult.valid) {
        errors.push(...customResult.errors);
      }
    }

    // Check for recommended fields
    const recommendedFields = ['phone', 'resume'];
    for (const fieldId of recommendedFields) {
      if (!data[fieldId] && mapping.fields.find(f => f.id === fieldId && !f.required)) {
        const field = mapping.fields.find(f => f.id === fieldId);
        warnings.push(`${field?.label || fieldId} is recommended for better application success`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate a single field
   */
  private static validateField(field: FieldDefinition, value: any): string[] {
    const errors: string[] = [];

    if (!field.validation) return errors;

    const validation = field.validation;
    const stringValue = String(value).trim();

    // Length validation
    if (validation.minLength && stringValue.length < validation.minLength) {
      errors.push(`${field.label} must be at least ${validation.minLength} characters`);
    }
    if (validation.maxLength && stringValue.length > validation.maxLength) {
      errors.push(`${field.label} must be no more than ${validation.maxLength} characters`);
    }

    // Pattern validation
    if (validation.pattern && !new RegExp(validation.pattern).test(stringValue)) {
      errors.push(`${field.label} format is invalid`);
    }

    // Format validation
    if (validation.format) {
      switch (validation.format) {
        case 'email':
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(stringValue)) {
            errors.push(`${field.label} must be a valid email address`);
          }
          break;
        case 'phone':
          if (!/^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/.test(stringValue)) {
            errors.push(`${field.label} must be a valid phone number`);
          }
          break;
        case 'url':
          try {
            new URL(stringValue);
          } catch {
            errors.push(`${field.label} must be a valid URL`);
          }
          break;
        case 'date':
          if (isNaN(Date.parse(stringValue))) {
            errors.push(`${field.label} must be a valid date`);
          }
          break;
      }
    }

    return errors;
  }

  /**
   * Get field categories for UI organization
   */
  static getFieldsByCategory(platform: JobProvider): Record<string, FieldDefinition[]> {
    const fields = this.getFields(platform);
    const categories: Record<string, FieldDefinition[]> = {};

    for (const field of fields) {
      if (!categories[field.category]) {
        categories[field.category] = [];
      }
      categories[field.category].push(field);
    }

    return categories;
  }

  /**
   * Transform user data to platform-specific format
   */
  static transformUserData(
    platform: JobProvider,
    userData: Record<string, any>
  ): Record<string, any> {
    const mapping = this.getFieldMapping(platform);
    const transformedData: Record<string, any> = {};

    for (const field of mapping.fields) {
      if (userData[field.id] !== undefined) {
        transformedData[field.id] = userData[field.id];
      }
    }

    // Platform-specific transformations
    switch (platform) {
      case JobProvider.ZIPRECRUITER:
        // ZipRecruiter expects full address in single field
        if (userData.address && userData.city && userData.state && userData.zipCode) {
          transformedData.fullAddress = `${userData.address}, ${userData.city}, ${userData.state} ${userData.zipCode}`;
        }
        break;
      
      case JobProvider.ANGELLIST:
      case JobProvider.WELLFOUND:
        // Convert boolean equity interest to percentage range
        if (userData.equityInterest === true && !userData.equityRange) {
          transformedData.equityRange = '0.1-0.5%';
        }
        break;
    }

    return transformedData;
  }

  /**
   * Get field mapping differences between platforms
   */
  static compareFieldMappings(platform1: JobProvider, platform2: JobProvider): {
    commonFields: string[];
    platform1Only: string[];
    platform2Only: string[];
    differentRequirements: string[];
  } {
    const mapping1 = this.getFieldMapping(platform1);
    const mapping2 = this.getFieldMapping(platform2);
    
    const fields1 = new Set(mapping1.fields.map(f => f.id));
    const fields2 = new Set(mapping2.fields.map(f => f.id));
    const required1 = new Set(mapping1.requiredFields);
    const required2 = new Set(mapping2.requiredFields);

    const commonFields = [...fields1].filter(f => fields2.has(f));
    const platform1Only = [...fields1].filter(f => !fields2.has(f));
    const platform2Only = [...fields2].filter(f => !fields1.has(f));
    
    const differentRequirements = commonFields.filter(f => 
      required1.has(f) !== required2.has(f)
    );

    return {
      commonFields,
      platform1Only,
      platform2Only,
      differentRequirements,
    };
  }
}

// Export helper functions
export const {
  getFieldMapping,
  getFields,
  getRequiredFields,
  validateFormData,
  getFieldsByCategory,
  transformUserData,
  compareFieldMappings,
} = FieldMappingService;