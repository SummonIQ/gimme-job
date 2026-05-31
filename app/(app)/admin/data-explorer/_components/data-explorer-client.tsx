'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Copy,
  Filter,
  Loader2,
  Search,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const TABS = [
  {
    key: 'observations',
    label: 'Observations',
    description: 'ATS field observations from assist mode',
  },
  {
    key: 'rules',
    label: 'Rules',
    description: 'Promoted rules from repeated observations',
  },
  {
    key: 'ats-systems',
    label: 'ATS Systems',
    description: 'Detected ATS platforms and their configs',
  },
  {
    key: 'training-sessions',
    label: 'Training',
    description: 'Vision-driven training runs',
  },
  {
    key: 'analysis-jobs',
    label: 'Analysis Jobs',
    description: 'ATS research analysis jobs',
  },
  {
    key: 'applications',
    label: 'Applications',
    description: 'Application submissions',
  },
] as const;

type TabKey = (typeof TABS)[number]['key'];

interface DataResponse {
  table: string;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  columns: string[];
  rows: Record<string, unknown>[];
}

// Filterable columns per table — clicking a cell value in these columns applies a filter
const FILTERABLE_COLUMNS: Record<string, string[]> = {
  observations: [
    'hostname',
    'action',
    'actionType',
    'tagName',
    'success',
    'inputType',
    'inputMode',
  ],
  rules: ['hostname', 'action', 'actionType', 'tagName', 'enabled'],
  'ats-systems': ['difficulty', 'isMultiStep', 'vendor'],
  'training-sessions': ['status', 'hostname', 'atsSystemName'],
  'analysis-jobs': ['status'],
  applications: ['status', 'wasAutomated'],
};

// Date columns for relative time formatting
const DATE_COLUMNS = new Set([
  'createdAt',
  'updatedAt',
  'startedAt',
  'completedAt',
  'lastAnalyzed',
  'submittedAt',
]);

function relativeTime(dateStr: string): string {
  try {
    const ms = Date.now() - new Date(dateStr).getTime();
    if (ms < 0) return 'just now';
    const secs = Math.floor(ms / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

export function DataExplorerClient() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('observations');
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({});
  const [data, setData] = useState<DataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [columnFilter, setColumnFilter] = useState<{
    col: string;
    val: string;
  } | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [selectedRow, setSelectedRow] = useState<Record<
    string,
    unknown
  > | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Fetch tab counts on mount
  useEffect(() => {
    fetch('/api/admin/data-explorer?counts=true', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setTabCounts(d.counts ?? {}))
      .catch(() => {});
  }, []);

  const visibleColumns = useMemo(
    () => (data?.columns ?? []).filter(c => !hiddenColumns.has(c)),
    [data?.columns, hiddenColumns],
  );

  const fetchData = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        table: activeTab,
        page: String(page),
        pageSize: String(pageSize),
        sortDir,
      });
      if (search) params.set('search', search);
      if (sortBy) params.set('sortBy', sortBy);
      if (columnFilter) {
        params.set('columnFilter', columnFilter.col);
        params.set('columnValue', columnFilter.val);
      }

      const res = await fetch(`/api/admin/data-explorer?${params}`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Fetch failed');
      const json = await res.json();
      setData(json);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('[DataExplorer]', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, pageSize, search, sortBy, sortDir, columnFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Keyboard navigation: arrow keys for pagination
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === 'ArrowLeft' && page > 1) {
        e.preventDefault();
        setPage(p => p - 1);
      } else if (e.key === 'ArrowRight' && data && page < data.totalPages) {
        e.preventDefault();
        setPage(p => p + 1);
      } else if (e.key === 'Escape') {
        setSelectedRow(null);
        setShowColumnPicker(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [page, data]);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setPage(1);
    setSearch('');
    setSearchInput('');
    setSortBy(undefined);
    setSortDir('desc');
    setColumnFilter(null);
    setHiddenColumns(new Set());
    setSelectedRow(null);
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('desc');
    }
    setPage(1);
  };

  const handleCellFilter = (col: string, val: unknown) => {
    const strVal = String(val);
    if (columnFilter?.col === col && columnFilter?.val === strVal) {
      setColumnFilter(null);
    } else {
      setColumnFilter({ col, val: strVal });
      setPage(1);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: text.length > 60 ? text.slice(0, 60) + '...' : text,
    });
  };

  const isFilterableColumn = (col: string) =>
    FILTERABLE_COLUMNS[activeTab]?.includes(col) ?? false;

  const formatCellValue = (value: unknown, column: string): string => {
    if (value === null || value === undefined) return '—';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'string' && DATE_COLUMNS.has(column)) {
      return relativeTime(value);
    }
    return String(value);
  };

  const getRawDateStr = (value: unknown, column: string): string | null => {
    if (typeof value === 'string' && DATE_COLUMNS.has(column)) {
      try {
        return new Date(value).toLocaleString();
      } catch {
        return null;
      }
    }
    return null;
  };

  const getCellColor = (value: unknown, column: string): string => {
    if (column === 'success' || column === 'enabled') {
      return value === true
        ? 'text-green-400'
        : value === false
          ? 'text-red-400'
          : '';
    }
    if (column === 'status') {
      const s = String(value).toLowerCase();
      if (['completed', 'active', 'submitted', 'analyzed'].includes(s))
        return 'text-green-400';
      if (
        [
          'running',
          'pending',
          'processing',
          'analyzing',
          'in_progress',
        ].includes(s)
      )
        return 'text-blue-400';
      if (['failed', 'rejected'].includes(s)) return 'text-red-400';
    }
    if (column === 'confidence') {
      const n = Number(value);
      if (n >= 0.8) return 'text-green-400';
      if (n >= 0.5) return 'text-yellow-400';
      return 'text-red-400';
    }
    if (column === 'observationCount') {
      const n = Number(value);
      if (n >= 10) return 'text-green-400';
      if (n >= 4) return 'text-yellow-400';
    }
    return '';
  };

  const toggleColumn = (col: string) => {
    setHiddenColumns(prev => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  };

  const currentTabInfo = TABS.find(t => t.key === activeTab);

  return (
    <div className="space-y-3">
      {/* Tabs with counts */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-border/50 bg-muted/20 p-1">
        {TABS.map(tab => {
          const count =
            activeTab === tab.key && data
              ? data.totalCount
              : tabCounts[tab.key];
          return (
            <button
              key={tab.key}
              type="button"
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
              onClick={() => handleTabChange(tab.key)}
            >
              {tab.label}
              {count !== undefined && (
                <span className="ml-1.5 font-mono text-[10px] text-muted-foreground/70">
                  {count.toLocaleString()}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Toolbar: search, active filters, column picker */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder={`Search ${currentTabInfo?.label ?? ''}...`}
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="h-8 pl-8 text-xs"
          />
          {search && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSearch('');
                setSearchInput('');
                setPage(1);
              }}
            >
              <X className="size-3" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={handleSearch}
        >
          Search
        </Button>

        {/* Active column filter chip */}
        {columnFilter && (
          <Badge
            variant="outline"
            className="gap-1 text-xs cursor-pointer border-primary/40 text-primary hover:bg-primary/10"
            onClick={() => {
              setColumnFilter(null);
              setPage(1);
            }}
          >
            <Filter className="size-3" />
            {columnFilter.col} = &quot;{columnFilter.val}&quot;
            <X className="size-3" />
          </Badge>
        )}

        {/* Active search chip */}
        {search && (
          <Badge
            variant="outline"
            className="gap-1 text-xs cursor-pointer hover:bg-muted/40"
            onClick={() => {
              setSearch('');
              setSearchInput('');
              setPage(1);
            }}
          >
            <Search className="size-3" />
            &quot;{search}&quot;
            <X className="size-3" />
          </Badge>
        )}

        <div className="flex-1" />

        {/* Column picker toggle */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setShowColumnPicker(p => !p)}
          >
            <Columns3 className="size-3.5" />
            Columns
            {hiddenColumns.size > 0 && (
              <span className="text-[10px] text-muted-foreground">
                ({(data?.columns.length ?? 0) - hiddenColumns.size}/
                {data?.columns.length ?? 0})
              </span>
            )}
          </Button>
          {showColumnPicker && data && (
            <div className="absolute right-0 top-full mt-1 z-50 w-56 max-h-72 overflow-y-auto rounded-lg border border-border bg-background shadow-lg p-2 space-y-0.5">
              <div className="flex items-center justify-between px-1 pb-1 border-b border-border/50 mb-1">
                <span className="text-[10px] font-medium text-muted-foreground">
                  Toggle columns
                </span>
                <button
                  type="button"
                  className="text-[10px] text-primary hover:underline"
                  onClick={() => setHiddenColumns(new Set())}
                >
                  Show all
                </button>
              </div>
              {data.columns.map(col => (
                <label
                  key={col}
                  className="flex items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted/40 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={!hiddenColumns.has(col)}
                    onChange={() => toggleColumn(col)}
                    className="size-3 rounded"
                  />
                  <span className="font-mono truncate">{col}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground hidden lg:block">
          ← → to paginate · Esc to close
        </p>
      </div>

      {/* Table */}
      <div
        ref={tableRef}
        className="rounded-lg border border-border/50 overflow-hidden"
      >
        <div className="overflow-x-auto max-h-[calc(100vh-320px)]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border/50 bg-muted/80 backdrop-blur-sm">
                <th className="px-2 py-2 text-center text-muted-foreground/50 w-8">
                  #
                </th>
                {visibleColumns.map(col => (
                  <th
                    key={col}
                    className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground transition-colors select-none"
                    onClick={() => handleSort(col)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col}
                      {isFilterableColumn(col) && (
                        <Filter className="size-2 opacity-20" />
                      )}
                      {sortBy === col ? (
                        sortDir === 'asc' ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        )
                      ) : (
                        <ArrowUpDown className="size-2.5 opacity-20" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr>
                  <td
                    colSpan={100}
                    className="px-3 py-12 text-center text-muted-foreground"
                  >
                    <Loader2 className="size-5 animate-spin mx-auto mb-2" />
                    Loading...
                  </td>
                </tr>
              ) : data?.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={100}
                    className="px-3 py-12 text-center text-muted-foreground"
                  >
                    No data found{search ? ` for "${search}"` : ''}
                    {columnFilter
                      ? ` with ${columnFilter.col}="${columnFilter.val}"`
                      : ''}
                    .
                  </td>
                </tr>
              ) : (
                data?.rows.map((row, rowIdx) => {
                  const globalIdx =
                    (data.page - 1) * data.pageSize + rowIdx + 1;
                  return (
                    <tr
                      key={String(row.id ?? rowIdx)}
                      className={`border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer ${
                        selectedRow?.id === row.id
                          ? 'bg-primary/5 border-primary/20'
                          : ''
                      }`}
                      onClick={() =>
                        setSelectedRow(selectedRow?.id === row.id ? null : row)
                      }
                    >
                      <td className="px-2 py-2 text-center text-[10px] text-muted-foreground/40 font-mono">
                        {globalIdx}
                      </td>
                      {visibleColumns.map(col => {
                        const raw = row[col];
                        const formatted = formatCellValue(raw, col);
                        const fullDate = getRawDateStr(raw, col);
                        const isLong = formatted.length > 50;
                        const colorClass = getCellColor(raw, col);
                        const filterable =
                          isFilterableColumn(col) &&
                          raw !== null &&
                          raw !== undefined;

                        return (
                          <td
                            key={col}
                            className={`px-3 py-2 font-mono whitespace-nowrap max-w-[300px] ${colorClass}`}
                            title={
                              fullDate ??
                              (formatted.length > 50 ? formatted : undefined)
                            }
                          >
                            <span className="inline-flex items-center gap-1 group">
                              {col === 'id' ? (
                                <button
                                  type="button"
                                  className="text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                                  onClick={e => {
                                    e.stopPropagation();
                                    copyToClipboard(String(raw));
                                  }}
                                  title="Click to copy full ID"
                                >
                                  {formatted.slice(0, 10)}…
                                  <Copy className="size-2.5 inline ml-1 opacity-0 group-hover:opacity-50" />
                                </button>
                              ) : typeof raw === 'boolean' ? (
                                <span
                                  className={`inline-flex items-center gap-1 ${filterable ? 'cursor-pointer hover:underline' : ''}`}
                                  onClick={
                                    filterable
                                      ? e => {
                                          e.stopPropagation();
                                          handleCellFilter(col, raw);
                                        }
                                      : undefined
                                  }
                                >
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${raw ? 'border-green-500/30 text-green-400' : 'border-red-500/30 text-red-400'}`}
                                  >
                                    {formatted}
                                  </Badge>
                                  {filterable && (
                                    <Filter className="size-2 opacity-0 group-hover:opacity-40" />
                                  )}
                                </span>
                              ) : col === 'status' ? (
                                <span
                                  className={`inline-flex items-center gap-1 ${filterable ? 'cursor-pointer hover:underline' : ''}`}
                                  onClick={
                                    filterable
                                      ? e => {
                                          e.stopPropagation();
                                          handleCellFilter(col, raw);
                                        }
                                      : undefined
                                  }
                                >
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${getCellColor(raw, col).replace('text-', 'border-').replace('400', '500/30')} ${getCellColor(raw, col)}`}
                                  >
                                    {formatted}
                                  </Badge>
                                  {filterable && (
                                    <Filter className="size-2 opacity-0 group-hover:opacity-40" />
                                  )}
                                </span>
                              ) : filterable ? (
                                <span
                                  className="cursor-pointer hover:underline hover:text-foreground transition-colors inline-flex items-center gap-1"
                                  onClick={e => {
                                    e.stopPropagation();
                                    handleCellFilter(col, raw);
                                  }}
                                  title={`Filter by ${col}="${raw}"`}
                                >
                                  <span className="truncate max-w-[250px]">
                                    {formatted}
                                  </span>
                                  <Filter className="size-2 opacity-0 group-hover:opacity-40 shrink-0" />
                                </span>
                              ) : isLong ? (
                                <span
                                  className="truncate max-w-[250px]"
                                  title={formatted}
                                >
                                  {formatted}
                                </span>
                              ) : (
                                formatted
                              )}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Loading indicator */}
        {loading && data && (
          <div className="flex items-center justify-center py-1 bg-muted/20 border-t border-border/30">
            <Loader2 className="size-3 animate-spin mr-1.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              Refreshing...
            </span>
          </div>
        )}
      </div>

      {/* Row detail drawer */}
      <Drawer
        open={!!selectedRow}
        onOpenChange={open => {
          if (!open) setSelectedRow(null);
        }}
      >
        <DrawerContent>
          <DrawerHeader className="flex flex-row items-center justify-between gap-4">
            <DrawerTitle className="text-sm">Row Detail</DrawerTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() =>
                  copyToClipboard(JSON.stringify(selectedRow, null, 2))
                }
              >
                <Copy className="size-3" />
                Copy JSON
              </Button>
              <DrawerClose asChild>
                <button type="button">
                  <X className="size-4 text-muted-foreground hover:text-foreground" />
                </button>
              </DrawerClose>
            </div>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6 max-h-[60vh]">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {selectedRow &&
                Object.entries(selectedRow).map(([key, val]) => {
                  const formatted =
                    val === null || val === undefined
                      ? '—'
                      : typeof val === 'object'
                        ? JSON.stringify(val, null, 2)
                        : typeof val === 'string' && DATE_COLUMNS.has(key)
                          ? new Date(val).toLocaleString()
                          : String(val);
                  return (
                    <div
                      key={key}
                      className="rounded-md border border-border/40 bg-muted/20 px-3 py-2"
                    >
                      <p className="text-[10px] text-muted-foreground font-medium mb-0.5">
                        {key}
                      </p>
                      <p
                        className={`text-xs font-mono break-all ${getCellColor(val, key)}`}
                      >
                        {formatted.length > 500 ? (
                          <span title={formatted}>
                            {formatted.slice(0, 500)}...
                          </span>
                        ) : (
                          formatted
                        )}
                      </p>
                    </div>
                  );
                })}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Pagination */}
      {data && data.totalPages > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {(data.page - 1) * data.pageSize + 1}–
            {Math.min(data.page * data.pageSize, data.totalCount)} of{' '}
            {data.totalCount.toLocaleString()}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={page <= 1}
              onClick={() => setPage(1)}
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="px-2 text-xs font-mono text-muted-foreground">
              {data.page}/{data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={page >= data.totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={page >= data.totalPages}
              onClick={() => setPage(data.totalPages)}
            >
              Last
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
