import {
  FileChartColumn,
  UserSearch,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { Separator } from '@/components/ui/separator';

const GridCard = ({
  title,
  description,
  href,
  icon,
}: {
  description: string;
  href?: string;
  icon: React.ReactNode;
  title: string;
}) => {
  const card = (
    <div className="flex min-h-24 cursor-pointer flex-row rounded-md border border-border/50 bg-background shadow-sm shadow-border/10 ring-offset-2 ring-offset-background drop-shadow-sm transition-all duration-300 hover:border-border/80 hover:shadow-lg hover:shadow-primary/20 hover:ring-2 hover:ring-primary">
      <div className="flex items-start justify-center p-4 pr-0">{icon}</div>
      <div className="flex flex-col space-y-1 p-4 px-5">
        <h5 className="font-semibold text-foreground/75">{title}</h5>
        <p className="text-pretty text-sm text-muted-foreground/70">
          {description}
        </p>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{card}</Link>;
  }
  return card;
};

export const metadata: Metadata = {
  description: 'A collection of tools to help you with your job search.',
  title: 'Tools | Gimme Job',
};

export default function ToolsPage() {
  return (
    <Page name="tools">
      <PageHeader
        title="Tools"
        description="A collection of tools to help you with your job search."
      />
      <PageContent>
        <Separator
          className="mb-4 bg-border/60 md:mb-6"
          orientation="horizontal"
        />

        <div className="mb-4 flex flex-col">
          <h4 className="text-lg font-semibold text-foreground/80">
            Resume Optimization
          </h4>
          <p className="text-sm text-muted-foreground/70">
            Tools to help you optimize your resume for Applicant Tracking
            Systems and job descriptions.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:w-4/5 xl:w-full xl:grid-cols-3">
          <GridCard
            description="Optimize your resume against a job description."
            href="/tools/job-details-optimizer"
            icon={
              <div className="flex items-center justify-center rounded-md bg-green-500/10 p-3">
                <FileChartColumn className="size-6 text-green-500" />
              </div>
            }
            title="Job Details Optimizer"
          />
        </div>

        <div className="mb-4 mt-8 flex flex-col">
          <h4 className="text-lg font-semibold text-foreground/80">
            Interview Preparation
          </h4>
          <p className="text-sm text-muted-foreground/70">
            Research your interviewers and prepare for your interviews with
            AI-powered insights.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:w-4/5 xl:w-full xl:grid-cols-3">
          <GridCard
            description="Research interviewers and get AI-powered personality assessments and interview strategies."
            href="/tools/interview-prep"
            icon={
              <div className="flex items-center justify-center rounded-md bg-indigo-500/10 p-3">
                <UserSearch className="size-6 text-indigo-500" />
              </div>
            }
            title="Interview Prep Intelligence"
          />
        </div>
      </PageContent>
    </Page>
  );
}
