'use client';

import { Page, PageContent, PageHeader } from '@/components/layout/page';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
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
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Activity, Database, ExternalLink, Loader2, Play } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface ATSSystem {
  id: string;
  name: string;
  detectedDomain?: string;
  commonStructures: any;
  formPatterns: any;
  fieldMappings: any;
  uniqueIdentifiers: any;
  nuances: string[];
  difficulty?: string;
  successRate?: number;
  sampleUrls: string[];
  lastAnalyzed: string;
  totalAnalyzed: number;
}

interface AnalysisJob {
  id: string;
  status: string;
  searchQueries: string[];
  totalUrls: number;
  processedUrls: number;
  foundSystems: number;
  startedAt: string;
  completedAt?: string;
  progress: number;
}

export default function ATSResearchPage() {
  const [atsSystems, setAtsSystems] = useState<ATSSystem[]>([]);
  const [jobs, setJobs] = useState<AnalysisJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [searchQueries, setSearchQueries] = useState(
    'Software Engineer\nProduct Manager\nData Scientist',
  );
  const [maxUrls, setMaxUrls] = useState(1000);
  const { toast } = useToast();
  const isFetchingRef = useRef(false);

  const fetchData = useCallback(async (type: 'both' | 'jobs' = 'both') => {
    if (isFetchingRef.current) {
      return;
    }
    isFetchingRef.current = true;
    try {
      const response = await fetch(`/api/ats-research?type=${type}`, {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      if (type === 'both') {
        setAtsSystems(data.atsSystems || []);
      }
      setJobs(data.jobs || []);
    } catch (error) {
      console.error('Error fetching ATS data:', error);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData('both');
  }, [fetchData]);

  const hasActiveJobs = useMemo(
    () =>
      jobs.some(job => job.status === 'pending' || job.status === 'running'),
    [jobs],
  );

  useEffect(() => {
    if (!hasActiveJobs) {
      return;
    }

    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      fetchData('jobs');
    }, 12000);

    return () => clearInterval(interval);
  }, [fetchData, hasActiveJobs]);

  const startResearch = async () => {
    const queries = searchQueries.split('\n').filter(q => q.trim());

    if (queries.length === 0) {
      toast({
        title: 'Missing Queries',
        description: 'Please enter at least one search query.',
        variant: 'destructive',
      });
      return;
    }

    setIsStarting(true);
    try {
      const response = await fetch('/api/ats-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchQueries: queries, maxUrls }),
      });

      if (!response.ok) throw new Error('Failed to start research');

      const data = await response.json();
      toast({
        title: 'Research Started',
        description: `Analysis job created. Processing up to ${maxUrls} URLs.`,
      });

      // Refresh data
      await fetchData('both');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start research job.',
        variant: 'destructive',
      });
    } finally {
      setIsStarting(false);
    }
  };

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case 'Easy':
        return 'bg-green-500/10 text-green-600';
      case 'Medium':
        return 'bg-yellow-500/10 text-yellow-600';
      case 'Hard':
        return 'bg-red-500/10 text-red-600';
      default:
        return 'bg-gray-500/10 text-gray-600';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 text-green-600';
      case 'running':
        return 'bg-blue-500/10 text-blue-600';
      case 'failed':
        return 'bg-red-500/10 text-red-600';
      default:
        return 'bg-gray-500/10 text-gray-600';
    }
  };

  return (
    <Page name="ats-research">
      <PageHeader
        title="ATS Research"
        description="Automatically analyze job application systems to build automation profiles"
      />
      <PageContent>
        {/* Start Research Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="size-5" />
              Start New Research
            </CardTitle>
            <CardDescription>
              Enter job titles/locations to search for and analyze ATS systems
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="queries">Search Queries (one per line)</Label>
              <textarea
                id="queries"
                className="w-full min-h-[100px] p-3 rounded-md border border-border bg-background"
                value={searchQueries}
                onChange={e => setSearchQueries(e.target.value)}
                placeholder="Software Engineer San Francisco&#10;Product Manager New York&#10;Data Scientist Remote"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxUrls">Maximum URLs to Process</Label>
              <Input
                id="maxUrls"
                type="number"
                min="10"
                max="2000"
                value={maxUrls}
                onChange={e => setMaxUrls(parseInt(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Recommended: 1000 URLs for comprehensive analysis
              </p>
            </div>

            <Button
              onClick={startResearch}
              disabled={isStarting}
              className="w-full"
            >
              {isStarting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="mr-2 size-4" />
                  Start Research
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Analysis Jobs */}
        {jobs.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="size-5" />
                Analysis Jobs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {jobs.map(job => (
                <div
                  key={job.id}
                  className="space-y-2 p-4 border border-border/50 rounded-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(job.status)}>
                        {job.status}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(job.startedAt).toLocaleString()}
                      </span>
                    </div>
                    <span className="text-sm font-medium">
                      {job.processedUrls} / {job.totalUrls} URLs
                    </span>
                  </div>

                  {job.status === 'running' && (
                    <Progress value={job.progress} className="h-2" />
                  )}

                  <div className="text-xs text-muted-foreground">
                    Queries: {job.searchQueries.join(', ')} • Found{' '}
                    {job.foundSystems} ATS systems
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* ATS Systems */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : atsSystems.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Database className="size-12 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">No ATS Systems Found</CardTitle>
              <CardDescription className="text-center max-w-md">
                Start a research job to begin collecting ATS system data
              </CardDescription>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Discovered ATS Systems</h2>
              <Badge variant="secondary">{atsSystems.length} systems</Badge>
            </div>

            {atsSystems.map(ats => (
              <Card key={ats.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {ats.name}
                        {ats.difficulty && (
                          <Badge className={getDifficultyColor(ats.difficulty)}>
                            {ats.difficulty}
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {ats.detectedDomain &&
                          `Domain: ${ats.detectedDomain} • `}
                        Analyzed {ats.totalAnalyzed} times
                        {ats.successRate &&
                          ` • ${(ats.successRate * 100).toFixed(0)}% success rate`}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible>
                    <AccordionItem value="nuances">
                      <AccordionTrigger>
                        Nuances & Special Behaviors ({ats.nuances.length})
                      </AccordionTrigger>
                      <AccordionContent>
                        <ul className="space-y-1 text-sm">
                          {ats.nuances.map((nuance, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-primary mt-1">•</span>
                              <span>{nuance}</span>
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="fieldMappings">
                      <AccordionTrigger>Field Mappings</AccordionTrigger>
                      <AccordionContent>
                        <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
                          {JSON.stringify(ats.fieldMappings, null, 2)}
                        </pre>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="structures">
                      <AccordionTrigger>Common Structures</AccordionTrigger>
                      <AccordionContent>
                        <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
                          {JSON.stringify(ats.commonStructures, null, 2)}
                        </pre>
                      </AccordionContent>
                    </AccordionItem>

                    {ats.sampleUrls.length > 0 && (
                      <AccordionItem value="samples">
                        <AccordionTrigger>
                          Sample URLs ({ats.sampleUrls.length})
                        </AccordionTrigger>
                        <AccordionContent>
                          <ul className="space-y-1 text-sm">
                            {ats.sampleUrls.slice(0, 5).map((url, idx) => (
                              <li key={idx}>
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-primary hover:underline"
                                >
                                  <ExternalLink className="size-3" />
                                  {url}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    )}
                  </Accordion>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageContent>
    </Page>
  );
}
