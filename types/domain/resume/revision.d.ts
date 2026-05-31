import { ResumeRevision as DBResumeRevision } from '@/generated/prisma/browser';

import { ResumeAnalysis } from './resume';

export interface ResumeRevision extends DBResumeRevision {
  analysis: ResumeAnalysis;
  scoreImprovement: {
    delta: number;
    new_score: number;
    percent_change: number;
    significant_improvements: string[];
  };
}

export type WithOptionalResumeRevisions<T> = T & {
  resumeRevisions?: Array<ResumeRevision>;
};

export type WithOptionalResumeRevision<T> = T & {
  resumeRevision?: ResumeRevision;
};
