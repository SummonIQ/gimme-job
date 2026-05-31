'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { JobLeadStatus } from '@/generated/prisma/browser';

interface JobLeadAnalyticsData {
  statusDistribution: Record<JobLeadStatus, number>;
  statusProgression: Array<{
    date: string;
    status: JobLeadStatus;
    count: number;
  }>;
  topCompanies: Array<{
    company: string;
    count: number;
    avgFitScore: number;
  }>;
  locationDistribution: Array<{
    location: string;
    count: number;
  }>;
}

interface JobLeadMetricsProps {
  type?: 'overview' | 'companies' | 'locations';
}

const STATUS_COLORS = {
  [JobLeadStatus.ADDED]: '#64748b',
  [JobLeadStatus.ANALYZING]: '#60a5fa',
  [JobLeadStatus.ANALYZED]: '#3b82f6',
  [JobLeadStatus.ANALYSIS_FAILED]: '#ef4444',
  [JobLeadStatus.OPTIMIZING]: '#34d399',
  [JobLeadStatus.OPTIMIZED]: '#10b981',
  [JobLeadStatus.OPTIMIZATION_FAILED]: '#ef4444',
  [JobLeadStatus.APPLYING]: '#fbbf24',
  [JobLeadStatus.APPLIED]: '#3b82f6',
  [JobLeadStatus.REJECTED]: '#dc2626',
  [JobLeadStatus.ADVANCED]: '#8b5cf6',
  [JobLeadStatus.INTERVIEW_SCHEDULED]: '#f59e0b',
  [JobLeadStatus.INTERVIEW_CANCELLED]: '#6b7280',
  [JobLeadStatus.INTERVIEW_COMPLETED]: '#8b5cf6',
  [JobLeadStatus.INTERVIEWED_NOT_SELECTED]: '#dc2626',
  [JobLeadStatus.OFFER]: '#10b981',
  [JobLeadStatus.OFFER_DECLINED]: '#ef4444',
  [JobLeadStatus.HIRED]: '#059669',
  [JobLeadStatus.REMOVED]: '#6b7280',
};

const STATUS_LABELS = {
  [JobLeadStatus.ADDED]: 'Added',
  [JobLeadStatus.ANALYZING]: 'Analyzing',
  [JobLeadStatus.ANALYZED]: 'Analyzed',
  [JobLeadStatus.ANALYSIS_FAILED]: 'Analysis Failed',
  [JobLeadStatus.OPTIMIZING]: 'Optimizing',
  [JobLeadStatus.OPTIMIZED]: 'Optimized',
  [JobLeadStatus.OPTIMIZATION_FAILED]: 'Optimization Failed',
  [JobLeadStatus.APPLYING]: 'Applying',
  [JobLeadStatus.APPLIED]: 'Applied',
  [JobLeadStatus.REJECTED]: 'Rejected',
  [JobLeadStatus.ADVANCED]: 'Advanced',
  [JobLeadStatus.INTERVIEW_SCHEDULED]: 'Interview Scheduled',
  [JobLeadStatus.INTERVIEW_CANCELLED]: 'Interview Cancelled',
  [JobLeadStatus.INTERVIEW_COMPLETED]: 'Interview Completed',
  [JobLeadStatus.INTERVIEWED_NOT_SELECTED]: 'Interviewed, Not Selected',
  [JobLeadStatus.OFFER]: 'Offer',
  [JobLeadStatus.OFFER_DECLINED]: 'Offer Declined',
  [JobLeadStatus.HIRED]: 'Hired',
  [JobLeadStatus.REMOVED]: 'Removed',
};

export function JobLeadMetrics({ type = 'overview' }: JobLeadMetricsProps) {
  const [data, setData] = useState<JobLeadAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/analytics?type=job-leads');
        if (!response.ok) throw new Error('Failed to fetch job lead analytics');
        const result = await response.json();
        setData(result.data);
      } catch (error) {
        console.error('Error fetching job lead analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-[300px] bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Failed to load job lead analytics. Please try again.
      </div>
    );
  }

  const statusChartData = Object.entries(data.statusDistribution).map(([status, count]) => ({
    status: STATUS_LABELS[status as JobLeadStatus],
    count,
    color: STATUS_COLORS[status as JobLeadStatus],
  }));

  const pieChartData = statusChartData.filter(item => item.count > 0);

  if (type === 'companies') {
    return (
      <div className="space-y-4">
        <div className="space-y-3">
          {data.topCompanies.slice(0, 8).map((company, index) => (
            <div key={company.company} className="flex items-center justify-between space-y-0">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium text-sm">{company.company}</p>
                  <p className="text-xs text-muted-foreground">
                    Avg Fit Score: {Math.round(company.avgFitScore)}/100
                  </p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant="secondary" className="text-xs">
                  {company.count} {company.count === 1 ? 'application' : 'applications'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
        {data.topCompanies.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-4">
            No company data available yet. Start applying to jobs to see insights!
          </p>
        )}
      </div>
    );
  }

  if (type === 'locations') {
    return (
      <div className="space-y-4">
        <div className="space-y-3">
          {data.locationDistribution.slice(0, 8).map((location, index) => (
            <div key={location.location} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </div>
                <p className="font-medium text-sm">{location.location}</p>
              </div>
              <Badge variant="outline" className="text-xs">
                {location.count} {location.count === 1 ? 'job' : 'jobs'}
              </Badge>
            </div>
          ))}
        </div>
        {data.locationDistribution.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-4">
            No location data available yet.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Distribution Bar Chart */}
      <div>
        <h4 className="text-sm font-medium mb-3">Application Status Distribution</h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={statusChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="status"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
            />
            <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Status Distribution Pie Chart */}
      {pieChartData.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-3">Status Breakdown</h4>
          <div className="flex flex-col lg:flex-row items-start space-y-4 lg:space-y-0 lg:space-x-6">
            <div className="w-full lg:w-1/2">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="count"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full lg:w-1/2 space-y-2">
              {pieChartData.map((entry) => (
                <div key={entry.status} className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span>{entry.status}</span>
                  </div>
                  <span className="font-medium">{entry.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-center">
              {data.statusDistribution[JobLeadStatus.APPLIED] || 0}
            </div>
            <p className="text-xs text-muted-foreground text-center">Applications Sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-center">
              {data.statusDistribution[JobLeadStatus.INTERVIEW_SCHEDULED] || 0}
            </div>
            <p className="text-xs text-muted-foreground text-center">Interviews Scheduled</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
