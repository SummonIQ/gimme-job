'use client';

import React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  RadarChart,
  Radar,
  ScatterChart,
  Scatter,
  ComposedChart,
  FunnelChart,
  Funnel,
  RadialBarChart,
  RadialBar,
  Treemap,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
  ReferenceLine,
  ReferenceArea,
  Brush,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/css/tailwind';

// Color schemes
export const COLOR_SCHEMES = {
  default: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'],
  success: ['#10b981', '#22c55e', '#34d399', '#4ade80', '#86efac', '#bbf7d0', '#d1fae5'],
  danger: ['#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2', '#fef2f2'],
  ocean: ['#0891b2', '#06b6d4', '#22d3ee', '#67e8f9', '#a5f3fc', '#cffafe', '#e0f2fe'],
  sunset: ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5', '#fff7ed'],
  purple: ['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe', '#f3f4f6'],
  monochrome: ['#111827', '#374151', '#6b7280', '#9ca3af', '#d1d5db', '#e5e7eb', '#f3f4f6'],
} as const;

// Common chart props interface
interface BaseChartProps {
  data: any[];
  loading?: boolean;
  error?: string;
  height?: number;
  animate?: boolean;
  colors?: string[];
  className?: string;
  responsive?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  showLegend?: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
}

interface ChartCardProps extends BaseChartProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

// Loading skeleton for charts
export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="w-full" style={{ height }}>
      <Skeleton className="w-full h-full" />
    </div>
  );
}

// Error state for charts
export function ChartError({ message = 'Failed to load chart data' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <p>{message}</p>
    </div>
  );
}

// Enhanced Line Chart
interface LineChartProps extends BaseChartProps {
  lines: Array<{
    key: string;
    name: string;
    color?: string;
    strokeWidth?: number;
    strokeDasharray?: string;
    dot?: boolean;
  }>;
  xAxisKey: string;
  yAxisDomain?: [number | 'auto', number | 'auto'];
  showArea?: boolean;
  showBrush?: boolean;
  referenceLines?: Array<{
    y?: number;
    x?: string | number;
    label?: string;
    stroke?: string;
  }>;
}

export function InteractiveLineChart({
  data,
  lines,
  xAxisKey,
  yAxisDomain,
  loading = false,
  error,
  height = 300,
  animate = true,
  colors = COLOR_SCHEMES.default,
  showGrid = true,
  showTooltip = true,
  showLegend = true,
  showArea = false,
  showBrush = false,
  referenceLines = [],
  legendPosition = 'bottom',
  margin = { top: 10, right: 30, left: 0, bottom: 0 },
}: LineChartProps) {
  if (loading) return <ChartSkeleton height={height} />;
  if (error) return <ChartError message={error} />;
  if (!data || data.length === 0) return <ChartError message="No data available" />;

  const ChartComponent = showArea ? AreaChart : LineChart;
  const DataComponent = showArea ? Area : Line;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ChartComponent data={data} margin={margin}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" className="opacity-50" />}
        <XAxis 
          dataKey={xAxisKey} 
          className="text-xs"
          tick={{ fill: 'currentColor' }}
        />
        <YAxis 
          domain={yAxisDomain}
          className="text-xs"
          tick={{ fill: 'currentColor' }}
        />
        {showTooltip && (
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
            }}
          />
        )}
        {showLegend && <Legend verticalAlign={legendPosition} />}
        {lines.map((line, index) => (
          <DataComponent
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.name}
            stroke={line.color || colors[index % colors.length]}
            fill={showArea ? (line.color || colors[index % colors.length]) : undefined}
            fillOpacity={showArea ? 0.2 : undefined}
            strokeWidth={line.strokeWidth || 2}
            strokeDasharray={line.strokeDasharray}
            dot={line.dot !== false}
            isAnimationActive={animate}
          />
        ))}
        {referenceLines.map((ref, index) => (
          <ReferenceLine
            key={index}
            y={ref.y}
            x={ref.x}
            stroke={ref.stroke || '#94a3b8'}
            strokeDasharray="3 3"
            label={ref.label}
          />
        ))}
        {showBrush && <Brush dataKey={xAxisKey} height={30} stroke="#8884d8" />}
      </ChartComponent>
    </ResponsiveContainer>
  );
}

// Enhanced Bar Chart
interface BarChartProps extends BaseChartProps {
  bars: Array<{
    key: string;
    name: string;
    color?: string;
    stackId?: string;
  }>;
  xAxisKey: string;
  layout?: 'horizontal' | 'vertical';
  stacked?: boolean;
  showLabels?: boolean;
}

export function InteractiveBarChart({
  data,
  bars,
  xAxisKey,
  layout = 'horizontal',
  stacked = false,
  showLabels = false,
  loading = false,
  error,
  height = 300,
  animate = true,
  colors = COLOR_SCHEMES.default,
  showGrid = true,
  showTooltip = true,
  showLegend = true,
  legendPosition = 'bottom',
  margin = { top: 10, right: 30, left: 0, bottom: 0 },
}: BarChartProps) {
  if (loading) return <ChartSkeleton height={height} />;
  if (error) return <ChartError message={error} />;
  if (!data || data.length === 0) return <ChartError message="No data available" />;

  const isVertical = layout === 'vertical';

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout} margin={margin}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" className="opacity-50" />}
        {isVertical ? (
          <>
            <XAxis type="number" className="text-xs" tick={{ fill: 'currentColor' }} />
            <YAxis dataKey={xAxisKey} type="category" className="text-xs" tick={{ fill: 'currentColor' }} />
          </>
        ) : (
          <>
            <XAxis dataKey={xAxisKey} className="text-xs" tick={{ fill: 'currentColor' }} />
            <YAxis className="text-xs" tick={{ fill: 'currentColor' }} />
          </>
        )}
        {showTooltip && (
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
            }}
          />
        )}
        {showLegend && <Legend verticalAlign={legendPosition} />}
        {bars.map((bar, index) => (
          <Bar
            key={bar.key}
            dataKey={bar.key}
            name={bar.name}
            fill={bar.color || colors[index % colors.length]}
            stackId={stacked ? 'stack' : bar.stackId}
            isAnimationActive={animate}
          >
            {showLabels && <LabelList position={isVertical ? 'right' : 'top'} />}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// Enhanced Pie/Donut Chart
interface PieChartProps extends BaseChartProps {
  dataKey: string;
  nameKey: string;
  innerRadius?: number;
  outerRadius?: number;
  paddingAngle?: number;
  showLabels?: boolean;
  labelType?: 'percent' | 'value' | 'name';
}

export function InteractivePieChart({
  data,
  dataKey,
  nameKey,
  innerRadius = 0,
  outerRadius = 80,
  paddingAngle = 0,
  showLabels = true,
  labelType = 'percent',
  loading = false,
  error,
  height = 300,
  animate = true,
  colors = COLOR_SCHEMES.default,
  showTooltip = true,
  showLegend = true,
  legendPosition = 'bottom',
}: PieChartProps) {
  if (loading) return <ChartSkeleton height={height} />;
  if (error) return <ChartError message={error} />;
  if (!data || data.length === 0) return <ChartError message="No data available" />;

  const renderLabel = (entry: any) => {
    switch (labelType) {
      case 'percent':
        return `${(entry.percent * 100).toFixed(0)}%`;
      case 'value':
        return entry.value;
      case 'name':
        return entry[nameKey];
      default:
        return '';
    }
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={paddingAngle}
          dataKey={dataKey}
          nameKey={nameKey}
          label={showLabels ? renderLabel : false}
          labelLine={showLabels}
          isAnimationActive={animate}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        {showTooltip && (
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
            }}
          />
        )}
        {showLegend && <Legend verticalAlign={legendPosition} />}
      </PieChart>
    </ResponsiveContainer>
  );
}

// Enhanced Radar Chart
interface RadarChartProps extends BaseChartProps {
  radars: Array<{
    key: string;
    name: string;
    color?: string;
    fillOpacity?: number;
  }>;
  angleKey: string;
  domain?: [number, number];
}

export function InteractiveRadarChart({
  data,
  radars,
  angleKey,
  domain = [0, 100],
  loading = false,
  error,
  height = 300,
  animate = true,
  colors = COLOR_SCHEMES.default,
  showGrid = true,
  showTooltip = true,
  showLegend = true,
  legendPosition = 'bottom',
}: RadarChartProps) {
  if (loading) return <ChartSkeleton height={height} />;
  if (error) return <ChartError message={error} />;
  if (!data || data.length === 0) return <ChartError message="No data available" />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data}>
        {showGrid && <PolarGrid />}
        <PolarAngleAxis dataKey={angleKey} className="text-xs" />
        <PolarRadiusAxis domain={domain} className="text-xs" />
        {showTooltip && (
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
            }}
          />
        )}
        {showLegend && <Legend verticalAlign={legendPosition} />}
        {radars.map((radar, index) => (
          <Radar
            key={radar.key}
            dataKey={radar.key}
            name={radar.name}
            stroke={radar.color || colors[index % colors.length]}
            fill={radar.color || colors[index % colors.length]}
            fillOpacity={radar.fillOpacity || 0.3}
            isAnimationActive={animate}
          />
        ))}
      </RadarChart>
    </ResponsiveContainer>
  );
}

// Scatter Plot Chart
interface ScatterChartProps extends BaseChartProps {
  scatters: Array<{
    key: string;
    name: string;
    data: any[];
    color?: string;
    shape?: 'circle' | 'cross' | 'diamond' | 'square' | 'star' | 'triangle' | 'wye';
  }>;
  xKey: string;
  yKey: string;
  zKey?: string;
}

export function InteractiveScatterChart({
  scatters,
  xKey,
  yKey,
  zKey,
  loading = false,
  error,
  height = 300,
  animate = true,
  colors = COLOR_SCHEMES.default,
  showGrid = true,
  showTooltip = true,
  showLegend = true,
  legendPosition = 'bottom',
  margin = { top: 10, right: 30, left: 0, bottom: 0 },
}: ScatterChartProps) {
  if (loading) return <ChartSkeleton height={height} />;
  if (error) return <ChartError message={error} />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={margin}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" className="opacity-50" />}
        <XAxis dataKey={xKey} name={xKey} className="text-xs" tick={{ fill: 'currentColor' }} />
        <YAxis dataKey={yKey} name={yKey} className="text-xs" tick={{ fill: 'currentColor' }} />
        {zKey && <ZAxis dataKey={zKey} name={zKey} />}
        {showTooltip && (
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
            }}
          />
        )}
        {showLegend && <Legend verticalAlign={legendPosition} />}
        {scatters.map((scatter, index) => (
          <Scatter
            key={scatter.key}
            name={scatter.name}
            data={scatter.data}
            fill={scatter.color || colors[index % colors.length]}
            shape={scatter.shape}
            isAnimationActive={animate}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}

// Funnel Chart
interface FunnelChartProps extends BaseChartProps {
  dataKey: string;
  nameKey: string;
}

export function InteractiveFunnelChart({
  data,
  dataKey,
  nameKey,
  loading = false,
  error,
  height = 300,
  animate = true,
  colors = COLOR_SCHEMES.default,
  showTooltip = true,
  showLegend = true,
  legendPosition = 'bottom',
}: FunnelChartProps) {
  if (loading) return <ChartSkeleton height={height} />;
  if (error) return <ChartError message={error} />;
  if (!data || data.length === 0) return <ChartError message="No data available" />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <FunnelChart>
        <Funnel
          dataKey={dataKey}
          data={data}
          isAnimationActive={animate}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
          <LabelList position="center" fill="#fff" />
        </Funnel>
        {showTooltip && (
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
            }}
          />
        )}
        {showLegend && <Legend verticalAlign={legendPosition} />}
      </FunnelChart>
    </ResponsiveContainer>
  );
}

// Chart Card Wrapper
export function ChartCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {action && <div>{action}</div>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// Metric Card
interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
  };
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function MetricCard({
  title,
  value,
  change,
  description,
  icon,
  className,
}: MetricCardProps) {
  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change && (
          <p className={cn(
            'text-xs mt-1',
            change.type === 'increase' ? 'text-green-600' : 'text-red-600'
          )}>
            {change.type === 'increase' ? '↑' : '↓'} {Math.abs(change.value)}%
          </p>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-2">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}