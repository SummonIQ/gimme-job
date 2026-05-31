'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface PaginationProps {
  currentPage: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSize: number;
  totalPages: number;
}

export function Pagination({
  currentPage,
  onPageChange,
  onPageSizeChange,
  pageSize,
  totalPages,
}: PaginationProps) {
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const showEllipsisThreshold = 7;

    if (totalPages <= showEllipsisThreshold) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Rows per page:</span>
        <Select
          onValueChange={value => onPageSizeChange(Number(value))}
          value={pageSize.toString()}
        >
          <SelectTrigger className="h-8 w-[70px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="25">25</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1">
        <Button
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          size="sm"
          variant="outline"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {getPageNumbers().map((page, index) =>
          typeof page === 'number' ? (
            <Button
              className={cn(
                'min-w-[36px]',
                currentPage === page && 'bg-primary text-primary-foreground',
              )}
              key={index}
              onClick={() => onPageChange(page)}
              size="sm"
              variant={currentPage === page ? 'default' : 'outline'}
            >
              {page}
            </Button>
          ) : (
            <span className="px-2 text-muted-foreground" key={index}>
              {page}
            </span>
          ),
        )}

        <Button
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          size="sm"
          variant="outline"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </div>
    </div>
  );
}
