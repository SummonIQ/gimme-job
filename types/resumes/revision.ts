import { ResumeRevision as DBResumeRevision } from '@/generated/prisma/browser';

import { ResumeAnalysis } from '@/types/domain/resume';

export interface ResumeRevision extends DBResumeRevision {
  analysis: ResumeAnalysis;
}
