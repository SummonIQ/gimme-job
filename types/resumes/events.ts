import { ResumeAnalysisStatus, ResumeOptimizationStatus } from '@/generated/prisma/browser';

export type ResumeAnalysisProgressPayload = {
  emittedAt?: string;
  id: string;
  name: string;
  progress: number;
  sequence?: number;
  status: ResumeAnalysisStatus;
};

export type ResumeOptimizationProgressPayload = {
  emittedAt?: string;
  id: string;
  name: string;
  progress: number;
  sequence?: number;
  status: ResumeOptimizationStatus;
};
