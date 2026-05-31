'use client';

import { UI_INTERACTIVE_ELEMENT_SIZE_HEIGHT } from '@/constants/ui/sizes';
import { type VariantProps, cva } from 'class-variance-authority';
import { ChevronsUpDown, Loader2 } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/css/index';

const comboboxTriggerVariants = cva(
  'w-full bg-input border-border dark:border-zinc-800 border-t border-t-border dark:border-t-[#2a2a2e] border-b-muted dark:border-b-zinc-800 font-normal justify-start! [&>span]:justify-start! shadow-none',
  {
    defaultVariants: { size: 'default' },
    variants: {
      size: {
        xs: cn(UI_INTERACTIVE_ELEMENT_SIZE_HEIGHT.xs, 'px-2 text-xs gap-1'),
        sm: cn(UI_INTERACTIVE_ELEMENT_SIZE_HEIGHT.sm, 'px-2.5 text-sm gap-1.5'),
        default: cn(
          UI_INTERACTIVE_ELEMENT_SIZE_HEIGHT.default,
          'px-3 text-sm gap-1.5',
        ),
        lg: cn(UI_INTERACTIVE_ELEMENT_SIZE_HEIGHT.lg, 'px-3 text-sm gap-2'),
        xl: cn(UI_INTERACTIVE_ELEMENT_SIZE_HEIGHT.xl, 'px-3.5 text-base gap-2'),
      },
    },
  },
);

const comboboxIconVariants = cva('shrink-0', {
  defaultVariants: { size: 'default' },
  variants: {
    size: {
      xs: 'size-3',
      sm: 'size-3.5',
      default: 'size-3.5',
      lg: 'size-4',
      xl: 'size-4.5',
    },
  },
});

const comboboxChevronVariants = cva(
  'absolute top-1/2 -translate-y-1/2 shrink-0 opacity-50 pointer-events-none',
  {
    defaultVariants: { size: 'default' },
    variants: {
      size: {
        xs: 'size-3 right-1.5',
        sm: 'size-3.5 right-2',
        default: 'size-4 right-2.5',
        lg: 'size-4 right-2.5',
        xl: 'size-4.5 right-3',
      },
    },
  },
);

type ComboboxSize = NonNullable<
  VariantProps<typeof comboboxTriggerVariants>['size']
>;

interface ComboboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  size?: ComboboxSize;
  placeholder?: string;
  searchPlaceholder?: string;
  icon?: React.ReactNode;
  displayValue?: string;
  hasValue?: boolean;
  /** Controlled search input value */
  search?: string;
  /** Called when the search input changes */
  onSearchChange?: (value: string) => void;
  /** Called when user presses Enter with a non-empty custom value.
   *  Combobox auto-closes and clears the search input after calling. */
  onCustomSubmit?: (value: string) => void;
  loading?: boolean;
  /** Simple empty-state message string. When `onCustomSubmit` is set,
   *  a "Press Enter to use ..." hint is appended automatically. */
  emptyMessage?: string;
  /** Override empty-state content entirely (takes precedence over emptyMessage) */
  emptyContent?: React.ReactNode;
  contentWidth?: string;
  contentAlign?: 'start' | 'center' | 'end';
  className?: string;
  triggerClassName?: string;
  children: React.ReactNode;
}

function Combobox({
  open,
  onOpenChange,
  size = 'default',
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  icon,
  displayValue,
  hasValue = false,
  search,
  onSearchChange,
  onCustomSubmit,
  loading = false,
  emptyMessage = 'No results found.',
  emptyContent,
  contentWidth = 'w-64',
  contentAlign = 'start',
  className,
  triggerClassName,
  children,
}: ComboboxProps) {
  const handleSearchKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && onCustomSubmit && search?.trim()) {
        e.preventDefault();
        onCustomSubmit(search.trim());
        onOpenChange(false);
        onSearchChange?.('');
      }
    },
    [onCustomSubmit, search, onOpenChange, onSearchChange],
  );

  const resolvedEmptyContent = emptyContent ?? (
    <div className="py-6 text-center text-sm">
      <p className="text-muted-foreground">{emptyMessage}</p>
      {onCustomSubmit && search && (
        <p className="mt-2 text-xs">
          Press{' '}
          <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted rounded">
            Enter
          </kbd>{' '}
          to use &ldquo;{search}&rdquo;
        </p>
      )}
    </div>
  );

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <div className={cn('relative', className)}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              comboboxTriggerVariants({ size }),
              'pr-8',
              hasValue
                ? 'text-foreground/90'
                : 'text-muted-foreground/55 hover:text-foreground',
              triggerClassName,
            )}
          >
            {icon && (
              <span
                className={cn(
                  comboboxIconVariants({ size }),
                  'flex items-center justify-center',
                  hasValue ? 'text-foreground/90' : 'text-muted-foreground/55',
                )}
              >
                {icon}
              </span>
            )}
            <span className="truncate">{displayValue || placeholder}</span>
          </Button>
        </PopoverTrigger>
        <ChevronsUpDown className={comboboxChevronVariants({ size })} />
      </div>
      <PopoverContent className={cn(contentWidth, 'p-0')} align={contentAlign}>
        <Command>
          <CommandInput
            placeholder={searchPlaceholder}
            className="focus-visible:ring-0 focus-visible:ring-offset-0"
            value={search}
            onValueChange={onSearchChange}
            onKeyDown={handleSearchKeyDown}
          />
          <CommandList>
            {loading ? (
              <div className="py-6 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : (
              <>
                <CommandEmpty>{resolvedEmptyContent}</CommandEmpty>
                {children}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

Combobox.displayName = 'Combobox';

// Re-export Command primitives as Combobox* for cleaner consumer API
const ComboboxGroup = CommandGroup;
const ComboboxItem = CommandItem;

export {
  Combobox,
  ComboboxGroup,
  ComboboxItem,
  type ComboboxProps,
  type ComboboxSize,
};
