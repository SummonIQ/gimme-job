import { api } from '@/lib/api/client';

interface ResumeSummary {
  id: string;
  name: string | null;
  markdown: string | null;
  createdAt: string;
  updatedAt: string;
  analysis: {
    atsScore: number | null;
    formattingScore: number | null;
    grammarScore: number | null;
    keywordScore: number | null;
    overallScore: number | null;
    readabilityScore: number | null;
    status: string;
  } | null;
  _count: {
    revisions: number;
  };
}

interface ResumeDetail {
  id: string;
  name: string | null;
  markdown: string | null;
  createdAt: string;
  updatedAt: string;
  analysis: Record<string, unknown> | null;
  revisions: Array<{
    id: string;
    markdown: string | null;
    name: string | null;
    wordDocumentUrl: string | null;
    createdAt: string;
    optimization: {
      changelog: string | null;
      score: number | null;
      scoreImprovement: number | null;
      status: string;
      summary: string | null;
    } | null;
  }>;
}

interface CreateResumeInput {
  description?: string;
  markdown: string;
  name: string;
  setDefault?: boolean;
}

export function getResumes(): Promise<{ data: ResumeSummary[] }> {
  return api.get('/api/mobile/resumes');
}

export function getResume(id: string): Promise<ResumeDetail> {
  return api.get(`/api/mobile/resumes/${id}`);
}

export function createResume(input: CreateResumeInput): Promise<{
  createdAt: string;
  id: string;
  markdown: string | null;
  name: string;
  updatedAt: string;
}> {
  return api.post('/api/mobile/resumes', input);
}
