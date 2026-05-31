import { forwardRef, type HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

const ShimmerCard = forwardRef<
  HTMLDivElement,
  Omit<HTMLAttributes<HTMLDivElement>, 'content'>
>(({ children, className, ...props }, ref) => {
  return (
    <div
      className={cn(
        'shadow-shadow group relative flex flex-col overflow-hidden rounded-[.5rem] border border-border/60 bg-background transition-all',
        className,
      )}
      ref={ref}
      {...props}
    >
      <div className="absolute -inset-12 flex scale-x-110 scale-y-50 items-center [container-type:inline-size]">
        <div
          className="absolute h-full min-h-[100cqw] w-[100cqw] animate-spin bg-[conic-gradient(from_0_at_50%_50%,hsl(217_91%_60%_/_0.5)_0deg,transparent_60deg,transparent_300deg,hsl(217_91%_60%_/_0.5)_360deg)] opacity-90 transition duration-300 [animation-duration:3s] dark:bg-[conic-gradient(from_0_at_50%_50%,hsl(217_91%_60%_/_0.5)_0deg,transparent_60deg,transparent_300deg,hsl(217_91%_60%_/_0.5)_360deg)]"
          // className="absolute size-[100cqw] animate-spin bg-[conic-gradient(from_0_at_50%_50%,hsl(var(--primary)_/_0.5)_0deg,transparent_60deg,transparent_300deg,hsl(var(--primary)_/_0.5)_360deg)] opacity-60 transition duration-300 [animation-duration:3s] dark:bg-[conic-gradient(from_0_at_50%_50%,hsl(var(--primary-dark)_/_0.5)_0deg,transparent_60deg,transparent_300deg,hsl(var(--primary-dark)_/_0.5)_360deg)]"
          // className="absolute h-full min-h-[100cqw] w-[100cqw] animate-spin bg-[conic-gradient(from_0_at_50%_50%,rgba(0,0,0,0.5)_0deg,transparent_60deg,transparent_300deg,rgba(0,0,0,0.5)_360deg)] transition duration-300 [animation-duration:3s] dark:bg-[conic-gradient(from_0_at_50%_50%,rgba(255,255,255,0.5)_0deg,transparent_60deg,transparent_300deg,rgba(255,255,255,0.5)_360deg)]"
        />
      </div>

      <div className={cn('absolute inset-0.5 bg-inherit', 'rounded-[.3rem]')} />

      <div className="relative z-10">{children}</div>
    </div>
  );
});
ShimmerCard.displayName = 'ShimmerCard';

const ShimmerCardHeader = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    className={cn(
      'flex flex-row items-center justify-between border-b border-border p-6',
      className,
    )}
    ref={ref}
    {...props}
  />
));
ShimmerCardHeader.displayName = 'ShimmerCardHeader';

const ShimmerCardTitle = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => (
  <h3
    className={cn(
      'flex w-full flex-row text-lg font-semibold leading-none tracking-tight',
      className,
    )}
    ref={ref}
    {...props}
  >
    {children}
  </h3>
));
ShimmerCardTitle.displayName = 'ShimmerCardTitle';

const ShimmerCardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    className={cn('text-sm text-muted-foreground', className)}
    ref={ref}
    {...props}
  />
));
ShimmerCardDescription.displayName = 'ShimmerCardDescription';

const ShimmerCardContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div className={cn('flex flex-col p-6', className)} ref={ref} {...props} />
));
ShimmerCardContent.displayName = 'ShimmerCardContent';

const ShimmerCardFooter = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    className={cn(
      'flex flex-col items-center justify-between rounded-b-lg border-t border-t-border sm:flex-row md:flex-row md:gap-4',
      className,
    )}
    ref={ref}
    {...props}
  />
));
ShimmerCardFooter.displayName = 'ShimmerCardFooter';

export {
  ShimmerCard,
  ShimmerCardContent,
  ShimmerCardDescription,
  ShimmerCardFooter,
  ShimmerCardHeader,
  ShimmerCardTitle,
};
