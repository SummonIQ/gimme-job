"use client";

import { useEffect, useState } from 'react';
import { ArrowDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/css';

interface ConversionFunnelProps {
  timeframe?: '7d' | '30d' | '90d' | '1y' | 'all';
  resumeId?: string;
  className?: string;
}

interface ConversionFunnelData {
  applications: number;
  responses: number;
  interviews: number;
  offers: number;
  accepted: number;
  responseRate: number;
  interviewRate: number;
  offerRate: number;
  acceptanceRate: number;
}

interface FunnelStage {
  label: string;
  count: number;
  rate: number;
  color: string;
  description: string;
  avgDays?: number;
}

export function ConversionFunnel({ 
  timeframe = '30d', 
  resumeId, 
  className 
}: ConversionFunnelProps) {
  const [funnelData, setFunnelData] = useState<ConversionFunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFunnelData();
  }, [timeframe, resumeId]);

  const loadFunnelData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({ timeframe });
      if (resumeId) params.append('resumeId', resumeId);
      
      const response = await fetch(`/api/applications/analytics?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }
      
      const data = await response.json();
      setFunnelData(data.conversionFunnel);
    } catch (error) {
      console.error('Failed to load funnel data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={cn("space-y-4", className)}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("p-4 text-center text-muted-foreground", className)}>
        <p>Failed to load funnel data: {error}</p>
        <button 
          onClick={loadFunnelData} 
          className="mt-2 text-primary hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!funnelData) {
    return (
      <div className={cn("p-4 text-center text-muted-foreground", className)}>
        <p>No data available</p>
      </div>
    );
  }

  const stages: FunnelStage[] = [
    {
      label: 'Applications',
      count: funnelData.applications,
      rate: 100,
      color: 'bg-blue-500',
      description: 'Total applications submitted',
    },
    {
      label: 'Responses',
      count: funnelData.responses,
      rate: funnelData.responseRate,
      color: 'bg-green-500',
      description: 'Companies that responded',
    },
    {
      label: 'Interviews',
      count: funnelData.interviews,
      rate: funnelData.interviewRate,
      color: 'bg-yellow-500',
      description: 'Interview opportunities',
    },
    {
      label: 'Offers',
      count: funnelData.offers,
      rate: funnelData.offerRate,
      color: 'bg-orange-500',
      description: 'Job offers received',
    },
    {
      label: 'Accepted',
      count: funnelData.accepted,
      rate: funnelData.accepted > 0 ? (funnelData.accepted / funnelData.applications) * 100 : 0,
      color: 'bg-red-500',
      description: 'Offers accepted',
    },
  ];

  const maxCount = Math.max(...stages.map(s => s.count), 1);

  const getBenchmarkIcon = (rate: number, benchmarkRate: number) => {
    if (rate > benchmarkRate * 1.2) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (rate < benchmarkRate * 0.8) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-yellow-500" />;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {stages.map((stage, index) => {
        const widthPercentage = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
        const nextStage = stages[index + 1];
        const dropOffRate = nextStage && stage.count > 0
          ? ((stage.count - nextStage.count) / stage.count) * 100
          : 0;

        return (
          <div key={stage.label}>
            <div className="relative">
              {/* Funnel Stage */}
              <div className="relative bg-gray-100 rounded-lg overflow-hidden">
                <div
                  className={cn(
                    stage.color,
                    "h-16 transition-all duration-1000 ease-out flex items-center justify-between px-4 text-white font-medium"
                  )}
                  style={{
                    width: `${Math.max(widthPercentage, 15)}%`,
                    minWidth: '150px',
                  }}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{stage.label}</span>
                    <span className="text-xs opacity-90">{stage.description}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{stage.count}</div>
                    <div className="text-xs opacity-90">
                      {stage.rate.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Drop-off Indicator */}
              {nextStage && dropOffRate > 0 && (
                <div className="flex items-center justify-center py-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-background border rounded px-2 py-1">
                    <ArrowDown className="h-4 w-4" />
                    <span>{dropOffRate.toFixed(1)}% drop-off</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Summary Stats */}
      <div className="mt-6 p-4 bg-muted rounded-lg">
        <h4 className="font-medium mb-4">Conversion Summary</h4>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Response Rate</span>
              {getBenchmarkIcon(funnelData.responseRate, 15)}
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {funnelData.responseRate.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">Industry avg: 15%</div>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Interview Rate</span>
              {getBenchmarkIcon(funnelData.interviewRate, 8)}
            </div>
            <div className="text-2xl font-bold text-green-600">
              {funnelData.interviewRate.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">Industry avg: 8%</div>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Offer Rate</span>
              {getBenchmarkIcon(funnelData.offerRate, 3)}
            </div>
            <div className="text-2xl font-bold text-orange-600">
              {funnelData.offerRate.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">Industry avg: 3%</div>
          </div>
          
          <div className="space-y-1">
            <span className="text-sm text-muted-foreground">Success Rate</span>
            <div className="text-2xl font-bold text-red-600">
              {((funnelData.accepted / Math.max(funnelData.applications, 1)) * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">Offers accepted</div>
          </div>
        </div>

        {/* Insights */}
        {funnelData.applications > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h5 className="font-medium text-sm mb-2">Insights</h5>
            <div className="space-y-1 text-sm text-muted-foreground">
              {funnelData.responseRate < 10 && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full" />
                  <span>Response rate below average. Consider resume optimization.</span>
                </div>
              )}
              {funnelData.responseRate >= 15 && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full" />
                  <span>Excellent response rate! Your applications stand out.</span>
                </div>
              )}
              {funnelData.interviewRate > 0 && funnelData.offerRate === 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full" />
                  <span>Getting interviews but no offers. Focus on interview prep.</span>
                </div>
              )}
              {funnelData.offerRate > 5 && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full" />
                  <span>Outstanding offer rate! Well above industry average.</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}