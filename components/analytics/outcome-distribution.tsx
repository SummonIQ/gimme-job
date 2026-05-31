"use client";

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { ApplicationStatus } from '@/generated/prisma/browser';

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  [ApplicationStatus.PENDING]: '#94a3b8',
  [ApplicationStatus.SUBMITTED]: '#3b82f6',
  [ApplicationStatus.UNDER_REVIEW]: '#8b5cf6',
  [ApplicationStatus.INTERVIEW_REQUESTED]: '#a855f7',
  [ApplicationStatus.INTERVIEW_SCHEDULED]: '#8b5cf6',
  [ApplicationStatus.INTERVIEW_COMPLETED]: '#6366f1',
  [ApplicationStatus.OFFER_RECEIVED]: '#eab308',
  [ApplicationStatus.OFFER_ACCEPTED]: '#22c55e',
  [ApplicationStatus.OFFER_REJECTED]: '#f59e0b',
  [ApplicationStatus.REJECTED]: '#ef4444',
  [ApplicationStatus.NOT_SELECTED]: '#dc2626',
  [ApplicationStatus.WITHDRAWN]: '#6b7280',
  [ApplicationStatus.FAILED]: '#991b1b',
};

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  [ApplicationStatus.PENDING]: 'Pending',
  [ApplicationStatus.SUBMITTED]: 'Submitted',
  [ApplicationStatus.UNDER_REVIEW]: 'Under Review',
  [ApplicationStatus.INTERVIEW_REQUESTED]: 'Interview Requested',
  [ApplicationStatus.INTERVIEW_SCHEDULED]: 'Interview Scheduled',
  [ApplicationStatus.INTERVIEW_COMPLETED]: 'Interview Completed',
  [ApplicationStatus.OFFER_RECEIVED]: 'Offer Received',
  [ApplicationStatus.OFFER_ACCEPTED]: 'Offer Accepted',
  [ApplicationStatus.OFFER_REJECTED]: 'Offer Rejected',
  [ApplicationStatus.REJECTED]: 'Rejected',
  [ApplicationStatus.NOT_SELECTED]: 'Not Selected',
  [ApplicationStatus.WITHDRAWN]: 'Withdrawn',
  [ApplicationStatus.FAILED]: 'Failed',
};

export function OutcomeDistribution() {
  const [outcomeData, setOutcomeData] = useState<Array<{
    name: string;
    value: number;
    percentage: number;
    color: string;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOutcomeData();
  }, []);

  const loadOutcomeData = async () => {
    try {
      const response = await fetch('/api/applications/outcome-metrics');
      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }
      const metrics = await response.json();
      
      // Transform status breakdown into pie chart data
      const statusBreakdown = metrics.statusBreakdown || {};
      const total = Object.values(statusBreakdown).reduce((sum: number, count: any) => sum + count, 0);
      const data = Object.entries(statusBreakdown)
        .filter(([_, count]) => (count as number) > 0)
        .map(([status, count]) => ({
          name: STATUS_LABELS[status as ApplicationStatus],
          value: count as number,
          percentage: ((count as number) / total) * 100,
          color: STATUS_COLORS[status as ApplicationStatus]
        }))
        .sort((a, b) => b.value - a.value);
      
      setOutcomeData(data);
    } catch (error) {
      console.error('Failed to load outcome data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading outcome data...</div>
      </div>
    );
  }

  if (outcomeData.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p>No outcome data available</p>
          <p className="text-sm mt-2">Application outcomes will appear here</p>
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload[0]) {
      return (
        <div className="bg-popover border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{payload[0].name}</p>
          <p className="text-sm text-muted-foreground">
            {payload[0].value} applications ({payload[0].payload.percentage.toFixed(1)}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const renderCustomLabel = (entry: any) => {
    if (entry.percentage > 5) {
      return `${entry.percentage.toFixed(0)}%`;
    }
    return '';
  };

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={outcomeData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {outcomeData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend with counts */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Outcome Breakdown</h4>
        <div className="grid grid-cols-2 gap-2">
          {outcomeData.map((item) => (
            <div key={item.name} className="flex items-center gap-2 text-sm">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-muted-foreground">{item.name}:</span>
              <span className="font-medium">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="border-t pt-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Active Applications:</span>
            <p className="font-semibold">
              {outcomeData
                .filter(item => ['Submitted', 'Under Review', 'Interview Requested', 'Interview Scheduled'].includes(item.name))
                .reduce((sum, item) => sum + item.value, 0)}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Completed:</span>
            <p className="font-semibold">
              {outcomeData
                .filter(item => ['Offer Accepted', 'Offer Rejected', 'Rejected', 'Not Selected', 'Withdrawn'].includes(item.name))
                .reduce((sum, item) => sum + item.value, 0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}