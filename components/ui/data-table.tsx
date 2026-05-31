'use client';

import {
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnSort,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table';
import { Columns, Download } from 'lucide-react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

import { Card, CardContent } from './card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

export interface DataTableProps<TData, TValue> {
  card?: boolean;
  className?: string;
  columnVisibility?: VisibilityState;
  columns: Array<ColumnDef<TData, TValue>>;
  data: Array<TData>;
  initialSorting?: Array<ColumnSort>;
  onRowSelectionChange?: (selectedRows: Array<string>) => void;
  pageIndex?: number;
  pageSize?: number;
  searchField?: string;
  searchPlaceholder?: string;
  showColumnVisibility?: boolean;
  showExport?: boolean;
  showPagination?: boolean;
  showSearch?: boolean;
  showSelectedCount?: boolean;
}

export function DataTable<TData, TValue>({
  card = false,
  columns,
  className,
  columnVisibility: initialColumnVisibility,
  searchPlaceholder,
  searchField,
  onRowSelectionChange,
  data,
  initialSorting = [],
  pageIndex = 0,
  pageSize = 10,
  showColumnVisibility = false,
  showExport = false,
  showPagination = false,
  showSelectedCount = false,
  showSearch = false,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    initialColumnVisibility ?? {},
  );
  const [pagination, setPagination] = useState({
    pageIndex,
    pageSize,
  });
  const [rowSelection, setRowSelection] = useState({});
  const [searchValue, setSearchValue] = useState<string | undefined>(undefined);
  const [stateData, setStateData] = useState<TData[]>(data);

  useEffect(() => {
    setStateData(data);
    table.resetRowSelection();
  }, [data]);

  const table = useReactTable({
    columns,
    data: stateData,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: true,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    state: {
      columnFilters,
      columnVisibility,
      pagination,
      rowSelection,
      sorting,
    },
  });

  const rows = table
    .getSortedRowModel()
    .rows.sort((a, b) => {
      const sortColumn = sorting?.[0]?.id;
      const sortDirection = sorting?.[0]?.desc;

      if (!sortColumn) {
        return 0;
      }

      const aValue = a.original[sortColumn as keyof typeof a.original];
      const bValue = b.original[sortColumn as keyof typeof b.original];

      if (aValue instanceof Date && bValue instanceof Date) {
        return sortDirection
          ? bValue.getTime() - aValue.getTime()
          : aValue.getTime() - bValue.getTime();
      }

      return sortDirection
        ? String(bValue).localeCompare(String(aValue))
        : String(aValue).localeCompare(String(bValue));
    })

    .filter(row => {
      if (searchField && searchValue) {
        const value = row.original[searchField as keyof typeof row.original];
        if (typeof value === 'string') {
          return value.toLowerCase().includes(searchValue.toLowerCase());
        }
        return String(value).toLowerCase().includes(searchValue.toLowerCase());
      }

      return true;
    })
    .slice(
      pagination.pageIndex * pagination.pageSize,
      pagination.pageIndex * pagination.pageSize + pagination.pageSize,
    );

  const handleSearch = (value: string) => {
    setSearchValue(value);
    setPagination(prev => ({ ...prev, pageIndex: 0 }));
  };

  const tableContent = (
    <>
      {showColumnVisibility || showExport || showSearch ? (
        <div className="flex items-center justify-between space-x-2 pb-2 md:space-x-4">
          {showSearch && searchField ? (
            <Input
              className="w-56 max-w-sm"
              onChange={event => handleSearch(event.target.value)}
              placeholder={searchPlaceholder}
              type="search"
              value={searchValue || ''}
            />
          ) : null}

          <div className="flex items-center space-x-3">
            {showColumnVisibility ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="ml-auto w-10 text-foreground/70"
                    variant="outline"
                  >
                    <Columns className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {table
                    .getAllColumns()
                    .filter(column => column.getCanHide())
                    .map(column => {
                      return (
                        <DropdownMenuCheckboxItem
                          checked={column.getIsVisible()}
                          className="capitalize"
                          key={column.id}
                          onCheckedChange={value => {
                            setColumnVisibility({
                              ...columnVisibility,
                              [column.id]: value,
                            });
                          }}
                        >
                          {column.id}
                        </DropdownMenuCheckboxItem>
                      );
                    })}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            {showExport ? (
              <Button className="ml-4" onClick={() => {}} variant="secondary">
                <Download className="mr-2 size-4" />
                Export
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          'rounded-t-md border bg-background overflow-x-auto',
          className,
          showPagination ? 'border-b-0' : '',
        )}
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers
                  .filter(header => {
                    return columnVisibility[header.column.id] !== false;
                  })
                  .map(header => {
                    const width = header.column.getSize();
                    return (
                      <TableHead
                        className="p-3"
                        key={header.id}
                        style={width !== -1 ? { width: `${width}px` } : {}}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    );
                  })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map(row => {
                return (
                  <TableRow
                    data-state={
                      // @ts-ignore
                      rowSelection?.[row.id] ? 'selected' : undefined
                    }
                    key={row.id}
                  >
                    {row
                      .getVisibleCells()
                      .filter(cell => {
                        if (columnVisibility[cell.column.id] !== false) {
                          return true;
                        }
                        return false;
                      })
                      .map(cell => {
                        const width = cell.column.getSize();
                        const verticalAlign =
                          cell.column.columnDef.meta?.verticalAlign ?? 'middle';

                        return (
                          <TableCell
                            className={cn(
                              'py-3',
                              verticalAlign === 'top'
                                ? 'align-top'
                                : 'align-middle',
                            )}
                            key={cell.id}
                            style={width !== -1 ? { width: `${width}px` } : {}}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        );
                      })}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  className="h-24 text-center"
                  colSpan={columns.length}
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {showPagination ? (
        <div className="rounded-b-md border border-border bg-accent px-1 py-3">
          <div className="flex items-center justify-between px-2">
            {showSelectedCount ? (
              <div className="flex-1 text-sm text-muted-foreground">
                {table.getFilteredSelectedRowModel().rows.length} of{' '}
                {table.getFilteredRowModel().rows.length} row(s) selected.
              </div>
            ) : null}

            <div
              className={cn(
                'flex items-center justify-between space-x-3 md:space-x-6 lg:space-x-8',
                !showSelectedCount ? 'grow' : '',
              )}
            >
              <div className="flex items-center space-x-1.5 md:space-x-2">
                <p className="hidden text-sm font-medium md:block">
                  Rows per page
                </p>
                <p className="text-xs font-medium md:hidden">Rows</p>
                <Select
                  onValueChange={value => {
                    table.setPageSize(Number(value));
                  }}
                  value={
                    table.getState().pagination.pageSize
                      ? `${table.getState().pagination.pageSize}`
                      : '10'
                  }
                >
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue
                      defaultValue={table.getState().pagination.pageSize}
                      placeholder={table.getState().pagination.pageSize ?? '10'}
                    />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {[5, 10, 20, 30, 40, 50].map(pageSize => (
                      <SelectItem key={pageSize} value={`${pageSize}`}>
                        {pageSize}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-center text-xs font-medium md:w-[100px] md:text-sm">
                Page {pagination.pageIndex + 1} of {table.getPageCount()}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  className="hidden size-8 p-0 lg:flex"
                  disabled={pagination.pageIndex === 0}
                  onClick={() =>
                    setPagination({
                      ...pagination,
                      pageIndex: 0,
                    })
                  }
                  variant="outline"
                >
                  <span className="sr-only">Go to first page</span>
                  <ChevronsLeft />
                </Button>
                <Button
                  className="size-8 p-0"
                  disabled={pagination.pageIndex === 0}
                  onClick={() =>
                    setPagination({
                      ...pagination,
                      pageIndex: pagination.pageIndex - 1,
                    })
                  }
                  variant="outline"
                >
                  <span className="sr-only">Go to previous page</span>
                  <ChevronLeft />
                </Button>
                <Button
                  className="size-8 p-0"
                  disabled={pagination.pageIndex + 1 === table.getPageCount()}
                  onClick={() => table.nextPage()}
                  variant="outline"
                >
                  <span className="sr-only">Go to next page</span>
                  <ChevronRight />
                </Button>
                <Button
                  className="hidden size-8 p-0 lg:flex"
                  disabled={pagination.pageIndex + 1 === table.getPageCount()}
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  variant="outline"
                >
                  <span className="sr-only">Go to last page</span>
                  <ChevronsRight />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );

  if (card) {
    return (
      <Card>
        <CardContent className="bg-accent/30 p-2 md:p-2">
          {tableContent}
        </CardContent>
      </Card>
    );
  }

  return tableContent;
}
