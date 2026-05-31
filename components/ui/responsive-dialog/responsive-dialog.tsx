'use client';

import type { ScrollAreaProps } from '@radix-ui/react-scroll-area';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import type * as React from 'react';
import { useEffect } from 'react';
import { useState } from 'react';
import type { Drawer as DrawerPrimitive } from 'vaul';

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  SlidePanel,
  SlidePanelClose,
  SlidePanelContent,
  SlidePanelDescription,
  SlidePanelFooter,
  SlidePanelHeader,
  SlidePanelOverlay,
  SlidePanelTitle,
  SlidePanelTrigger,
} from '@/components/ui/slide-panel';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';

const ResponsiveDialogOverlay = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) return null;

  if (isDesktop) {
    return <SlidePanelOverlay {...props} className={cn('z-20', className)} />;
  }

  return <DrawerOverlay {...props} className={cn('z-20', className)} />;
};
ResponsiveDialogOverlay.displayName = 'ResponsiveDialogOverlay';

const ResponsiveDialogTrigger = ({
  children,
  ...props
}: React.HTMLAttributes<HTMLButtonElement>) => {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) return null;

  if (isDesktop) {
    return (
      <SlidePanelTrigger {...props} asChild>
        {children}
      </SlidePanelTrigger>
    );
  }

  return (
    <DrawerTrigger {...props} asChild>
      {children}
    </DrawerTrigger>
  );
};
ResponsiveDialogTrigger.displayName = 'ResponsiveDialogTrigger';

const ResponsiveDialogHeader = ({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) return null;

  if (isDesktop) {
    return (
      <SlidePanelHeader
        className={cn(
          'fixed left-0 right-0 top-0 mb-0 flex h-28 grow-0 justify-center border-b border-b-border bg-accent/70 p-6 pr-12 backdrop-blur-sm',
          className,
        )}
        {...props}
      >
        {children}
      </SlidePanelHeader>
    );
  }

  return (
    <DrawerHeader
      className={cn(
        'item-start fixed inset-x-0 top-0 mb-0 flex h-28 flex-col justify-start border-b border-b-border bg-background p-6 pt-3 backdrop-blur-sm',
        className,
      )}
      {...props}
    >
      <div className="mx-auto mb-4 h-2 w-[100px] rounded-full bg-muted" />

      {children}
    </DrawerHeader>
  );
};
ResponsiveDialogHeader.displayName = 'ResponsiveDialogHeader';

const ResponsiveDialogClose = ({
  children,
  ...props
}: React.HTMLAttributes<HTMLButtonElement>) => {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) return null;

  if (isDesktop) {
    return (
      <SlidePanelClose {...props} asChild>
        {children}
      </SlidePanelClose>
    );
  }

  return (
    <DrawerClose {...props} asChild>
      {children}
    </DrawerClose>
  );
};
ResponsiveDialogClose.displayName = 'ResponsiveDialogClose';

const ResponsiveDialogContainer = ({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  side?: 'left' | 'right';
}) => {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) return null;

  if (isDesktop) {
    return (
      <SlidePanelContent
        className={cn(
          'fixed inset-y-6 left-auto right-6 flex w-full max-w-sm grow translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden border bg-background p-0 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-right-12 data-[state=open]:slide-in-from-right-12 sm:rounded-lg',
          className,
        )}
        {...props}
      >
        <VisuallyHidden>
          <SlidePanelTitle />
          <SlidePanelDescription />
        </VisuallyHidden>
        {/* <div className="absolute inset-y-0 z-40 w-full py-24">
          <ScrollArea className="flex h-full grow flex-col justify-start overflow-y-auto"> */}
        {children}
        {/* </ScrollArea>
        </div> */}
      </SlidePanelContent>
    );
  }

  return (
    <DrawerContent
      className={cn('inset-0 mt-24 h-auto overflow-hidden py-4', className)}
      {...props}
    >
      <VisuallyHidden>
        <DrawerTitle />
        <DrawerDescription />
      </VisuallyHidden>
      {children}
    </DrawerContent>
  );
};
ResponsiveDialogContainer.displayName = 'ResponsiveDialogContainer';

const ResponsiveDialogContent = ({
  children,
  className,
  ...props
}: ScrollAreaProps & {
  side?: 'left' | 'right';
}) => {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) return null;

  if (isDesktop) {
    return (
      <div
        className={cn(
          'absolute bottom-20 top-28 w-full overflow-hidden',
          className,
        )}
        {...props}
      >
        <ScrollArea
          className={cn('flex h-full grow flex-col justify-start', className)}
          {...props}
        >
          <div className="flex size-full grow flex-col p-4 pb-12 md:p-5">
            {children}
          </div>
        </ScrollArea>
      </div>
    );
  }

  /*
   <div className="absolute inset-y-0 z-40 w-full py-24">
          <ScrollArea className="flex h-full grow flex-col justify-start overflow-y-auto">
            {children}
          </ScrollArea>
        </div>
        **/
  return (
    <div
      className={cn('absolute bottom-20 top-28 z-40 w-full', className)}
      {...props}
    >
      <ScrollArea
        className={cn(
          'absolute inset-0 z-40 flex h-full grow overflow-y-auto',
          className,
        )}
        {...props}
      >
        <div className="flex size-full grow flex-col px-4 pb-12 pt-6">
          {children}
        </div>
      </ScrollArea>
    </div>
  );
};
ResponsiveDialogContent.displayName = 'ResponsiveDialogContent';

const ResponsiveDialogTitle = ({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) return null;

  if (isDesktop) {
    return (
      <SlidePanelTitle className={className} {...props}>
        {children}
      </SlidePanelTitle>
    );
  }

  return (
    <DrawerTitle className={className} {...props}>
      {children}
    </DrawerTitle>
  );
};
ResponsiveDialogTitle.displayName = 'ResponsiveDialogTitle';

const ResponsiveDialogDescription = ({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) return null;

  if (isDesktop) {
    return (
      <SlidePanelDescription className={className} {...props}>
        {children}
      </SlidePanelDescription>
    );
  }

  return (
    <DrawerDescription
      className={cn('line-clamp-1 text-pretty', className)}
      {...props}
    >
      {children}
    </DrawerDescription>
  );
};
ResponsiveDialogDescription.displayName = 'ResponsiveDialogDescription';

const ResponsiveDialogFooter = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) return null;

  if (isDesktop) {
    return (
      <SlidePanelFooter
        className={cn(
          'fixed bottom-0 left-0 right-0 flex h-20 flex-row items-end justify-between border-t border-t-border bg-accent/70 p-5 backdrop-blur-sm sm:justify-between',
          className,
        )}
        {...props}
      >
        {children}
      </SlidePanelFooter>
    );
  }

  return (
    <DrawerFooter
      className={cn(
        'fixed bottom-0 left-0 right-0 flex h-20 flex-row items-end justify-between border-t border-t-border bg-accent/70 p-4 backdrop-blur-sm sm:justify-between [&>button]:h-full',
        className,
      )}
      {...props}
    >
      {children}
    </DrawerFooter>
  );
};
ResponsiveDialogFooter.displayName = 'ResponsiveDialogFooter';

const ResponsiveDialog = ({
  children,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) return null;

  if (isDesktop) {
    return <SlidePanel {...props}>{children}</SlidePanel>;
  }

  return <Drawer {...props}>{children}</Drawer>;
};
ResponsiveDialog.displayName = 'ResponsiveDialog';

export {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContainer,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
};
