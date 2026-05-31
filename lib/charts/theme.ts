/**
 * Reusable chart theme configuration for Recharts
 * Use these constants to ensure consistent dark mode support across all charts
 */

// Common chart colors palette
export const CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
] as const;

// Grid styling for CartesianGrid
export const gridStyle = {
  strokeDasharray: '3 3',
  stroke: 'hsl(var(--border))',
  strokeOpacity: 0.5,
} as const;

// Axis styling for XAxis and YAxis
export const axisStyle = {
  tick: { fill: 'hsl(var(--muted-foreground))' },
  axisLine: { stroke: 'hsl(var(--border))' },
  tickLine: { stroke: 'hsl(var(--border))' },
} as const;

// Tooltip styling
export const tooltipStyle = {
  contentStyle: {
    backgroundColor: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    color: 'hsl(var(--popover-foreground))',
  },
  labelStyle: {
    color: 'hsl(var(--popover-foreground))',
  },
  cursor: {
    stroke: 'hsl(var(--border))',
    strokeWidth: 2,
  },
} as const;

// Bar styling with rounded corners
export const barStyle = {
  radius: [4, 4, 0, 0] as [number, number, number, number],
} as const;

// Line styling for LineChart
export const lineStyle = {
  strokeWidth: 2,
  dot: {
    fill: '#3b82f6',
    r: 4,
    strokeWidth: 2,
    stroke: 'hsl(var(--background))',
  },
  activeDot: {
    r: 6,
    stroke: '#3b82f6',
    strokeWidth: 2,
    fill: 'hsl(var(--background))',
  },
} as const;

// Area chart styling
export const areaStyle = {
  fillOpacity: 0.3,
} as const;

// Pie/Donut chart cell styling
export const cellStyle = {
  stroke: 'hsl(var(--background))',
  strokeWidth: 2,
} as const;

// Polar grid styling for RadarChart
export const polarGridStyle = {
  stroke: 'hsl(var(--border))',
  strokeOpacity: 0.5,
} as const;

// Combined props getter for common chart elements
export const getChartProps = () => ({
  grid: gridStyle,
  xAxis: axisStyle,
  yAxis: axisStyle,
  tooltip: tooltipStyle,
  bar: barStyle,
  line: lineStyle,
  area: areaStyle,
  cell: cellStyle,
  polarGrid: polarGridStyle,
});
