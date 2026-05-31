'use client';

import { ArrowRight, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface ApplicationItem {
  readonly id: string;
  readonly status: string;
  readonly failureReason: string | null;
  readonly errorMessage: string | null;
  readonly submittedAt: string | null;
  readonly createdAt: string;
  readonly company: string | null;
  readonly jobTitle: string | null;
  readonly applicationUrl: string | null;
  readonly wasAutomated: boolean;
}

interface ListResponse {
  readonly items: readonly ApplicationItem[];
  readonly totalCount: number;
}

const STATUS_STYLES: Record<string, string> = {
  SUBMITTED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  FAILED: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  REJECTED: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  UNDER_REVIEW: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  INTERVIEW_REQUESTED: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  INTERVIEW_SCHEDULED: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  INTERVIEW_COMPLETED: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  OFFER_RECEIVED: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  OFFER_ACCEPTED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  OFFER_REJECTED: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  WITHDRAWN: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  NOT_SELECTED: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  PENDING: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
};

function humanizeStatus(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function RecentApplications({ limit = 10 }: { readonly limit?: number }) {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/applications/list?page=1&pageSize=${limit}`)
      .then(async response => {
        if (!response.ok) {
          throw new Error(`Applications request failed (${response.status})`);
        }
        const body = (await response.json()) as ListResponse;
        if (!cancelled) setData(body);
      })
      .catch(err => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load applications.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [limit]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Recent applications</CardTitle>
          <CardDescription>
            Your most recent {limit} submissions
            {data && data.totalCount > limit
              ? ` (${data.totalCount} total)`
              : null}
            .
          </CardDescription>
        </div>
        <Link
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          href={{ pathname: '/applications' }}
        >
          View all
          <ArrowRight className="size-3.5" />
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : error ? (
          <div className="py-6 text-center text-sm text-destructive">
            {error}
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No submissions yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Company</th>
                  <th className="py-2 pr-3 font-medium">Role</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-0 font-medium" />
                </tr>
              </thead>
              <tbody>
                {data.items.map(item => (
                  <tr
                    key={item.id}
                    className="border-b border-border/40 last:border-b-0"
                  >
                    <td className="py-2 pr-3 font-medium">
                      {item.company || '—'}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {item.jobTitle || '—'}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                          STATUS_STYLES[item.status] ?? STATUS_STYLES.PENDING
                        }`}
                      >
                        {humanizeStatus(item.status)}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {formatTimestamp(item.submittedAt ?? item.createdAt)}
                    </td>
                    <td className="py-2 pr-0 text-right">
                      {item.applicationUrl ? (
                        <a
                          aria-label={`Open ${item.company || 'application'} posting`}
                          className="inline-flex text-muted-foreground hover:text-foreground"
                          href={item.applicationUrl}
                          rel="noreferrer noopener"
                          target="_blank"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
