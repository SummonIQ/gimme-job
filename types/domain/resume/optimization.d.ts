import { ResumeOptimization } from '@/generated/prisma/browser';

import { WithOptionalResumeRevision } from './revision';

export type WithResumeOptimization<T> = T & {
  optimization: ResumeOptimization;
};

export type WithOptionalResumeOptimization<T> = T & {
  optimization?: WithOptionalResumeRevision<ResumeOptimization>;
};
