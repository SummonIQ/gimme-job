import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

import { cn } from '@/lib/css';

const badgeVariants = cva(
  'inline-flex items-center gap-x-1.5 rounded-full py-1.5 border px-3.5 text-xs font-semibold transition-colors truncate focus:outline-none',
  {
    defaultVariants: {
      variant: 'default',
    },
    variants: {
      variant: {
        default: 'border-transparent bg-muted text-muted-foreground',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground',
        ghost: 'bg-transparent',
        outline: 'text-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
      },
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
