'use client';

import { Eye, Loader2, Plus, Search, Trash2, UserSearch } from 'lucide-react';
import { useState } from 'react';

import { InterviewerDossierCard } from '@/components/interviewer-research/interviewer-dossier-card';
import { LinkedInViewerModal } from '@/components/interviewer-research/linkedin-viewer-modal';
import {
  ResearchProgress,
  type ResearchStep,
} from '@/components/interviewer-research/research-progress';
import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEvent } from '@/hooks/use-event';
import { useToast } from '@/hooks/use-toast';
import { useUserChannel } from '@/hooks/use-user-channel';
import { DataEventType, EventType } from '@/types/events';
import type {
  InterviewerInput,
  InterviewerResearchResponse,
} from '@/types/interviewer-research';

interface InterviewerFormData extends InterviewerInput {
  id: string;
}

export default function InterviewPrepPage() {
  const [interviewers, setInterviewers] = useState<InterviewerFormData[]>([
    { id: '1', name: '', company: '', title: '' },
  ]);
  const [isResearching, setIsResearching] = useState(false);
  const [results, setResults] = useState<InterviewerResearchResponse | null>(
    null,
  );
  const [showLinkedInModal, setShowLinkedInModal] = useState(false);
  const [researchSteps, setResearchSteps] = useState<ResearchStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const { toast } = useToast();
  const userChannel = useUserChannel();

  // Listen for research progress updates
  useEvent<{
    data: any;
    type: DataEventType.INTERVIEWER_RESEARCH_PROGRESS;
  }>(userChannel, EventType.DataUpdate, payload => {
    if (
      !payload ||
      payload.type !== DataEventType.INTERVIEWER_RESEARCH_PROGRESS
    )
      return;

    const data = payload.data;

    setResearchSteps(prevSteps => {
      const existingStepIndex = prevSteps.findIndex(s => s.id === data.stepId);

      if (existingStepIndex >= 0) {
        // Update existing step
        const newSteps = [...prevSteps];
        newSteps[existingStepIndex] = {
          ...newSteps[existingStepIndex],
          ...data,
        };

        // Count completed steps
        const completedCount = newSteps.filter(
          s => s.status === 'completed',
        ).length;
        setCurrentStep(completedCount);

        return newSteps;
      } else {
        // Add new step
        const newStep: ResearchStep = {
          id: data.stepId,
          interviewer: data.interviewer,
          status: data.status,
          stage: data.stage,
          message: data.message,
          progress: data.progress,
          searchResults: data.searchResults,
          currentUrl: data.currentUrl,
        };
        return [...prevSteps, newStep];
      }
    });
  });

  const addInterviewer = () => {
    setInterviewers([
      ...interviewers,
      { id: Date.now().toString(), name: '', company: '', title: '' },
    ]);
  };

  const removeInterviewer = (id: string) => {
    if (interviewers.length > 1) {
      setInterviewers(interviewers.filter(i => i.id !== id));
    }
  };

  const updateInterviewer = (
    id: string,
    field: keyof InterviewerInput,
    value: string,
  ) => {
    setInterviewers(
      interviewers.map(i => (i.id === id ? { ...i, [field]: value } : i)),
    );
  };

  const handleResearch = async () => {
    const validInterviewers = interviewers.filter(i => i.name && i.company);

    if (validInterviewers.length === 0) {
      toast({
        title: 'Invalid Input',
        description:
          'Please provide at least one interviewer with name and company.',
        variant: 'destructive',
      });
      return;
    }

    setIsResearching(true);
    setResults(null);
    setResearchSteps([]);
    setCurrentStep(0);

    try {
      const response = await fetch('/api/interviewer-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interviewers: validInterviewers.map(({ name, company, title }) => ({
            name,
            company,
            title,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Research failed');
      }

      const data = await response.json();
      setResults(data);

      if (data.dossiers.length > 0) {
        toast({
          title: 'Research Complete',
          description: `Successfully researched ${data.dossiers.length} interviewer(s).`,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to research interviewers. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsResearching(false);
    }
  };

  return (
    <Page name="interview-prep">
      <PageHeader
        title="Interview Prep Intelligence"
        description="Research your interviewers and get AI-powered personality assessments and interview strategies"
      />
      <PageContent>
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserSearch className="size-5" />
              Interviewer Information
            </CardTitle>
            <CardDescription>
              Enter details about the people who will be interviewing you
            </CardDescription>
          </CardHeader>
          <CardContent>
            {interviewers.map((interviewer, index) => (
              <div
                key={interviewer.id}
                className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-4 mb-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm text-muted-foreground">
                    Interviewer {index + 1}
                  </h4>
                  {interviewers.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeInterviewer(interviewer.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor={`name-${interviewer.id}`}>
                      Full Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id={`name-${interviewer.id}`}
                      placeholder="e.g., Jane Smith"
                      value={interviewer.name}
                      onChange={e =>
                        updateInterviewer(
                          interviewer.id,
                          'name',
                          e.target.value,
                        )
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`company-${interviewer.id}`}>
                      Company <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id={`company-${interviewer.id}`}
                      placeholder="e.g., Acme Corp"
                      value={interviewer.company}
                      onChange={e =>
                        updateInterviewer(
                          interviewer.id,
                          'company',
                          e.target.value,
                        )
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`title-${interviewer.id}`}>
                      Job Title{' '}
                      <span className="text-muted-foreground text-xs">
                        (Optional)
                      </span>
                    </Label>
                    <Input
                      id={`title-${interviewer.id}`}
                      placeholder="e.g., Senior Engineer"
                      value={interviewer.title}
                      onChange={e =>
                        updateInterviewer(
                          interviewer.id,
                          'title',
                          e.target.value,
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={addInterviewer}>
                <Plus className="mr-2 size-4" />
                Add Another Interviewer
              </Button>
              <Button onClick={handleResearch} disabled={isResearching}>
                {isResearching ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Researching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 size-4" />
                    Research Interviewers
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-4">
              We'll use SerpAPI to search for public information about each
              interviewer, including their LinkedIn profiles, articles, and
              professional presence.
            </p>
          </CardContent>
        </Card>

        {/* Research Progress */}
        {isResearching && researchSteps.length > 0 && (
          <ResearchProgress
            steps={researchSteps}
            currentStep={currentStep}
            totalSteps={interviewers.filter(i => i.name && i.company).length}
          />
        )}

        {/* Results */}
        {results && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Research Results</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  AI-generated dossiers with personality assessments and
                  interview strategies
                </p>
              </div>
              {results.dossiers.some(d => d.profile.linkedinUrl) && (
                <Button
                  variant="outline"
                  onClick={() => setShowLinkedInModal(true)}
                >
                  <Eye className="mr-2 size-4" />
                  View LinkedIn Profiles
                </Button>
              )}
            </div>

            {results.errors && results.errors.length > 0 && (
              <Card className="border-yellow-500/50 bg-yellow-500/5">
                <CardHeader>
                  <CardTitle className="text-yellow-600 dark:text-yellow-400">
                    Some Research Failed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-sm">
                    {results.errors.map((error, index) => (
                      <li key={index}>
                        <span className="font-medium">
                          {error.interviewer}:
                        </span>{' '}
                        {error.error}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {results.dossiers.length > 0 && (
              <div className="space-y-6">
                {results.dossiers.map((dossier, index) => (
                  <InterviewerDossierCard
                    key={index}
                    dossier={dossier}
                    fromCache={dossier.fromCache}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* LinkedIn Viewer Modal */}
        {results && (
          <LinkedInViewerModal
            open={showLinkedInModal}
            onOpenChange={setShowLinkedInModal}
            linkedinUrls={results.dossiers
              .filter(d => d.profile.linkedinUrl)
              .map(d => ({
                name: d.profile.name,
                url: d.profile.linkedinUrl!,
              }))}
          />
        )}
      </PageContent>
    </Page>
  );
}
