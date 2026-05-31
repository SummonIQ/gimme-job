export interface VisionFieldDetection {
  selector: string;
  label: string;
  fieldDisplayName: string;
  fieldType: 'text' | 'email' | 'tel' | 'select' | 'textarea' | 'radio' | 'checkbox' | 'file' | 'button' | 'other';
  suggestedAction: 'fill' | 'click' | 'select' | 'upload' | 'skip';
  suggestedValue: string;
  confidence: number;
  reason: string;
  isEmpty: boolean;
  isRequired: boolean;
  constraints?: {
    maxLength?: number;
    minLength?: number;
    pattern?: string;
    inputMode?: string;
    numbersOnly?: boolean;
    autoFormats?: boolean;
    formatDescription?: string;
    allowedValues?: string[];
  };
}

export interface VisionStepAnalysis {
  pageType: 'application_form' | 'expired' | 'job_listing' | 'login' | 'confirmation' | 'error' | 'other';
  currentStep: number;
  estimatedTotalSteps: number;
  fields: VisionFieldDetection[];
  nextAction: {
    selector: string;
    action: string;
    reason: string;
  } | null;
  isComplete: boolean;
  observations: string[];
}

export interface TrainingStepLog {
  stepIndex: number;
  timestamp: string;
  url: string;
  pageType: string;
  fieldsDetected: number;
  actionsPerformed: Array<{
    selector: string;
    action: string;
    actionType: string;
    label: string;
    value: string;
    success: boolean;
    confidence: number;
    /**
     * Whether the expected post-condition was observed (e.g. URL changed
     * after a navigation click). Distinct from `success` — you can click
     * successfully without anything happening.
     */
    postConditionMet?: boolean;
  }>;
  observationsRecorded: number;
  screenshotBase64?: string; // Thumbnail for review, omitted in large lists
  error?: string;
}

export interface TrainingSessionConfig {
  captureScreenshots: boolean;
  disableJavascript?: boolean;
  dryRun: boolean; // If true, don't actually fill fields — just observe
  hostname: string;
  maxSteps: number;
  maxDurationMin?: number; // Max session duration in minutes (default: 5)
  mobileViewport?: boolean;
  sessionId: string;
  targetUrl: string;
  userId: string;
}
