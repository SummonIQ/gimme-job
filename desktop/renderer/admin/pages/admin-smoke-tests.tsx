import {
  ChevronDown,
  ChevronRight,
  Copy,
  FileJson,
  MoreHorizontal,
  RefreshCw,
} from 'lucide-react';
import { Fragment, useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardActions,
  CardContent,
  CardDescription,
  CardHeader,
  CardSummary,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

import type {
  DesktopSmokeReportFull,
  DesktopSmokeReportSummary,
  DesktopSmokeTestRun,
} from '../../desktop-api';
import { filterSmokeReportFilePaths } from '../lib/smoke-report-paths';

interface SmokeReportState {
  readonly error: string | null;
  readonly reports: readonly DesktopSmokeReportSummary[];
  readonly status: 'idle' | 'loading' | 'ready' | 'error';
}

export function AdminSmokeTestsPage() {
  const [state, setState] = useState<SmokeReportState>({
    error: null,
    reports: [],
    status: 'idle',
  });
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const [detailsByPath, setDetailsByPath] = useState<
    ReadonlyMap<string, DesktopSmokeReportFull>
  >(new Map());
  const [loadingPath, setLoadingPath] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const loadReports = useCallback(() => {
    const smokeReports = window.gimmeJobDesktop?.smokeReports;
    if (!smokeReports) {
      setState({
        error: 'Desktop smoke report bridge unavailable.',
        reports: [],
        status: 'error',
      });
      return;
    }

    setState(current => ({
      ...current,
      error: null,
      status: current.reports.length === 0 ? 'loading' : current.status,
    }));

    void smokeReports
      .list()
      .then(reports => {
        setState({
          error: null,
          reports: filterSmokeReportFilePaths(reports),
          status: 'ready',
        });
      })
      .catch(error => {
        setState({
          error: error instanceof Error ? error.message : String(error),
          reports: [],
          status: 'error',
        });
      });
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleToggleReport = useCallback(
    (report: DesktopSmokeReportSummary) => {
      const nextPath = expandedPath === report.filePath ? null : report.filePath;
      setExpandedPath(nextPath);
      if (!nextPath || detailsByPath.has(nextPath)) return;

      const smokeReports = window.gimmeJobDesktop?.smokeReports;
      if (!smokeReports) return;
      setLoadingPath(nextPath);
      void smokeReports
        .read(nextPath)
        .then(detail => {
          setDetailsByPath(current => {
            const next = new Map(current);
            next.set(nextPath, detail);
            return next;
          });
        })
        .finally(() => {
          setLoadingPath(current => (current === nextPath ? null : current));
        });
    },
    [detailsByPath, expandedPath],
  );

  const handleCopy = useCallback((path: string) => {
    void navigator.clipboard?.writeText(path).then(() => {
      setCopiedPath(path);
      window.setTimeout(() => {
        setCopiedPath(current => (current === path ? null : current));
      }, 1800);
    });
  }, []);

  const isLoading = state.status === 'loading';
  const hasReports = state.reports.length > 0;

  return (
    <Card className="desktop-admin-card">
      <CardHeader>
        <CardSummary>
          <CardTitle>Smoke tests</CardTitle>
          <CardDescription>
            Review ATS smoke-test summaries and copy paths to report artifacts.
          </CardDescription>
        </CardSummary>
        <CardActions>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={loadReports}
            disabled={isLoading}
          >
            <RefreshCw data-icon="inline-start" />
            Refresh
          </Button>
        </CardActions>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {state.error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </div>
        ) : null}

        {!isLoading && !hasReports ? (
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
            No smoke tests have been run yet — start one from the Training → State tab.
          </div>
        ) : (
          <div className="rounded-lg border border-border/50">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ATS</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Runs</TableHead>
                  <TableHead>Success rate</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? <SmokeReportLoadingRows /> : null}
                {state.reports.map(report => {
                  const isExpanded = expandedPath === report.filePath;
                  const detail = detailsByPath.get(report.filePath);
                  return (
                    <Fragment key={report.filePath}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => handleToggleReport(report)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown data-icon="inline-start" />
                            ) : (
                              <ChevronRight data-icon="inline-start" />
                            )}
                            <div className="min-w-0">
                              <div className="truncate font-medium">
                                {report.runtimeProviderLabel}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {report.runtimeProviderId}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <time
                            title={new Date(report.startedAt).toLocaleString()}
                            className="text-sm"
                          >
                            {formatRelativeTime(report.startedAt)}
                          </time>
                        </TableCell>
                        <TableCell>
                          <RunBadges report={report} />
                        </TableCell>
                        <TableCell>
                          {formatSuccessRate(report.completed, report.requested)}
                        </TableCell>
                        <TableCell>
                          {formatDuration(report.totalDurationMs)}
                        </TableCell>
                        <TableCell onClick={event => event.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                aria-label="Smoke report actions"
                              >
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuGroup>
                                <DropdownMenuItem
                                  onClick={() => handleCopy(report.filePath)}
                                >
                                  <Copy data-icon="inline-start" />
                                  {copiedPath === report.filePath
                                    ? 'Copied report path'
                                    : 'Copy report path'}
                                </DropdownMenuItem>
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      {isExpanded ? (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/20 p-0">
                            <SmokeReportRuns
                              copiedPath={copiedPath}
                              detail={detail}
                              isLoading={loadingPath === report.filePath}
                              onCopy={handleCopy}
                            />
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SmokeReportLoadingRows() {
  return Array.from({ length: 4 }, (_, index) => (
    <TableRow key={index}>
      <TableCell colSpan={6}>
        <div className="h-8 rounded-md bg-muted/40" />
      </TableCell>
    </TableRow>
  ));
}

function RunBadges({ report }: { readonly report: DesktopSmokeReportSummary }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
        {report.completed} completed
      </Badge>
      <Badge variant="destructive">{report.failed} failed</Badge>
      <Badge variant="outline">{report.skipped} skipped</Badge>
    </div>
  );
}

function SmokeReportRuns({
  copiedPath,
  detail,
  isLoading,
  onCopy,
}: {
  readonly copiedPath: string | null;
  readonly detail?: DesktopSmokeReportFull;
  readonly isLoading: boolean;
  readonly onCopy: (path: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        <div className="h-8 rounded-md bg-muted/40" />
        <div className="h-8 rounded-md bg-muted/30" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Report details unavailable.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex min-w-0 items-center gap-2 rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <FileJson data-icon="inline-start" />
        <span className="truncate">{detail.filePath}</span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Application</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Tool calls</TableHead>
            <TableHead>Error</TableHead>
            <TableHead className="w-36">Run log</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {detail.runs.map(run => {
            const runLogPath = getRunLogPath(detail, run);
            return (
              <TableRow key={`${run.index}-${run.applicationUrl}`}>
                <TableCell className="max-w-[24rem]">
                  <div className="truncate font-medium">
                    {run.title ?? 'Untitled run'}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {run.applicationUrl || 'No application URL'}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={run.status === 'completed' ? 'secondary' : 'outline'}
                    className={cn(
                      run.status === 'failed' || run.status === 'unavailable'
                        ? 'border-destructive/40 text-destructive'
                        : null,
                    )}
                  >
                    {run.status}
                  </Badge>
                </TableCell>
                <TableCell>{formatDuration(run.durationMs)}</TableCell>
                <TableCell>{run.toolCallCount ?? '—'}</TableCell>
                <TableCell className="max-w-[18rem]">
                  <div className="truncate text-sm">
                    {run.errorTool ?? '—'}
                  </div>
                  {run.errorToolMessage ? (
                    <div className="truncate text-xs text-muted-foreground">
                      {run.errorToolMessage}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => onCopy(runLogPath)}
                  >
                    <Copy data-icon="inline-start" />
                    {copiedPath === runLogPath
                      ? 'Copied'
                      : run.runId
                        ? 'Copy log'
                        : 'Copy folder'}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function getRunLogPath(
  report: DesktopSmokeReportFull,
  run: DesktopSmokeTestRun,
): string {
  if (!run.runId) return report.runLogsDirectory;
  return `${report.runLogsDirectory.replace(/[/\\]$/, '')}/${run.runId}.jsonl`;
}

function formatSuccessRate(completed: number, requested: number): string {
  if (requested <= 0) return '—';
  return `${Math.round((completed / requested) * 100)}%`;
}

function formatDuration(durationMs: number | null): string {
  if (durationMs === null) return '—';
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}
