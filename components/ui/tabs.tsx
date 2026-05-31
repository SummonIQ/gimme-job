'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as React from 'react';

import { cn } from '@/lib/utils';



const Tabs = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>) => (
  <TabsPrimitive.Root
    className={cn(
      'space-y-5',
      className,
    )}
    {...props}
  />
);
Tabs.displayName = TabsPrimitive.Root.displayName;


const TabsList = ({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) => {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [tabWidths, setTabWidths] = React.useState<number[]>([]);
  const [tabOffsets, setTabOffsets] = React.useState<number[]>([]);
  const listRef = React.useRef<HTMLDivElement>(null);

  const updateTabMeasurements = React.useCallback(() => {
    if (!listRef.current) return;

    const tabs = listRef.current.querySelectorAll('[role="tab"]');
    const widths: number[] = [];
    const offsets: number[] = [];

    tabs.forEach((tab, index) => {
      const rect = tab.getBoundingClientRect();
      const listRect = listRef.current!.getBoundingClientRect();
      widths.push(rect.width);
      offsets.push(rect.left - listRect.left);

      if (tab.getAttribute('data-state') === 'active') {
        setActiveIndex(index);
      }
    });

    setTabWidths(widths);
    setTabOffsets(offsets);
  }, []);

  // Update measurements on mount and when children change
  React.useEffect(() => {
    updateTabMeasurements();
    // Add a small delay to ensure DOM is fully rendered
    const timeoutId = setTimeout(updateTabMeasurements, 100);
    return () => clearTimeout(timeoutId);
  }, [children, updateTabMeasurements]);

  // Update measurements on window resize
  React.useEffect(() => {
    const handleResize = () => {
      updateTabMeasurements();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateTabMeasurements]);

  // Watch for tab state changes using MutationObserver
  React.useEffect(() => {
    if (!listRef.current) return;

    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'data-state'
        ) {
          updateTabMeasurements();
        }
      });
    });

    const tabs = listRef.current.querySelectorAll('[role="tab"]');
    tabs.forEach(tab => {
      observer.observe(tab, {
        attributeFilter: ['data-state'],
        attributes: true,
      });
    });

    return () => observer.disconnect();
  }, [children, updateTabMeasurements]);

  React.useEffect(() => {
    const handleClick = () => {
      // Use requestAnimationFrame for better timing
      requestAnimationFrame(() => {
        if (!listRef.current) return;
        const tabs = listRef.current.querySelectorAll('[role="tab"]');
        tabs.forEach((tab, index) => {
          if (tab.getAttribute('data-state') === 'active') {
            setActiveIndex(index);
            // Also update measurements when tab changes
            updateTabMeasurements();
          }
        });
      });
    };

    const listElement = listRef.current;
    listElement?.addEventListener('click', handleClick);
    return () => listElement?.removeEventListener('click', handleClick);
  }, [updateTabMeasurements]);

  return (
    <TabsPrimitive.List
      className={cn(
        'relative flex items-center rounded-lg bg-muted p-1 text-muted-foreground w-fit',
        className,
      )}
      ref={listRef}
      {...props}
    >
      {children}
      {tabWidths.length > 0 && tabOffsets.length > 0 && (
        <div
          className="absolute top-1 bottom-1 rounded-md bg-primary/15 transition-all duration-200 ease-out"
          style={{
            left: `${tabOffsets[activeIndex]}px`,
            width: `${tabWidths[activeIndex]}px`,
            zIndex: 10,
          }}
        />
      )}
    </TabsPrimitive.List>
  );
};
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) => (
  <TabsPrimitive.Trigger
    className={cn(
      'relative z-20 inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-primary data-[state=inactive]:hover:text-foreground/80',
      className,
    )}
    {...props}
  />
);
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

interface TabsContentProps extends React.ComponentPropsWithoutRef<
  typeof TabsPrimitive.Content
> {
  scrollable?: boolean;
}

const TabsContent = ({
  className,
  scrollable = false,
  ...props
}: TabsContentProps) => (
  <TabsPrimitive.Content
    className={cn(
      // 'bg-card p-3',
      scrollable && 'overflow-y-auto h-full',
      className,
    )}
    {...props}
  />
);
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsContent, TabsList, TabsTrigger };
