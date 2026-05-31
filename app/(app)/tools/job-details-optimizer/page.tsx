import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { getUserResumes } from '@/lib/resumes';
import { getSessionUser } from '@/lib/user/query';

import { JobDetailsOptimizerClient } from './page-client';

export const metadata: Metadata = {
  description: 'Optimize your resume for job descriptions.',
  title: 'Job Details Optimizer | Gimme Job',
};

export default async function ATSResumeOptimizerPage() {
  const user = await getSessionUser();

  if (!user || !user.id) {
    redirect('/login');
  }

  const resumes = await getUserResumes({
    userId: user.id,
  });

  return (
    <Page name="job-details-optimizer">
      <PageHeader
        title="Job Details Optimizer"
        description="Optimize your resume for job descriptions."
      />
      <PageContent className="flex grow flex-col">
        <JobDetailsOptimizerClient
          resumes={resumes.map(resume => ({
            id: resume.id,
            name: resume.name,
          }))}
          userId={user.id}
        />
      </PageContent>
    </Page>
  );
}
