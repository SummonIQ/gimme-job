export interface InterviewerInput {
  name: string;
  company: string;
  title?: string;
  linkedinUrl?: string;
}

export interface InterviewerProfile {
  name: string;
  company: string;
  title?: string;
  linkedinUrl?: string;
  summary?: string;
  experience?: string[];
  education?: string[];
  skills?: string[];
  articles?: string[];
  socialProfiles?: {
    linkedin?: string;
    twitter?: string;
    github?: string;
  };
}

export interface PersonalityAssessment {
  communicationStyle: string;
  decisionMakingApproach: string;
  leadershipStyle?: string;
  values?: string[];
  workPreferences?: string[];
  personalityTraits: string[];
  assessmentSummary: string;
}

export interface InterviewStrategy {
  keyTalkingPoints: string[];
  questionsToAsk: string[];
  topicsToAvoid: string[];
  conversationStarters: string[];
  culturalFit: string;
}

export interface InterviewerDossier {
  profile: InterviewerProfile;
  personality: PersonalityAssessment;
  strategy: InterviewStrategy;
  researchSources: string[];
  researchedAt: string;
}

export interface InterviewerResearchResponse {
  dossiers: Array<InterviewerDossier & { fromCache?: boolean }>;
  errors?: Array<{
    interviewer: string;
    error: string;
  }>;
}
