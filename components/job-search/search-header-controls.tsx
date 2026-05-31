'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import * as React from 'react';

export const SEARCH_HEADER_INPUT_CLASS =
  'h-11 text-sm rounded-lg border-border/60 bg-background/90 shadow-none transition-all duration-200 focus-visible:border-border focus-visible:ring-2 focus-visible:ring-primary/30';

export const SEARCH_HEADER_LOCATION_CLASS =
  'h-11 text-sm rounded-lg border-border/60 border-t-border/30 border-x-border/45 bg-background/90 bg-linear-to-br from-white/[0.04] to-black/[0.02] dark:from-white/[0.02] dark:to-white/[0.005] text-muted-foreground/55 shadow-none hover:text-foreground';

export const SEARCH_HEADER_BUTTON_CLASS = 'h-11 px-4 text-sm font-medium';

interface SearchHeaderButtonProps extends React.ComponentProps<typeof Button> {
  children: React.ReactNode;
}

export function SearchHeaderButton({
  children,
  className,
  ...props
}: SearchHeaderButtonProps) {
  return (
    <Button className={cn(SEARCH_HEADER_BUTTON_CLASS, className)} {...props}>
      {children}
    </Button>
  );
}
