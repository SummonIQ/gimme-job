import type { ResumeAnalysis as DBResumeAnalysis } from '@/generated/prisma/browser';

export interface ResumeAnalysis extends DBResumeAnalysis {
  achievements: {
    feedback: Array<string>;
    good_examples: Array<string>;
    needs_improvement: Array<string>;
    score: number;
    summary: string;
  };
  formatting: {
    feedback: Array<string>;
    incompatible_elements: Array<string>;
    score: number;
    significant_improvements: Array<string>;
    summary: string;
  };
  grammar: {
    issues: Array<{
      description: string;
      example: string;
      suggestion: string;
      word: string;
    }>;
    issues_found: number;
    score: number;
    significant_improvements: Array<string>;
  };
  id: string;
  keywords: {
    feedback: Array<string>;
    missing: Array<string>;
    overused: Array<string>;
    score: number;
    summary: string;
  };
  likeability: {
    feedback: Array<string>;
    score: number;
    summary: string;
  };
  readability: {
    feedback: Array<string>;
    score: number;
    significant_improvements: Array<string>;
    summary: string;
  };
  recommendations: {
    content_enhancements: Array<string>;
    long_term_improvements: Array<string>;
    priority_fixes: Array<string>;
    significant_improvements: Array<string>;
  };
  sections: {
    details: Array<{
      feedback: Array<string>;
      name: string;
      score: number;
    }>;
    score: number;
    significant_improvements: Array<string>;
    summary: string;
  };
  spelling: {
    issues: Array<{
      context_sentence: string;
      suggestion: string;
      word: string;
    }>;
    issues_found: number;
    score: number;
    significant_improvements: Array<string>;
    summary: string;
  };
}

export type WithResumeAnalysis<T> = T & { analysis: ResumeAnalysis };

export type WithOptionalResumeAnalysis<T> = T & {
  analysis?: ResumeAnalysis;
};
