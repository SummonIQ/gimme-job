'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  Activity,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { AutomationMetrics } from '@/lib/automation/analytics';
import { AutomationTimingHeatmap } from './automation-timing-heatmap';

const PLATFORM_COLORS = {
  LinkedIn: '#0A66C2',
  Indeed: '#003A9B',
  Glassdoor: '#0CAA41',
  ZipRecruiter: '#193028',
  Other: '#6B7280',
};

export function AutomationAnalyticsDashboard() {
  const [metrics, setMetrics] = useState<AutomationMetrics | null>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<'day' | 'week' | 'month'>('week');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchMetrics();
    fetchHistoricalData();
    // Refresh every 5 minutes
    const interval = setInterval(
      () => {
        fetchMetrics();
      },
      5 * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, [dateRange]);

  const fetchMetrics = async () => {
    try {
      const response = await fetch(
        `/api/automation/analytics?range=${dateRange}`,
      );
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchHistoricalData = async () => {
    try {
      const response = await fetch('/api/automation/analytics/history');
      if (response.ok) {
        const data = await response.json();
        setHistoricalData(data);
      }
    } catch (error) {
      console.error('Error fetching historical data:', error);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMetrics();
  };

  const handleExport = async () => {
    try {
      const response = await fetch(
        `/api/automation/analytics/export?range=${dateRange}`,
      );
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `automation-analytics-${dateRange}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Report exported successfully');
      }
    } catch (error) {
      console.error('Error exporting report:', error);
      toast.error('Failed to export report');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Loading Analytics...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!metrics) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No Data Available</AlertTitle>
        <AlertDescription>
          Start automating applications to see analytics data.
        </AlertDescription>
      </Alert>
    );
  }

  const totalApplications = metrics.totalAutomated + metrics.totalManual;
  const automationRate =
    totalApplications > 0
      ? (metrics.totalAutomated / totalApplications) * 100
      : 0;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-end gap-2">
        <Tabs value={dateRange} onValueChange={v => setDateRange(v as any)}>
          <TabsList>
            <TabsTrigger value="day">Today</TabsTrigger>
            <TabsTrigger value="week">This Week</TabsTrigger>
            <TabsTrigger value="month">This Month</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Alerts */}
      {metrics.alerts.length > 0 && (
        <div className="space-y-2">
          {metrics.alerts.map(alert => (
            <Alert
              key={alert.id}
              variant={alert.type === 'error' ? 'destructive' : 'default'}
            >
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{alert.title}</AlertTitle>
              <AlertDescription>{alert.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Total Automated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalAutomated}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {automationRate.toFixed(1)}% automation rate
            </p>
            <Progress value={automationRate} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {metrics.successRate.toFixed(1)}%
              {metrics.successRate > 80 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.platformBreakdown.length} platforms active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Time Saved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {metrics.roiMetrics.totalTimeSaved.toFixed(1)}h
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ~{metrics.roiMetrics.averageTimePerManualApplication}min per
              manual app
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Processing Speed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.averageProcessingTime.toFixed(1)}min
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Average per application
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Platform Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Performance</CardTitle>
          <CardDescription>
            Success rates and submission volumes by platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.platformBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="platform" />
                <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                <Tooltip />
                <Legend />
                <Bar
                  yAxisId="left"
                  dataKey="totalSubmissions"
                  fill="#8884d8"
                  name="Submissions"
                />
                <Bar
                  yAxisId="right"
                  dataKey="successRate"
                  fill="#82ca9d"
                  name="Success Rate %"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Historical Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Historical Trends</CardTitle>
          <CardDescription>
            Weekly application volume and success rates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historicalData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="total"
                  stroke="#8884d8"
                  name="Total Applications"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="successRate"
                  stroke="#82ca9d"
                  name="Success Rate %"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Timing Heatmap */}
      {metrics.timeBreakdown.length > 0 && (
        <AutomationTimingHeatmap data={metrics.timeBreakdown} />
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest automated application submissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics.recentActivity.map(activity => (
              <div
                key={activity.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <h4 className="font-medium">{activity.jobTitle}</h4>
                  <p className="text-sm text-muted-foreground">
                    {activity.companyName} · {activity.platform}
                  </p>
                  {activity.submittedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(activity.submittedAt), 'MMM d, h:mm a')}
                      {activity.processingTime &&
                        ` · ${activity.processingTime}min`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {activity.status === 'SUBMITTED' && (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Submitted
                    </Badge>
                  )}
                  {activity.status === 'FAILED' && (
                    <Badge variant="destructive">
                      <XCircle className="mr-1 h-3 w-3" />
                      Failed
                    </Badge>
                  )}
                  {activity.status === 'PENDING' && (
                    <Badge variant="secondary">
                      <Clock className="mr-1 h-3 w-3" />
                      Pending
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ROI Summary */}
      <Card>
        <CardHeader>
          <CardTitle>ROI Summary</CardTitle>
          <CardDescription>
            Return on investment from automation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <Activity className="h-8 w-8 mx-auto mb-2 text-blue-500" />
              <p className="text-2xl font-bold">
                {metrics.roiMetrics.applicationsPerHour.toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">Apps/Hour</p>
            </div>
            <div className="text-center">
              <Clock className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold">
                {metrics.roiMetrics.totalTimeSaved.toFixed(0)}
              </p>
              <p className="text-sm text-muted-foreground">Hours Saved</p>
            </div>
            <div className="text-center">
              <DollarSign className="h-8 w-8 mx-auto mb-2 text-purple-500" />
              <p className="text-2xl font-bold">
                ${(metrics.roiMetrics.totalTimeSaved * 25).toFixed(0)}
              </p>
              <p className="text-sm text-muted-foreground">Value @ $25/hr</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
