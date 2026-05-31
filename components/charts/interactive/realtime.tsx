'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { InteractiveLineChart, InteractiveBarChart, COLOR_SCHEMES } from './index';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/css/tailwind';

interface RealtimeDataPoint {
  timestamp: number;
  value: number;
  [key: string]: any;
}

interface RealtimeChartProps {
  title: string;
  description?: string;
  dataSource: () => Promise<RealtimeDataPoint[]>;
  updateInterval?: number;
  maxDataPoints?: number;
  lines?: Array<{
    key: string;
    name: string;
    color?: string;
  }>;
  showControls?: boolean;
  autoStart?: boolean;
  onDataUpdate?: (data: RealtimeDataPoint[]) => void;
}

export function RealtimeLineChart({
  title,
  description,
  dataSource,
  updateInterval = 5000,
  maxDataPoints = 50,
  lines = [{ key: 'value', name: 'Value' }],
  showControls = true,
  autoStart = true,
  onDataUpdate,
}: RealtimeChartProps) {
  const [data, setData] = useState<RealtimeDataPoint[]>([]);
  const [isRunning, setIsRunning] = useState(autoStart);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const newData = await dataSource();
      
      setData(prevData => {
        const combined = [...prevData, ...newData];
        const trimmed = combined.slice(-maxDataPoints);
        
        if (onDataUpdate) {
          onDataUpdate(trimmed);
        }
        
        return trimmed;
      });
      
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  }, [dataSource, maxDataPoints, onDataUpdate]);

  useEffect(() => {
    if (isRunning) {
      fetchData();
      intervalRef.current = setInterval(fetchData, updateInterval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, fetchData, updateInterval]);

  const handlePlayPause = () => {
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setData([]);
    setLastUpdate(null);
    if (isRunning) {
      fetchData();
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const formattedData = data.map(point => ({
    ...point,
    time: formatTimestamp(point.timestamp),
  }));

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
          </div>
          <div className="flex items-center gap-2">
            {lastUpdate && (
              <Badge variant="outline" className="text-xs">
                Last update: {lastUpdate.toLocaleTimeString()}
              </Badge>
            )}
            {isLoading && (
              <Badge variant="secondary" className="text-xs">
                Loading...
              </Badge>
            )}
            {isRunning && (
              <Badge variant="default" className="text-xs animate-pulse">
                Live
              </Badge>
            )}
          </div>
        </div>
        {showControls && (
          <div className="flex gap-2 mt-4">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePlayPause}
              className="gap-2"
            >
              {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isRunning ? 'Pause' : 'Start'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReset}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <InteractiveLineChart
          data={formattedData}
          lines={lines}
          xAxisKey="time"
          height={300}
          showBrush={data.length > 20}
          error={error || undefined}
        />
      </CardContent>
    </Card>
  );
}

// Realtime Metrics Dashboard
interface MetricData {
  id: string;
  label: string;
  value: number;
  unit?: string;
  color?: string;
  trend?: 'up' | 'down' | 'stable';
}

interface RealtimeMetricsProps {
  title: string;
  metrics: MetricData[];
  updateInterval?: number;
  onUpdate?: () => Promise<MetricData[]>;
}

export function RealtimeMetrics({
  title,
  metrics: initialMetrics,
  updateInterval = 3000,
  onUpdate,
}: RealtimeMetricsProps) {
  const [metrics, setMetrics] = useState<MetricData[]>(initialMetrics);
  const [isUpdating, setIsUpdating] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (onUpdate) {
      const updateMetrics = async () => {
        setIsUpdating(true);
        try {
          const newMetrics = await onUpdate();
          setMetrics(newMetrics);
        } catch (error) {
          console.error('Failed to update metrics:', error);
        } finally {
          setIsUpdating(false);
        }
      };

      updateMetrics();
      intervalRef.current = setInterval(updateMetrics, updateInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [onUpdate, updateInterval]);

  const getTrendIcon = (trend?: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      case 'stable':
        return '→';
      default:
        return '';
    }
  };

  const getTrendColor = (trend?: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return 'text-green-500';
      case 'down':
        return 'text-red-500';
      case 'stable':
        return 'text-yellow-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          {isUpdating && (
            <Badge variant="outline" className="animate-pulse">
              Updating...
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {metrics.map((metric) => (
            <div
              key={metric.id}
              className={cn(
                'p-4 rounded-lg border bg-card',
                isUpdating && 'opacity-70 transition-opacity'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{metric.label}</span>
                {metric.trend && (
                  <span className={cn('text-lg font-bold', getTrendColor(metric.trend))}>
                    {getTrendIcon(metric.trend)}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold" style={{ color: metric.color }}>
                  {metric.value.toLocaleString()}
                </span>
                {metric.unit && (
                  <span className="text-sm text-muted-foreground">{metric.unit}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Stream Chart for continuous data flow
interface StreamChartProps {
  title: string;
  streamUrl: string;
  maxPoints?: number;
  height?: number;
}

export function StreamChart({
  title,
  streamUrl,
  maxPoints = 100,
  height = 300,
}: StreamChartProps) {
  const [data, setData] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const connectToStream = () => {
      try {
        eventSourceRef.current = new EventSource(streamUrl);
        
        eventSourceRef.current.onopen = () => {
          setIsConnected(true);
          setError(null);
        };

        eventSourceRef.current.onmessage = (event) => {
          try {
            const newData = JSON.parse(event.data);
            setData(prevData => {
              const updated = [...prevData, newData];
              return updated.slice(-maxPoints);
            });
          } catch (err) {
            console.error('Failed to parse stream data:', err);
          }
        };

        eventSourceRef.current.onerror = () => {
          setIsConnected(false);
          setError('Connection lost. Attempting to reconnect...');
          
          // Attempt to reconnect after 5 seconds
          setTimeout(() => {
            if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
              connectToStream();
            }
          }, 5000);
        };
      } catch (err) {
        setError('Failed to connect to stream');
        setIsConnected(false);
      }
    };

    connectToStream();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [streamUrl, maxPoints]);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={isConnected ? 'default' : 'destructive'}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
            {data.length > 0 && (
              <Badge variant="outline">
                {data.length} points
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}
        <InteractiveLineChart
          data={data}
          lines={[{ key: 'value', name: 'Stream Value' }]}
          xAxisKey="timestamp"
          height={height}
          showBrush={false}
          animate={false}
        />
      </CardContent>
    </Card>
  );
}