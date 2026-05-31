import React from 'react';
import {
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// Define formatPercentage function locally if it's not available in utils
const formatPercentage = (value: number): string => {
  return `${(value * 100).toFixed(1)}%`;
};

// Common chart colors
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

// Theme-aware chart styling props
const getChartThemeProps = () => ({
  grid: {
    stroke: 'hsl(var(--border))',
    strokeOpacity: 0.5,
    strokeDasharray: '3 3',
  },
  axis: {
    tick: { fill: 'hsl(var(--muted-foreground))' },
    axisLine: { stroke: 'hsl(var(--border))' },
    tickLine: { stroke: 'hsl(var(--border))' },
  },
  tooltip: {
    contentStyle: {
      backgroundColor: 'hsl(var(--popover))',
      border: '1px solid hsl(var(--border))',
      borderRadius: '8px',
      color: 'hsl(var(--popover-foreground))',
    },
  },
});

// Status colors
export const STATUS_COLORS = {
  SUBMITTED: '#64748b', // slate-500
  PENDING: '#3b82f6', // blue-500
  REJECTED: '#ef4444', // red-500
  INTERVIEWING: '#f97316', // orange-500
  OFFERED: '#10b981', // emerald-500
  ACCEPTED: '#22c55e', // green-500
  ARCHIVED: '#94a3b8', // slate-400
};

interface BarChartCardProps {
  title: string;
  description?: string;
  data: any[];
  dataKeys: { key: string; name: string; color?: string }[];
  xAxisDataKey: string;
  height?: number;
}

export function BarChartCard({
  title,
  description,
  data,
  dataKeys,
  xAxisDataKey,
  height = 300,
}: BarChartCardProps) {
  // Use React's useEffect hook to adapt to window size
  const [isMobile, setIsMobile] = React.useState(false);
  const themeProps = getChartThemeProps();

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="pb-1 px-1 md:pb-4 md:px-4">
        <div style={{ width: '100%', height: isMobile ? height * 0.8 : height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{
                top: 5,
                right: isMobile ? 10 : 30,
                left: isMobile ? 0 : 20,
                bottom: isMobile ? 15 : 5,
              }}
            >
              <CartesianGrid {...themeProps.grid} />
              <XAxis
                dataKey={xAxisDataKey}
                tick={{ fontSize: isMobile ? 10 : 12, ...themeProps.axis.tick }}
                angle={isMobile ? -45 : 0}
                textAnchor={isMobile ? "end" : "middle"}
                height={isMobile ? 60 : 30}
                axisLine={themeProps.axis.axisLine}
                tickLine={themeProps.axis.tickLine}
              />
              <YAxis
                tick={{ fontSize: isMobile ? 10 : 12, ...themeProps.axis.tick }}
                width={isMobile ? 35 : 40}
                axisLine={themeProps.axis.axisLine}
                tickLine={themeProps.axis.tickLine}
              />
              <Tooltip
                cursor={{ strokeWidth: 2, stroke: 'hsl(var(--border))' }}
                contentStyle={{ ...themeProps.tooltip.contentStyle, fontSize: isMobile ? '12px' : '14px' }}
              />
              <Legend
                verticalAlign={isMobile ? "bottom" : "top"}
                height={isMobile ? 36 : 30}
                wrapperStyle={{ fontSize: isMobile ? '10px' : '12px' }}
              />
              {dataKeys.map((dataKey, index) => (
                <Bar
                  key={dataKey.key}
                  dataKey={dataKey.key}
                  name={dataKey.name}
                  fill={dataKey.color || COLORS[index % COLORS.length]}
                  // Increase minPointSize for better touch targets on mobile
                  minPointSize={isMobile ? 5 : 3}
                  // Add some gap between bars for better touch distinction
                  barSize={isMobile ? 15 : 20}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

interface PieChartCardProps {
  title: string;
  description?: string;
  data: any[];
  dataKey: string;
  nameKey: string;
  colors?: string[];
  height?: number;
  formatValue?: (value: number) => string;
}

export function PieChartCard({
  title,
  description,
  data,
  dataKey,
  nameKey,
  colors = COLORS,
  height = 300,
  formatValue,
}: PieChartCardProps) {
  // Use React's useEffect hook to adapt to window size
  const [isMobile, setIsMobile] = React.useState(false);
  const themeProps = getChartThemeProps();

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="pb-1 px-1 md:pb-4 md:px-4">
        <div style={{ width: '100%', height: isMobile ? height * 0.8 : height }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey={dataKey}
                nameKey={nameKey}
                cx="50%"
                cy="50%"
                outerRadius={isMobile ? 60 : 80}
                // Add innerRadius for a donut chart which is easier to interact with on mobile
                innerRadius={isMobile ? 20 : 0}
                fill="#8884d8"
                // Adjust label for better mobile visibility
                label={isMobile ?
                  // Simplified label for mobile
                  ({ name }: { name: string }) => `${name}` :
                  // More detailed label for desktop
                  ({ name, percent }: { name: string; percent: number }) =>
                    `${name}: ${formatValue ? formatValue(percent * 100) : formatPercentage(percent)}`
                }
                labelLine={!isMobile}
              >
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={colors[index % colors.length]}
                    // Increase stroke width for better touch distinction
                    strokeWidth={isMobile ? 2 : 1}
                    stroke="hsl(var(--background))"
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={formatValue ? (value: any) => formatValue(Number(value)) : undefined}
                contentStyle={{ ...themeProps.tooltip.contentStyle, fontSize: isMobile ? '12px' : '14px' }}
              />
              <Legend
                verticalAlign={isMobile ? "bottom" : "bottom"}
                height={36}
                wrapperStyle={{
                  fontSize: isMobile ? '10px' : '12px',
                  paddingTop: isMobile ? '10px' : '0',
                  marginTop: isMobile ? '10px' : '0'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: {
    value: number;
    label: string;
    positive?: boolean;
  };
}

export function StatCard({ title, value, description, trend }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium md:text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-xl font-bold md:text-2xl">{value}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        {trend && (
          <div className="flex items-center pt-2">
            {trend.positive ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-5 w-5 text-emerald-500"
              >
                <path
                  fillRule="evenodd"
                  d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-5 w-5 text-red-500"
              >
                <path
                  fillRule="evenodd"
                  d="M12 13a1 1 0 110 2H7a1 1 0 01-1-1V9a1 1 0 112 0v3.586l4.293-4.293a1 1 0 011.414 0L16 10.586V8a1 1 0 112 0v5a1 1 0 01-1 1h-5z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            <span
              className={`text-xs md:text-sm ${
                trend.positive ? 'text-emerald-500' : 'text-red-500'
              } ml-2`}
            >
              {trend.value}% {trend.label}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function StatusDistributionChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <PieChartCard
      title="Application Status Distribution"
      data={data}
      dataKey="value"
      nameKey="name"
      colors={Object.values(STATUS_COLORS)}
      height={300}
    />
  );
}

export function ResponseRatesChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <PieChartCard
      title="Response Rates"
      description="Percentage of applications that received a response"
      data={data}
      dataKey="value"
      nameKey="name"
      formatValue={(value) => `${value.toFixed(1)}%`}
    />
  );
}

export function JobProviderPerformanceChart({ data }: { data: any[] }) {
  return (
    <BarChartCard
      title="Job Provider Performance"
      description="Application outcomes by job provider"
      data={data}
      xAxisDataKey="jobProvider"
      dataKeys={[
        { key: 'applications', name: 'Applications', color: '#64748b' },
        { key: 'responses', name: 'Responses', color: '#3b82f6' },
        { key: 'interviews', name: 'Interviews', color: '#f97316' },
        { key: 'offers', name: 'Offers', color: '#10b981' },
      ]}
    />
  );
}

export function ResumePerformanceChart({ data }: { data: any[] }) {
  return (
    <BarChartCard
      title="Resume Performance"
      description="Application outcomes by resume"
      data={data}
      xAxisDataKey="resumeName"
      dataKeys={[
        { key: 'responseRate', name: 'Response Rate', color: '#3b82f6' },
        { key: 'interviewRate', name: 'Interview Rate', color: '#f97316' },
        { key: 'offerRate', name: 'Offer Rate', color: '#10b981' },
      ]}
    />
  );
}
