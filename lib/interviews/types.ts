import { JobLead } from "@/generated/prisma/client";

export enum InterviewType {
  BEHAVIORAL = 'BEHAVIORAL',
  TECHNICAL = 'TECHNICAL',
  SYSTEM_DESIGN = 'SYSTEM_DESIGN',
  CASE_STUDY = 'CASE_STUDY',
  ROLE_SPECIFIC = 'ROLE_SPECIFIC',
  HR_SCREENING = 'HR_SCREENING',
  MIXED = 'MIXED',
}

export enum DifficultyLevel {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
}

export enum InterviewResponseQuality {
  POOR = 'POOR',
  FAIR = 'FAIR',
  GOOD = 'GOOD',
  EXCELLENT = 'EXCELLENT',
}

export interface InterviewQuestion {
  id: string;
  type: InterviewType;
  question: string;
  description?: string;
  difficulty: DifficultyLevel;
  jobLead?: JobLead;
  jobLeadId?: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

export interface InterviewQuestionGenerationOptions {
  aiProvider?: import('@/lib/ai/models').AiProvider;
  jobLeadId?: string;
  type?: InterviewType;
  count?: number;
  difficulty?: DifficultyLevel;
  jobTitle?: string;
  jobDescription?: string;
  resumeContext?: string;
  specificTopic?: string;
}

export interface InterviewResponse {
  id: string;
  questionId: string;
  answer: string;
  feedback?: string;
  score?: number;
  quality?: InterviewResponseQuality;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

export interface InterviewSession {
  id: string;
  name?: string;
  description?: string;
  questions: InterviewQuestion[];
  responses: InterviewResponse[];
  totalScore?: number;
  averageScore?: number;
  status: 'IN_PROGRESS' | 'COMPLETED';
  jobLeadId?: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

export interface InterviewFeedback {
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  overallScore: number;
  detailedBreakdown: {
    clarity: number;
    relevance: number;
    depth: number;
    structure: number;
    confidence: number;
  };
  analysis: string;
}

export interface InterviewSimulationOptions {
  jobLeadId?: string;
  questionCount?: number;
  interviewType?: InterviewType;
  difficulty?: DifficultyLevel;
  specificQuestions?: string[];
  resumeId?: string;
  coverLetterId?: string;
  jobTitle?: string;
  jobDescription?: string;
}

export interface InterviewSimulation {
  id: string;
  name: string;
  description?: string;
  questions: InterviewQuestion[];
  responses: InterviewResponse[];
  feedback?: InterviewFeedback;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  jobLeadId?: string;
  resumeId?: string;
  coverLetterId?: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}
