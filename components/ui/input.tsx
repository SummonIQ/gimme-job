import { UI_INTERACTIVE_ELEMENT_SIZE_HEIGHT } from '@/constants/ui/sizes';
import { cn } from '@/lib/css/index';
import { type VariantProps, cva } from 'class-variance-authority';
import * as React from 'react';
import { SearchInput } from './search-input';

export const inputVariants = cva(
  cn(
    'flex min-w-0 rounded-lg bg-input bg-linear-to-br from-black/[0.02] to-white/[0.04] dark:bg-card dark:from-transparent dark:to-transparent shadow-xs border border-border/50 inset-shadow-xs inset-shadow-black/[0.04] dark:inset-shadow-white/[0.03]',
    'transition-[color,box-shadow,border-color] outline-none',
    'placeholder:text-muted-foreground/55 selection:bg-primary selection:text-primary-foreground',
    'file:text-foreground file:inline-flex file:border-0 file:bg-transparent file:font-medium',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
    'focus-visible:border-transparent focus-visible:ring-primary focus-visible:ring-1 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
  ),
  {
    defaultVariants: {
      size: 'default',
    },
    variants: {
      size: {
        xs: cn(
          UI_INTERACTIVE_ELEMENT_SIZE_HEIGHT.xs,
          'px-2 text-xs file:h-5 file:text-xs',
        ),
        sm: cn(
          UI_INTERACTIVE_ELEMENT_SIZE_HEIGHT.sm,
          'px-3 text-sm file:h-6 file:text-sm',
        ),
        default: cn(
          UI_INTERACTIVE_ELEMENT_SIZE_HEIGHT.default,
          'px-3 text-base md:text-sm file:h-7 file:text-sm',
        ),
        lg: cn(
          UI_INTERACTIVE_ELEMENT_SIZE_HEIGHT.lg,
          'px-4 text-base file:h-8 file:text-base',
        ),
        xl: cn(
          UI_INTERACTIVE_ELEMENT_SIZE_HEIGHT.xl,
          'px-5 text-lg file:h-9 file:text-base',
        ),
      },
    },
  },
);

export const searchIconVariants = cva(
  'absolute top-1/2 -translate-y-1/2 pointer-events-none transition-colors',
  {
    defaultVariants: { size: 'default' },
    variants: {
      size: {
        xs: 'size-3 left-2',
        sm: 'size-3.5 left-2.5',
        default: 'size-3.5 left-3',
        lg: 'size-4 left-3.5',
        xl: 'size-4.5 left-4',
      },
    },
  },
);

export const searchPaddingVariants = cva(
  '[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none',
  {
    defaultVariants: { size: 'default' },
    variants: {
      size: {
        xs: 'pl-6 pr-7',
        sm: 'pl-8 pr-8',
        default: 'pl-9 pr-9',
        lg: 'pl-10 pr-10',
        xl: 'pl-11 pr-11',
      },
    },
  },
);

export const clearButtonVariants = cva(
  'absolute top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full border border-transparent bg-transparent text-muted-foreground/60 transition-[color,background-color,border-color] duration-150 ease-out hover:border-border/40 hover:bg-muted/35 hover:text-foreground dark:hover:border-white/10 dark:hover:bg-white/[0.04] cursor-pointer',
  {
    defaultVariants: { size: 'default' },
    variants: {
      size: {
        xs: 'size-4 right-1.5 [&_svg]:size-2.5',
        sm: 'size-5 right-2 [&_svg]:size-3',
        default: 'size-5 right-2.5 [&_svg]:size-3',
        lg: 'size-5 right-2.5 [&_svg]:size-3',
        xl: 'size-6 right-3 [&_svg]:size-3.5',
      },
    },
  },
);

export type InputSize = NonNullable<VariantProps<typeof inputVariants>['size']>;

type InputProps = Omit<React.ComponentProps<'input'>, 'size'> & {
  size?: InputSize;
};

function Input({ className, type, size = 'default', ...props }: InputProps) {
  if (type === 'search') {
    return <SearchInput className={className} size={size} {...props} />;
  }

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants({ size }), 'w-full', className)}
      {...props}
    />
  );
}

export { Input };
