'use client';

import {
  ClipboardList,
  Download,
  FileBadge,
  History,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import type { FormEvent, ReactNode } from 'react';
import { useMemo, useState } from 'react';

import { MarkdownPreview } from '@/components/data/markdown-preview';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FileUploadInput } from '@/components/ui/file-upload-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

interface ResumeOption {
  id: string;
  name: string;
}

interface OptimizerResult {
  diffSummary: Array<{
    after: string;
    before?: string | null;
    keywords: string[];
    reason: string;
    section: string;
  }>;
  emphasizedKeywords: string[];
  formats: {
    docx: string;
    pdf: string;
    txt: string;
    html: string;
  };
  historyUrl: string;
  markdown: string;
  resumeId: string;
  revisionId: string;
  score: {
    after: number;
    before: number;
    delta: number;
    percentChange: number;
  };
  summary: string;
}

export function JobDetailsOptimizerClient({
  resumes,
  userId,
}: {
  resumes: ResumeOption[];
  userId: string;
}) {
  const [selectedResumeId, setSelectedResumeId] = useState(
    resumes[0]?.id ?? '',
  );
  const [uploadedResumeUrl, setUploadedResumeUrl] = useState('');
  const [resumeName, setResumeName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [result, setResult] = useState<OptimizerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inProgress, setInProgress] = useState(false);
  const hasResumeInput = Boolean(uploadedResumeUrl || selectedResumeId);
  const canSubmit =
    hasResumeInput && jobDescription.trim().length >= 20 && !inProgress;
  const selectedResumeName = useMemo(
    () => resumes.find(resume => resume.id === selectedResumeId)?.name,
    [resumes, selectedResumeId],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setInProgress(true);

    try {
      const response = await fetch('/api/tools/job-details-optimizer', {
        body: JSON.stringify({
          company: company.trim() || undefined,
          jobDescription,
          jobTitle: jobTitle.trim() || undefined,
          resumeId: uploadedResumeUrl ? undefined : selectedResumeId,
          resumeName:
            resumeName.trim() ||
            (uploadedResumeUrl
              ? 'Uploaded resume'
              : selectedResumeName || 'Selected resume'),
          resumeUrl: uploadedResumeUrl || undefined,
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.details || payload?.error || 'Failed to optimize resume.',
        );
      }

      setResult(payload as OptimizerResult);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to optimize resume.',
      );
    } finally {
      setInProgress(false);
    }
  };

  return (
    <form
      className="flex grow flex-col gap-4 lg:flex-row"
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-4 pt-4 lg:w-80">
        <Card>
          <CardHeader>
            <CardTitle>Resume</CardTitle>
            <CardDescription>
              Upload a PDF or Word document, or use an existing resume.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {resumes.length > 0 ? (
              <div className="space-y-2">
                <Label>Existing resume</Label>
                <Select
                  value={selectedResumeId}
                  onValueChange={setSelectedResumeId}
                >
                  <SelectTrigger>
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
              </div>
            ) : null}

            <Separator className="bg-border/60" orientation="horizontal" />

            <div className="space-y-2">
              <Label>Upload resume</Label>
              <FileUploadInput
                contentTypes="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={value => {
                  const nextUrl = Array.isArray(value) ? value[0] : value;
                  setUploadedResumeUrl(nextUrl ?? '');
                }}
                uploadUrlPath={`users/${userId}/job-details-optimizer/`}
              />
              {uploadedResumeUrl ? (
                <p className="text-xs text-muted-foreground">
                  Uploaded resume will be used for this optimization.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="resume-name">History name</Label>
              <Input
                id="resume-name"
                onChange={event => setResumeName(event.target.value)}
                placeholder={selectedResumeName ?? 'Uploaded resume'}
                value={resumeName}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Job</CardTitle>
            <CardDescription>
              Paste the job description to tailor this resume.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="space-y-2">
                <Label htmlFor="job-title">Job title</Label>
                <Input
                  id="job-title"
                  onChange={event => setJobTitle(event.target.value)}
                  placeholder="Senior Software Engineer"
                  value={jobTitle}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  onChange={event => setCompany(event.target.value)}
                  placeholder="Company name"
                  value={company}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job-description">Job description</Label>
                <Textarea
                  className="min-h-48 resize-y"
                  id="job-description"
                  onChange={event => setJobDescription(event.target.value)}
                  placeholder="Paste the job description here."
                  value={jobDescription}
                />
              </div>
            </div>

            <Button className="w-full" disabled={!canSubmit} type="submit">
              <Sparkles className="size-4" />
              {inProgress ? 'Optimizing...' : 'Optimize resume'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex grow flex-col gap-2 pt-4 lg:w-2/3">
        {error ? (
          <Alert className="mt-0" variant="destructive">
            <AlertTitle>Optimization failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Tabs className="h-full grow pb-12" defaultValue="analysis">
          <TabsList>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
            <TabsTrigger value="resume">Resume</TabsTrigger>
          </TabsList>

          <TabsContent className="grow lg:h-full" value="analysis">
            <div className="flex grow flex-col rounded-md border border-border bg-accent/40 p-5 shadow-inner lg:h-full">
              {result ? (
                <div className="space-y-5 rounded-md border border-border bg-background p-6">
                  <div className="flex items-start gap-3">
                    <ClipboardList className="mt-0.5 size-6 text-primary" />
                    <div className="space-y-1">
                      <h5 className="text-lg font-semibold">Analysis</h5>
                      <p className="text-sm text-muted-foreground">
                        {result.summary}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <Metric label="Before" value={`${result.score.before}%`} />
                    <Metric label="After" value={`${result.score.after}%`} />
                    <Metric
                      label="Change"
                      value={`${result.score.delta >= 0 ? '+' : ''}${result.score.delta}`}
                    />
                  </div>

                  {result.emphasizedKeywords.length > 0 ? (
                    <div className="space-y-2">
                      <h6 className="text-sm font-semibold">
                        Emphasized keywords
                      </h6>
                      <div className="flex flex-wrap gap-2">
                        {result.emphasizedKeywords.map(keyword => (
                          <Badge key={keyword} variant="secondary">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    <h6 className="text-sm font-semibold">Changes</h6>
                    <div className="space-y-3">
                      {result.diffSummary.map(item => (
                        <div
                          className="rounded-md border border-border/70 bg-muted/30 p-3"
                          key={`${item.section}-${item.reason}`}
                        >
                          <p className="text-sm font-semibold">
                            {item.section}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {item.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <Placeholder
                  icon={<ClipboardList className="size-6 text-primary" />}
                  title="Analysis"
                  description="Your resume analysis will be displayed here after optimization."
                />
              )}
            </div>
          </TabsContent>

          <TabsContent className="grow lg:h-full" value="resume">
            <div className="flex grow flex-col rounded-md border border-border bg-accent/40 p-5 shadow-inner lg:h-full">
              {result ? (
                <div className="flex min-h-0 grow flex-col gap-4 rounded-md border border-border bg-background p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <FileBadge className="mt-0.5 size-6 text-yellow-500" />
                      <div>
                        <h5 className="text-lg font-semibold">
                          Optimized Resume
                        </h5>
                        <p className="text-sm text-muted-foreground">
                          Saved to resume history without changing your default.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={result.formats.docx}>
                          <Download className="size-4" />
                          DOCX
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={result.formats.pdf}>
                          <Download className="size-4" />
                          PDF
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="secondary">
                        <Link href={result.historyUrl}>
                          <History className="size-4" />
                          History
                        </Link>
                      </Button>
                    </div>
                  </div>

                  <div className="min-h-0 grow overflow-auto rounded-md border border-border/70 bg-muted/20 p-4">
                    <MarkdownPreview markdown={result.markdown} paged />
                  </div>
                </div>
              ) : (
                <Placeholder
                  icon={<FileBadge className="size-6 text-yellow-500" />}
                  title="Optimized Resume"
                  description="Your optimized resume will be displayed here."
                />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </form>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/70 bg-muted/30 p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-semibold">{value}</p>
    </div>
  );
}

function Placeholder({
  description,
  icon,
  title,
}: {
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="flex grow flex-col items-center justify-center">
      <div className="flex flex-row items-start gap-2.5 rounded-md border border-border bg-background p-6 md:w-2/3">
        <div className="pt-0.5">{icon}</div>
        <div className="flex flex-col">
          <h5 className="text-lg font-semibold">{title}</h5>
          <p className="text-sm text-muted-foreground/70">{description}</p>
        </div>
      </div>
    </div>
  );
}
