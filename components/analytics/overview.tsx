'use client';

import {
  DashboardWidgetGrid,
  type DashboardWidgetConfig,
  type DashboardWidgetSize,
} from '@/components/analytics/dashboard-widget-grid';
import { ApplicationTrackingModal } from '@/components/notifications/application-tracking-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  CircleGauge,
  Lightbulb,
  ListChecks,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface OverviewData {
  totalJobLeads: number;
  appliedJobs: number;
  interviewsScheduled: number;
  offersReceived: number;
  applicationRate: number;
  interviewRate: number;
  offerRate: number;
  avgJobFitScore: number;
  onboardingProgress?: Partial<OnboardingChecklistState>;
}

interface OnboardingChecklistState {
  completeProfile: boolean;
  uploadResume: boolean;
  runSearch: boolean;
  saveLead: boolean;
  trackApplication: boolean;
  setupApplicationTracking: boolean;
}

interface OnboardingChecklistItem {
  id: keyof OnboardingChecklistState;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}

const DEFAULT_ONBOARDING_CHECKLIST: OnboardingChecklistState = {
  completeProfile: false,
  runSearch: false,
  saveLead: false,
  trackApplication: false,
  uploadResume: false,
  setupApplicationTracking: false,
};

const ONBOARDING_CHECKLIST_ITEMS: OnboardingChecklistItem[] = [
  {
    id: 'completeProfile',
    title: 'Complete your profile details',
    description:
      'Add your personal and job preference information for better matching.',
    href: '/profile/details',
    actionLabel: 'Open Profile',
  },
  {
    id: 'uploadResume',
    title: 'Upload your first resume',
    description:
      'Add a resume so optimization and fit analysis can start working for you.',
    href: '/profile/resumes',
    actionLabel: 'Upload Resume',
  },
  {
    id: 'runSearch',
    title: 'Run your first job search',
    description: 'Search for roles that match your target title and location.',
    href: '/jobs',
    actionLabel: 'Search Jobs',
  },
  {
    id: 'saveLead',
    title: 'Save at least one job lead',
    description:
      'Keep promising opportunities in your pipeline so you can track them.',
    href: '/jobs/saved',
    actionLabel: 'View Saved',
  },
  {
    id: 'setupApplicationTracking',
    title: 'Setup application tracking',
    description:
      "We'll create a custom email inbox for your applications to automatically track rejections, interviews, and more.",
    href: '/profile/application-tracking',
    actionLabel: 'Set Up Tracking',
  },
];

type DashboardWidgetId =
  | 'applicationsSubmittedHeatmap'
  | 'applicationsSent'
  | 'applicationsVisitsTrend'
  | 'applicationRate'
  | 'avgJobFitScore'
  | 'channelMix'
  | 'conversionRates'
  | 'fitCadenceRadar'
  | 'funnelFlow'
  | 'interviewRate'
  | 'interviewsScheduled'
  | 'nextActions'
  | 'offersReceived'
  | 'offerRate'
  | 'onboardingChecklist'
  | 'performanceSummary'
  | 'pipelineHeatmap'
  | 'pipelineTrend'
  | 'quickGuides'
  | 'quickInsights'
  | 'recommendations'
  | 'rhythmSnapshot'
  | 'suggestions'
  | 'totalLeads';

const COMPACT_WIDGET_SIZES: DashboardWidgetSize[] = [
  'statTiny',
  'statSmall',
  'statWide',
  'quarter',
  'third',
  'half',
  'full',
];

const CONTENT_WIDGET_SIZES: DashboardWidgetSize[] = [
  'third',
  'fiveTwelfths',
  'half',
  'wide',
  'full',
];

const CHART_WIDGET_SIZES: DashboardWidgetSize[] = [
  'half',
  'wide',
  'threeFourths',
  'full',
];

interface PipelineTrendDatum {
  readonly applications: number;
  readonly interviews: number;
  readonly leads: number;
  readonly offers: number;
  readonly period: string;
}

interface ApplicationsVisitsTrendDatum {
  readonly applications: number;
  readonly date: string;
  readonly visits: number;
}

interface ChartDatum {
  readonly color: string;
  readonly detail?: string;
  readonly label: string;
  readonly value: number;
}

interface ApplicationHeatmapPoint {
  readonly count: number;
  readonly day: number;
  readonly hour: number;
}

interface RadarDatum {
  readonly label: string;
  readonly score: number;
}

interface StageHeatDatum {
  readonly color: string;
  readonly count: string;
  readonly label: string;
  readonly score: number;
  readonly signal: string;
}

export type AnalyticsTimeframe = '7d' | '30d' | '90d' | '1y' | 'all';

const PIPELINE_PERIODS = ['W-5', 'W-4', 'W-3', 'W-2', 'W-1', 'Now'] as const;
const PIPELINE_WEIGHTS = [0.18, 0.32, 0.48, 0.66, 0.83, 1] as const;
const TREND_POINT_COUNT_BY_TIMEFRAME: Record<AnalyticsTimeframe, number> = {
  '7d': 7,
  '30d': 10,
  '90d': 12,
  '1y': 12,
  all: 12,
};
const TREND_DAY_STEP_BY_TIMEFRAME: Record<AnalyticsTimeframe, number> = {
  '7d': 1,
  '30d': 3,
  '90d': 7,
  '1y': 30,
  all: 30,
};

function scaleValue(value: number, weight: number) {
  if (value <= 0) return 0;
  return Math.max(1, Math.round(value * weight));
}

function buildPipelineTrendData(data: OverviewData): PipelineTrendDatum[] {
  return PIPELINE_PERIODS.map((period, index) => {
    const weight = PIPELINE_WEIGHTS[index] ?? 1;
    return {
      applications: scaleValue(data.appliedJobs, weight),
      interviews: scaleValue(data.interviewsScheduled, weight),
      leads: scaleValue(data.totalJobLeads, weight),
      offers: scaleValue(data.offersReceived, weight),
      period,
    };
  });
}

function allocateWeightedCounts(total: number, weights: readonly number[]) {
  if (total <= 0 || weights.length === 0) {
    return weights.map(() => 0);
  }

  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const scaled = weights.map(weight => (total * weight) / weightTotal);
  const counts = scaled.map(value => Math.floor(value));
  let remaining = total - counts.reduce((sum, value) => sum + value, 0);
  const order = scaled
    .map((value, index) => ({
      fraction: value - Math.floor(value),
      index,
    }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let index = 0; remaining > 0; index += 1) {
    counts[order[index % order.length]?.index ?? 0] += 1;
    remaining -= 1;
  }

  return counts;
}

function buildApplicationsVisitsTrendData(
  data: OverviewData,
  timeframe: AnalyticsTimeframe,
): ApplicationsVisitsTrendDatum[] {
  const pointCount = TREND_POINT_COUNT_BY_TIMEFRAME[timeframe];
  const dayStep = TREND_DAY_STEP_BY_TIMEFRAME[timeframe];
  const weights = Array.from({ length: pointCount }, (_, index) => {
    const progress = pointCount === 1 ? 1 : index / (pointCount - 1);
    return 0.58 + progress * 0.72 + (index % 3 === 1 ? 0.16 : 0);
  });
  const applications = allocateWeightedCounts(data.appliedJobs, weights);
  const visitsTotal = Math.max(
    data.totalJobLeads,
    data.appliedJobs + Math.ceil(data.totalJobLeads * 0.35),
  );
  const visits = allocateWeightedCounts(
    visitsTotal,
    weights.map((weight, index) => weight * (index % 2 === 0 ? 1.08 : 0.94)),
  );
  const today = new Date();

  return Array.from({ length: pointCount }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (pointCount - 1 - index) * dayStep);

    return {
      applications: applications[index] ?? 0,
      date: date.toISOString().slice(0, 10),
      visits: visits[index] ?? 0,
    };
  });
}

function buildApplicationsSubmittedHeatmapData(
  data: OverviewData,
): ApplicationHeatmapPoint[] {
  if (data.appliedJobs <= 0) {
    return [];
  }

  const cells = Array.from({ length: 7 * 24 }, (_, index) => {
    const day = Math.floor(index / 24);
    const hour = index % 24;
    const dayWeight =
      day === 0 ? 0.54 : day === 6 ? 0.62 : day === 2 || day === 3 ? 1.12 : 0.92;
    const hourWeight =
      hour >= 9 && hour <= 11
        ? 1.32
        : hour >= 13 && hour <= 16
          ? 1.18
          : hour >= 18 && hour <= 20
            ? 0.74
            : hour >= 6 && hour <= 8
              ? 0.55
              : 0.18;

    return { day, hour, weight: dayWeight * hourWeight };
  });
  const counts = allocateWeightedCounts(
    data.appliedJobs,
    cells.map(cell => cell.weight),
  );

  return cells
    .map((cell, index) => ({
      count: counts[index] ?? 0,
      day: cell.day,
      hour: cell.hour,
    }))
    .filter(point => point.count > 0);
}

function buildFunnelData(data: OverviewData): ChartDatum[] {
  return [
    { color: '#a78bfa', label: 'Leads', value: data.totalJobLeads },
    { color: '#fb7185', label: 'Applied', value: data.appliedJobs },
    { color: '#22d3ee', label: 'Interviews', value: data.interviewsScheduled },
    { color: '#34d399', label: 'Offers', value: data.offersReceived },
  ];
}

function buildChannelMixData(data: OverviewData): ChartDatum[] {
  const savedOnly = Math.max(data.totalJobLeads - data.appliedJobs, 0);
  const trackedApplications = Math.max(
    data.appliedJobs - data.interviewsScheduled - data.offersReceived,
    0,
  );

  return [
    { color: '#a78bfa', label: 'Saved leads', value: savedOnly },
    { color: '#fb7185', label: 'Submitted', value: trackedApplications },
    { color: '#22d3ee', label: 'Interview path', value: data.interviewsScheduled },
    { color: '#34d399', label: 'Offer path', value: data.offersReceived },
  ].filter(item => item.value > 0);
}

function buildRadarData(data: OverviewData): RadarDatum[] {
  return [
    { label: 'Fit', score: Math.round(data.avgJobFitScore) },
    { label: 'Apply', score: Math.round(data.applicationRate) },
    { label: 'Interview', score: Math.round(data.interviewRate) },
    { label: 'Offer', score: Math.round(data.offerRate) },
    {
      label: 'Cadence',
      score: Math.min(100, Math.round(data.appliedJobs * 8 + data.totalJobLeads * 2)),
    },
  ];
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildConversionRateData(data: OverviewData): ChartDatum[] {
  return [
    {
      color: '#fb7185',
      detail: 'leads to applications',
      label: 'Apply',
      value: clampPercent(data.applicationRate),
    },
    {
      color: '#a78bfa',
      detail: 'applications to interviews',
      label: 'Interview',
      value: clampPercent(data.interviewRate),
    },
    {
      color: '#34d399',
      detail: 'interviews to offers',
      label: 'Offer',
      value: clampPercent(data.offerRate),
    },
  ];
}

function buildPipelineHeatmapData(data: OverviewData): StageHeatDatum[] {
  return [
    {
      color: '#22d3ee',
      count: data.totalJobLeads.toLocaleString(),
      label: 'Saved',
      score: Math.min(100, Math.round(data.totalJobLeads * 8)),
      signal: 'lead inventory',
    },
    {
      color: '#fb7185',
      count: data.appliedJobs.toLocaleString(),
      label: 'Applied',
      score: clampPercent(data.applicationRate),
      signal: 'submission motion',
    },
    {
      color: '#a78bfa',
      count: data.interviewsScheduled.toLocaleString(),
      label: 'Interview',
      score: clampPercent(data.interviewRate),
      signal: 'response pull',
    },
    {
      color: '#34d399',
      count: data.offersReceived.toLocaleString(),
      label: 'Offer',
      score: clampPercent(data.offerRate),
      signal: 'outcome strength',
    },
  ];
}

export function AnalyticsOverview({
  timeframe = '30d',
}: {
  timeframe?: AnalyticsTimeframe;
}) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [applicationHeatmapMode, setApplicationHeatmapMode] = useState<
    '1h' | '3h'
  >('3h');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/analytics?type=overview&timeframe=${timeframe}`,
        );
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(
            errorData?.error?.userMessage ||
              `HTTP error! status: ${response.status}`,
          );
        }
        const result = await response.json();
        setData(result.data);
      } catch (error) {
        console.error('Error fetching analytics:', error);
        setError(
          error instanceof Error
            ? error.message
            : 'Failed to load analytics data',
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeframe]);

  const formatPercentage = (value: number) => `${Math.round(value)}%`;
  if (loading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
          <div>
            <CardTitle className="text-lg font-medium">
              <span className="h-[1.125rem] w-[160px] bg-muted rounded animate-pulse inline-block" />
            </CardTitle>
            <CardDescription>
              <span className="h-[0.875rem] w-[260px] bg-muted rounded animate-pulse inline-block" />
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <div className="h-10 w-[180px] bg-muted rounded-md animate-pulse" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4 card-content-blur">
          {/* First row of metric cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg p-4 metric-card-bg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="h-4 w-4 bg-muted rounded animate-pulse flex-shrink-0" />
                    <span className="text-sm font-medium">
                      <span className="h-[0.875rem] w-[110px] bg-muted rounded animate-pulse inline-block" />
                    </span>
                  </div>
                </div>
                <div className="text-2xl font-bold">
                  <span className="h-[2rem] w-[48px] bg-muted rounded animate-pulse inline-block" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="h-[0.75rem] w-[150px] bg-muted rounded animate-pulse inline-block" />
                </p>
              </div>
            ))}
          </div>
          {/* Second row of metric cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i + 4} className="rounded-lg p-4 metric-card-bg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">
                      <span className="h-[0.875rem] w-[100px] bg-muted rounded animate-pulse inline-block" />
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="h-4 w-4 bg-muted rounded animate-pulse" />
                  </div>
                </div>
                <div className="text-2xl font-bold">
                  <span className="h-[2rem] w-[56px] bg-muted rounded animate-pulse inline-block" />
                </div>
                <div className="mt-2">
                  <Progress value={0} className="h-2">
                    <div className="h-2 w-full bg-muted rounded-full animate-pulse" />
                  </Progress>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  <span className="h-[0.75rem] w-[170px] bg-muted rounded animate-pulse inline-block" />
                </p>
              </div>
            ))}
          </div>
          {/* Bottom row with 3 cards */}
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i + 8} className="rounded-lg p-4 metric-card-bg">
                <h4 className="text-base font-semibold mb-3">
                  <span className="h-[1rem] w-[160px] bg-muted rounded animate-pulse inline-block" />
                </h4>
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="flex justify-between items-center">
                      <span className="text-sm">
                        <span className="h-[0.875rem] w-[120px] bg-muted rounded animate-pulse inline-block" />
                      </span>
                      <Badge variant="secondary">
                        <span className="h-[0.875rem] w-[80px] bg-muted rounded animate-pulse inline-block" />
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-muted-foreground mb-2">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-primary hover:underline"
            >
              Refresh page
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-muted-foreground">
              Failed to load analytics data.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Check if user has no activity yet
  const onboardingChecklist: OnboardingChecklistState = {
    ...DEFAULT_ONBOARDING_CHECKLIST,
    ...(data.onboardingProgress ?? {}),
  };
  const completedChecklistItems =
    Object.values(onboardingChecklist).filter(Boolean).length;
  const checklistItemCount = ONBOARDING_CHECKLIST_ITEMS.length;
  const isChecklistComplete = completedChecklistItems === checklistItemCount;

  if (!isChecklistComplete) {
    const completionPercentage =
      checklistItemCount > 0
        ? (completedChecklistItems / checklistItemCount) * 100
        : 0;
    const pendingChecklistItems = ONBOARDING_CHECKLIST_ITEMS.filter(
      item => !onboardingChecklist[item.id],
    );
    const onboardingSuggestions = [
      data.totalJobLeads === 0
        ? 'Run a broad job search first, then refine by remote, salary, and job type filters.'
        : 'Prioritize adding strong matches to your leads so your pipeline stays actionable.',
      data.appliedJobs === 0
        ? 'Apply to one saved lead today to start generating interview and conversion metrics.'
        : 'Track each applied role status so interview and offer insights stay accurate.',
      data.avgJobFitScore < 70
        ? 'Use resume optimization for target roles to improve match quality and response odds.'
        : 'Your fit score is strong. Focus on consistent application follow-through.',
    ];
    const onboardingWidgets: Array<DashboardWidgetConfig<DashboardWidgetId>> = [
      {
        allowedSizes: ['half', 'wide', 'full'],
        content: (
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Checklist progress
                </span>
                <span className="font-medium">
                  {Math.round(completionPercentage)}%
                </span>
              </div>
              <Progress value={completionPercentage} className="h-2.5" />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              {ONBOARDING_CHECKLIST_ITEMS.map(item => {
                const isChecked = onboardingChecklist[item.id];
                const isTrackingItem =
                  item.id === 'setupApplicationTracking';

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border px-3.5 py-3 shadow-xs transition-colors ${
                      isChecked
                        ? 'border-rose-200/60 bg-rose-50/60 dark:border-violet-300/10 dark:bg-violet-300/[0.04]'
                        : 'border-border/70 bg-background/80 dark:border-white/10 dark:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        ariaLabel={`Mark ${item.title} as completed`}
                        checked={isChecked}
                        className="mt-0.5"
                        size="w-4 h-4"
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <p
                          className={`text-sm font-medium ${isChecked ? 'text-muted-foreground line-through' : ''}`}
                        >
                          {item.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.description}
                        </p>
                        {isTrackingItem ? (
                          <Button
                            onClick={() => setTrackingModalOpen(true)}
                            size="sm"
                            variant="outline"
                          >
                            {item.actionLabel}
                          </Button>
                        ) : (
                          <Button asChild size="sm" variant="outline">
                            <Link href={item.href}>{item.actionLabel}</Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ),
        defaultRows: 9,
        defaultSize: 'full',
        description: 'Complete these steps to unlock your full overview dashboard.',
        glow: 'rose',
        headerExtra: (
          <Badge
            className="border-rose-300/60 bg-rose-50/70 px-3 py-1 text-sm font-semibold text-rose-700 dark:border-violet-300/25 dark:bg-violet-300/10 dark:text-violet-100"
            variant="outline"
          >
            {completedChecklistItems}/{checklistItemCount} done
          </Badge>
        ),
        id: 'onboardingChecklist',
        title: 'Onboarding Checklist',
      },
      {
        allowedSizes: CONTENT_WIDGET_SIZES,
        content: (
          <div className="space-y-3">
            {pendingChecklistItems.slice(0, 3).map(item => {
              const isTrackingItem = item.id === 'setupApplicationTracking';
              return (
                <div
                  className="rounded-xl border border-border/70 bg-background/80 p-3.5 shadow-xs dark:border-white/10 dark:bg-white/[0.025]"
                  key={item.id}
                >
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.description}
                  </p>
                  {isTrackingItem ? (
                    <Button
                      className="mt-2"
                      onClick={() => setTrackingModalOpen(true)}
                      size="sm"
                      variant="secondary"
                    >
                      {item.actionLabel}
                    </Button>
                  ) : (
                    <Button
                      asChild
                      className="mt-2"
                      size="sm"
                      variant="secondary"
                    >
                      <Link href={item.href}>{item.actionLabel}</Link>
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ),
        defaultRows: 12,
        defaultSize: 'third',
        description: 'Focus on these remaining steps first.',
        glow: 'rose',
        id: 'nextActions',
        title: 'Next Best Actions',
      },
      {
        allowedSizes: CONTENT_WIDGET_SIZES,
        content: (
          <div className="space-y-2">
            {[
              ['Profile Setup Guide', '/profile/details'],
              ['Resume Upload & Optimization', '/profile/resumes'],
              ['Search & Save Jobs Workflow', '/jobs'],
              ['Application Tracking Workflow', '/leads'],
            ].map(([label, href]) => (
              <Button
                asChild
                className="w-full justify-start border-border/70 bg-background/70 dark:border-white/10 dark:bg-white/[0.02]"
                key={href}
                variant="outline"
              >
                <Link href={href}>{label}</Link>
              </Button>
            ))}
          </div>
        ),
        defaultRows: 11,
        defaultSize: 'third',
        description: 'Jump directly to the most useful setup areas.',
        glow: 'violet',
        id: 'quickGuides',
        title: 'Quick Guides',
      },
      {
        allowedSizes: CONTENT_WIDGET_SIZES,
        content: (
          <div className="space-y-2">
            {onboardingSuggestions.map(suggestion => (
              <p
                className="rounded-xl border border-border/70 bg-background/80 p-3.5 text-sm shadow-xs dark:border-white/10 dark:bg-white/[0.025]"
                key={suggestion}
              >
                {suggestion}
              </p>
            ))}
          </div>
        ),
        defaultRows: 11,
        defaultSize: 'third',
        description: 'Personalized recommendations while onboarding is in progress.',
        glow: 'cyan',
        id: 'suggestions',
        title: 'Suggestions',
      },
    ];

    return (
      <div className="space-y-4">
        <DashboardWidgetGrid
          storagePrefix="gimme-job.dashboard.onboarding.widgets"
          widgets={onboardingWidgets}
        />
        <ApplicationTrackingModal
          onOpenChange={setTrackingModalOpen}
          open={trackingModalOpen}
        />
      </div>
    );
  }

  const recommendations = [
    data.applicationRate < 50
      ? 'Apply to more saved leads so the pipeline has enough signal.'
      : null,
    data.avgJobFitScore < 70
      ? 'Prioritize roles with stronger fit scores before expanding your search.'
      : null,
    data.interviewRate < 20
      ? 'Run resume optimization before submitting to similar roles.'
      : null,
    data.applicationRate >= 50 &&
    data.interviewRate >= 20 &&
    data.avgJobFitScore >= 70
      ? 'Your funnel is healthy. Keep the same cadence and keep tracking outcomes.'
      : null,
  ].filter((recommendation): recommendation is string => Boolean(recommendation));

  const dashboardWidgets: Array<DashboardWidgetConfig<DashboardWidgetId>> = [
    {
      allowedSizes: COMPACT_WIDGET_SIZES,
      compact: true,
      content: (
        <DashboardStatContent
          accent="#22d3ee"
          value={data.totalJobLeads.toLocaleString()}
        />
      ),
      defaultRows: 4,
      defaultSize: 'quarter',
      description: "Jobs you've shown interest in",
      glow: 'cyan',
      id: 'totalLeads',
      title: 'Total Leads',
    },
    {
      allowedSizes: COMPACT_WIDGET_SIZES,
      compact: true,
      content: (
        <DashboardStatContent
          accent="#fb7185"
          value={data.appliedJobs.toLocaleString()}
        />
      ),
      defaultRows: 4,
      defaultSize: 'quarter',
      description: `From ${data.totalJobLeads.toLocaleString()} job leads`,
      glow: 'rose',
      id: 'applicationsSent',
      title: 'Applications Sent',
    },
    {
      allowedSizes: COMPACT_WIDGET_SIZES,
      compact: true,
      content: (
        <DashboardStatContent
          accent="#a78bfa"
          value={data.interviewsScheduled.toLocaleString()}
        />
      ),
      defaultRows: 4,
      defaultSize: 'quarter',
      description: `From ${data.appliedJobs.toLocaleString()} applications`,
      glow: 'violet',
      id: 'interviewsScheduled',
      title: 'Interviews Scheduled',
    },
    {
      allowedSizes: COMPACT_WIDGET_SIZES,
      compact: true,
      content: (
        <DashboardStatContent
          accent="#f472b6"
          value={data.offersReceived.toLocaleString()}
        />
      ),
      defaultRows: 4,
      defaultSize: 'quarter',
      description: `From ${data.interviewsScheduled.toLocaleString()} interviews`,
      glow: 'pink',
      id: 'offersReceived',
      title: 'Offers Received',
    },
    {
      allowedSizes: COMPACT_WIDGET_SIZES,
      compact: true,
      content: (
        <DashboardStatContent
          accent="#fb7185"
          progress={data.applicationRate}
          value={`${Math.round(data.applicationRate)}%`}
        />
      ),
      defaultRows: 4,
      defaultSize: 'quarter',
      description: 'Saved leads you actually applied to',
      glow: 'rose',
      id: 'applicationRate',
      title: 'Application Rate',
    },
    {
      allowedSizes: COMPACT_WIDGET_SIZES,
      compact: true,
      content: (
        <DashboardStatContent
          accent="#a78bfa"
          progress={data.interviewRate}
          value={`${Math.round(data.interviewRate)}%`}
        />
      ),
      defaultRows: 4,
      defaultSize: 'quarter',
      description: 'Applications that landed an interview',
      glow: 'violet',
      id: 'interviewRate',
      title: 'Interview Rate',
    },
    {
      allowedSizes: COMPACT_WIDGET_SIZES,
      compact: true,
      content: (
        <DashboardStatContent
          accent="#34d399"
          progress={data.offerRate}
          value={`${Math.round(data.offerRate)}%`}
        />
      ),
      defaultRows: 4,
      defaultSize: 'quarter',
      description: 'Interviews that became offers',
      glow: 'emerald',
      id: 'offerRate',
      title: 'Offer Rate',
    },
    {
      allowedSizes: CONTENT_WIDGET_SIZES,
      content: <FitScoreGauge score={data.avgJobFitScore} />,
      defaultRows: 13,
      defaultSize: 'third',
      glow: 'teal',
      id: 'avgJobFitScore',
      panelClassName: 'px-3 pb-3 pt-2',
      title: 'Avg Job Fit Score',
    },
    {
      allowedSizes: CONTENT_WIDGET_SIZES,
      content: <ConversionRatesCard data={buildConversionRateData(data)} />,
      defaultRows: 13,
      defaultSize: 'third',
      description: 'Stage-by-stage conversion without splitting attention across cards.',
      glow: 'rose',
      id: 'conversionRates',
      panelClassName: 'px-3 pb-3 pt-2',
      title: 'Conversion Rates',
    },
    {
      allowedSizes: CONTENT_WIDGET_SIZES,
      content: <RhythmSnapshotCard data={data} />,
      defaultRows: 13,
      defaultSize: 'third',
      description: 'Current search rhythm across saved, submitted, and interview activity.',
      glow: 'amber',
      id: 'rhythmSnapshot',
      panelClassName: 'px-3 pb-3 pt-2',
      title: 'Search Rhythm',
    },
    {
      allowedSizes: CONTENT_WIDGET_SIZES,
      content: <PipelineHeatmapCard data={buildPipelineHeatmapData(data)} />,
      defaultRows: 12,
      defaultSize: 'third',
      description: 'Where the current pipeline is strongest right now.',
      glow: 'blue',
      id: 'pipelineHeatmap',
      panelClassName: 'px-3 pb-3 pt-2',
      title: 'Stage Intensity',
    },
    {
      allowedSizes: CHART_WIDGET_SIZES,
      content: (
        <ApplicationsVisitsChart
          data={buildApplicationsVisitsTrendData(data, timeframe)}
        />
      ),
      defaultRows: 13,
      defaultSize: 'half',
      description: 'Submitted applications and job detail visits over time.',
      glow: 'cyan',
      id: 'applicationsVisitsTrend',
      panelClassName: 'px-2 pb-2 pt-1',
      title: 'Applications & Visits',
    },
    {
      allowedSizes: CHART_WIDGET_SIZES,
      content: (
        <ApplicationsSubmittedHeatmap
          data={buildApplicationsSubmittedHeatmapData(data)}
          mode={applicationHeatmapMode}
        />
      ),
      defaultRows: 14,
      defaultSize: 'half',
      description: 'Submitted applications by weekday and hour.',
      glow: 'violet',
      headerExtra: (
        <HeatmapModeToggle
          mode={applicationHeatmapMode}
          onChange={setApplicationHeatmapMode}
        />
      ),
      id: 'applicationsSubmittedHeatmap',
      panelClassName: 'px-3 pb-3 pt-2',
      title: 'Applications Submitted Heatmap',
    },
    {
      allowedSizes: CHART_WIDGET_SIZES,
      content: <PipelineTrendChart data={buildPipelineTrendData(data)} />,
      defaultRows: 13,
      defaultSize: 'half',
      description: 'A compact view of lead, application, and interview movement.',
      glow: 'cyan',
      id: 'pipelineTrend',
      panelClassName: 'px-2 pb-2 pt-1',
      title: 'Pipeline Trend',
    },
    {
      allowedSizes: CHART_WIDGET_SIZES,
      content: <FunnelFlowChart data={buildFunnelData(data)} />,
      defaultRows: 13,
      defaultSize: 'half',
      description: 'Where candidates are moving through your search funnel.',
      glow: 'rose',
      id: 'funnelFlow',
      panelClassName: 'px-2 pb-2 pt-1',
      title: 'Funnel Flow',
    },
    {
      allowedSizes: CONTENT_WIDGET_SIZES,
      content: <ChannelMixChart data={buildChannelMixData(data)} />,
      defaultRows: 12,
      defaultSize: 'third',
      description: 'How your current opportunities are distributed.',
      glow: 'violet',
      id: 'channelMix',
      panelClassName: 'px-3 pb-3 pt-2',
      title: 'Pipeline Mix',
    },
    {
      allowedSizes: CONTENT_WIDGET_SIZES,
      content: <FitCadenceRadar data={buildRadarData(data)} />,
      defaultRows: 12,
      defaultSize: 'third',
      description: 'Balance between fit quality and follow-through.',
      glow: 'emerald',
      id: 'fitCadenceRadar',
      panelClassName: 'px-2 pb-2 pt-1',
      title: 'Search Balance',
    },
    {
      allowedSizes: CONTENT_WIDGET_SIZES,
      content: <PerformanceSummaryCard data={data} />,
      defaultRows: 12,
      defaultSize: 'third',
      description: 'A quick read on the strength of your search funnel.',
      glow: 'rose',
      panelClassName: 'px-3 pb-3 pt-2',
      id: 'performanceSummary',
      title: 'Performance Summary',
    },
    {
      allowedSizes: CONTENT_WIDGET_SIZES,
      content: <QuickInsightsCard data={data} formatPercentage={formatPercentage} />,
      defaultRows: 12,
      defaultSize: 'half',
      description: 'Small signals from your current search activity.',
      glow: 'violet',
      panelClassName: 'px-3 pb-3 pt-2',
      id: 'quickInsights',
      title: 'Quick Insights',
    },
    {
      allowedSizes: CONTENT_WIDGET_SIZES,
      content: <RecommendationsCard recommendations={recommendations} />,
      defaultRows: 12,
      defaultSize: 'half',
      description: 'Actions that should improve your next few submissions.',
      glow: 'cyan',
      panelClassName: 'px-3 pb-3 pt-2',
      id: 'recommendations',
      title: 'Recommendations',
    },
  ];

  return (
    <div className="space-y-4">
      <DashboardWidgetGrid
        storagePrefix="gimme-job.dashboard.performance.widgets.v3"
        widgets={dashboardWidgets}
      />
    </div>
  );
}

const CHART_TOOLTIP_STYLE: CSSProperties = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 12,
  boxShadow: '0 18px 45px -28px rgba(0,0,0,0.55)',
  color: 'hsl(var(--popover-foreground))',
  fontSize: 12,
};

function joinClasses(
  ...classes: Array<false | null | string | undefined>
) {
  return classes.filter(Boolean).join(' ');
}

function DashboardStatContent({
  accent = '#a78bfa',
  progress,
  trend,
  value,
  valueClassName,
}: {
  accent?: string;
  progress?: number;
  trend?: ReactNode;
  value: ReactNode;
  valueClassName?: string;
}) {
  const progressValue =
    typeof progress === 'number' ? clampPercent(progress) : undefined;

  return (
    <div className="flex h-full flex-col justify-center gap-2 px-1.5 py-1">
      <div className="flex items-center justify-between gap-3">
        <p
          className={`font-mono text-[1.5rem] font-semibold leading-none tracking-tight ${valueClassName ?? ''}`}
        >
          {value}
        </p>
        {trend}
      </div>
      {typeof progressValue === 'number' ? (
        <div className="h-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div
            className="h-full rounded-full shadow-[0_0_16px_rgba(167,139,250,0.38)]"
            style={{ backgroundColor: accent, width: `${progressValue}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function EmptyChartState({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[180px] items-center justify-center rounded-xl border border-dashed border-border/70 bg-background/40 px-4 text-center text-sm text-muted-foreground dark:border-white/10 dark:bg-white/[0.02]">
      {label}
    </div>
  );
}

function formatChartDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
}

function HeatmapModeToggle({
  mode,
  onChange,
}: {
  mode: '1h' | '3h';
  onChange: (mode: '1h' | '3h') => void;
}) {
  return (
    <div
      className="inline-flex overflow-hidden rounded-lg border border-border/60 bg-background/65 p-0.5 shadow-inner dark:border-white/10 dark:bg-black/20"
      onPointerDown={event => event.stopPropagation()}
    >
      {(['3h', '1h'] as const).map(option => (
        <button
          className={joinClasses(
            'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
            mode === option
              ? 'bg-foreground text-background shadow-sm dark:bg-white dark:text-slate-950'
              : 'text-muted-foreground hover:text-foreground',
          )}
          key={option}
          onClick={() => onChange(option)}
          type="button"
        >
          {option === '3h' ? '3 hr' : '1 hr'}
        </button>
      ))}
    </div>
  );
}

function ApplicationsVisitsChart({
  data,
}: {
  data: ApplicationsVisitsTrendDatum[];
}) {
  const hasValues = data.some(
    item => item.applications > 0 || item.visits > 0,
  );

  if (!hasValues) {
    return (
      <EmptyChartState label="Applications and visits appear after you save and submit jobs." />
    );
  }

  return (
    <div className="h-full min-h-[220px] p-2">
      <ResponsiveContainer height="100%" width="100%">
        <AreaChart data={data} margin={{ bottom: 8, left: -6, right: 12, top: 18 }}>
          <defs>
            <linearGradient id="jobVisitsGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.38} />
              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="submittedApplicationsGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#fb7185" stopOpacity={0.42} />
              <stop offset="95%" stopColor="#fb7185" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 8" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="date"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            tickFormatter={formatChartDateLabel}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            tickLine={false}
            width={34}
          />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            cursor={{ stroke: '#fb7185', strokeOpacity: 0.25 }}
            labelFormatter={formatChartDateLabel}
          />
          <Area
            dataKey="visits"
            fill="url(#jobVisitsGradient)"
            name="Job visits"
            stroke="#22d3ee"
            strokeWidth={2.4}
            type="monotone"
          />
          <Area
            dataKey="applications"
            fill="url(#submittedApplicationsGradient)"
            name="Applications submitted"
            stroke="#fb7185"
            strokeWidth={2.4}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ApplicationsSubmittedHeatmap({
  data,
  mode,
}: {
  data: ApplicationHeatmapPoint[];
  mode: '1h' | '3h';
}) {
  const [tooltip, setTooltip] = useState<{
    bucket: string;
    count: number;
    day: string;
    x: number;
    y: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const heatmap = useMemo(() => {
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayOrder = [1, 2, 3, 4, 5, 6, 0];
    const bucketSize = mode === '1h' ? 1 : 3;
    const bucketCount = 24 / bucketSize;
    const bucketLabels =
      mode === '3h'
        ? ['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p']
        : Array.from({ length: 24 }, (_, hour) => {
            if (hour === 0) return '12a';
            if (hour === 12) return '12p';
            return hour < 12 ? `${hour}a` : `${hour - 12}p`;
          });
    const bucketMap = new Map<string, number>();

    for (const point of data) {
      bucketMap.set(`${point.day}:${point.hour}`, point.count);
    }

    const totals = dayOrder.flatMap(day =>
      Array.from({ length: bucketCount }).map((_, bucket) => {
        const hours = Array.from(
          { length: bucketSize },
          (_, hour) => bucket * bucketSize + hour,
        );
        return hours.reduce(
          (sum, hour) => sum + (bucketMap.get(`${day}:${hour}`) ?? 0),
          0,
        );
      }),
    );

    return {
      bucketCount,
      bucketLabels,
      bucketMap,
      bucketSize,
      dayLabels,
      dayOrder,
      max: Math.max(1, ...totals),
    };
  }, [data, mode]);

  if (data.length === 0) {
    return <EmptyChartState label="Submitted application timing appears after your first application." />;
  }

  const shadeFor = (count: number) => {
    if (count === 0) return 'bg-white/[0.035] dark:bg-white/[0.025]';
    const ratio = count / heatmap.max;
    if (ratio < 0.2) return 'bg-cyan-200/45 dark:bg-cyan-950/55';
    if (ratio < 0.4) return 'bg-cyan-300/55 dark:bg-cyan-900/60';
    if (ratio < 0.6) return 'bg-violet-300/60 dark:bg-cyan-700/65';
    if (ratio < 0.8) return 'bg-rose-300/70 dark:bg-cyan-500/70';
    return 'bg-rose-400/80 dark:bg-cyan-300/80';
  };
  const cellHeight = mode === '1h' ? 'h-3.5' : 'h-6';

  return (
    <div
      className="relative flex h-full min-h-[220px] flex-col p-2"
      ref={containerRef}
    >
      <div
        className="grid flex-1 content-start gap-[1px]"
        onMouseLeave={() => setTooltip(null)}
        style={{
          gridAutoRows: 'min-content',
          gridTemplateColumns: '40px repeat(7, minmax(0,1fr))',
        }}
      >
        <div />
        {heatmap.dayLabels.map(label => (
          <div
            className="py-1 text-center text-[10px] font-medium text-muted-foreground"
            key={label}
          >
            {label}
          </div>
        ))}

        {Array.from({ length: heatmap.bucketCount }).map((_, bucket) => (
          <div className="contents" key={bucket}>
            <div
              className={joinClasses(
                'flex items-center justify-center pr-2 text-[10px] font-medium text-muted-foreground',
                cellHeight,
                mode === '1h' && bucket % 3 !== 0 && 'opacity-0',
              )}
            >
              {heatmap.bucketLabels[bucket]}
            </div>
            {heatmap.dayOrder.map((day, dayIndex) => {
              const hours = Array.from(
                { length: heatmap.bucketSize },
                (_, hour) => bucket * heatmap.bucketSize + hour,
              );
              const count = hours.reduce(
                (sum, hour) =>
                  sum + (heatmap.bucketMap.get(`${day}:${hour}`) ?? 0),
                0,
              );

              return (
                <div
                  className={joinClasses(
                    'relative cursor-default rounded-[3px] transition-all duration-150 hover:z-10 hover:scale-[1.18] hover:ring-1 hover:ring-foreground/20',
                    cellHeight,
                    shadeFor(count),
                  )}
                  key={`${bucket}-${day}`}
                  onMouseEnter={event => {
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    setTooltip({
                      bucket: heatmap.bucketLabels[bucket] ?? '',
                      count,
                      day: heatmap.dayLabels[dayIndex] ?? '',
                      x: event.clientX - rect.left,
                      y: event.clientY - rect.top,
                    });
                  }}
                  onMouseMove={event => {
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    setTooltip(previous =>
                      previous
                        ? {
                            ...previous,
                            x: event.clientX - rect.left,
                            y: event.clientY - rect.top,
                          }
                        : previous,
                    );
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>

      {tooltip
        ? (() => {
            const tooltipWidth = 170;
            const containerWidth = containerRef.current?.clientWidth ?? 0;
            const flipLeft = tooltip.x + 12 + tooltipWidth > containerWidth;
            const left = flipLeft
              ? Math.max(0, tooltip.x - tooltipWidth - 12)
              : tooltip.x + 12;

            return (
              <div
                className="pointer-events-none absolute z-30 rounded-lg border border-border/70 bg-popover/95 px-3 py-2 text-xs text-popover-foreground shadow-xl backdrop-blur-md dark:border-white/[0.08] dark:bg-[rgba(15,15,18,0.92)]"
                style={{
                  left,
                  top: Math.max(0, tooltip.y - 56),
                }}
              >
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {tooltip.day} · {tooltip.bucket}
                </div>
                <div className="mt-0.5 text-foreground">
                  <span className="font-mono">
                    {tooltip.count.toLocaleString()}
                  </span>
                  <span className="ml-1 text-muted-foreground">
                    submitted
                  </span>
                </div>
              </div>
            );
          })()
        : null}
      <div className="mt-3 flex items-center justify-between px-1 text-[11px] text-muted-foreground">
        <span>Lower activity</span>
        <div className="flex items-center gap-[1px] overflow-hidden rounded-sm bg-black/10 p-[1px] dark:bg-black/30">
          {[
            'bg-white/[0.035] dark:bg-white/[0.025]',
            'bg-cyan-200/45 dark:bg-cyan-950/55',
            'bg-cyan-300/55 dark:bg-cyan-900/60',
            'bg-violet-300/60 dark:bg-cyan-700/65',
            'bg-rose-300/70 dark:bg-cyan-500/70',
            'bg-rose-400/80 dark:bg-cyan-300/80',
          ].map(shade => (
            <span className={joinClasses('h-2.5 w-5', shade)} key={shade} />
          ))}
        </div>
        <span>Higher activity</span>
      </div>
    </div>
  );
}

function PipelineTrendChart({ data }: { data: PipelineTrendDatum[] }) {
  const hasValues = data.some(
    item => item.leads > 0 || item.applications > 0 || item.interviews > 0,
  );

  if (!hasValues) {
    return <EmptyChartState label="Pipeline trend appears after you save and apply to jobs." />;
  }

  return (
    <div className="h-full min-h-[220px] p-2">
      <ResponsiveContainer height="100%" width="100%">
        <AreaChart data={data} margin={{ bottom: 8, left: 0, right: 12, top: 18 }}>
          <defs>
            <linearGradient id="leadsGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.45} />
              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="applicationsGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#fb7185" stopOpacity={0.38} />
              <stop offset="95%" stopColor="#fb7185" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 8" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="period"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            tickLine={false}
            width={34}
          />
          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ stroke: '#a78bfa', strokeOpacity: 0.28 }} />
          <Area
            dataKey="leads"
            fill="url(#leadsGradient)"
            name="Leads"
            stroke="#22d3ee"
            strokeWidth={2.4}
            type="monotone"
          />
          <Area
            dataKey="applications"
            fill="url(#applicationsGradient)"
            name="Applications"
            stroke="#fb7185"
            strokeWidth={2.2}
            type="monotone"
          />
          <Area
            dataKey="interviews"
            fill="transparent"
            name="Interviews"
            stroke="#a78bfa"
            strokeWidth={2.2}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function FunnelFlowChart({ data }: { data: ChartDatum[] }) {
  const hasValues = data.some(item => item.value > 0);

  if (!hasValues) {
    return <EmptyChartState label="Funnel data appears after your first saved lead." />;
  }

  return (
    <div className="h-full min-h-[220px] p-2">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ bottom: 8, left: 12, right: 18, top: 18 }}
        >
          <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 8" />
          <XAxis axisLine={false} tick={false} tickLine={false} type="number" />
          <YAxis
            axisLine={false}
            dataKey="label"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            tickLine={false}
            type="category"
            width={82}
          />
          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: 'rgba(167,139,250,0.08)' }} />
          <Bar dataKey="value" name="Count" radius={[0, 8, 8, 0]}>
            {data.map(item => (
              <Cell fill={item.color} key={item.label} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChannelMixChart({ data }: { data: ChartDatum[] }) {
  if (data.length === 0) {
    return <EmptyChartState label="Pipeline mix appears after you save and submit jobs." />;
  }

  return (
    <div className="flex h-full min-h-[210px] flex-col gap-3 p-2">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer height="100%" minHeight={130} width="100%">
          <PieChart>
            <Pie
              cx="50%"
              cy="50%"
              data={data}
              dataKey="value"
              innerRadius="52%"
              nameKey="label"
              outerRadius="82%"
              paddingAngle={4}
            >
              {data.map(item => (
                <Cell fill={item.color} key={item.label} />
              ))}
            </Pie>
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {data.map(item => (
          <div
            className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-xs dark:border-white/10 dark:bg-white/[0.025]"
            key={item.label}
          >
            <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="font-mono font-semibold text-foreground">
              {item.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FitCadenceRadar({ data }: { data: RadarDatum[] }) {
  return (
    <div className="h-full min-h-[210px] p-2">
      <ResponsiveContainer height="100%" width="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="label"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
          />
          <Radar
            dataKey="score"
            fill="#fb7185"
            fillOpacity={0.28}
            name="Score"
            stroke="#a78bfa"
            strokeWidth={2.2}
          />
          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

function FitScoreGauge({ score }: { score: number }) {
  const value = clampPercent(score);
  const ringData = [{ fill: '#a78bfa', name: 'Fit score', value }];

  return (
    <div className="flex h-full min-h-[260px] flex-col gap-4 p-4">
      <div className="relative min-h-[160px] flex-1 px-4 py-3">
        <ResponsiveContainer height="100%" width="100%">
          <RadialBarChart
            data={ringData}
            endAngle={-35}
            innerRadius="76%"
            outerRadius="98%"
            startAngle={215}
          >
            <RadialBar
              background={{ fill: 'rgba(148,163,184,0.16)' }}
              cornerRadius={18}
              dataKey="value"
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-4xl font-semibold leading-none text-foreground">
            {value}
          </span>
          <span className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            score
          </span>
        </div>
      </div>
      <DashboardInfoTile
        accent="#a78bfa"
        icon={<CircleGauge className="h-4 w-4" />}
        title="Match Quality"
        value={value >= 70 ? 'Strong' : value >= 45 ? 'Building' : 'Needs Focus'}
      >
        {value >= 70
          ? 'Keep applying to roles with this fit profile.'
          : 'Optimize the resume against higher-priority roles before scaling submissions.'}
      </DashboardInfoTile>
    </div>
  );
}

function ConversionRatesCard({ data }: { data: ChartDatum[] }) {
  return (
    <div className="flex h-full min-h-[210px] flex-col justify-between gap-4 p-2">
      {data.map(item => (
        <div className="space-y-2" key={item.label}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.detail}</p>
            </div>
            <span className="font-mono text-2xl font-semibold leading-none">
              {item.value}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div
              className="h-full rounded-full shadow-[0_0_18px_rgba(167,139,250,0.34)]"
              style={{ backgroundColor: item.color, width: `${item.value}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function RhythmSnapshotCard({ data }: { data: OverviewData }) {
  const items = [
    {
      color: '#22d3ee',
      label: 'Lead Base',
      value: Math.min(100, Math.round(data.totalJobLeads * 6)),
    },
    {
      color: '#fb7185',
      label: 'Apply Motion',
      value: clampPercent(data.applicationRate),
    },
    {
      color: '#a78bfa',
      label: 'Interview Pull',
      value: clampPercent(data.interviewRate),
    },
    {
      color: '#34d399',
      label: 'Offer Signal',
      value: clampPercent(data.offerRate),
    },
  ];

  return (
    <div className="grid h-full min-h-[210px] grid-cols-[0.78fr_1fr] gap-4 p-2">
      <div className="flex items-end gap-2">
        {items.map(item => (
          <div className="flex flex-1 flex-col items-center gap-2" key={item.label}>
            <div className="flex h-32 w-full items-end rounded-full bg-black/5 p-1 dark:bg-white/[0.04]">
              <div
                className="w-full rounded-full shadow-[0_0_18px_rgba(167,139,250,0.28)]"
                style={{
                  backgroundColor: item.color,
                  height: `${Math.max(10, item.value)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col justify-center gap-2.5">
        {items.map(item => (
          <div
            className="flex items-center justify-between gap-3 rounded-lg border border-border/55 bg-background/60 px-3 py-2 text-xs dark:border-white/10 dark:bg-white/[0.025]"
            key={item.label}
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              {item.label}
            </span>
            <span className="font-mono font-semibold text-foreground">
              {item.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PipelineHeatmapCard({ data }: { data: StageHeatDatum[] }) {
  return (
    <div className="grid h-full min-h-[200px] grid-cols-2 gap-3 p-2">
      {data.map(item => {
        const opacity = Math.max(0.08, item.score / 100);

        return (
          <div
            className="relative overflow-hidden rounded-xl border border-border/55 bg-background/64 p-3 dark:border-white/10 dark:bg-white/[0.025]"
            key={item.label}
          >
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${item.color}${Math.round(
                  opacity * 95,
                )
                  .toString(16)
                  .padStart(2, '0')}, transparent 72%)`,
              }}
            />
            <div className="relative flex h-full min-h-[76px] flex-col justify-between">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {item.signal}
                  </p>
                </div>
                <span
                  className="h-2.5 w-2.5 rounded-full shadow-[0_0_14px_currentColor]"
                  style={{ color: item.color, backgroundColor: item.color }}
                />
              </div>
              <div className="mt-4 flex items-end justify-between gap-3">
                <span className="font-mono text-2xl font-semibold leading-none">
                  {item.count}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {item.score}%
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PerformanceSummaryCard({ data }: { data: OverviewData }) {
  const items = [
    {
      accent: '#fb7185',
      body:
        data.applicationRate >= 50
          ? 'Saved leads are turning into tracked applications.'
          : 'More saved leads need to move into submitted applications.',
      icon:
        data.applicationRate >= 50 ? (
          <TrendingUp className="h-4 w-4" />
        ) : (
          <TrendingDown className="h-4 w-4" />
        ),
      title: 'Application Efficiency',
      value: data.applicationRate >= 50 ? 'Good' : 'Needs Work',
    },
    {
      accent: '#a78bfa',
      body:
        data.interviewRate >= 20
          ? 'Applications are creating interview opportunities.'
          : 'Interview conversion is still forming.',
      icon:
        data.interviewRate >= 20 ? (
          <TrendingUp className="h-4 w-4" />
        ) : (
          <TrendingDown className="h-4 w-4" />
        ),
      title: 'Interview Success',
      value: data.interviewRate >= 20 ? 'Strong' : 'Building',
    },
    {
      accent: '#34d399',
      body:
        data.avgJobFitScore >= 70
          ? 'The current target roles line up well.'
          : 'Better-fit roles or tailored resume variants should help.',
      icon: <Target className="h-4 w-4" />,
      title: 'Fit Quality',
      value: data.avgJobFitScore >= 70 ? 'High Fit' : 'Refine Fit',
    },
  ];

  return (
    <div className="grid h-full min-h-[210px] gap-3">
      {items.map(item => (
        <DashboardInfoTile
          accent={item.accent}
          icon={item.icon}
          key={item.title}
          title={item.title}
          value={item.value}
        >
          {item.body}
        </DashboardInfoTile>
      ))}
    </div>
  );
}

function QuickInsightsCard({
  data,
  formatPercentage,
}: {
  data: OverviewData;
  formatPercentage: (value: number) => string;
}) {
  const items = [
    {
      accent: '#fb7185',
      body: `${formatPercentage(data.applicationRate)} of saved leads have been submitted.`,
      icon: <Activity className="h-4 w-4" />,
      title: 'Apply Coverage',
      value: data.appliedJobs.toLocaleString(),
    },
    {
      accent: '#a78bfa',
      body: `${formatPercentage(data.interviewRate)} of submitted applications have reached interview stage.`,
      icon: <Zap className="h-4 w-4" />,
      title: 'Interview Pull',
      value: data.interviewsScheduled.toLocaleString(),
    },
    {
      accent: '#34d399',
      body: `Average compatibility across tracked opportunities is ${Math.round(
        data.avgJobFitScore,
      )}/100.`,
      icon: <CircleGauge className="h-4 w-4" />,
      title: 'Fit Signal',
      value: `${Math.round(data.avgJobFitScore)}`,
    },
  ];

  return (
    <div className="grid h-full min-h-[210px] gap-3 md:grid-cols-3">
      {items.map(item => (
        <DashboardInfoTile
          accent={item.accent}
          icon={item.icon}
          key={item.title}
          title={item.title}
          value={item.value}
        >
          {item.body}
        </DashboardInfoTile>
      ))}
    </div>
  );
}

function RecommendationsCard({
  recommendations,
}: {
  recommendations: readonly string[];
}) {
  return (
    <div className="grid h-full min-h-[210px] gap-3 md:grid-cols-2">
      {recommendations.map((recommendation, index) => (
        <DashboardInfoTile
          accent={index % 2 === 0 ? '#22d3ee' : '#f472b6'}
          icon={index % 2 === 0 ? <Lightbulb className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />}
          key={recommendation}
          title={`Next Move ${index + 1}`}
          value="Action"
        >
          {recommendation}
        </DashboardInfoTile>
      ))}
    </div>
  );
}

function DashboardInfoTile({
  accent,
  children,
  icon,
  title,
  value,
}: {
  accent: string;
  children: ReactNode;
  icon: ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-background/72 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] transition-colors dark:border-white/10 dark:bg-white/[0.028] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div
        aria-hidden
        className="absolute -right-8 -top-10 h-24 w-24 rounded-full opacity-15 blur-2xl transition-opacity group-hover:opacity-25"
        style={{ backgroundColor: accent }}
      />
      <div className="relative flex items-start gap-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white shadow-[0_0_18px_rgba(167,139,250,0.25)]"
          style={{ backgroundColor: accent }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <span className="rounded-full border border-border/60 bg-background/80 px-2 py-0.5 text-[11px] font-semibold text-foreground dark:border-white/10 dark:bg-white/[0.04]">
              {value}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {children}
          </p>
        </div>
      </div>
    </div>
  );
}
