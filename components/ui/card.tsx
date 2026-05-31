import * as React from 'react';

import { cn } from '@/lib/utils';

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    className={cn(
      'rounded-lg border border-border/40 bg-card text-card-foreground shadow-sm drop-shadow-sm overflow-hidden',
      className,
    )}
    ref={ref}
    {...props}
  />
));
Card.displayName = 'Card';

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    className={cn(
      'flex flex-row flex-wrap items-center justify-between gap-4 border-b border-b-border p-4 md:p-5',
      className,
    )}
    ref={ref}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

const CardSummary = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    className={cn('flex flex-col flex-nowrap gap-y-1.5', className)}
    ref={ref}
    {...props}
  />
));
CardSummary.displayName = 'CardSummary';

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    className={cn(
      'text-lg font-semibold leading-none tracking-tight',
      className,
    )}
    ref={ref}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    className={cn('text-sm text-muted-foreground', className)}
    ref={ref}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardActions = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    className={cn('flex flex-wrap justify-end gap-2', className)}
    ref={ref}
    {...props}
  />
));
CardActions.displayName = 'CardActions';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div className={cn('p-4 md:p-5', className)} ref={ref} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    className={cn('flex items-center p-4 md:p-5', className)}
    ref={ref}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export {
  Card,
  CardActions,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardSummary,
  CardTitle,
};
