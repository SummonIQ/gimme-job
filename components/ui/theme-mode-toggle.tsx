'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/css';

interface ThemeModeToggleProps {
  className?: string;
}

export function ThemeModeToggle({ className }: ThemeModeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';

  return (
    <Button
      aria-label="Toggle theme mode"
      className={cn(
        'h-8 w-8 rounded-2xl border border-border/40 p-1 hover:bg-gray-100 dark:hover:bg-gray-800',
        className,
      )}
      onClick={() => setTheme(nextTheme)}
      size="sm"
      type="button"
      variant="ghost"
    >
      <Sun className="size-3.5 rotate-0 scale-100 text-amber-500 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)] transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute size-3.5 rotate-90 scale-0 text-sky-300 drop-shadow-[0_0_6px_rgba(147,112,219,0.6)] transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
