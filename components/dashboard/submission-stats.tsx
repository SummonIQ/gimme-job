'use client';

import { CheckCircle2, FileText, Percent, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface AnalyticsResponse {
  readonly summary: {
    readonly totalApplications: number;
    readonly responseRate: number;
    readonly interviewRate: number;
    readonly offerRate: number;
    readonly successRate: number;
    readonly avgResponseTime: number;
    readonly avgOfferTime: number;
  };
  readonly statusBreakdown: ReadonlyArray<{
    readonly status: string;
    readonly count: number;
    readonly percentage: number;
  }>;
  readonly timelineTrends: ReadonlyArray<{
    readonly week: string;
    readonly applications: number;
    readonly responses: number;
    readonly interviews: number;
    readonly offers: number;
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#94a3b8',
  SUBMITTED: '#22c55e',
  FAILED: '#ef4444',
  REJECTED: '#dc2626',
  UNDER_REVIEW: '#3b82f6',
  INTERVIEW_REQUESTED: '#8b5cf6',
  INTERVIEW_SCHEDULED: '#a855f7',
  INTERVIEW_COMPLETED: '#c084fc',
  OFFER_RECEIVED: '#f59e0b',
  OFFER_ACCEPTED: '#16a34a',
  OFFER_REJECTED: '#f97316',
  WITHDRAWN: '#64748b',
  NOT_SELECTED: '#71717a',
};

const FAILURE_STATUSES = new Set(['FAILED', 'REJECTED', 'NOT_SELECTED']);
const SUCCESS_STATUSES = new Set([
  'SUBMITTED',
  'UNDER_REVIEW',
  'INTERVIEW_REQUESTED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEW_COMPLETED',
  'OFFER_RECEIVED',
  'OFFER_ACCEPTED',
]);

function humanizeStatus(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatWeek(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function SubmissionStats({
  timeframe = '30d',
}: {
  readonly timeframe?: '7d' | '30d' | '90d' | '1y' | 'all';
}) {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/applications/analytics?timeframe=${timeframe}`)
      .then(async response => {
        if (!response.ok) {
          throw new Error(`Analytics request failed (${response.status})`);
        }
        const body = (await response.json()) as AnalyticsResponse;
        if (!cancelled) setData(body);
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load stats.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [timeframe]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Submissions</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
        <CardContent className="grid h-[280px] place-items-center text-sm text-muted-foreground">
          Crunching the numbers…
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Submissions</CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data) return null;

  const totalApplications = data.summary.totalApplications;
  const completedCount = data.statusBreakdown
    .filter(row => SUCCESS_STATUSES.has(row.status))
    .reduce((sum, row) => sum + row.count, 0);
  const failedCount = data.statusBreakdown
    .filter(row => FAILURE_STATUSES.has(row.status))
    .reduce((sum, row) => sum + row.count, 0);
  const attemptedTotal = completedCount + failedCount;
  const successRate =
    attemptedTotal > 0 ? (completedCount / attemptedTotal) * 100 : 0;

  const weeklyData = data.timelineTrends.map(row => ({
    label: formatWeek(row.week),
    applications: row.applications,
    interviews: row.interviews,
    offers: row.offers,
  }));

  const pieData = data.statusBreakdown.map(row => ({
    name: humanizeStatus(row.status),
    value: row.count,
    fill: STATUS_COLORS[row.status] ?? '#64748b',
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submissions</CardTitle>
        <CardDescription>
          Application activity over the last {timeframe}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={<FileText className="size-4" />}
            label="Total"
            value={totalApplications}
          />
          <KpiCard
            icon={<CheckCircle2 className="size-4 text-emerald-500" />}
            label="Completed"
            value={completedCount}
          />
          <KpiCard
            icon={<XCircle className="size-4 text-rose-500" />}
            label="Failed"
            value={failedCount}
          />
          <KpiCard
            icon={<Percent className="size-4" />}
            label="Success rate"
            value={`${successRate.toFixed(1)}%`}
            hint={
              attemptedTotal === 0
                ? 'No attempts yet'
                : `${completedCount}/${attemptedTotal} attempts`
            }
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-lg border bg-card/50 p-4">
            <h3 className="mb-2 text-sm font-semibold">Weekly volume</h3>
            <div className="h-[220px] w-full">
              {weeklyData.length === 0 ? (
                <div className="grid h-full place-items-center text-sm text-muted-foreground">
                  No submissions in this window yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(148, 163, 184, 0.18)"
                    />
                    <XAxis dataKey="label" fontSize={11} tickMargin={4} />
                    <YAxis fontSize={11} allowDecimals={false} width={28} />
                    <Tooltip
                      cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="applications"
                      fill="#6366f1"
                      name="Applications"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="interviews"
                      fill="#a855f7"
                      name="Interviews"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="offers"
                      fill="#22c55e"
                      name="Offers"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-card/50 p-4">
            <h3 className="mb-2 text-sm font-semibold">By status</h3>
            <div className="h-[220px] w-full">
              {pieData.length === 0 ? (
                <div className="grid h-full place-items-center text-sm text-muted-foreground">
                  No status data yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                    />
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {pieData.map(entry => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {data.statusBreakdown.length > 0 ? (
          <div className="rounded-lg border bg-card/50 p-4">
            <h3 className="mb-3 text-sm font-semibold">Status breakdown</h3>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.statusBreakdown
                .slice()
                .sort((a, b) => b.count - a.count)
                .map(row => (
                  <li
                    className="flex items-center justify-between gap-2 rounded border bg-background/40 px-3 py-2"
                    key={row.status}
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <span
                        aria-hidden
                        className="size-2.5 rounded-full"
                        style={{
                          background: STATUS_COLORS[row.status] ?? '#64748b',
                        }}
                      />
                      {humanizeStatus(row.status)}
                    </span>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {row.count} · {row.percentage.toFixed(0)}%
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly value: string | number;
  readonly hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-card/50 p-3">
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {hint ? (
        <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}
