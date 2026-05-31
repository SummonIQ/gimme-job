export interface RuntimeSessionListItem {
  artifactCount: number;
  company: string | null;
  completedAt: string | null;
  currentUrl: string | null;
  eventCount: number;
  hostname: string | null;
  id: string;
  jobTitle: string | null;
  lastScreenshotUrl: string | null;
  mode: string;
  startedAt: string;
  status: string;
  updatedAt: string;
}

export interface RuntimeSessionEventItem {
  actionType: string | null;
  createdAt: string;
  errorMessage: string | null;
  eventType: string;
  fieldLabel: string | null;
  fieldName: string | null;
  id: string;
  selector: string | null;
  source: string;
  stepIndex: number | null;
  success: boolean | null;
  url: string | null;
}

export interface ReplayArtifactItem {
  createdAt: string;
  id: string;
  screenshotUrls: string[];
  sizeBytes: number | null;
}

export interface RulePromotionCandidateItem {
  actionType: string;
  confidence: number;
  failureCount: number;
  fieldLabel: string | null;
  fieldName: string | null;
  hostname: string;
  id: string;
  observationCount: number;
  promotionStatus: string;
  stableSelector: string;
  successCount: number;
  updatedAt: string;
  userOverrideCount: number;
}

export interface RuntimeSessionDetail {
  artifacts: ReplayArtifactItem[];
  candidates: RulePromotionCandidateItem[];
  company: string | null;
  currentStepIndex: number;
  currentUrl: string | null;
  events: RuntimeSessionEventItem[];
  hostname: string | null;
  id: string;
  jobTitle: string | null;
  mode: string;
  startedAt: string;
  status: string;
  updatedAt: string;
}
