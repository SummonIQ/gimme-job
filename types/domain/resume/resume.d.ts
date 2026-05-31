import { Resume as DBResume } from '@/generated/prisma/browser';

import { ResumeAnalysis } from './analysis';

export interface Resume extends DBResume {
  analysis: ResumeAnalysis;
}
