"use client";

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { type PlatformMetrics } from '@/lib/applications/outcomes';
import { Badge } from '@/components/ui/badge';

export function PlatformComparison() {
  const [platformData, setPlatformData] = useState<PlatformMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlatformData();
  }, []);

  const loadPlatformData = async () => {
    try {
      const response = await fetch('/api/applications/outcome-metrics');
      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }
      const metrics = await response.json();
      setPlatformData(metrics.performanceByPlatform || []);
    } catch (error) {
      console.error('Failed to load platform data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading platform data...</div>
      </div>
    );
  }

  if (platformData.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p>No application data available</p>
          <p className="text-sm mt-2">Start applying to jobs to see platform comparisons</p>
        </div>
      </div>
    );
  }

  // Format data for the chart
  const chartData = platformData.map(platform => ({
    name: platform.platform,
    'Response Rate': parseFloat(platform.responseRate.toFixed(1)),
    'Interview Rate': parseFloat(platform.interviewRate.toFixed(1)),
    'Success Rate': parseFloat(platform.successRate.toFixed(1)),
    applications: platform.applications
  }));

  // Find best performing platform
  const bestPlatform = platformData.reduce((best, current) => 
    current.successRate > best.successRate ? current : best
  );

  return (
    <div className="space-y-4">
      {/* Best Platform Badge */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Best Performing:</span>
        <Badge variant="secondary">
          {bestPlatform.platform} ({bestPlatform.successRate.toFixed(1)}% success)
        </Badge>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }} />
          <Tooltip 
            formatter={(value: number) => `${value}%`}
            labelFormatter={(label) => {
              const platform = platformData.find(p => p.platform === label);
              return `${label} (${platform?.applications} applications)`;
            }}
          />
          <Legend />
          <Bar dataKey="Response Rate" fill="#22c55e" />
          <Bar dataKey="Interview Rate" fill="#a855f7" />
          <Bar dataKey="Success Rate" fill="#eab308" />
        </BarChart>
      </ResponsiveContainer>

      {/* Platform Details */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Platform Details</h4>
        <div className="space-y-1">
          {platformData.map(platform => (
            <div key={platform.platform} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{platform.platform}:</span>
              <span>{platform.applications} applications</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}