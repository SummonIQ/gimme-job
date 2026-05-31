import { IndeedApplicationForm } from '@/components/job-applications/indeed-application-form';
import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { PageBackButton } from '@/components/layout/page-back-button';
import { Card, CardContent } from '@/components/ui/card';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';
import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

interface ApplyIndeedPageProps {
  params: {
    id: string;
  };
}

export const metadata: Metadata = {
  title: 'Apply on Indeed | Gimme Job',
  description: 'Submit your job application on Indeed',
};

export default async function ApplyIndeedPage({
  params,
}: ApplyIndeedPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  // Get job lead
  const jobLead = await db.jobLead.findUnique({
    where: {
      id: params.id,
      userId: user.id,
    },
    include: {
      jobListing: true,
    },
  });

  if (!jobLead) {
    notFound();
  }

  // Check if job is on Indeed
  const jobProvider = String(jobLead.jobListing?.jobProvider || '');
  if (jobProvider !== 'INDEED') {
    // Redirect to the appropriate application page or general apply page
    redirect(`/jobs/${params.id}/apply`);
  }

  // Get user's resumes
  const resumes = await db.resume.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
  });

  const resumeOptions = resumes.map(resume => ({
    id: resume.id,
    name: resume.name,
  }));

  // Get user's cover letters
  const coverLetters = await db.coverLetter.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
  });

  const coverLetterOptions = coverLetters.map(letter => ({
    id: letter.id,
    name: letter.name,
  }));

  const jobTitle =
    jobLead.title || jobLead.jobListing?.title || 'Unknown Position';
  const company =
    (jobLead as any).company ||
    jobLead.jobListing?.company ||
    'Unknown Company';

  return (
    <Page name="apply-indeed" title="Apply on Indeed">
      <PageBackButton href={`/jobs/${params.id}`} />
      <PageHeader
        title="Apply on Indeed"
        description={`Submit your application for ${jobTitle} at ${company}`}
      />

      <PageContent>
        <div className="grid gap-6">
          <Card>
            <CardContent className="pt-6">
              <IndeedApplicationForm
                jobLeadId={params.id}
                jobTitle={jobTitle}
                company={company}
                resumeOptions={resumeOptions}
                coverLetterOptions={coverLetterOptions}
              />
            </CardContent>
          </Card>

          <div className="text-center text-sm text-muted-foreground">
            <p>
              This will submit your application through Indeed&apos;s job
              application system.
              <br />
              Your application will be tracked in the &quot;Applications&quot;
              section.
            </p>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
