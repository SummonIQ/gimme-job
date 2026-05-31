'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

import { Button } from './button';

const SlidePanel = DialogPrimitive.Root;
SlidePanel.displayName = 'SlidePanel';

const SlidePanelTrigger = DialogPrimitive.Trigger;
SlidePanelTrigger.displayName = 'SlidePanelTrigger';

const SlidePanelPortal = DialogPrimitive.Portal;
SlidePanelPortal.displayName = 'SlidePanelPortal';

// const SlidePanelClose = DialogPrimitive.Close;
// SlidePanelClose.displayName = 'SlidePanelClose';

const SlidePanelClose = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Close
    className={cn('rounded-full bg-blue-500', className)}
    ref={ref}
    {...props}
    asChild
  >
    <Button
      variant="outline"
      className="focus:outline-none focus:border-transparent focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2 focus:ring-offset-background focus-visible:outline-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <X className="size-4" />
    </Button>
  </DialogPrimitive.Close>
));
SlidePanelClose.displayName = 'SlidePanelClose';

const SlidePanelOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    className={cn(
      'fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    ref={ref}
    {...props}
  />
));
SlidePanelOverlay.displayName = 'SlidePanelOverlay';

const SlidePanelContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <SlidePanelPortal>
    <SlidePanelOverlay />
    <DialogPrimitive.Content
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=open]:slide-in-from-left-1/2 sm:rounded-lg',
        className,
      )}
      ref={ref}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full border border-border bg-background p-1.5 text-muted-foreground opacity-70 ring-offset-background transition-all hover:border-foreground/70 hover:text-foreground focus:outline-none focus:border-transparent focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2 focus:ring-offset-background focus-visible:outline-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none">
        <X className="size-4" strokeWidth={2.7} />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </SlidePanelPortal>
));
SlidePanelContent.displayName = 'SlidePanel';

const SlidePanelHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-1.5 text-center sm:text-left',
      className,
    )}
    {...props}
  />
);
SlidePanelHeader.displayName = 'SlidePanelHeader';

const SlidePanelFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
      className,
    )}
    {...props}
  />
);
SlidePanelFooter.displayName = 'SlidePanelFooter';

const SlidePanelTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    className={cn(
      'text-lg font-semibold leading-none tracking-tight',
      className,
    )}
    ref={ref}
    {...props}
  />
));
SlidePanelTitle.displayName = 'SlidePanelTitle';

const SlidePanelDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    className={cn('text-sm text-muted-foreground', className)}
    ref={ref}
    {...props}
  />
));
SlidePanelDescription.displayName = 'SlidePanelDescription';

export {
  SlidePanel,
  SlidePanelClose,
  SlidePanelContent,
  SlidePanelDescription,
  SlidePanelFooter,
  SlidePanelHeader,
  SlidePanelOverlay,
  SlidePanelPortal,
  SlidePanelTitle,
  SlidePanelTrigger,
};
