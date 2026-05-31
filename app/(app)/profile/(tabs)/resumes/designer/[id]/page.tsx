import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { Page, PageHeader } from '@/components/layout/page';
import { getStructuredResume } from '@/lib/resumes/structured/actions';

import { ResumeDesignerClient } from './designer-client';

export const metadata: Metadata = {
  title: 'Resume Designer | Gimme Job',
  description: 'Build a structured resume step by step.',
};

export const dynamic = 'force-dynamic';

interface DesignerPageProps {
  params: Promise<{ id: string }>;
}

export default async function ResumeDesignerPage({
  params,
}: DesignerPageProps) {
  const { id } = await params;
  const resume = await getStructuredResume(id);
  if (!resume) {
    notFound();
  }

  return (
    <Page name="resume-designer">
      <PageHeader
        title={resume.name}
        description="Fill out each section. Your work autosaves as you type."
      />
      <ResumeDesignerClient
        resumeId={resume.id}
        initialName={resume.name}
        initialData={resume.structuredData}
      />
    </Page>
  );
}
