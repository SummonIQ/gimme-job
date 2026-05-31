import { ClipboardList, FileBadge } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardSummary,
  CardTitle,
} from '@/components/ui/card';
import { FileUploadInput } from '@/components/ui/file-upload-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getUserResumes } from '@/lib/resumes';
import { getSessionUser } from '@/lib/user/query';

export const metadata: Metadata = {
  description: 'Optimize your resume for Applicant Tracking Systems.',
  title: 'ATS Optimizer | Gimme Job',
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
    <Page name="ats-optimizer">
      <PageHeader
        title="ATS Optimizer"
        description="Optimize your resume for Applicant Tracking Systems."
      />
      <PageContent className="my-4 flex h-full grow flex-col">
        <div className="flex grow flex-col gap-4 lg:flex-row">
          <div className="flex flex-col gap-2 lg:w-72">
            <Card>
              <CardHeader>
                <CardSummary>
                  <CardTitle>Resume</CardTitle>
                  <CardDescription>
                    Select a resume or upload a new one to get started.
                  </CardDescription>
                </CardSummary>
              </CardHeader>
              <CardContent className="p-4">
                <form>
                  <Select>
                    <SelectTrigger className="max-w-64">
                      <SelectValue placeholder="Select a resume" />
                    </SelectTrigger>
                    <SelectContent>
                      {resumes.map(resume => (
                        <SelectItem key={resume.id} value={resume.id}>
                          {resume.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Separator
                    className="my-2 bg-border/60 md:my-3"
                    orientation="horizontal"
                  />

                  <FileUploadInput />

                  <div className="flex justify-end">
                    <Button className="mt-4">Optimize</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="flex grow flex-col gap-2 lg:w-2/3">
            <h4 className="text-lg font-semibold">Output</h4>
            {/* <p className="text-sm text-muted-foreground/70">
              The optimized resume will be displayed here.
            </p> */}

            <Tabs className="h-full grow pb-12" defaultValue="analysis">
              <TabsList>
                <TabsTrigger value="analysis">Analysis</TabsTrigger>
                <TabsTrigger value="resume">Resume</TabsTrigger>
              </TabsList>

              <TabsContent className="grow lg:h-full" value="analysis">
                <div className="flex grow flex-col items-center justify-center rounded-md border border-border bg-accent/40 p-5 shadow-inner lg:h-full">
                  <div className="flex flex-row items-start gap-2.5 rounded-md border border-border bg-background p-6 md:w-2/3">
                    <div className="pt-0.5">
                      <ClipboardList className="size-6 text-primary" />
                    </div>

                    <div className="flex flex-col">
                      <h5 className="text-lg font-semibold">Analysis</h5>
                      <p className="text-sm text-muted-foreground/70">
                        Your resume analysis will be displayed here after
                        optimization.
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent className="grow lg:h-full" value="resume">
                <div className="flex grow flex-col items-center justify-center rounded-md border border-border bg-accent/40 p-5 shadow-inner lg:h-full">
                  <div className="flex flex-row items-start gap-2.5 rounded-md border border-border bg-background p-6 md:w-2/3">
                    <div className="pt-0.5">
                      <FileBadge className="size-6 text-yellow-500" />
                    </div>

                    <div className="flex flex-col">
                      <h5 className="text-lg font-semibold">
                        Optimized Resume
                      </h5>
                      <p className="text-sm text-muted-foreground/70">
                        Your optimized resume will be displayed here.
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
