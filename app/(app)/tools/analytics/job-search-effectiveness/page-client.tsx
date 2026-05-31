'use client';

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
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  Activity,
  AlertTriangle,
  Award,
  Clock,
  Lightbulb,
  PieChart as PieChartIcon,
  RefreshCw,
  Search,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface SearchStrategyMetrics {
  strategy: string;
  totalSearches: number;
  totalJobsFound: number;
  totalApplications: number;
  successfulApplications: number;
  successRate: number;
  averageJobsPerSearch: number;
  averageTimeToApplication: number;
  topKeywords: Array<{
    keyword: string;
    frequency: number;
    successRate: number;
  }>;
  platforms: Array<{ platform: string; usage: number; successRate: number }>;
  effectiveness: 'high' | 'medium' | 'low';
}

interface ApplicationTimingMetrics {
  timeSlot: string;
  totalApplications: number;
  successfulApplications: number;
  successRate: number;
  averageResponseTime: number;
  platforms: Record<string, { applications: number; successRate: number }>;
  recommendation: 'optimal' | 'good' | 'suboptimal';
}

interface PlatformROIMetrics {
  platform: string;
  totalSearches: number;
  totalJobsFound: number;
  qualityScore: number;
  totalApplications: number;
  successfulApplications: number;
  successRate: number;
  averageTimeInvested: number;
  roi: number;
  costEffectiveness: 'excellent' | 'good' | 'fair' | 'poor';
  trends: {
    searchVolumeTrend: 'increasing' | 'stable' | 'decreasing';
    successRateTrend: 'improving' | 'stable' | 'declining';
  };
}

interface KeywordPerformanceMetrics {
  keyword: string;
  searchFrequency: number;
  totalJobsFound: number;
  relevantJobsFound: number;
  relevanceScore: number;
  totalApplications: number;
  successfulApplications: number;
  successRate: number;
  platforms: Record<string, { searches: number; jobsFound: number }>;
  relatedKeywords: string[];
  optimization: 'expand' | 'revise' | 'maintain' | 'replace';
}

import { Page, PageContent, PageHeader } from '@/components/layout/page';
import {
  areaStyle,
  axisStyle,
  barStyle,
  CHART_COLORS,
  gridStyle,
  tooltipStyle,
} from '@/lib/charts/theme';

const COLORS = CHART_COLORS;

interface JobSearchEffectivenessPageProps {
  initialData: {
    strategies: SearchStrategyMetrics[];
    timing: ApplicationTimingMetrics[];
    platforms: PlatformROIMetrics[];
    keywords: KeywordPerformanceMetrics[];
    dateRange: { start: string; end: string };
  };
}

export default function JobSearchEffectivenessPage({
  initialData,
}: JobSearchEffectivenessPageProps) {
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<'week' | 'month'>('month');
  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState<{
    strategies: SearchStrategyMetrics[];
    timing: ApplicationTimingMetrics[];
    platforms: PlatformROIMetrics[];
    keywords: KeywordPerformanceMetrics[];
    dateRange: { start: string; end: string };
  } | null>(initialData);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/analytics/job-search-effectiveness?type=overview&period=${period}`,
      );
      const result = await response.json();
      setData(result.overview ? result.overview : result);
    } catch (error) {
      console.error('Error fetching effectiveness data:', error);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getEffectivenessColor = (effectiveness: string) => {
    switch (effectiveness) {
      case 'high':
        return 'text-green-600 bg-green-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'optimal':
        return 'text-green-600 bg-green-100';
      case 'good':
        return 'text-blue-600 bg-blue-100';
      case 'suboptimal':
        return 'text-orange-600 bg-orange-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
      case 'increasing':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'declining':
      case 'decreasing':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">
            Analyzing job search effectiveness...
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>No Data Available</AlertTitle>
        <AlertDescription>
          We need more job search and application data to generate effectiveness
          insights.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Page name="job-search-effectiveness">
      <PageHeader
        title="Job Search Effectiveness"
        description="Analyze and optimize your job search strategy with data-driven insights"
        actions={
          <>
            <Select
              value={period}
              onValueChange={(value: 'week' | 'month') => setPeriod(value)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </>
        }
      />
      <PageContent className="space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Total Strategies
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.strategies.length}</div>
              <div className="flex items-center mt-2">
                <Badge
                  className={getEffectivenessColor(
                    data.strategies[0]?.effectiveness || 'low',
                  )}
                >
                  {data.strategies[0]?.effectiveness || 'N/A'} performing
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Best Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {data.strategies[0]?.successRate?.toFixed(1) || 0}%
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {data.strategies[0]?.strategy || 'No data'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Optimal Time Slots
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {data.timing.filter(t => t.recommendation === 'optimal').length}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Peak application times identified
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Top Platform ROI
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {data.platforms[0]?.roi?.toFixed(1) || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {data.platforms[0]?.platform || 'No data'}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="strategies">Search Strategies</TabsTrigger>
            <TabsTrigger value="timing">Application Timing</TabsTrigger>
            <TabsTrigger value="platforms">Platform ROI</TabsTrigger>
            <TabsTrigger value="keywords">Keyword Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Strategy Effectiveness Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Strategy Effectiveness
                  </CardTitle>
                  <CardDescription>
                    Success rates across different search approaches
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.strategies.slice(0, 5)}>
                      <CartesianGrid {...gridStyle} />
                      <XAxis
                        dataKey="strategy"
                        tick={{ fontSize: 12, ...axisStyle.tick }}
                        interval={0}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        axisLine={axisStyle.axisLine}
                        tickLine={axisStyle.tickLine}
                      />
                      <YAxis {...axisStyle} />
                      <Tooltip contentStyle={tooltipStyle.contentStyle} />
                      <Bar
                        dataKey="successRate"
                        fill="#3b82f6"
                        name="Success Rate %"
                        radius={barStyle.radius}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Platform Performance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5" />
                    Platform ROI Distribution
                  </CardTitle>
                  <CardDescription>
                    Return on investment across job platforms
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={data.platforms.slice(0, 6) as any}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="roi"
                        label={({ platform, roi }: any) =>
                          `${platform}: ${roi.toFixed(1)}`
                        }
                      >
                        {data.platforms.slice(0, 6).map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                            stroke="hsl(var(--background))"
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle.contentStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Application Timing Heatmap */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Optimal Application Times
                  </CardTitle>
                  <CardDescription>
                    Success rates by application timing
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={data.timing.slice(0, 8)}>
                      <CartesianGrid {...gridStyle} />
                      <XAxis
                        dataKey="timeSlot"
                        tick={{ fontSize: 12, ...axisStyle.tick }}
                        interval={0}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        axisLine={axisStyle.axisLine}
                        tickLine={axisStyle.tickLine}
                      />
                      <YAxis {...axisStyle} />
                      <Tooltip contentStyle={tooltipStyle.contentStyle} />
                      <Area
                        type="monotone"
                        dataKey="successRate"
                        stroke="#10b981"
                        fill="#10b981"
                        fillOpacity={areaStyle.fillOpacity}
                        name="Success Rate %"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Top Keywords Performance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    Top Performing Keywords
                  </CardTitle>
                  <CardDescription>
                    Keywords with highest success rates
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.keywords.slice(0, 6).map((keyword, index) => (
                      <div
                        key={keyword.keyword}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium',
                              index === 0
                                ? 'bg-yellow-500'
                                : index === 1
                                  ? 'bg-gray-400'
                                  : index === 2
                                    ? 'bg-orange-600'
                                    : 'bg-blue-500',
                            )}
                          >
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{keyword.keyword}</p>
                            <p className="text-sm text-muted-foreground">
                              Used {keyword.searchFrequency} times
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-green-600">
                            {keyword.successRate.toFixed(1)}%
                          </p>
                          <Badge
                            className={cn(
                              'text-xs',
                              keyword.optimization === 'expand'
                                ? 'bg-green-100 text-green-800'
                                : keyword.optimization === 'maintain'
                                  ? 'bg-blue-100 text-blue-800'
                                  : keyword.optimization === 'revise'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800',
                            )}
                          >
                            {keyword.optimization}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="strategies" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {data.strategies.map((strategy, index) => (
                <Card key={strategy.strategy} className="relative">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {strategy.strategy}
                      </CardTitle>
                      <Badge
                        className={getEffectivenessColor(
                          strategy.effectiveness,
                        )}
                      >
                        {strategy.effectiveness}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total Searches</p>
                        <p className="font-medium">{strategy.totalSearches}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Jobs Found</p>
                        <p className="font-medium">{strategy.totalJobsFound}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Applications</p>
                        <p className="font-medium">
                          {strategy.totalApplications}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Success Rate</p>
                        <p className="font-medium text-green-600">
                          {strategy.successRate.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-2">Top Keywords</p>
                      <div className="flex flex-wrap gap-1">
                        {strategy.topKeywords.slice(0, 4).map(keyword => (
                          <Badge
                            key={keyword.keyword}
                            variant="outline"
                            className="text-xs"
                          >
                            {keyword.keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-2">Platform Usage</p>
                      <div className="space-y-2">
                        {strategy.platforms.slice(0, 3).map(platform => (
                          <div
                            key={platform.platform}
                            className="flex items-center justify-between text-sm"
                          >
                            <span>{platform.platform}</span>
                            <span className="text-muted-foreground">
                              {platform.usage} jobs
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="timing" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {data.timing.map(timing => (
                <Card key={timing.timeSlot}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {timing.timeSlot}
                      </CardTitle>
                      <Badge
                        className={getRecommendationColor(
                          timing.recommendation,
                        )}
                      >
                        {timing.recommendation}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Applications</p>
                        <p className="font-medium">
                          {timing.totalApplications}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Success Rate</p>
                        <p className="font-medium text-green-600">
                          {timing.successRate.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Successful</p>
                        <p className="font-medium">
                          {timing.successfulApplications}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Avg Response</p>
                        <p className="font-medium">
                          {timing.averageResponseTime.toFixed(1)} days
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-2">Success Rate</p>
                      <Progress value={timing.successRate} className="h-2" />
                    </div>

                    {timing.recommendation === 'optimal' && (
                      <Alert>
                        <Lightbulb className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          Optimal time slot! Consider scheduling more
                          applications during this period.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="platforms" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {data.platforms.map(platform => (
                <Card key={platform.platform}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {platform.platform}
                      </CardTitle>
                      <Badge
                        className={cn(
                          platform.costEffectiveness === 'excellent'
                            ? 'bg-green-100 text-green-800'
                            : platform.costEffectiveness === 'good'
                              ? 'bg-blue-100 text-blue-800'
                              : platform.costEffectiveness === 'fair'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800',
                        )}
                      >
                        {platform.costEffectiveness}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total Searches</p>
                        <p className="font-medium">{platform.totalSearches}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Jobs Found</p>
                        <p className="font-medium">{platform.totalJobsFound}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Applications</p>
                        <p className="font-medium">
                          {platform.totalApplications}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Success Rate</p>
                        <p className="font-medium text-green-600">
                          {platform.successRate.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Time Invested</p>
                        <p className="font-medium">
                          {platform.averageTimeInvested.toFixed(1)}h
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">ROI</p>
                        <p className="font-medium text-purple-600">
                          {platform.roi.toFixed(1)}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-2">Quality Score</p>
                      <Progress value={platform.qualityScore} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {platform.qualityScore.toFixed(1)}/100
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span>Search Volume</span>
                        {getTrendIcon(platform.trends.searchVolumeTrend)}
                      </div>
                      <div className="flex items-center gap-2">
                        <span>Success Rate</span>
                        {getTrendIcon(platform.trends.successRateTrend)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="keywords" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {data.keywords.map(keyword => (
                <Card key={keyword.keyword}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {keyword.keyword}
                      </CardTitle>
                      <Badge
                        className={cn(
                          keyword.optimization === 'expand'
                            ? 'bg-green-100 text-green-800'
                            : keyword.optimization === 'maintain'
                              ? 'bg-blue-100 text-blue-800'
                              : keyword.optimization === 'revise'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800',
                        )}
                      >
                        {keyword.optimization}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">
                          Search Frequency
                        </p>
                        <p className="font-medium">{keyword.searchFrequency}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Jobs Found</p>
                        <p className="font-medium">{keyword.totalJobsFound}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Relevance Score</p>
                        <p className="font-medium">
                          {keyword.relevanceScore.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Success Rate</p>
                        <p className="font-medium text-green-600">
                          {keyword.successRate.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-2">
                        Relevance Score
                      </p>
                      <Progress
                        value={keyword.relevanceScore}
                        className="h-2"
                      />
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-2">
                        Related Keywords
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {keyword.relatedKeywords.slice(0, 3).map(related => (
                          <Badge
                            key={related}
                            variant="outline"
                            className="text-xs"
                          >
                            {related}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {keyword.optimization === 'expand' && (
                      <Alert>
                        <Award className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          High-performing keyword! Consider using in more
                          searches.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </PageContent>
    </Page>
  );
}
