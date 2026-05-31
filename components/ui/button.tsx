import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/css/index';

const buttonVariants = cva(
  cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'rounded-lg text-sm font-medium transition-all duration-200',
    'disabled:pointer-events-none disabled:opacity-50',
    'font-medium',
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
    'shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-1',
    'focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
    'aria-invalid:border-destructive',
  ),
  {
    compoundVariants: [],
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
    variants: {
      size: {
        default: 'h-9 gap-1.5 px-4 py-2 text-sm',
        icon: 'size-9 p-0 text-xs',
        lg: 'h-11 gap-2 px-8 text-base has-[>svg]:px-6',
        sm: 'h-8 gap-2 px-3.5 text-sm has-[>svg]:px-3',
        xl: 'h-12 gap-2 px-10 text-lg has-[>svg]:px-8',
        xs: 'h-6 gap-1.5 px-2.5 text-xs has-[>svg]:px-2',
      },
      variant: {
        default: cn(
          'relative bg-linear-to-br from-[#e874aa] via-[#c36cf0] to-[#8b5cf6]',
          'transition-all duration-150',
          'text-white dark:text-slate-950',
          'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.28),inset_0_-1px_0_0_rgba(76,29,149,0.42),0_2px_8px_-2px_rgba(139,92,246,0.34),0_0_18px_rgba(232,116,170,0.16)]',
          'hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.48),inset_0_-1px_0_0_rgba(76,29,149,0.5),0_8px_22px_-5px_rgba(139,92,246,0.45),0_0_26px_rgba(232,116,170,0.22)]',
          'active:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),inset_0_-1px_0_0_rgba(76,29,149,0.48),0_4px_12px_-2px_rgba(139,92,246,0.46)] active:scale-95',
          'overflow-hidden',
        ),
        destructive:
          'bg-destructive text-white shadow-xs hover:bg-destructive/80 active:bg-destructive/70 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        ghost: 'bg-transparent hover:bg-accent/50 shadow-none',
        link: 'text-primary underline-offset-4 hover:underline',
        outline: cn(
          'border bg-transparent font-medium',
          'border-border/60 text-muted-foreground shadow-xs',
          'hover:text-foreground hover:border-border hover:bg-muted/30',
        ),
        secondary:
          'bg-secondary text-secondary-foreground opacity-90 hover:bg-secondary/90 hover:opacity-100 active:opacity-95 border-t border-white/15 border-l border-r border-l-white/5 border-r-white/5 shadow-sm shadow-black/20 hover:shadow-md hover:shadow-black/30 transition-all duration-300 dark:bg-secondary',
      },
    },
  },
);

function Button({
  children,
  className,
  inProgress,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    inProgress?: boolean;
  }) {
  const isDefault = !variant || variant === 'default';
  const isDisabled = props.disabled || inProgress;

  if (asChild) {
    // For asChild, we wrap in a span so we can include the overlay
    // The slotted element (e.g., Link) fills the button and handles its own padding
    return (
      <span
        data-slot="button"
        className={cn(
          buttonVariants({ variant, size, className }),
          'group relative p-0',
        )}
      >
        {isDefault && (
          <>
            <span className="pointer-events-none absolute -top-2 -left-2 h-[55%] w-[48%] rounded-full bg-white/12 blur-md" />
            <span className="pointer-events-none absolute -top-2 -right-2 h-[1.1rem] w-7 rounded-full bg-white/10 blur-md" />
            <span className="pointer-events-none absolute -bottom-2 left-1/2 -translate-x-1/2 h-3 w-3/4 rounded-full bg-white/6 blur-sm" />
            <span className="absolute z-1 inset-0 rounded-lg bg-transparent group-hover:bg-black/10 transition-colors duration-200 pointer-events-none" />
          </>
        )}
        <Slot
          className="relative z-10 size-full inline-flex items-center justify-center gap-2 px-4"
          {...props}
        >
          {children}
        </Slot>
      </span>
    );
  }

  return (
    <button
      data-slot="button"
      className={cn(
        buttonVariants({ variant, size, className }),
        'group relative',
      )}
      {...props}
      disabled={isDisabled}
    >
      {isDefault && (
        <>
          <span className="pointer-events-none absolute -top-2 -left-2 h-[55%] w-[48%] rounded-full bg-white/12 blur-md" />
          <span className="pointer-events-none absolute -top-2 -right-2 h-[1.1rem] w-7 rounded-full bg-white/10 blur-md" />
          <span className="pointer-events-none absolute -bottom-2 left-1/2 -translate-x-1/2 h-3 w-3/4 rounded-full bg-white/6 blur-sm" />
          <span className="absolute z-1 inset-0 rounded-lg bg-transparent group-hover:bg-black/10 transition-colors duration-200" />
        </>
      )}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
    </button>
  );
}

export { Button, buttonVariants };
