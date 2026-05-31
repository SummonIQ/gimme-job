'use client';

import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { ApplicationStatus } from '@/generated/prisma/browser';
import { cn } from '@/lib/css/tailwind';
import { format } from 'date-fns';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Building,
  CalendarDays,
  CheckCircle,
  Clock,
  Download,
  Filter,
  Gauge,
  RefreshCw,
  Target,
  Timer,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface ApplicationMetrics {
  totalApplications: number;
  successRate: number;
  responseRate: number;
  interviewRate: number;
  offerRate: number;
  averageResponseTime: number;
  averageTimeToFinalOutcome: number;
  statusBreakdown: Record<ApplicationStatus, number>;
  conversionFunnel: ConversionFunnelStep[];
  performanceByPlatform: PlatformMetrics[];
  performanceByAutomation: AutomationMetrics;
  timeSeriesData: TimeSeriesMetric[];
}

interface ConversionFunnelStep {
  stage: string;
  count: number;
  percentage: number;
  averageDaysToReach: number | null;
}

interface PlatformMetrics {
  platform: string;
  applications: number;
  responseRate: number;
  interviewRate: number;
  successRate: number;
}

interface AutomationMetrics {
  automated: {
    total: number;
    responseRate: number;
    successRate: number;
  };
  manual: {
    total: number;
    responseRate: number;
    successRate: number;
  };
}

interface TimeSeriesMetric {
  date: string;
  applications: number;
  responses: number;
  interviews: number;
  offers: number;
}

interface ResponseTimeMetrics {
  avgFirstResponse: number;
  avgInterviewScheduling: number;
  avgOfferDelivery: number;
  fastestResponse: number;
  slowestResponse: number;
  responseTimeDistribution: Array<{
    range: string;
    count: number;
    percentage: number;
  }>;
}

const COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
];
const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: '#3b82f6',
  UNDER_REVIEW: '#06b6d4',
  INTERVIEW_REQUESTED: '#8b5cf6',
  INTERVIEW_SCHEDULED: '#a855f7',
  INTERVIEW_COMPLETED: '#d946ef',
  OFFER_RECEIVED: '#10b981',
  OFFER_ACCEPTED: '#059669',
  REJECTED: '#ef4444',
  NOT_SELECTED: '#f97316',
  WITHDRAWN: '#6b7280',
};

interface ApplicationOutcomesPageProps {
  initialMetrics: ApplicationMetrics;
}

export default function ApplicationOutcomesPage({
  initialMetrics,
}: ApplicationOutcomesPageProps) {
  const [loading, setLoading] = useState(false);
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d' | 'all'>(
    '30d',
  );
  const [activeTab, setActiveTab] = useState('overview');
  const [metrics, setMetrics] = useState<ApplicationMetrics | null>(
    initialMetrics,
  );
  const [responseMetrics, setResponseMetrics] =
    useState<ResponseTimeMetrics | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [metricsRes, responseRes] = await Promise.all([
        fetch(`/api/applications/outcome-metrics?timeframe=${timeframe}`),
        fetch(
          `/api/applications/analytics?type=response-time&timeframe=${timeframe}`,
        ),
      ]);

      const metricsData = await metricsRes.json();
      const responseData = await responseRes.json();

      setMetrics(metricsData);
      setResponseMetrics(responseData);
    } catch (error) {
      console.error('Error fetching outcome data:', error);
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getStatusColor = (status: string) => STATUS_COLORS[status] || '#6b7280';

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 15) return 'text-green-600 bg-green-100';
    if (rate >= 8) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const formatDays = (days: number) => {
    if (days < 1) return '<1 day';
    if (days === 1) return '1 day';
    if (days < 7) return `${Math.round(days)} days`;
    if (days < 30) return `${Math.round(days / 7)} weeks`;
    return `${Math.round(days / 30)} months`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">
            Loading application outcome data...
          </p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No application data available for the selected timeframe.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Page name="application-outcomes">
      <PageHeader
        title="Application Outcome Tracking"
        description="Track success rates, response times, and conversion funnels for your job applications"
        actions={
          <>
            <Select
              value={timeframe}
              onValueChange={(value: any) => setTimeframe(value)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </>
        }
      />
      <PageContent className="space-y-6">
        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Total Applications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics.totalApplications}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {metrics.timeSeriesData.length > 1 && (
                  <>
                    {metrics.timeSeriesData[metrics.timeSeriesData.length - 1]
                      .applications >
                    metrics.timeSeriesData[metrics.timeSeriesData.length - 2]
                      .applications ? (
                      <TrendingUp className="h-3 w-3 inline mr-1 text-green-600" />
                    ) : (
                      <TrendingDown className="h-3 w-3 inline mr-1 text-red-600" />
                    )}
                    vs previous period
                  </>
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  'text-2xl font-bold',
                  getSuccessRateColor(metrics.successRate).split(' ')[0],
                )}
              >
                {metrics.successRate.toFixed(1)}%
              </div>
              <Progress value={metrics.successRate} className="h-2 mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Response Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {metrics.responseRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {responseMetrics &&
                  `Avg ${formatDays(responseMetrics.avgFirstResponse)}`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Interview Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {metrics.interviewRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {Math.round(
                  (metrics.totalApplications * metrics.interviewRate) / 100,
                )}{' '}
                interviews
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Offer Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {metrics.offerRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {Math.round(
                  (metrics.totalApplications * metrics.offerRate) / 100,
                )}{' '}
                offers
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
            <TabsTrigger value="funnel">Conversion Funnel</TabsTrigger>
            <TabsTrigger value="response-time">
              Response Time Analysis
            </TabsTrigger>
            <TabsTrigger value="outcomes">Outcome Distribution</TabsTrigger>
            <TabsTrigger value="platform">Platform Performance</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Success Metrics Comparison */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Key Performance Metrics
                  </CardTitle>
                  <CardDescription>
                    Success rates across different stages
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={[
                        { metric: 'Response', rate: metrics.responseRate },
                        { metric: 'Interview', rate: metrics.interviewRate },
                        { metric: 'Offer', rate: metrics.offerRate },
                        { metric: 'Success', rate: metrics.successRate },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="metric" />
                      <YAxis />
                      <Tooltip
                        formatter={(value: any) => `${value.toFixed(1)}%`}
                      />
                      <Bar dataKey="rate" fill="#3b82f6">
                        <LabelList
                          dataKey="rate"
                          position="top"
                          formatter={(value: any) => `${value.toFixed(1)}%`}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Automation vs Manual Performance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Automated vs Manual Applications
                  </CardTitle>
                  <CardDescription>
                    Performance comparison by submission method
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Automated</span>
                          <Badge variant="outline">
                            {metrics.performanceByAutomation.automated.total}
                          </Badge>
                        </div>
                        <Progress
                          value={
                            metrics.performanceByAutomation.automated
                              .responseRate
                          }
                          className="h-2"
                        />
                        <p className="text-xs text-muted-foreground">
                          {metrics.performanceByAutomation.automated.responseRate.toFixed(
                            1,
                          )}
                          % response rate
                        </p>
                        <p className="text-xs font-medium text-green-600">
                          {metrics.performanceByAutomation.automated.successRate.toFixed(
                            1,
                          )}
                          % success rate
                        </p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Manual</span>
                          <Badge variant="outline">
                            {metrics.performanceByAutomation.manual.total}
                          </Badge>
                        </div>
                        <Progress
                          value={
                            metrics.performanceByAutomation.manual.responseRate
                          }
                          className="h-2"
                        />
                        <p className="text-xs text-muted-foreground">
                          {metrics.performanceByAutomation.manual.responseRate.toFixed(
                            1,
                          )}
                          % response rate
                        </p>
                        <p className="text-xs font-medium text-green-600">
                          {metrics.performanceByAutomation.manual.successRate.toFixed(
                            1,
                          )}
                          % success rate
                        </p>
                      </div>
                    </div>

                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={[
                          {
                            type: 'Automated',
                            responseRate:
                              metrics.performanceByAutomation.automated
                                .responseRate,
                            successRate:
                              metrics.performanceByAutomation.automated
                                .successRate,
                          },
                          {
                            type: 'Manual',
                            responseRate:
                              metrics.performanceByAutomation.manual
                                .responseRate,
                            successRate:
                              metrics.performanceByAutomation.manual
                                .successRate,
                          },
                        ]}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="type" />
                        <YAxis />
                        <Tooltip
                          formatter={(value: any) => `${value.toFixed(1)}%`}
                        />
                        <Bar
                          dataKey="responseRate"
                          fill="#3b82f6"
                          name="Response Rate"
                        />
                        <Bar
                          dataKey="successRate"
                          fill="#10b981"
                          name="Success Rate"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Status Distribution */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Current Status Distribution
                  </CardTitle>
                  <CardDescription>
                    Applications grouped by current status
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={Object.entries(metrics.statusBreakdown).map(
                        ([status, count]) => ({
                          status: status
                            .replace(/_/g, ' ')
                            .toLowerCase()
                            .replace(/\b\w/g, l => l.toUpperCase()),
                          count,
                          percentage: (
                            (count / metrics.totalApplications) *
                            100
                          ).toFixed(1),
                        }),
                      )}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="status"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        interval={0}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload[0]) {
                            return (
                              <div className="bg-background border rounded p-2">
                                <p className="font-medium">
                                  {payload[0].payload.status}
                                </p>
                                <p className="text-sm">
                                  Count: {payload[0].value}
                                </p>
                                <p className="text-sm">
                                  Percentage: {payload[0].payload.percentage}%
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="count" fill="#3b82f6">
                        {Object.keys(metrics.statusBreakdown).map(
                          (status, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={getStatusColor(status)}
                            />
                          ),
                        )}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="funnel" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Application Conversion Funnel
                </CardTitle>
                <CardDescription>
                  Track progression through each stage of the application
                  process
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <FunnelChart>
                    <Tooltip />
                    <Funnel
                      dataKey="count"
                      data={metrics.conversionFunnel.map((step, index) => ({
                        ...step,
                        fill: COLORS[index % COLORS.length],
                      }))}
                      isAnimationActive
                    >
                      <LabelList
                        position="center"
                        content={(props: any) => {
                          const { value, payload } = props;
                          return (
                            <text
                              x={props.x}
                              y={props.y}
                              fill="white"
                              textAnchor="middle"
                              fontSize={12}
                              fontWeight="bold"
                            >
                              <tspan x={props.x} dy="-10">
                                {payload.stage}
                              </tspan>
                              <tspan x={props.x} dy="20">
                                {value} ({payload.percentage.toFixed(1)}%)
                              </tspan>
                              {payload.averageDaysToReach && (
                                <tspan x={props.x} dy="20" fontSize={10}>
                                  ~{formatDays(payload.averageDaysToReach)}
                                </tspan>
                              )}
                            </text>
                          );
                        }}
                      />
                    </Funnel>
                  </FunnelChart>
                </ResponsiveContainer>

                <div className="mt-6 space-y-2">
                  {metrics.conversionFunnel.map((step, index) => (
                    <div
                      key={step.stage}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded"
                          style={{
                            backgroundColor: COLORS[index % COLORS.length],
                          }}
                        />
                        <div>
                          <p className="font-medium">{step.stage}</p>
                          {step.averageDaysToReach && (
                            <p className="text-sm text-muted-foreground">
                              Avg. time to reach:{' '}
                              {formatDays(step.averageDaysToReach)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{step.count} applications</p>
                        <p className="text-sm text-muted-foreground">
                          {step.percentage.toFixed(1)}% of total
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="response-time" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Response Time Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Timer className="h-5 w-5" />
                    Response Time Metrics
                  </CardTitle>
                  <CardDescription>
                    Average time to receive responses
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {responseMetrics && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            First Response
                          </p>
                          <p className="text-2xl font-bold">
                            {formatDays(responseMetrics.avgFirstResponse)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Interview Scheduling
                          </p>
                          <p className="text-2xl font-bold">
                            {formatDays(responseMetrics.avgInterviewScheduling)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Offer Delivery
                          </p>
                          <p className="text-2xl font-bold">
                            {formatDays(responseMetrics.avgOfferDelivery)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Range</p>
                          <p className="text-lg font-bold">
                            {formatDays(responseMetrics.fastestResponse)} -{' '}
                            {formatDays(responseMetrics.slowestResponse)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Response Time Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5" />
                    Response Time Distribution
                  </CardTitle>
                  <CardDescription>
                    How quickly companies typically respond
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {responseMetrics && (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={responseMetrics.responseTimeDistribution}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="range" />
                        <YAxis />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload[0]) {
                              return (
                                <div className="bg-background border rounded p-2">
                                  <p className="font-medium">
                                    {payload[0].payload.range}
                                  </p>
                                  <p className="text-sm">
                                    {payload[0].value} applications
                                  </p>
                                  <p className="text-sm">
                                    {payload[0].payload.percentage}% of
                                    responses
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="count" fill="#3b82f6">
                          <LabelList
                            dataKey="percentage"
                            position="top"
                            formatter={(value: any) => `${value}%`}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Time to Final Outcome */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Average Time to Final Outcome
                </CardTitle>
                <CardDescription>
                  How long it takes to reach a final decision
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <Gauge className="h-12 w-12 mx-auto mb-2 text-blue-600" />
                    <p className="text-sm text-muted-foreground">
                      Overall Average
                    </p>
                    <p className="text-2xl font-bold">
                      {formatDays(metrics.averageTimeToFinalOutcome)}
                    </p>
                  </div>
                  <div className="text-center">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-600" />
                    <p className="text-sm text-muted-foreground">
                      Successful Applications
                    </p>
                    <p className="text-2xl font-bold">
                      {formatDays(metrics.averageTimeToFinalOutcome * 0.8)}
                    </p>
                  </div>
                  <div className="text-center">
                    <XCircle className="h-12 w-12 mx-auto mb-2 text-red-600" />
                    <p className="text-sm text-muted-foreground">
                      Rejected Applications
                    </p>
                    <p className="text-2xl font-bold">
                      {formatDays(metrics.averageTimeToFinalOutcome * 1.2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="outcomes" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Outcome Distribution Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Final Outcome Distribution</CardTitle>
                  <CardDescription>
                    Breakdown of application final outcomes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          {
                            name: 'Offers Accepted',
                            value: metrics.statusBreakdown.OFFER_ACCEPTED || 0,
                          },
                          {
                            name: 'Offers Received',
                            value: metrics.statusBreakdown.OFFER_RECEIVED || 0,
                          },
                          {
                            name: 'Rejected',
                            value: metrics.statusBreakdown.REJECTED || 0,
                          },
                          {
                            name: 'Not Selected',
                            value: metrics.statusBreakdown.NOT_SELECTED || 0,
                          },
                          {
                            name: 'Withdrawn',
                            value: metrics.statusBreakdown.WITHDRAWN || 0,
                          },
                          {
                            name: 'In Progress',
                            value:
                              (metrics.statusBreakdown.UNDER_REVIEW || 0) +
                              (metrics.statusBreakdown.INTERVIEW_SCHEDULED ||
                                0) +
                              (metrics.statusBreakdown.INTERVIEW_COMPLETED ||
                                0),
                          },
                        ].filter(item => item.value > 0)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }: any) =>
                          `${name}: ${(percent * 100).toFixed(0)}%`
                        }
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {[
                          {
                            name: 'Offers Accepted',
                            value: metrics.statusBreakdown.OFFER_ACCEPTED || 0,
                          },
                          {
                            name: 'Offers Received',
                            value: metrics.statusBreakdown.OFFER_RECEIVED || 0,
                          },
                          {
                            name: 'Rejected',
                            value: metrics.statusBreakdown.REJECTED || 0,
                          },
                          {
                            name: 'Not Selected',
                            value: metrics.statusBreakdown.NOT_SELECTED || 0,
                          },
                          {
                            name: 'Withdrawn',
                            value: metrics.statusBreakdown.WITHDRAWN || 0,
                          },
                          {
                            name: 'In Progress',
                            value:
                              (metrics.statusBreakdown.UNDER_REVIEW || 0) +
                              (metrics.statusBreakdown.INTERVIEW_SCHEDULED ||
                                0) +
                              (metrics.statusBreakdown.INTERVIEW_COMPLETED ||
                                0),
                          },
                        ]
                          .filter(item => item.value > 0)
                          .map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Success vs Rejection Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle>Success vs Rejection Analysis</CardTitle>
                  <CardDescription>
                    Understanding outcome patterns
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="font-medium">Positive Outcomes</span>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-600">
                          {(metrics.statusBreakdown.OFFER_ACCEPTED || 0) +
                            (metrics.statusBreakdown.OFFER_RECEIVED || 0) +
                            (metrics.statusBreakdown.INTERVIEW_COMPLETED || 0)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {(
                            (((metrics.statusBreakdown.OFFER_ACCEPTED || 0) +
                              (metrics.statusBreakdown.OFFER_RECEIVED || 0) +
                              (metrics.statusBreakdown.INTERVIEW_COMPLETED ||
                                0)) /
                              metrics.totalApplications) *
                            100
                          ).toFixed(1)}
                          % of total
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-5 w-5 text-red-600" />
                        <span className="font-medium">Negative Outcomes</span>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-red-600">
                          {(metrics.statusBreakdown.REJECTED || 0) +
                            (metrics.statusBreakdown.NOT_SELECTED || 0)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {(
                            (((metrics.statusBreakdown.REJECTED || 0) +
                              (metrics.statusBreakdown.NOT_SELECTED || 0)) /
                              metrics.totalApplications) *
                            100
                          ).toFixed(1)}
                          % of total
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                        <span className="font-medium">In Progress</span>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-yellow-600">
                          {(metrics.statusBreakdown.PENDING || 0) +
                            (metrics.statusBreakdown.SUBMITTED || 0) +
                            (metrics.statusBreakdown.UNDER_REVIEW || 0) +
                            (metrics.statusBreakdown.INTERVIEW_REQUESTED || 0) +
                            (metrics.statusBreakdown.INTERVIEW_SCHEDULED || 0)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {(
                            (((metrics.statusBreakdown.PENDING || 0) +
                              (metrics.statusBreakdown.SUBMITTED || 0) +
                              (metrics.statusBreakdown.UNDER_REVIEW || 0) +
                              (metrics.statusBreakdown.INTERVIEW_REQUESTED ||
                                0) +
                              (metrics.statusBreakdown.INTERVIEW_SCHEDULED ||
                                0)) /
                              metrics.totalApplications) *
                            100
                          ).toFixed(1)}
                          % of total
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="platform" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Platform Performance Comparison
                </CardTitle>
                <CardDescription>
                  Success rates across different job platforms
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={metrics.performanceByPlatform}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="platform"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis />
                    <Tooltip
                      formatter={(value: any) => `${value.toFixed(1)}%`}
                    />
                    <Bar
                      dataKey="responseRate"
                      fill="#3b82f6"
                      name="Response Rate"
                    />
                    <Bar
                      dataKey="interviewRate"
                      fill="#8b5cf6"
                      name="Interview Rate"
                    />
                    <Bar
                      dataKey="successRate"
                      fill="#10b981"
                      name="Success Rate"
                    />
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-6 space-y-3">
                  {metrics.performanceByPlatform.map(platform => (
                    <div
                      key={platform.platform}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div>
                        <p className="font-medium">{platform.platform}</p>
                        <p className="text-sm text-muted-foreground">
                          {platform.applications} applications
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            Response
                          </p>
                          <p className="font-medium">
                            {platform.responseRate.toFixed(1)}%
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            Interview
                          </p>
                          <p className="font-medium">
                            {platform.interviewRate.toFixed(1)}%
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            Success
                          </p>
                          <p className="font-medium text-green-600">
                            {platform.successRate.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Application Trends Over Time
                </CardTitle>
                <CardDescription>
                  Track how your application outcomes change over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={metrics.timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={date => format(new Date(date), 'MMM d')}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={date =>
                        format(new Date(date), 'MMM d, yyyy')
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="applications"
                      stackId="1"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.6}
                      name="Applications"
                    />
                    <Area
                      type="monotone"
                      dataKey="responses"
                      stackId="2"
                      stroke="#8b5cf6"
                      fill="#8b5cf6"
                      fillOpacity={0.6}
                      name="Responses"
                    />
                    <Area
                      type="monotone"
                      dataKey="interviews"
                      stackId="3"
                      stroke="#f59e0b"
                      fill="#f59e0b"
                      fillOpacity={0.6}
                      name="Interviews"
                    />
                    <Area
                      type="monotone"
                      dataKey="offers"
                      stackId="4"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.6}
                      name="Offers"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </PageContent>
    </Page>
  );
}
