'use client';

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns,
  Download,
  Loader2,
} from 'lucide-react';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { AnimatedSortIcon } from '@/components/ui/animated-sort-icon';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDebounce } from '@/hooks/use-debounce';
import { useReportData } from '@/hooks/use-report-data';
import { cn } from '@/lib/css';
import type { ApiQuery } from '@/types/reporting/query';
import { ReportColumn } from '@/types/reporting/report';

const getAlignmentClass = (align?: 'left' | 'center' | 'right') => {
  switch (align) {
    case 'center':
      return 'text-center justify-center';
    case 'right':
      return 'text-right justify-end';
    default:
      return 'text-left justify-start';
  }
};

function normalizeSortableValue(value: unknown): number | string {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  if (typeof value === 'string') {
    const asTimestamp = Date.parse(value);
    if (!Number.isNaN(asTimestamp) && /\d/.test(value)) {
      return asTimestamp;
    }

    return value.toLocaleLowerCase();
  }

  if (value == null) {
    return '';
  }

  return String(value).toLocaleLowerCase();
}

function sortRowsOptimistically<T>(
  rows: T[],
  field: keyof T,
  direction: 'asc' | 'desc',
): T[] {
  const sortedRows = [...rows];

  sortedRows.sort((leftRow, rightRow) => {
    const leftValue = normalizeSortableValue(leftRow[field]);
    const rightValue = normalizeSortableValue(rightRow[field]);

    if (typeof leftValue === 'number' && typeof rightValue === 'number') {
      return direction === 'asc'
        ? leftValue - rightValue
        : rightValue - leftValue;
    }

    const comparison = String(leftValue).localeCompare(
      String(rightValue),
      undefined,
      {
        numeric: true,
        sensitivity: 'base',
      },
    );

    return direction === 'asc' ? comparison : -comparison;
  });

  return sortedRows;
}

// First, let's define some consistent spacing constants
const CELL_PADDING = 'px-4 py-3';
const CELL_PADDING_SORTABLE = 'pl-7 pr-4 py-3'; // Extra left padding for sortable columns
const SELECTION_COLUMN_WIDTH = 'w-8 min-w-8 max-w-8';

function ReportHeaderCell<T>({
  className,
  col,
  onSort,
  onToggleVisibility,
  sortDirection,
}: {
  className?: string;
  col: ReportColumn<T>;
  onSort: (desc: boolean) => void;
  onToggleVisibility: () => void;
  sortDirection: false | 'asc' | 'desc';
}) {
  const justifyClass =
    col.align === 'right'
      ? 'justify-end'
      : col.align === 'center'
        ? 'justify-center'
        : 'justify-start';

  if (!col.sortable) {
    return (
      <div
        className={cn(
          'flex h-full items-center py-0.5',
          justifyClass,
          className,
        )}
      >
        {col.headerFn ? col.headerFn() : col.header}
      </div>
    );
  }

  // Toggle sort: if not sorted -> asc, if asc -> desc, if desc -> asc
  const handleClick = () => {
    if (!sortDirection || sortDirection === 'desc') {
      onSort(false); // asc
    } else {
      onSort(true); // desc
    }
  };

  return (
    <Button
      className={cn(
        'flex h-full w-full items-center px-0 py-0 hover:bg-black/6 dark:hover:bg-white/8',
        justifyClass,
        className,
      )}
      size="sm"
      variant="ghost"
      onClick={event => {
        event.stopPropagation();
        handleClick();
      }}
    >
      <span>{col.headerFn ? col.headerFn() : col.header}</span>
      <AnimatedSortIcon
        sortDirection={sortDirection || 'asc'}
        className={cn(
          'ml-1.5',
          sortDirection ? 'text-muted-foreground' : 'text-muted-foreground/40',
        )}
        size={16}
        inactive={!sortDirection}
      />
    </Button>
  );
}

export type ReportProps<T, I> = {
  cacheKey?: string;
  className?: string;
  columns: Array<ReportColumn<T>>;
  enableRowSelection?: boolean;
  initialData?: Array<T>;
  initialQuery?: ApiQuery<T, I>;
  model: string;
  onRowClick?: (row: T) => void;
  onSelectedRowsChange?: (selectedRows: Record<string, T>) => void;
  searchField?: keyof T & string;
  searchPlaceholder?: string;
  selectedRows?: Record<string, T>;
  showColumnToggle?: boolean;
  showExport?: boolean;
  showPagination?: boolean;
  showSearch?: boolean;
  showSelectedCount?: boolean;
  isPaginationSticky?: boolean;
  totalCount?: number;
};

export function Report<T, I>({
  cacheKey,
  model,
  columns: initialColumns,
  initialQuery,
  initialData,
  searchField,
  searchPlaceholder = 'Search...',
  selectedRows,
  showColumnToggle = false,
  showExport = false,
  showPagination = true,
  showSearch = true,
  showSelectedCount = false,
  isPaginationSticky = false,
  totalCount: initialTotalCount = 0,
  enableRowSelection = false,
  className,
  onRowClick,
  onSelectedRowsChange,
}: ReportProps<T, I>) {
  const {
    data,
    loading,
    error,
    query,
    updateQuery,
    nextPage,
    previousPage,
    canNextPage,
    canPreviousPage,
    totalCount: reportTotalCount,
  } = useReportData<T, I>({
    cacheKey,
    initialData,
    initialQuery,
    model,
    initialTotalCount,
  });
  const totalCount =
    reportTotalCount === 0 ? initialTotalCount : reportTotalCount;

  // Use debounced search value
  const [searchValue, setSearchValue] = useState('');
  const debouncedSearchValue = useDebounce(searchValue, 300);

  // Update filters when debounced search value changes
  useEffect(() => {
    if (searchField && debouncedSearchValue) {
      updateQuery({
        ...query,
        filters: debouncedSearchValue
          ? [
              {
                field: searchField,
                operator: 'contains',
                value: debouncedSearchValue,
              },
              ...(query.filters ?? []),
            ]
          : [],
        pagination: {
          ...query.pagination,
          start: 0, // Reset to first page when searching
        },
      });
    }
  }, [debouncedSearchValue, searchField, updateQuery]);

  // Maintain local column visibility state.
  const [columns, setColumns] = useState<ReportColumn<T>[]>(initialColumns);

  // Helper to get a unique row id.
  const getRowId = (row: T, idx: number): string =>
    (row as any).id ?? String(idx);

  // Internal state to track row selections
  const [rowSelection, setRowSelection] = useState<Record<string, T>>(
    selectedRows ?? {},
  );

  // *** Synchronize internal row selection with the external prop ***
  useEffect(() => {
    setRowSelection(selectedRows ?? {});
  }, [selectedRows]);

  // When row selection changes, call onSelectedRowsChange with the selected rows
  useEffect(() => {
    if (!onSelectedRowsChange) return;

    onSelectedRowsChange(rowSelection);
  }, [rowSelection, onSelectedRowsChange]);

  // if (error) {
  //   console.error('error', error);
  // }
  // Determine visible columns.
  const visibleColumns = columns.filter(col => col.visible !== false);

  const totalColumns = (enableRowSelection ? 1 : 0) + visibleColumns.length;

  // Update the handleSort function to properly handle direction changes
  const handleSort = (col: ReportColumn<T>, desc?: boolean) => {
    if (!col.sortable || !col.key) return;
    let newDirection: 'asc' | 'desc';
    if (typeof desc === 'boolean') {
      newDirection = desc ? 'desc' : 'asc';
    } else {
      const currentDirection = query.sort?.[0]?.direction;
      const currentField = query.sort?.[0]?.field;
      newDirection =
        currentField === col.key
          ? currentDirection === 'asc'
            ? 'desc'
            : 'asc'
          : 'asc';
    }

    setPaginatedData(prevRows =>
      sortRowsOptimistically(prevRows, col.key as keyof T, newDirection),
    );

    updateQuery({
      ...query,
      pagination: {
        ...query.pagination,
        start: 0, // Reset to first page when sorting changes
      },
      sort: [{ direction: newDirection, field: col.key }],
    });
  };
  const [paginatedData, setPaginatedData] = useState<Array<T>>(
    initialData ?? [],
  );

  const getColumnWidths = (cells: NodeListOf<Element>): number[] => {
    return Array.from(cells).map(cell => {
      const computed = window.getComputedStyle(cell);
      const minWidth = Number.parseFloat(computed.minWidth);
      const maxWidth = Number.parseFloat(computed.maxWidth);

      if (Number.isFinite(minWidth) && minWidth > 0) {
        return Math.ceil(minWidth);
      }

      if (Number.isFinite(maxWidth) && maxWidth > 0) {
        return Math.ceil(maxWidth);
      }

      return Math.ceil(cell.getBoundingClientRect().width);
    });
  };

  useLayoutEffect(() => {
    if (!tableRef.current) return;
    const bodyRowCells = tableRef.current.querySelectorAll(
      'tbody tr:first-child td',
    );
    const headerCells = tableRef.current.querySelectorAll('thead th');
    const cells = bodyRowCells.length ? bodyRowCells : headerCells;
    if (!cells.length) return;
    const widths = getColumnWidths(cells);
    if (widths.length === totalColumns) {
      setColumnWidths(widths);
    }
  }, [paginatedData, totalColumns]);

  useEffect(() => {
    if (!tableContainerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (!tableRef.current) return;
      const bodyRowCells = tableRef.current.querySelectorAll(
        'tbody tr:first-child td',
      );
      const headerCells = tableRef.current.querySelectorAll('thead th');
      const cells = bodyRowCells.length ? bodyRowCells : headerCells;
      if (!cells.length) return;
      const widths = getColumnWidths(cells);
      if (widths.length === totalColumns) {
        setColumnWidths(widths);
      }
    });
    observer.observe(tableContainerRef.current);
    return () => observer.disconnect();
  }, [totalColumns]);

  // Helper to get current sort direction for a column
  const getColumnSort = (col: ReportColumn<T>): false | 'asc' | 'desc' => {
    if (!query.sort?.[0] || query.sort[0].field !== col.key) return false;
    return query.sort[0].direction;
  };

  // Helper to check if column is currently sorted
  const isColumnSorted = (col: ReportColumn<T>): boolean => {
    return query.sort?.[0]?.field === col.key;
  };

  // Sorted column highlight class
  const SORTED_COLUMN_BG = 'bg-foreground/[0.01] dark:bg-foreground/[0.015]';

  // Pagination: assume query.pagination exists with start and count.

  // Update toggle all function to store full row objects
  const toggleSelectAll = (checked: boolean) => {
    const newSelection: Record<string, T> = {};
    if (checked) {
      paginatedData.forEach((row, idx) => {
        newSelection[getRowId(row, idx)] = row;
      });
    }
    setRowSelection(newSelection);
  };

  const allSelected =
    paginatedData.length > 0 &&
    paginatedData.every((row, idx) => !!rowSelection[getRowId(row, idx)]);
  const someSelected =
    paginatedData.some((row, idx) => !!rowSelection[getRowId(row, idx)]) &&
    !allSelected;

  const showPaginationControls =
    showPagination &&
    ((!loading && (totalCount ?? initialTotalCount > 0)) ||
      (loading && data?.length));

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [columnWidths, setColumnWidths] = useState<number[]>([]);

  const initialLoad = useRef(true);
  useEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false;
      return;
    }
    window.scrollTo({ behavior: 'smooth', top: 0 });
  }, [query.pagination?.start]);

  // Calculate current page and total pages
  const currentPage =
    Math.floor(
      (query.pagination?.start ?? 0) / (query.pagination?.count ?? 10),
    ) + 1;
  const totalPages = Math.ceil(
    (totalCount ?? initialTotalCount) / (query.pagination?.count ?? 10),
  );

  // Update pagination controls to preserve filters
  const goToFirstPage = () => {
    updateQuery({
      ...query, // Preserve existing query params including filters
      pagination: { ...query.pagination, start: 0 },
    });
  };

  const goToLastPage = () => {
    const lastPageStart = Math.max(
      0,
      Math.floor(
        (totalCount ?? initialTotalCount) / (query.pagination?.count ?? 10),
      ) * (query.pagination?.count ?? 10),
    );
    updateQuery({
      ...query, // Preserve existing query params including filters
      pagination: { ...query.pagination, start: lastPageStart },
    });
  };

  // Update the rows per page handler
  const handleRowsPerPageChange = (value: string) => {
    updateQuery({
      ...query, // Preserve existing query params including filters
      pagination: {
        ...query.pagination,
        count: Number(value),
        start: 0,
      },
    });
  };

  // useEffect(() => {
  //   setColumns(initialColumns);
  // }, [initialColumns]);

  useEffect(() => {
    // setColumns(initialColumns);
    setColumns(initialColumns);
    setPaginatedData(data ?? initialData ?? []);
  }, [data, initialColumns, initialData]);

  return (
    <div
      className={cn(
        'relative flex min-h-0 flex-col rounded-xl',
        'border-y border-t-border border-b-border/40 bg-muted/50 shadow-xl',
        !showPaginationControls && 'pb-0',
      )}
      ref={tableContainerRef}
    >
      {/* Controls */}
      {(showColumnToggle || showExport || showSearch) && (
        <div className="relative z-10 flex shrink-0 items-center justify-between space-x-2 px-3 py-2 pb-2.5 md:space-x-4">
          {showSearch && searchField && (
            <Input
              className="h-10 w-72 max-w-sm pl-8 text-sm dark:border-b-zinc-800 dark:border-x-0"
              onChange={e => setSearchValue(e.target.value)}
              placeholder={searchPlaceholder}
              type="search"
              value={searchValue}
            />
          )}
          <div className="flex items-center space-x-3">
            {showColumnToggle && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="ml-auto size-9 p-0 text-foreground/70"
                    variant="outline"
                  >
                    <Columns className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {columns
                    .filter(col => col.hideable ?? true)
                    .map((col, idx) => (
                      <DropdownMenuCheckboxItem
                        checked={col.visible !== false}
                        className="capitalize"
                        key={idx}
                        onCheckedChange={value =>
                          setColumns(prev =>
                            prev.map((c, i) =>
                              i === idx ? { ...c, visible: value } : c,
                            ),
                          )
                        }
                      >
                        {col.header || (col.headerFn && col.headerFn())}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {showExport && (
              <Button className="ml-4" variant="secondary">
                <Download className="mr-2 size-4" />
                Export
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div
        className={cn(
          'relative mx-3 mb-3 min-h-0 flex-1 overflow-hidden rounded-lg border-t border-t-border bg-white dark:bg-[#0a0a0a]',
          // showPaginationControls && 'mb-[60px]',
        )}
      >
        <Table className="min-w-full" ref={tableRef}>
          {columnWidths.length === totalColumns && (
            <colgroup>
              {columnWidths.map((width, index) => (
                <col key={`col-${index}`} style={{ width }} />
              ))}
            </colgroup>
          )}
          <TableHeader className="sticky top-0 z-10 w-full rounded-t-lg border-b border-b-border bg-muted shadow-xs backdrop-blur-sm dark:bg-[#101013]">
            <TableRow className="relative gap-0 h-[52px] !border-b-0 hover:bg-transparent">
              {enableRowSelection && (
                <TableHead
                  className={cn(
                    SELECTION_COLUMN_WIDTH,
                    'h-[52px] rounded-tl-lg pl-4 pr-0 text-sm font-medium text-muted-foreground align-middle',
                  )}
                >
                  <div className="flex items-center py-2 justify-center h-full">
                    <Checkbox
                      aria-label="Select all"
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                      size="w-4 h-4"
                    />
                  </div>
                </TableHead>
              )}
              {visibleColumns.map((col, idx) => (
                <TableHead
                  className={cn(
                    'h-[52px] border-r border-r-border/40 px-4 py-3 align-middle first:rounded-tl-lg first:pl-5 last:rounded-tr-lg last:border-r-0 dark:border-r-[#1f1f23]',
                    col.sortable && 'cursor-pointer',
                    getAlignmentClass(col.align),
                    col.sortable &&
                      col.key &&
                      isColumnSorted(col) &&
                      SORTED_COLUMN_BG,
                    col.className,
                  )}
                  key={idx}
                  onClick={() => {
                    if (!col.sortable || !col.key) return;

                    const sortDirection = getColumnSort(col);
                    handleSort(
                      col,
                      !sortDirection || sortDirection === 'desc' ? false : true,
                    );
                  }}
                  style={{ maxWidth: col.maxWidth, minWidth: col.minWidth }}
                >
                  <ReportHeaderCell
                    className={cn(
                      'text-sm font-medium h-full w-full text-muted-foreground',
                      getAlignmentClass(col.align),
                    )}
                    col={col}
                    onSort={(desc: boolean) => handleSort(col, desc)}
                    onToggleVisibility={() => {
                      setColumns(prev =>
                        prev.map((c, i) =>
                          i === idx ? { ...c, visible: false } : c,
                        ),
                      );
                    }}
                    sortDirection={getColumnSort(col)}
                  />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className="relative w-full dark:bg-zinc-700/20">
            {paginatedData.length ? (
              paginatedData.map((row, rowIndex) => {
                return (
                  <TableRow
                    className="group h-16 cursor-pointer rounded-lg border-x border-x-border/15 border-b border-b-border/15 dark:border-b-[#222226] last:border-b-0 transition-all duration-200 ease-out hover:ring-[3px] hover:ring-inset hover:ring-primary/70 focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-primary"
                    key={getRowId(row, rowIndex)}
                    onClick={() => onRowClick?.(row)}
                    onKeyDown={event => {
                      if (!onRowClick) return;

                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onRowClick(row);
                      }
                    }}
                    tabIndex={0}
                  >
                    {enableRowSelection && (
                      <TableCell
                        className={cn(
                          SELECTION_COLUMN_WIDTH,
                          'pl-4 pr-0 text-sm text-foreground align-top pt-4',
                        )}
                      >
                        <div className="flex items-start justify-center">
                          <Checkbox
                            aria-label="Select row"
                            checked={!!rowSelection[getRowId(row, rowIndex)]}
                            size="w-4 h-4"
                            onCheckedChange={checked =>
                              setRowSelection(prev => {
                                const newSelection = { ...prev };
                                if (checked) {
                                  newSelection[getRowId(row, rowIndex)] = row;
                                } else {
                                  delete newSelection[getRowId(row, rowIndex)];
                                }
                                return newSelection;
                              })
                            }
                          />
                        </div>
                      </TableCell>
                    )}
                    {visibleColumns.map((col, colIndex) => (
                      <TableCell
                        className={cn(
                          'pl-4 pr-4 py-3 text-sm text-foreground border-r border-r-border/10 dark:border-r-[#19191d] first:pl-5 last:border-r-0',
                          col.align === 'center' && 'text-center',
                          col.align === 'right' && 'text-right',
                          col.sortable &&
                            col.key &&
                            isColumnSorted(col) &&
                            SORTED_COLUMN_BG,
                          col.className,
                        )}
                        key={colIndex}
                        style={{
                          maxWidth: col.maxWidth,
                          minWidth: col.minWidth,
                        }}
                      >
                        {col.cellFn
                          ? col.cellFn(row)
                          : col.key
                            ? (row[col.key] as React.ReactNode)
                            : null}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            ) : loading ? (
              <TableRow>
                <TableCell
                  className="h-28 text-center"
                  colSpan={(enableRowSelection ? 1 : 0) + visibleColumns.length}
                >
                  <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    <span>Loading report...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <TableRow>
                <TableCell
                  className="h-24 text-center"
                  colSpan={(enableRowSelection ? 1 : 0) + visibleColumns.length}
                >
                  <div className="flex h-full items-center justify-center">
                    <p className="text-sm text-muted-foreground">No results.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {loading && paginatedData.length > 0 && (
          <div
            className={cn(
              'pointer-events-none absolute inset-x-0 top-[52px] z-20 flex justify-center pt-3',
            )}
          >
            <div className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/95 px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
              <Loader2 className="size-3.5 animate-spin" />
              <span>Refreshing report...</span>
            </div>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {showPaginationControls ? (
        <div
          className={cn(
            isPaginationSticky && 'sticky bottom-0 z-10',
            'flex items-center justify-between',
            'border-x border-b border-x-muted/50 border-b-muted/50 bg-background/95 p-3 px-3 backdrop-blur-sm rounded-b-xl',
          )}
        >
          <div className="flex items-center justify-between gap-4 w-full">
            <div className="flex items-center space-x-2">
              <span className="text-xs">Rows:</span>
              <Select
                disabled={loading}
                onValueChange={handleRowsPerPageChange}
                value={String(query.pagination?.count ?? 10)}
              >
                <SelectTrigger className="h-8 w-20">
                  <SelectValue
                    placeholder={String(query.pagination?.count ?? 10)}
                  />
                </SelectTrigger>
                <SelectContent side="top">
                  {[5, 10, 20, 30, 40, 50].map(pageSize => (
                    <SelectItem key={pageSize} value={String(pageSize)}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-center gap-1 text-xs font-medium md:w-[140px] md:text-sm">
              Page
              <input
                type="number"
                min={1}
                max={totalPages}
                value={currentPage}
                onChange={e => {
                  const page = parseInt(e.target.value);
                  if (page >= 1 && page <= totalPages) {
                    const pageSize = query.pagination?.count ?? 10;
                    updateQuery({
                      ...query,
                      pagination: {
                        ...query.pagination,
                        start: (page - 1) * pageSize,
                      },
                    });
                  }
                }}
                className="w-10 rounded border border-border bg-transparent px-1 py-0.5 text-center text-xs font-medium tabular-nums focus:outline-none focus:ring-1 focus:ring-primary md:text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              of {totalPages}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                className="hidden size-8 lg:flex"
                disabled={loading || !canPreviousPage}
                onClick={goToFirstPage}
                type="button"
                variant="outline"
              >
                <ChevronsLeft className="size-4" />
              </Button>

              <Button
                className="size-8"
                disabled={loading || !canPreviousPage}
                onClick={previousPage}
                type="button"
                variant="outline"
              >
                <ChevronLeft className="size-4" />
              </Button>

              <Button
                className="size-8"
                disabled={loading || !canNextPage}
                onClick={nextPage}
                type="button"
                variant="outline"
              >
                <ChevronRight className="size-4" />
              </Button>

              <Button
                className="hidden size-8 lg:flex"
                disabled={loading || !canNextPage}
                onClick={goToLastPage}
                type="button"
                variant="outline"
              >
                <ChevronsRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Loading/Error Overlays */}
      {/* {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-100">
          <p className="text-sm text-red-700">Error: {error.message}</p>
        </div>
      )} */}
    </div>
  );
}
