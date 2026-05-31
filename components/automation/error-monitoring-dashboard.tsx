'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  Info,
  Shield,
  Zap,
  Clock,
} from 'lucide-react';
import { format, subDays, eachDayOfInterval } from 'date-fns';
import { cn } from '@/lib/utils';

interface ErrorMetrics {
  totalErrors: number;
  resolvedErrors: number;
  pendingErrors: number;
  criticalErrors: number;
  errorsByCategory: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  errorTrend: Array<{ date: string; count: number }>;
  resolutionRate: number;
  averageResolutionTime: number;
  platformErrors: Record<string, number>;
  recentAlerts: Array<{
    id: string;
    type: string;
    message: string;
    timestamp: string;
  }>;
}

const SEVERITY_COLORS = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#16a34a',
};

const CATEGORY_COLORS = {
  temporary: '#3b82f6',
  permanent: '#dc2626',
  auth: '#8b5cf6',
  validation: '#f59e0b',
  platform: '#10b981',
  unknown: '#6b7280',
};

export function ErrorMonitoringDashboard() {
  const [metrics, setMetrics] = useState<ErrorMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [timeRange]);

  const fetchMetrics = async () => {
    try {
      // Fetch error statistics
      const statsRes = await fetch('/api/automation/errors/statistics');
      const stats = await statsRes.json();

      // Fetch error logs for trend analysis
      const logsRes = await fetch(`/api/automation/errors?range=${timeRange}`);
      const logs = await logsRes.json();

      // Calculate error trend
      const endDate = new Date();
      const startDate =
        timeRange === '24h'
          ? subDays(endDate, 1)
          : timeRange === '7d'
            ? subDays(endDate, 7)
            : subDays(endDate, 30);

      const days = eachDayOfInterval({ start: startDate, end: endDate });
      const errorTrend = days.map(day => {
        const dayErrors = logs.errors.filter((e: any) => {
          const errorDate = new Date(e.timestamp);
          return errorDate.toDateString() === day.toDateString();
        });
        return {
          date: format(day, 'MMM dd'),
          count: dayErrors.length,
        };
      });

      // Calculate platform-specific errors
      const platformErrors: Record<string, number> = {};
      logs.errors.forEach((error: any) => {
        if (error.platform) {
          platformErrors[error.platform] =
            (platformErrors[error.platform] || 0) + 1;
        }
      });

      // Fetch recent alerts
      const alertsRes = await fetch('/api/automation/errors/alerts');
      const alerts = await alertsRes.json().catch(() => ({ alerts: [] }));

      setMetrics({
        totalErrors: stats.totalErrors || 0,
        resolvedErrors: logs.errors.filter((e: any) => e.resolved).length,
        pendingErrors: logs.errors.filter((e: any) => !e.resolved).length,
        criticalErrors: stats.errorsBySeverity?.critical || 0,
        errorsByCategory: stats.errorsByCategory || {},
        errorsBySeverity: stats.errorsBySeverity || {},
        errorTrend,
        resolutionRate: stats.resolutionRate || 0,
        averageResolutionTime: stats.averageResolutionTime || 0,
        platformErrors,
        recentAlerts: alerts.alerts || [],
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Activity className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No Data Available</AlertTitle>
        <AlertDescription>
          Unable to load monitoring metrics. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  const healthScore = calculateHealthScore(metrics);

  return (
    <div className="space-y-6">
      {/* System Health Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>System Health</span>
            <Badge
              variant={
                healthScore >= 80
                  ? 'default'
                  : healthScore >= 60
                    ? 'secondary'
                    : 'destructive'
              }
              className="text-lg px-3 py-1"
            >
              {healthScore}%
            </Badge>
          </CardTitle>
          <CardDescription>
            Overall automation system health status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={healthScore} className="h-3" />
            <div className="grid grid-cols-4 gap-4">
              <MetricCard
                icon={<AlertCircle className="h-4 w-4" />}
                label="Total Errors"
                value={metrics.totalErrors}
                trend={metrics.totalErrors > 0 ? 'up' : 'stable'}
                color="text-red-600"
              />
              <MetricCard
                icon={<CheckCircle className="h-4 w-4" />}
                label="Resolved"
                value={metrics.resolvedErrors}
                trend="stable"
                color="text-green-600"
              />
              <MetricCard
                icon={<Clock className="h-4 w-4" />}
                label="Pending"
                value={metrics.pendingErrors}
                trend={metrics.pendingErrors > 5 ? 'up' : 'stable'}
                color="text-yellow-600"
              />
              <MetricCard
                icon={<AlertTriangle className="h-4 w-4" />}
                label="Critical"
                value={metrics.criticalErrors}
                trend={metrics.criticalErrors > 0 ? 'up' : 'stable'}
                color="text-red-700"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical Alerts */}
      {metrics.criticalErrors > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Critical Errors Detected</AlertTitle>
          <AlertDescription>
            {metrics.criticalErrors} critical error(s) require immediate
            attention. Review the error dashboard for details.
          </AlertDescription>
        </Alert>
      )}

      {/* Error Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Error Trend</CardTitle>
          <CardDescription>Error occurrence over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={metrics.errorTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#dc2626"
                fill="#dc2626"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        {/* Error by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Errors by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={Object.entries(metrics.errorsByCategory).map(
                    ([name, value]) => ({
                      name,
                      value,
                    }),
                  )}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label
                >
                  {Object.keys(metrics.errorsByCategory).map(
                    (category, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          CATEGORY_COLORS[
                            category as keyof typeof CATEGORY_COLORS
                          ] || '#8884d8'
                        }
                      />
                    ),
                  )}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Error by Severity */}
        <Card>
          <CardHeader>
            <CardTitle>Errors by Severity</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={Object.entries(metrics.errorsBySeverity).map(
                  ([severity, count]) => ({
                    severity,
                    count,
                  }),
                )}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="severity" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count">
                  {Object.keys(metrics.errorsBySeverity).map(
                    (severity, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          SEVERITY_COLORS[
                            severity as keyof typeof SEVERITY_COLORS
                          ] || '#8884d8'
                        }
                      />
                    ),
                  )}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Platform-specific Errors */}
      {Object.keys(metrics.platformErrors).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Platform Error Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(metrics.platformErrors).map(
                ([platform, count]) => (
                  <div
                    key={platform}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{platform}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {count} errors
                      </span>
                      <Progress
                        value={(count / metrics.totalErrors) * 100}
                        className="w-32 h-2"
                      />
                    </div>
                  </div>
                ),
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Metrics */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Resolution Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-muted-foreground">
                    Resolution Rate
                  </span>
                  <span className="text-sm font-medium">
                    {metrics.resolutionRate.toFixed(1)}%
                  </span>
                </div>
                <Progress value={metrics.resolutionRate} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Avg. Resolution Time
                  </span>
                  <span className="text-sm font-medium">
                    {metrics.averageResolutionTime.toFixed(0)} min
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <StatusIndicator
                label="Error Handler"
                status="operational"
                icon={<Shield className="h-4 w-4" />}
              />
              <StatusIndicator
                label="Auto Recovery"
                status={
                  metrics.resolutionRate > 50 ? 'operational' : 'degraded'
                }
                icon={<Zap className="h-4 w-4" />}
              />
              <StatusIndicator
                label="Monitoring"
                status="operational"
                icon={<Activity className="h-4 w-4" />}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  trend,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  trend: 'up' | 'down' | 'stable';
  color: string;
}) {
  return (
    <div className="p-4 border rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className={cn('', color)}>{icon}</span>
        {trend === 'up' && <TrendingUp className="h-3 w-3 text-red-500" />}
        {trend === 'down' && (
          <TrendingDown className="h-3 w-3 text-green-500" />
        )}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function StatusIndicator({
  label,
  status,
  icon,
}: {
  label: string;
  status: 'operational' | 'degraded' | 'down';
  icon: React.ReactNode;
}) {
  const statusColor = {
    operational: 'text-green-600 bg-green-50',
    degraded: 'text-yellow-600 bg-yellow-50',
    down: 'text-red-600 bg-red-50',
  }[status];

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <Badge className={cn('text-xs', statusColor)}>{status}</Badge>
    </div>
  );
}

function calculateHealthScore(metrics: ErrorMetrics): number {
  let score = 100;

  // Deduct points for errors
  score -= Math.min(metrics.totalErrors * 0.5, 20);
  score -= Math.min(metrics.criticalErrors * 5, 30);
  score -= Math.min(metrics.pendingErrors * 2, 20);

  // Add points for resolution
  score += Math.min(metrics.resolutionRate * 0.3, 30);

  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, Math.round(score)));
}
