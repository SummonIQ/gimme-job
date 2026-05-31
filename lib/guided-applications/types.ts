import {
  FieldSuggestionStatus,
  GuidedApplicationStatus,
  JobProvider,
} from '@/generated/prisma/browser';

export interface DetectedFormField {
  name: string;
  label: string;
  type:
    | 'text'
    | 'email'
    | 'tel'
    | 'url'
    | 'textarea'
    | 'select'
    | 'checkbox'
    | 'radio'
    | 'file'
    | 'date'
    | 'number'
    | 'hidden';
  selector: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  currentValue?: string;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
  };
  category:
    | 'personal'
    | 'contact'
    | 'work'
    | 'education'
    | 'documents'
    | 'preferences'
    | 'custom';
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface FormAnalysisResult {
  success: boolean;
  url: string;
  pageTitle: string;
  company?: string;
  jobTitle?: string;
  jobProvider?: JobProvider;
  isMultiStep: boolean;
  currentStep: number;
  totalSteps?: number;
  fields: DetectedFormField[];
  screenshotUrl?: string;
  hasFileUpload: boolean;
  hasResumeField: boolean;
  hasCoverLetterField: boolean;
  submitButtonSelector?: string;
  nextButtonSelector?: string;
  formSelector?: string;
  error?: string;
}

export interface FieldSuggestion {
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  fieldSelector: string;
  currentValue?: string;
  suggestedValue: string;
  suggestedSource:
    | 'profile'
    | 'resume'
    | 'linkedin'
    | 'ai'
    | 'previous_application';
  confidence: number;
  aiReasoning?: string;
  isRequired: boolean;
  category: string;
}

export interface UserDataForSuggestions {
  profile: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    streetAddress?: string;
    linkedinUrl?: string;
    githubUrl?: string;
    websiteUrl?: string;
  };
  resume: {
    summary?: string;
    skills?: string[];
    workExperience?: Array<{
      company: string;
      title: string;
      startDate?: string;
      endDate?: string;
      description?: string;
    }>;
    education?: Array<{
      institution: string;
      degree: string;
      field?: string;
      startYear?: number;
      endYear?: number;
    }>;
  };
  linkedin?: {
    headline?: string;
    currentCompany?: string;
    currentTitle?: string;
    connections?: number;
  };
  preferences?: {
    workAuthorization?: boolean;
    requiresSponsorship?: boolean;
    willingToRelocate?: boolean;
    preferredSalary?: string;
    experienceYears?: number;
  };
}

export interface GuidedApplicationSession {
  id: string;
  userId: string;
  applicationUrl: string;
  company?: string;
  jobTitle?: string;
  jobProvider?: JobProvider;
  status: GuidedApplicationStatus;
  currentStep: number;
  totalSteps?: number;
  progress: number;
  fields: FieldSuggestion[];
  lastScreenshotUrl?: string;
  resumeId?: string;
  coverLetterId?: string;
  jobLeadId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StartGuidedApplicationInput {
  applicationUrl: string;
  jobLeadId?: string;
  resumeId?: string;
  coverLetterId?: string;
}

export interface UpdateFieldSuggestionInput {
  suggestionId: string;
  status: FieldSuggestionStatus;
  userValue?: string;
}

export interface GuidedApplicationProgress {
  applicationId: string;
  status: GuidedApplicationStatus;
  currentStep: number;
  totalSteps?: number;
  progress: number;
  desktopQueueItemId?: string;
  jobLeadId?: string;
  screenshotUrl?: string;
  fields: Array<{
    id: string;
    fieldName: string;
    fieldLabel?: string;
    status: FieldSuggestionStatus;
    suggestedValue?: string;
    userValue?: string;
    isRequired: boolean;
  }>;
  message?: string;
  error?: string;
}

export interface SubmitGuidedApplicationResult {
  success: boolean;
  applicationId: string;
  submissionId?: string;
  confirmationCode?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface EnqueueDesktopSubmitRequestResult {
  success: boolean;
  applicationId: string;
  queueItemId?: string;
  error?: string;
}
