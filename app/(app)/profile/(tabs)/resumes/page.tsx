import {
  Prisma,
  Resume,
  ResumeOptimizationStatus,
  User,
} from '@/generated/prisma/browser';
import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

import { ResumeEditor } from '@/components/resumes/resume-editor';
import { Button } from '@/components/ui/button';
import { ResumeOptimizationQueue } from '@/components/resumes/resume-optimization-queue';
import { ResumesReport } from '@/components/resumes/resumes-report';
import { cacheTag } from '@/lib/cache/tag';
import { getReportData } from '@/lib/reporting';
import { createUserResume, deleteResume, getUserResumes } from '@/lib/resumes';
import { getCurrentUser } from '@/lib/user/query';
import { getUserDefaultResumeId } from '@/lib/user/resumes';
import {
  WithOptionalResumeAnalysis,
  WithOptionalResumeOptimization,
  WithOptionalResumeRevisions,
} from '@/types/domain/resume';
import { WithOptionalUserProfile } from '@/types/domain/user';
import { ApiQuery } from '@/types/reporting/query';

async function getQueuedResumes({ userId }: { userId: string }) {
  'use cache';

  cacheTag(`user:${userId}:resumes:queued`);

  const queuedResumes = await getUserResumes({
    include: {
      analysis: true,
      optimization: true,
    },
    statuses: [
      ResumeOptimizationStatus.QUEUED,
      ResumeOptimizationStatus.PROCESSING,
      ResumeOptimizationStatus.REVISING,
      ResumeOptimizationStatus.ANALYZING,
      ResumeOptimizationStatus.ANALYZED,
      ResumeOptimizationStatus.OPTIMIZING,
    ],
    userId,
  });

  return queuedResumes;
}

async function getDefaultResumeId({ userId }: { userId: string }) {
  'use cache';

  cacheTag(`user:${userId}:resumes:default`);

  const defaultResumeId = await getUserDefaultResumeId(userId);

  return defaultResumeId ?? undefined;
}

const initialResumesReportQuery: ApiQuery<Resume, Prisma.ResumeInclude> = {
  include: {
    analysis: true,
    optimization: true,
  },
  pagination: {
    count: 10,
    start: 0,
  },
  sort: [{ direction: 'desc', field: 'createdAt' }],
};

// export const experimental_ppr = true;

async function getResumesReportData({ userId }: { userId: string }) {
  'use cache';

  cacheTag(`user:${userId}:report:resumes`);

  const { data: resumes } = await getReportData({
    apiQuery: initialResumesReportQuery,
    model: 'resumes',
    userId,
  });

  return resumes;
}

export const experimental_ppr = true;

export default async function Resumes() {
  const user = (await getCurrentUser({
    include: { profile: true },
  })) as WithOptionalUserProfile<User>;
  const defaultResumeId = await getDefaultResumeId({ userId: user.id });
  const queuedResumes = await getQueuedResumes({ userId: user.id });
  const resumes = await getResumesReportData({ userId: user.id });

  return (
    <>
      <Suspense fallback={<></>}>
        <ResumeOptimizationQueue
          queue={queuedResumes.filter(
            resume =>
              resume.optimization?.status !==
                ResumeOptimizationStatus.COMPLETED &&
              (resume.optimization?.status ===
                ResumeOptimizationStatus.QUEUED ||
                resume.optimization?.status ===
                  ResumeOptimizationStatus.PROCESSING ||
                resume.optimization?.status ===
                  ResumeOptimizationStatus.REVISING ||
                resume.optimization?.status ===
                  ResumeOptimizationStatus.ANALYZING ||
                resume.optimization?.status ===
                  ResumeOptimizationStatus.ANALYZED ||
                resume.optimization?.status ===
                  ResumeOptimizationStatus.OPTIMIZING),
          )}
        />
      </Suspense>

      <section>
        <div className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex flex-col flex-nowrap gap-y-1.5">
            <div className="text-lg font-semibold leading-none tracking-tight">
              My Resumes
            </div>
            <div className="text-sm text-muted-foreground">
              View and manage your resumes.
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/profile/resumes/designer">
                <Sparkles className="mr-1 size-4" />
                Design new resume
              </Link>
            </Button>
            <ResumeEditor
              action={async values => {
                'use server';

                const { name, url, description, setDefault } = values;

                const newResume = await createUserResume({
                  description,
                  name,
                  setDefault,
                  url,
                });

                return newResume;
              }}
              showTrigger={true}
            />
          </div>
        </div>
        <div>
          <Suspense fallback={<></>}>
            <ResumesReport
              defaultResumeId={defaultResumeId}
              deleteResume={async resumeId => {
                'use server';

                await deleteResume(resumeId);
              }}
              initialData={
                resumes as Array<
                  WithOptionalResumeOptimization<
                    WithOptionalResumeAnalysis<
                      WithOptionalResumeRevisions<Resume>
                    >
                  >
                >
              }
              initialQuery={initialResumesReportQuery}
              showColumnToggle={true}
              showPagination={true}
              showSearch={true}
            />
          </Suspense>
        </div>
      </section>
    </>
  );
}
