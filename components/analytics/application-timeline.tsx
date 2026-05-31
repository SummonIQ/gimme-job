"use client";

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';
import { type TimeSeriesMetric } from '@/lib/applications/outcomes';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

type TimeRange = '7d' | '14d' | '30d' | '90d';

export function ApplicationTimeline() {
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesMetric[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTimelineData();
  }, [timeRange]);

  const loadTimelineData = async () => {
    try {
      setLoading(true);
      
      // Calculate date range
      const endDate = new Date();
      const days = parseInt(timeRange);
      const startDate = startOfDay(subDays(endDate, days));
      
      const response = await fetch('/api/applications/outcome-metrics');
      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }
      const metrics = await response.json();
      
      // Fill in missing dates for smooth chart
      const filledData = fillTimeSeriesGaps(metrics.timeSeriesData || [], startDate, endDate);
      setTimeSeriesData(filledData);
    } catch (error) {
      console.error('Failed to load timeline data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fillTimeSeriesGaps = (
    data: TimeSeriesMetric[], 
    startDate: Date, 
    endDate: Date
  ): TimeSeriesMetric[] => {
    const filled: TimeSeriesMetric[] = [];
    const dataMap = new Map(data.map(d => [format(d.date, 'yyyy-MM-dd'), d]));
    
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dateStr = format(date, 'yyyy-MM-dd');
      const existing = dataMap.get(dateStr);
      
      if (existing) {
        filled.push(existing);
      } else {
        filled.push({
          date: date,
          applications: 0,
          responses: 0,
          interviews: 0,
          offers: 0
        });
      }
    }
    
    return filled;
  };

  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading timeline data...</div>
      </div>
    );
  }

  if (timeSeriesData.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p>No timeline data available</p>
          <p className="text-sm mt-2">Start applying to jobs to see your activity timeline</p>
        </div>
      </div>
    );
  }

  // Calculate summary stats for selected period
  const summaryStats = timeSeriesData.reduce((acc, day) => ({
    totalApplications: acc.totalApplications + day.applications,
    totalResponses: acc.totalResponses + day.responses,
    totalInterviews: acc.totalInterviews + day.interviews,
    totalOffers: acc.totalOffers + day.offers,
  }), {
    totalApplications: 0,
    totalResponses: 0,
    totalInterviews: 0,
    totalOffers: 0,
  });

  const avgApplicationsPerDay = (summaryStats.totalApplications / timeSeriesData.length).toFixed(1);
  const bestDay = timeSeriesData.reduce((best, current) => 
    current.applications > best.applications ? current : best
  );

  return (
    <div className="space-y-4">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">Time Range:</span>
          <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="14d">Last 14 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {avgApplicationsPerDay} apps/day avg
          </Badge>
          <Badge variant="outline">
            Peak: {bestDay.applications} on {format(bestDay.date, 'MMM d')}
          </Badge>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={timeSeriesData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date"
            tickFormatter={(date) => format(date, 'MMM d')}
            interval="preserveStartEnd"
          />
          <YAxis />
          <Tooltip 
            labelFormatter={(date) => format(date as Date, 'MMMM d, yyyy')}
            formatter={(value: number, name: string) => [value, name]}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="applications" 
            stroke="#3b82f6" 
            strokeWidth={2}
            dot={false}
            name="Applications"
          />
          <Line 
            type="monotone" 
            dataKey="responses" 
            stroke="#22c55e" 
            strokeWidth={2}
            dot={false}
            name="Responses"
          />
          <Line 
            type="monotone" 
            dataKey="interviews" 
            stroke="#a855f7" 
            strokeWidth={2}
            dot={false}
            name="Interviews"
          />
          <Line 
            type="monotone" 
            dataKey="offers" 
            stroke="#eab308" 
            strokeWidth={2}
            dot={false}
            name="Offers"
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
        <div>
          <span className="text-sm text-muted-foreground">Total Applications</span>
          <p className="text-2xl font-bold text-blue-600">{summaryStats.totalApplications}</p>
        </div>
        <div>
          <span className="text-sm text-muted-foreground">Total Responses</span>
          <p className="text-2xl font-bold text-green-600">{summaryStats.totalResponses}</p>
        </div>
        <div>
          <span className="text-sm text-muted-foreground">Total Interviews</span>
          <p className="text-2xl font-bold text-purple-600">{summaryStats.totalInterviews}</p>
        </div>
        <div>
          <span className="text-sm text-muted-foreground">Total Offers</span>
          <p className="text-2xl font-bold text-yellow-600">{summaryStats.totalOffers}</p>
        </div>
      </div>

      {/* Activity Insights */}
      <div className="p-4 bg-muted rounded-lg">
        <h4 className="font-medium mb-2">Activity Insights</h4>
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">
            You've been most active on <span className="font-medium">{format(bestDay.date, 'EEEE')}s</span> with {bestDay.applications} applications.
          </p>
          {summaryStats.totalOffers > 0 && (
            <p className="text-muted-foreground">
              Your offer rate is <span className="font-medium text-green-600">{((summaryStats.totalOffers / summaryStats.totalApplications) * 100).toFixed(1)}%</span> for this period.
            </p>
          )}
          {summaryStats.totalInterviews > 0 && (
            <p className="text-muted-foreground">
              Interview conversion: <span className="font-medium text-purple-600">{((summaryStats.totalInterviews / summaryStats.totalApplications) * 100).toFixed(1)}%</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}