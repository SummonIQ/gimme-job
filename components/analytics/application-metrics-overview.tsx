"use client";

import { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  Clock, 
  Target, 
  Award,
  CheckCircle,
  XCircle,
  Calendar,
  Bot
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { type ApplicationMetrics } from '@/lib/applications/outcomes';
import { useToast } from '@/hooks/use-toast';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: string;
}

function MetricCard({ title, value, subtitle, icon, trend, color }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold ${color || ''}`}>{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {trend && (
              <div className={`flex items-center gap-1 text-xs ${
                trend.isPositive ? 'text-green-600' : 'text-red-600'
              }`}>
                <TrendingUp className={`h-3 w-3 ${!trend.isPositive && 'rotate-180'}`} />
                <span>{Math.abs(trend.value)}%</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-full ${color ? 'opacity-20' : 'bg-muted'}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ApplicationMetricsOverview() {
  const [metrics, setMetrics] = useState<ApplicationMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      const response = await fetch('/api/applications/outcome-metrics');
      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error('Failed to load metrics:', error);
      toast({
        title: "Error",
        description: "Failed to load application metrics",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !metrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-20 animate-pulse bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const automationComparison = metrics.performanceByAutomation;
  const automationDiff = automationComparison.automated.successRate - automationComparison.manual.successRate;

  return (
    <div className="space-y-4">
      {/* Primary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Applications"
          value={metrics.totalApplications}
          subtitle="Last 30 days"
          icon={<Target className="h-6 w-6" />}
          color="text-blue-600"
        />
        
        <MetricCard
          title="Response Rate"
          value={`${metrics.responseRate.toFixed(1)}%`}
          subtitle={`${Math.round(metrics.totalApplications * metrics.responseRate / 100)} responses`}
          icon={<CheckCircle className="h-6 w-6" />}
          color="text-green-600"
        />
        
        <MetricCard
          title="Interview Rate"
          value={`${metrics.interviewRate.toFixed(1)}%`}
          subtitle={`${Math.round(metrics.totalApplications * metrics.interviewRate / 100)} interviews`}
          icon={<Calendar className="h-6 w-6" />}
          color="text-purple-600"
        />
        
        <MetricCard
          title="Success Rate"
          value={`${metrics.successRate.toFixed(1)}%`}
          subtitle={`${Math.round(metrics.totalApplications * metrics.successRate / 100)} offers`}
          icon={<Award className="h-6 w-6" />}
          color="text-yellow-600"
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Avg. Response Time"
          value={`${metrics.averageResponseTime.toFixed(0)} days`}
          subtitle="Time to first response"
          icon={<Clock className="h-6 w-6" />}
        />
        
        <MetricCard
          title="Time to Outcome"
          value={`${metrics.averageTimeToFinalOutcome.toFixed(0)} days`}
          subtitle="From application to decision"
          icon={<Clock className="h-6 w-6" />}
        />
        
        <MetricCard
          title="Automated Success"
          value={`${automationComparison.automated.successRate.toFixed(1)}%`}
          subtitle={`${automationComparison.automated.total} automated apps`}
          icon={<Bot className="h-6 w-6" />}
          trend={{
            value: automationDiff,
            isPositive: automationDiff > 0
          }}
        />
        
        <MetricCard
          title="Manual Success"
          value={`${automationComparison.manual.successRate.toFixed(1)}%`}
          subtitle={`${automationComparison.manual.total} manual apps`}
          icon={<Target className="h-6 w-6" />}
        />
      </div>
    </div>
  );
}