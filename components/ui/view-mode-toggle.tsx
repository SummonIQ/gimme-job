'use client';

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Custom icons that visually represent the layouts
const TableIcon = ({ className }: { className?: string }) => (
  <div
    className={cn(
      'grid-cols-2 gap-y-0 max-w-[11px] translate-y-[0.5px] -translate-x-[0.5px] space-y-0 max-h-[9px] grid gap-[1px]',
      className,
    )}
  >
    <div className="col-span-2 h-[4px] rounded-[1px] bg-current" />
    <div className="col-span-1 h-[4px] rounded-[1px] bg-current" />
    <div className="col-span-1 h-[4px] rounded-[1px] bg-current" />
  </div>
);

const ListIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 18 16">
    <rect height="3" rx="1" width="14" x="2" y="1.5" />
    <rect height="3" rx="1" width="14" x="2" y="6" />
    <rect height="3" rx="1" width="14" x="2" y="10.5" />
  </svg>
);

const GridIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 18 16">
    <rect height="5.5" rx="1" width="6.5" x="2" y="2" />
    <rect height="5.5" rx="1" width="6.5" x="9.5" y="2" />
    <rect height="5.5" rx="1" width="6.5" x="2" y="8.5" />
    <rect height="5.5" rx="1" width="6.5" x="9.5" y="8.5" />
  </svg>
);

const BoardIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 18 16">
    <rect height="8" rx="1" width="4.5" x="2" y="2" />
    <rect height="5" rx="1" width="4.5" x="7.5" y="2" />
    <rect height="10" rx="1" width="3" x="13" y="2" />
    <rect height="3" rx="1" width="4.5" x="7.5" y="8" />
    <rect height="3" rx="1" width="4.5" x="2" y="11" />
  </svg>
);

const InboxIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 18 16">
    {/* Left sidebar */}
    <rect height="12" rx="0.5" width="4" x="2" y="2" />
    {/* Main content area */}
    <rect height="3" rx="0.5" width="9" x="7" y="3" />
    <rect height="2.5" rx="0.5" width="9" x="7" y="7" />
    <rect height="2.5" rx="0.5" width="9" x="7" y="10.5" />
    {/* Separator line */}
    <rect height="12" rx="0.25" width="0.5" x="6.25" y="2" />
  </svg>
);

export type ViewMode =
  | 'table'
  | 'card'
  | 'board'
  | 'list'
  | 'columns'
  | 'inbox';

interface ViewModeToggleProps {
  availableViews?: ViewMode[];
  className?: string;
  defaultView?: ViewMode;
  onChange: (value: ViewMode) => void;
  swimlanes?: Array<{
    color?: string;
    id: string;
    title: string;
  }>;
  value?: ViewMode;
}

const viewConfig = {
  board: {
    icon: BoardIcon,
    label: 'Board',
    tooltip: 'Board View',
  },
  card: {
    icon: GridIcon,
    label: 'Card',
    tooltip: 'Card View',
  },
  table: {
    icon: TableIcon,
    label: 'Table',
    tooltip: 'Table View',
  },
  list: {
    icon: ListIcon,
    label: 'List',
    tooltip: 'List View',
  },
  columns: {
    icon: BoardIcon,
    label: 'Columns',
    tooltip: 'Column View',
  },
  inbox: {
    icon: InboxIcon,
    label: 'Inbox',
    tooltip: 'Gmail-style Inbox View',
  },
};

export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({
  value,
  onChange,
  className = '',
  availableViews = ['table', 'list', 'card'],
  defaultView,
  swimlanes,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [buttonWidths, setButtonWidths] = useState<number[]>([]);
  const [buttonOffsets, setButtonOffsets] = useState<number[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [previousActiveIndex, setPreviousActiveIndex] = useState(-1);
  const [containerWidth, setContainerWidth] = useState(0);
  const rafIdRef = useRef<number | null>(null);

  const views = useMemo(() => {
    const uniqueViews = Array.from(new Set<ViewMode>(availableViews));

    if (!defaultView || !uniqueViews.includes(defaultView)) {
      return uniqueViews;
    }

    const remainingViews = uniqueViews.filter(view => view !== defaultView);
    return [defaultView, ...remainingViews];
  }, [availableViews, defaultView]);

  // Motion preferences and shared timing
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Use default view if no value is provided
  const currentView = value || defaultView || views[0];

  // Initialize with default view on mount if no value
  useEffect(() => {
    if (!value && defaultView && availableViews.includes(defaultView)) {
      onChange(defaultView);
    }
  }, []); // Only run once on mount

  const updateButtonMeasurements = useCallback(() => {
    if (!containerRef.current) return;

    const buttons = containerRef.current.querySelectorAll('button');
    const widths: number[] = [];
    const offsets: number[] = [];

    buttons.forEach(button => {
      const rect = button.getBoundingClientRect();
      const containerRect = containerRef.current!.getBoundingClientRect();
      widths.push(rect.width);
      offsets.push(rect.left - containerRect.left);
    });

    setButtonWidths(widths);
    setButtonOffsets(offsets);

    // Calculate and animate container width
    const sumButtons = Array.from(buttons).reduce((sum, button) => {
      return sum + button.getBoundingClientRect().width;
    }, 0);
    // gap-0.5 => 2px between buttons; pl-1 => 4px; pr-2 => 8px
    const gapPx = 2;
    const paddingLeftPx = 4; // pl-1
    const paddingRightPx = 8; // pr-2
    const totalWidth =
      sumButtons +
      (buttons.length - 1) * gapPx +
      paddingLeftPx +
      paddingRightPx;

    setContainerWidth(totalWidth);
  }, []);

  // Update active index when value changes
  useEffect(() => {
    const index = views.indexOf(currentView);
    if (index !== -1 && index !== activeIndex) {
      setPreviousActiveIndex(activeIndex);
      setActiveIndex(index);
    }
  }, [currentView, views, activeIndex]);

  // Update measurements on mount and when buttons change
  useLayoutEffect(() => {
    // Measure immediately before paint for smoother initial layout
    updateButtonMeasurements();
    // Schedule one more measurement on the next frame to catch late layout
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = requestAnimationFrame(() => {
      updateButtonMeasurements();
      rafIdRef.current = null;
    });
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    };
  }, [views, currentView, updateButtonMeasurements]);

  // Update measurements on window resize
  useEffect(() => {
    let resizeRaf: number | null = null;
    const handleResize = () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        updateButtonMeasurements();
        resizeRaf = null;
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
    };
  }, [updateButtonMeasurements]);

  return (
    <TooltipProvider>
      <div
        className={cn(
          'relative inset-shadow-xs inline-flex h-[34px] bg-muted rounded-2xl px-[3px] py-1 gap-0.5',
          className,
        )}
        ref={containerRef}
      >
        {/* Sliding background indicator with enhanced animations */}
        {buttonWidths.length > 0 && buttonOffsets.length > 0 && (
          <div
            className="absolute left-[1.5px] inset-y-1 rounded-xl bg-linear-to-br from-[hsl(238.7_83.5%_71%)] to-[hsl(238.7_83.5%_35%)] shadow-lg drop-shadow-lg drop-shadow-shadow pointer-events-none"
            style={{
              transform: `translate3d(${buttonOffsets[activeIndex] - 1}px, 0, 0)`,
              transition: prefersReducedMotion
                ? 'none'
                : `transform 300ms cubic-bezier(0.22, 1, 0.36, 1), width 300ms cubic-bezier(0.22, 1, 0.36, 1)`,
              width: `${buttonWidths[activeIndex] + 0}px`,
              willChange: 'transform, width',
            }}
          />
        )}

        {views.map((viewMode, index) => {
          const config = viewConfig[viewMode];
          const Icon = config.icon;
          const isActive = currentView === viewMode;
          return (
            <Tooltip key={viewMode}>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    'z-10 h-full w-[36px] px-2.5 flex items-center justify-center rounded-3xl transition-all group min-h-0',
                    isActive
                      ? cn('text-white', '')
                      : 'text-muted-foreground hover:text-foreground/70',
                  )}
                  onClick={() => onChange(viewMode)}
                  style={{
                    transition: prefersReducedMotion
                      ? 'none'
                      : `all 300ms cubic-bezier(0.22, 1, 0.36, 1)`,
                  }}
                >
                  <Icon
                    className={cn(
                      'size-3.5 translate-x-[1.5px] transition-all flex-shrink-0',
                      isActive
                        ? 'scale-110 text-white'
                        : 'scale-100 text-muted-foreground group-hover:text-foreground/70 group-hover:scale-105',
                      prefersReducedMotion
                        ? ''
                        : 'transition-[color,transform] duration-300',
                    )}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent
                arrowClassName={
                  isActive ? 'fill-[hsl(238.7_83.5%_35%)]' : 'fill-popover'
                }
                className={cn(
                  isActive
                    ? 'bg-linear-to-br from-[hsl(238.7_83.5%_71%)] to-[hsl(238.7_83.5%_35%)] text-white shadow-lg'
                    : 'bg-popover text-popover-foreground',
                )}
              >
                <p>{config.tooltip}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
};
