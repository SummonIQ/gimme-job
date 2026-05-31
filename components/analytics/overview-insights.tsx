'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  BarChartCard,
  PieChartCard,
  ResponseRatesChart,
  StatCard,
  StatusDistributionChart,
} from '@/components/analytics/charts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

type AnalyticsTimeframe = '7d' | '30d' | '90d' | '1y' | 'all';

interface OverviewAnalyticsData {
  appliedJobs: number;
  applicationRate: number;
  avgJobFitScore: number;
  interviewRate: number;
  interviewsScheduled: number;
  offerRate: number;
  offersReceived: number;
  totalJobLeads: number;
}

interface JobLeadAnalyticsData {
  locationDistribution: Array<{
    count: number;
    location: string;
  }>;
  statusDistribution: Record<string, number>;
  statusProgression: Array<{
    count: number;
    date: string;
    status: string;
  }>;
  topCompanies: Array<{
    avgFitScore: number;
    company: string;
    count: number;
  }>;
}

interface ResumeAnalyticsData {
  avgOptimizationScore: number;
  completedOptimizations: number;
  scoreImprovements: Array<{
    currentScore: number;
    improvement: number;
    previousScore: number;
    resumeId: string;
    resumeName: string;
  }>;
  totalResumes: number;
}

interface JobSearchAnalyticsData {
  avgJobsPerSearch: number;
  completedSearches: number;
  searchSuccessRate: number;
  topSearchTerms: Array<{
    avgResults: number;
    count: number;
    term: string;
  }>;
  totalSearches: number;
}

interface AnalyticsApiResponse<T> {
  data: T;
}

interface OverviewInsightsPayload {
  jobLeads: JobLeadAnalyticsData;
  jobSearches: JobSearchAnalyticsData;
  overview: OverviewAnalyticsData;
  resumes: ResumeAnalyticsData;
}

interface OnboardingChecklistState {
  completeProfile: boolean;
  uploadResume: boolean;
  runSearch: boolean;
  saveLead: boolean;
  trackApplication: boolean;
}

const ONBOARDING_CHECKLIST_STORAGE_KEY = 'overview-onboarding-checklist-v1';

const DEFAULT_ONBOARDING_CHECKLIST: OnboardingChecklistState = {
  completeProfile: false,
  runSearch: false,
  saveLead: false,
  trackApplication: false,
  uploadResume: false,
};

const JOB_LEAD_STATUS_LABELS: Record<string, string> = {
  ADDED: 'Added',
  APPLIED: 'Applied',
  INTERVIEWED: 'Interviewed',
  INTERVIEW_SCHEDULED: 'Interview Scheduled',
  OFFER_ACCEPTED: 'Offer Accepted',
  OFFER_MADE: 'Offer Made',
  OFFER_REJECTED: 'Offer Rejected',
  REJECTED: 'Rejected',
};

const getStatusLabel = (status: string): string => {
  if (JOB_LEAD_STATUS_LABELS[status]) {
    return JOB_LEAD_STATUS_LABELS[status];
  }

  return status
    .split('_')
    .map(word => `${word.slice(0, 1)}${word.slice(1).toLowerCase()}`)
    .join(' ');
};

const toPercentText = (value: number): string => `${Math.round(value)}%`;

const createAnalyticsUrl = ({
  timeframe,
  type,
}: {
  timeframe: AnalyticsTimeframe;
  type: 'job-leads' | 'job-searches' | 'overview' | 'resumes';
}): string => `/api/analytics?type=${type}&timeframe=${timeframe}`;

export function OverviewInsights() {
  const [timeframe, setTimeframe] = useState<AnalyticsTimeframe>('30d');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<OverviewInsightsPayload | null>(null);
  const [onboardingChecklist, setOnboardingChecklist] =
    useState<OnboardingChecklistState>(DEFAULT_ONBOARDING_CHECKLIST);
  const [isChecklistReady, setIsChecklistReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const cachedChecklist = window.localStorage.getItem(
        ONBOARDING_CHECKLIST_STORAGE_KEY,
      );
      if (!cachedChecklist) {
        setIsChecklistReady(true);
        return;
      }

      const parsedChecklist = JSON.parse(
        cachedChecklist,
      ) as Partial<OnboardingChecklistState>;
      setOnboardingChecklist({
        ...DEFAULT_ONBOARDING_CHECKLIST,
        ...parsedChecklist,
      });
    } catch (storageError) {
      console.error('Failed to load onboarding checklist state:', storageError);
    } finally {
      setIsChecklistReady(true);
    }
  }, []);

  const fetchInsights = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const [overviewResponse, jobLeadsResponse, resumesResponse, searchesResponse] =
        await Promise.all([
          fetch(createAnalyticsUrl({ timeframe, type: 'overview' })),
          fetch(createAnalyticsUrl({ timeframe, type: 'job-leads' })),
          fetch(createAnalyticsUrl({ timeframe, type: 'resumes' })),
          fetch(createAnalyticsUrl({ timeframe, type: 'job-searches' })),
        ]);

      if (
        !overviewResponse.ok ||
        !jobLeadsResponse.ok ||
        !resumesResponse.ok ||
        !searchesResponse.ok
      ) {
        throw new Error('Failed to load overview insights.');
      }

      const [overviewJson, jobLeadsJson, resumesJson, searchesJson] =
        (await Promise.all([
          overviewResponse.json(),
          jobLeadsResponse.json(),
          resumesResponse.json(),
          searchesResponse.json(),
        ])) as [
          AnalyticsApiResponse<OverviewAnalyticsData>,
          AnalyticsApiResponse<JobLeadAnalyticsData>,
          AnalyticsApiResponse<ResumeAnalyticsData>,
          AnalyticsApiResponse<JobSearchAnalyticsData>,
        ];

      setPayload({
        jobLeads: jobLeadsJson.data,
        jobSearches: searchesJson.data,
        overview: overviewJson.data,
        resumes: resumesJson.data,
      });
    } catch (insightsError) {
      console.error('Failed to load overview insights:', insightsError);
      setError('Unable to load overview insights right now.');
    } finally {
      setIsLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    void fetchInsights();
  }, [fetchInsights]);

  const statusDistributionData = useMemo(() => {
    if (!payload) {
      return [];
    }

    return Object.entries(payload.jobLeads.statusDistribution)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        name: getStatusLabel(status),
        value: count,
      }));
  }, [payload]);

  const topCompaniesData = useMemo(() => {
    if (!payload) {
      return [];
    }

    return payload.jobLeads.topCompanies
      .slice(0, 6)
      .map(company => ({
        avgFitScore: Math.round(company.avgFitScore || 0),
        company: company.company,
        leads: company.count,
      }));
  }, [payload]);

  const topSearchTermsData = useMemo(() => {
    if (!payload) {
      return [];
    }

    return payload.jobSearches.topSearchTerms.slice(0, 6).map(term => ({
      avgResults: Math.round(term.avgResults || 0),
      term: term.term,
      uses: term.count,
    }));
  }, [payload]);

  const locationDistributionData = useMemo(() => {
    if (!payload) {
      return [];
    }

    return payload.jobLeads.locationDistribution
      .slice(0, 6)
      .map(location => ({
        location: location.location,
        value: location.count,
      }));
  }, [payload]);

  const conversionRatesData = useMemo(() => {
    if (!payload) {
      return [];
    }

    return [
      { name: 'Applied', value: payload.overview.applicationRate },
      { name: 'Interviewed', value: payload.overview.interviewRate },
      { name: 'Offers', value: payload.overview.offerRate },
    ];
  }, [payload]);

  const isChecklistComplete = useMemo(() => {
    const completedItems = Object.values(onboardingChecklist).filter(Boolean);
    return completedItems.length === Object.keys(onboardingChecklist).length;
  }, [onboardingChecklist]);

  const shouldHideInsightsForOnboarding = useMemo(() => {
    if (!payload) {
      return false;
    }

    const hasNoActivity =
      payload.overview.totalJobLeads === 0 && payload.overview.appliedJobs === 0;

    return hasNoActivity && (!isChecklistReady || !isChecklistComplete);
  }, [isChecklistComplete, isChecklistReady, payload]);

  if (!isChecklistReady || shouldHideInsightsForOnboarding) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Live Insights</h2>
          <p className="text-sm text-muted-foreground">
            Real-time analytics for your search, leads, resumes, and outcomes.
          </p>
        </div>
        <Select
          value={timeframe}
          onValueChange={value => setTimeframe(value as AnalyticsTimeframe)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Timeframe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="1y">Last year</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Card key={`insight-stat-skeleton-${index}`}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-28" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-3 w-40" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={`insight-chart-skeleton-${index}`}>
                <CardHeader>
                  <Skeleton className="h-5 w-44" />
                  <Skeleton className="h-3 w-56" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-72 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {!isLoading && error ? (
        <Card>
          <CardHeader>
            <CardTitle>Insights Unavailable</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => void fetchInsights()} variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !error && payload ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total Leads"
              value={payload.overview.totalJobLeads}
              description="Leads created in selected timeframe"
            />
            <StatCard
              title="Applications"
              value={payload.overview.appliedJobs}
              description={`${toPercentText(payload.overview.applicationRate)} lead-to-apply rate`}
            />
            <StatCard
              title="Interviews"
              value={payload.overview.interviewsScheduled}
              description={`${toPercentText(payload.overview.interviewRate)} apply-to-interview rate`}
            />
            <StatCard
              title="Offers"
              value={payload.overview.offersReceived}
              description={`${toPercentText(payload.overview.offerRate)} interview-to-offer rate`}
            />
            <StatCard
              title="Searches Run"
              value={payload.jobSearches.totalSearches}
              description={`${toPercentText(payload.jobSearches.searchSuccessRate)} completed successfully`}
            />
            <StatCard
              title="Avg Jobs / Search"
              value={payload.jobSearches.avgJobsPerSearch.toFixed(1)}
              description="Results discovered per search run"
            />
            <StatCard
              title="Resumes"
              value={payload.resumes.totalResumes}
              description={`${payload.resumes.completedOptimizations} completed optimizations`}
            />
            <StatCard
              title="Avg Resume Score"
              value={Math.round(payload.resumes.avgOptimizationScore)}
              description={`${Math.round(payload.overview.avgJobFitScore)} avg job fit score`}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <StatusDistributionChart data={statusDistributionData} />
            <ResponseRatesChart data={conversionRatesData} />
            <BarChartCard
              title="Top Companies by Leads"
              description="Organizations appearing most in your lead pipeline"
              data={topCompaniesData}
              dataKeys={[
                { key: 'leads', name: 'Leads', color: '#3b82f6' },
                { key: 'avgFitScore', name: 'Avg Fit Score', color: '#10b981' },
              ]}
              xAxisDataKey="company"
            />
            <BarChartCard
              title="Top Search Terms"
              description="Most used search terms and their average result counts"
              data={topSearchTermsData}
              dataKeys={[
                { key: 'uses', name: 'Uses', color: '#8b5cf6' },
                { key: 'avgResults', name: 'Avg Results', color: '#f59e0b' },
              ]}
              xAxisDataKey="term"
            />
          </div>

          {locationDistributionData.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <PieChartCard
                title="Top Locations"
                description="Most common locations across your leads"
                data={locationDistributionData}
                dataKey="value"
                nameKey="location"
                formatValue={value => `${Math.round(value)} leads`}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
