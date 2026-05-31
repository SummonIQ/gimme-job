'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { SkillGapChart } from '@/components/skills/skill-gap-chart';
import { Skill } from '@/lib/skills/gap-analysis';
import { Label } from '@/components/ui/label';

interface SkillGapAnalysis {
  id: string;
  jobLeadId?: string;
  resumeId?: string;
  matchedSkills: Skill[];
  missingSkills: Skill[];
  partialSkills: Skill[];
  overallMatch: number;
  recommendations: {
    skillsToAcquire: string[];
    skillsToImprove: string[];
    skillsToHighlight: string[];
    coursesAndResources: Array<{
      skill: string;
      resources: Array<{
        name: string;
        url?: string;
        type: 'course' | 'certification' | 'tutorial' | 'book' | 'practice';
        platform?: string;
        estimatedTimeHours?: number;
        description?: string;
      }>;
    }>;
  };
  summary: string;
  createdAt: Date;
  updatedAt: Date;
}

interface JobLeadOption {
  id: string;
  title: string;
}

interface ResumeOption {
  id: string;
  name: string;
}

function SkillGapAnalysisContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [jobLeads, setJobLeads] = useState<JobLeadOption[]>([]);
  const [resumes, setResumes] = useState<ResumeOption[]>([]);
  const [selectedJobLeadId, setSelectedJobLeadId] = useState(
    searchParams.get('jobLeadId') || '',
  );
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [analysis, setAnalysis] = useState<SkillGapAnalysis | null>(null);
  const [savedAnalyses, setSavedAnalyses] = useState<SkillGapAnalysis[]>([]);

  // Fetch job leads and resumes on component mount
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [jobLeadsRes, resumesRes, analysesRes] = await Promise.all([
          fetch('/api/job-leads'),
          fetch('/api/resumes'),
          fetch('/api/skills/gap-analysis'),
        ]);

        if (jobLeadsRes.ok && resumesRes.ok && analysesRes.ok) {
          const [jobLeadsData, resumesData, analysesData] = await Promise.all([
            jobLeadsRes.json(),
            resumesRes.json(),
            analysesRes.json(),
          ]);

          setJobLeads(jobLeadsData.data || []);
          setResumes(resumesData.data || []);
          setSavedAnalyses(analysesData.data || []);

          // If job lead ID was provided in URL and we have an analysis for it already, load it
          if (searchParams.get('jobLeadId')) {
            const existingAnalysis = analysesData.data?.find(
              (a: SkillGapAnalysis) =>
                a.jobLeadId === searchParams.get('jobLeadId'),
            );

            if (existingAnalysis) {
              setAnalysis(existingAnalysis);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: 'Error fetching data',
          description: 'Unable to load job leads and resumes',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [searchParams]);

  // Handle form submission
  const handleAnalyze = async () => {
    if (!selectedJobLeadId || !selectedResumeId) {
      toast({
        title: 'Selection required',
        description: 'Please select both a job lead and a resume to analyze',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);

    try {
      const response = await fetch('/api/skills/gap-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobLeadId: selectedJobLeadId,
          resumeId: selectedResumeId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze skill gap');
      }

      const data = await response.json();

      if (data.success) {
        setAnalysis(data.data);
        setSavedAnalyses([data.data, ...savedAnalyses]);
        toast({
          title: 'Analysis complete',
          description: 'Skill gap analysis has been generated successfully',
        });
      } else {
        throw new Error(data.message || 'Unknown error occurred');
      }
    } catch (error) {
      toast({
        title: 'Error analyzing skill gap',
        description:
          error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const loadAnalysis = (id: string) => {
    const selectedAnalysis = savedAnalyses.find(a => a.id === id);
    if (selectedAnalysis) {
      setAnalysis(selectedAnalysis);
      setSelectedJobLeadId(selectedAnalysis.jobLeadId || '');
      setSelectedResumeId(selectedAnalysis.resumeId || '');
    }
  };

  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="container mx-auto py-10 space-y-8">
      <div className="flex flex-col">
        <h1 className="text-3xl font-bold">Skill Gap Analysis</h1>
        <p className="text-muted-foreground">
          Analyze the gap between your skills and job requirements
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-6">
          {/* Selection and Analysis Form */}
          <Card>
            <CardHeader>
              <CardTitle>Create New Analysis</CardTitle>
              <CardDescription>
                Select a job and resume to analyze the skill gap
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="jobLead">Job Posting</Label>
                <Select
                  value={selectedJobLeadId}
                  onValueChange={setSelectedJobLeadId}
                  disabled={isLoading || isAnalyzing}
                >
                  <SelectTrigger id="jobLead">
                    <SelectValue placeholder="Select job posting" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobLeads.map((job: any) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="resume">Resume</Label>
                <Select
                  value={selectedResumeId}
                  onValueChange={setSelectedResumeId}
                  disabled={isLoading || isAnalyzing}
                >
                  <SelectTrigger id="resume">
                    <SelectValue placeholder="Select resume" />
                  </SelectTrigger>
                  <SelectContent>
                    {resumes.map((resume: any) => (
                      <SelectItem key={resume.id} value={resume.id}>
                        {resume.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleAnalyze}
                disabled={
                  isLoading ||
                  isAnalyzing ||
                  !selectedJobLeadId ||
                  !selectedResumeId
                }
                className="w-full"
              >
                {isAnalyzing ? <Spinner className="mr-2" /> : null}
                {isAnalyzing ? 'Analyzing...' : 'Analyze Skill Gap'}
              </Button>
            </CardFooter>
          </Card>

          {/* Saved Analyses */}
          <Card>
            <CardHeader>
              <CardTitle>Saved Analyses</CardTitle>
              <CardDescription>
                Your previously generated analyses
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <Spinner />
                </div>
              ) : savedAnalyses.length > 0 ? (
                <div className="space-y-2">
                  {savedAnalyses.map(item => {
                    // Find job and resume details
                    const job = jobLeads.find(
                      (j: any) => j.id === item.jobLeadId,
                    );
                    const resume = resumes.find(
                      (r: any) => r.id === item.resumeId,
                    );

                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-md border hover:bg-gray-50 cursor-pointer"
                        onClick={() => loadAnalysis(item.id)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">
                              {job?.title || 'Unknown Job'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {resume?.name || 'Unknown Resume'}
                            </p>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {item.overallMatch}% match
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(item.createdAt)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No saved analyses yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {analysis ? (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Skill Gap Results</CardTitle>
                    <CardDescription>
                      Analysis of your skills versus job requirements
                    </CardDescription>
                  </div>
                  <div className="text-2xl font-bold text-primary">
                    {analysis.overallMatch}% Match
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Charts */}
                <SkillGapChart
                  matchedSkills={analysis.matchedSkills}
                  missingSkills={analysis.missingSkills}
                  partialSkills={analysis.partialSkills}
                  overallMatch={analysis.overallMatch}
                />

                {/* Summary */}
                <div>
                  <h3 className="text-lg font-semibold mb-2">Summary</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {analysis.summary}
                  </p>
                </div>

                <Tabs defaultValue="recommendations">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="recommendations">
                      Recommendations
                    </TabsTrigger>
                    <TabsTrigger value="matched">Matched Skills</TabsTrigger>
                    <TabsTrigger value="missing">Missing Skills</TabsTrigger>
                  </TabsList>

                  <TabsContent
                    value="recommendations"
                    className="space-y-4 mt-4"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2 p-4 border rounded-lg bg-gray-50">
                        <h4 className="font-semibold">Skills to Acquire</h4>
                        <ul className="list-disc pl-5 space-y-1">
                          {analysis.recommendations.skillsToAcquire.map(
                            (skill, index) => (
                              <li key={index} className="text-sm">
                                {skill}
                              </li>
                            ),
                          )}
                        </ul>
                      </div>

                      <div className="space-y-2 p-4 border rounded-lg bg-gray-50">
                        <h4 className="font-semibold">Skills to Improve</h4>
                        <ul className="list-disc pl-5 space-y-1">
                          {analysis.recommendations.skillsToImprove.map(
                            (skill, index) => (
                              <li key={index} className="text-sm">
                                {skill}
                              </li>
                            ),
                          )}
                        </ul>
                      </div>

                      <div className="space-y-2 p-4 border rounded-lg bg-gray-50">
                        <h4 className="font-semibold">Skills to Highlight</h4>
                        <ul className="list-disc pl-5 space-y-1">
                          {analysis.recommendations.skillsToHighlight.map(
                            (skill, index) => (
                              <li key={index} className="text-sm">
                                {skill}
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-semibold">Learning Resources</h4>
                      {analysis.recommendations.coursesAndResources.map(
                        (item, index) => (
                          <div key={index} className="p-3 border rounded-md">
                            <h5 className="font-medium text-primary">
                              {item.skill}
                            </h5>
                            <div className="mt-2 space-y-2">
                              {item.resources.map((resource, i) => (
                                <div key={i} className="text-sm">
                                  <div className="flex justify-between">
                                    <div className="font-medium">
                                      {resource.url ? (
                                        <a
                                          href={resource.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-blue-600 hover:underline"
                                        >
                                          {resource.name}
                                        </a>
                                      ) : (
                                        resource.name
                                      )}
                                      {resource.platform &&
                                        ` (${resource.platform})`}
                                    </div>
                                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100">
                                      {resource.type}
                                    </span>
                                  </div>
                                  {resource.description && (
                                    <p className="text-gray-600 mt-1">
                                      {resource.description}
                                    </p>
                                  )}
                                  {resource.estimatedTimeHours && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      Estimated time:{' '}
                                      {resource.estimatedTimeHours} hours
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="matched" className="mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {analysis.matchedSkills.map((skill, index) => (
                        <div key={index} className="p-3 border rounded-md">
                          <div className="flex justify-between items-start">
                            <h4 className="font-medium">{skill.name}</h4>
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${
                                skill.type === 'technical'
                                  ? 'bg-blue-100 text-blue-800'
                                  : skill.type === 'soft'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {skill.type}
                            </span>
                          </div>
                          {skill.level && (
                            <div className="mt-1 text-sm">
                              Level: {skill.level}
                            </div>
                          )}
                          <div className="mt-1 text-xs text-gray-500">
                            Relevance: {skill.relevance}/10
                          </div>
                          {skill.description && (
                            <p className="mt-2 text-sm text-gray-700">
                              {skill.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="missing" className="mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {analysis.missingSkills.map((skill, index) => (
                        <div key={index} className="p-3 border rounded-md">
                          <div className="flex justify-between items-start">
                            <h4 className="font-medium">{skill.name}</h4>
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${
                                skill.type === 'technical'
                                  ? 'bg-blue-100 text-blue-800'
                                  : skill.type === 'soft'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {skill.type}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            Relevance: {skill.relevance}/10
                          </div>
                          {skill.description && (
                            <p className="mt-2 text-sm text-gray-700">
                              {skill.description}
                            </p>
                          )}
                        </div>
                      ))}

                      {analysis.partialSkills.length > 0 && (
                        <div className="col-span-full mt-4">
                          <h3 className="font-semibold mb-2">
                            Partial Matches
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {analysis.partialSkills.map((skill, index) => (
                              <div
                                key={index}
                                className="p-3 border rounded-md bg-amber-50"
                              >
                                <div className="flex justify-between items-start">
                                  <h4 className="font-medium">{skill.name}</h4>
                                  <span
                                    className={`text-xs px-2 py-1 rounded-full ${
                                      skill.type === 'technical'
                                        ? 'bg-blue-100 text-blue-800'
                                        : skill.type === 'soft'
                                          ? 'bg-green-100 text-green-800'
                                          : 'bg-purple-100 text-purple-800'
                                    }`}
                                  >
                                    {skill.type}
                                  </span>
                                </div>
                                {skill.level && (
                                  <div className="mt-1 text-sm">
                                    Level: {skill.level}
                                  </div>
                                )}
                                <div className="mt-1 text-xs text-gray-500">
                                  Relevance: {skill.relevance}/10
                                </div>
                                {skill.description && (
                                  <p className="mt-2 text-sm text-gray-700">
                                    {skill.description}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="py-12 text-center">
                <h3 className="text-lg font-semibold mb-2">
                  No Analysis Selected
                </h3>
                <p className="text-muted-foreground">
                  Select a job and resume to analyze the skill gap, or choose a
                  saved analysis
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SkillGapAnalysisPage() {
  return <SkillGapAnalysisContent />;
}
