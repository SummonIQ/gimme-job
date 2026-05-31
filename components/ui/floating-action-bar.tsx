'use client';

import { Portal } from 'radix-ui';
import type { ReactNode } from 'react';

import { cn } from '@/lib/css';

interface FloatingActionBarProps {
  children: ReactNode;
  count: number;
  open: boolean;
}

export function FloatingActionBar({
  children,
  count,
  open,
}: FloatingActionBarProps) {
  return (
    <Portal.Root>
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-[9999] flex flex-row justify-center p-4 pb-6',
          open ? 'pointer-events-all' : 'pointer-events-none',
        )}
      >
        <div
          className={cn(
            'mx-auto flex items-center rounded-full border border-border/20 bg-background px-4 py-2.5 shadow-2xl shadow-black/30 backdrop-blur-xl transition-all data-[state=closed]:duration-500 data-[state=open]:duration-300',
            'dark:bg-zinc-900 dark:border-zinc-700 dark:shadow-black/70',
            'data-[state=closed]:translate-y-[200%] data-[state=closed]:scale-95 data-[state=closed]:opacity-0',
            'data-[state=open]:translate-y-0 data-[state=open]:scale-100 data-[state=open]:opacity-100',
          )}
          data-state={open ? 'open' : 'closed'}
        >
          <div className="flex items-center gap-2">
            <span className="tabular-nums text-sm font-semibold text-foreground">
              {count}
            </span>
            <span className="text-xs text-muted-foreground">
              selected
            </span>
          </div>
          <div className="mx-3 h-4 w-px bg-border/40 dark:bg-zinc-700" />
          <div className="flex items-center gap-1">
            {children}
          </div>
        </div>
      </div>
    </Portal.Root>
  );
}
