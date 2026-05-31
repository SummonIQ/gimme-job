'use client';

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/css';

export type DashboardWidgetGlow =
  | 'amber'
  | 'blue'
  | 'cyan'
  | 'emerald'
  | 'pink'
  | 'rose'
  | 'teal'
  | 'violet';

/**
 * Widget size is the xl col-span (out of 48 columns), 2..48.
 * String aliases are accepted for backwards compatibility with stored layouts.
 */
export type DashboardWidgetSize = number | DashboardWidgetSizeAlias;

type DashboardWidgetSizeAlias =
  | 'statTiny'
  | 'statSmall'
  | 'statWide'
  | 'quarter'
  | 'third'
  | 'fiveTwelfths'
  | 'half'
  | 'sevenTwelfths'
  | 'wide'
  | 'threeFourths'
  | 'fiveSixths'
  | 'elevenTwelfths'
  | 'full';

const SIZE_ALIAS: Record<DashboardWidgetSizeAlias, number> = {
  statTiny: 4,
  statSmall: 6,
  statWide: 8,
  quarter: 12,
  third: 16,
  fiveTwelfths: 20,
  half: 24,
  sevenTwelfths: 28,
  wide: 32,
  threeFourths: 36,
  fiveSixths: 40,
  elevenTwelfths: 44,
  full: 48,
};

const MIN_COL_SPAN = 2;
const MAX_COL_SPAN = 48;

function toColSpan(size: DashboardWidgetSize | undefined | null): number {
  if (typeof size === 'number' && Number.isFinite(size)) {
    return clamp(Math.round(size), MIN_COL_SPAN, MAX_COL_SPAN);
  }
  if (typeof size === 'string' && size in SIZE_ALIAS) {
    return SIZE_ALIAS[size as DashboardWidgetSizeAlias];
  }
  return SIZE_ALIAS.quarter;
}

export interface DashboardWidgetConfig<WidgetId extends string = string> {
  /**
   * Optional list of size aliases used to derive min/max col-span. When
   * provided, resize is bounded to [min..max] based on the alias values.
   * Prefer minSize/maxSize for new widgets.
   */
  allowedSizes?: DashboardWidgetSize[];
  bodyClassName?: string;
  compact?: boolean;
  content: React.ReactNode;
  defaultRows: number;
  defaultSize: DashboardWidgetSize;
  description?: string;
  glow: DashboardWidgetGlow;
  headerExtra?: React.ReactNode;
  id: WidgetId;
  /** Inclusive lower bound for col-span when resizing. */
  minSize?: DashboardWidgetSize;
  /** Inclusive upper bound for col-span when resizing. */
  maxSize?: DashboardWidgetSize;
  panelClassName?: string;
  title: string;
}

interface DashboardWidgetGridProps<WidgetId extends string = string> {
  onReorder?: (id: WidgetId) => void;
  onResize?: (id: WidgetId) => void;
  storagePrefix: string;
  widgets: Array<DashboardWidgetConfig<WidgetId>>;
}

function getWidgetSizeRange(
  widget: DashboardWidgetConfig<string>,
): { min: number; max: number } {
  if (widget.minSize != null || widget.maxSize != null) {
    const min = widget.minSize != null ? toColSpan(widget.minSize) : MIN_COL_SPAN;
    const max = widget.maxSize != null ? toColSpan(widget.maxSize) : MAX_COL_SPAN;
    return { min: Math.min(min, max), max: Math.max(min, max) };
  }
  if (widget.allowedSizes && widget.allowedSizes.length > 0) {
    const spans = widget.allowedSizes.map(toColSpan);
    return { min: Math.min(...spans), max: Math.max(...spans) };
  }
  return { min: MIN_COL_SPAN, max: MAX_COL_SPAN };
}

/**
 * Static lookup of every supported xl col-span class so Tailwind's content
 * scanner picks them up at build time. Template literals would not be
 * detected, so each variant has to appear here as a literal string.
 */
const XL_COL_SPAN_CLASS: Record<number, string> = {
  2: 'xl:col-span-2', 3: 'xl:col-span-3', 4: 'xl:col-span-4',
  5: 'xl:col-span-5', 6: 'xl:col-span-6', 7: 'xl:col-span-7',
  8: 'xl:col-span-8', 9: 'xl:col-span-9', 10: 'xl:col-span-10',
  11: 'xl:col-span-11', 12: 'xl:col-span-12', 13: 'xl:col-span-13',
  14: 'xl:col-span-14', 15: 'xl:col-span-15', 16: 'xl:col-span-16',
  17: 'xl:col-span-17', 18: 'xl:col-span-18', 19: 'xl:col-span-19',
  20: 'xl:col-span-20', 21: 'xl:col-span-21', 22: 'xl:col-span-22',
  23: 'xl:col-span-23', 24: 'xl:col-span-24', 25: 'xl:col-span-25',
  26: 'xl:col-span-26', 27: 'xl:col-span-27', 28: 'xl:col-span-28',
  29: 'xl:col-span-29', 30: 'xl:col-span-30', 31: 'xl:col-span-31',
  32: 'xl:col-span-32', 33: 'xl:col-span-33', 34: 'xl:col-span-34',
  35: 'xl:col-span-35', 36: 'xl:col-span-36', 37: 'xl:col-span-37',
  38: 'xl:col-span-38', 39: 'xl:col-span-39', 40: 'xl:col-span-40',
  41: 'xl:col-span-41', 42: 'xl:col-span-42', 43: 'xl:col-span-43',
  44: 'xl:col-span-44', 45: 'xl:col-span-45', 46: 'xl:col-span-46',
  47: 'xl:col-span-47', 48: 'xl:col-span-48',
};

function getColSpanClasses(xlSpan: number): string {
  const span = clamp(xlSpan, MIN_COL_SPAN, MAX_COL_SPAN);
  const mdClass =
    span <= 4 ? 'md:col-span-3' : span <= 8 ? 'md:col-span-6' : 'md:col-span-12';
  return `${mdClass} ${XL_COL_SPAN_CLASS[span]}`;
}

function getColSpanShadow(span: number): string {
  if (span <= 4) return 'shadow-[0_4px_10px_-4px_rgba(0,0,0,0.30)]';
  if (span <= 6) return 'shadow-[0_4px_10px_-4px_rgba(0,0,0,0.32)]';
  if (span <= 8) return 'shadow-[0_4px_12px_-4px_rgba(0,0,0,0.34)]';
  if (span <= 12) return 'shadow-[0_8px_18px_-8px_rgba(0,0,0,0.38)]';
  if (span <= 16) return 'shadow-[0_10px_22px_-10px_rgba(0,0,0,0.42)]';
  if (span <= 20) return 'shadow-[0_12px_24px_-10px_rgba(0,0,0,0.44)]';
  if (span <= 24) return 'shadow-[0_14px_28px_-12px_rgba(0,0,0,0.48)]';
  if (span <= 28) return 'shadow-[0_16px_30px_-12px_rgba(0,0,0,0.50)]';
  if (span <= 32) return 'shadow-[0_18px_34px_-14px_rgba(0,0,0,0.52)]';
  if (span <= 36) return 'shadow-[0_18px_34px_-14px_rgba(0,0,0,0.53)]';
  if (span <= 40) return 'shadow-[0_19px_36px_-15px_rgba(0,0,0,0.55)]';
  if (span <= 44) return 'shadow-[0_20px_37px_-15px_rgba(0,0,0,0.55)]';
  return 'shadow-[0_20px_38px_-16px_rgba(0,0,0,0.56)]';
}

const GLOW_CLASS: Record<DashboardWidgetGlow, string> = {
  amber:
    'before:bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.10),transparent_72%)]',
  blue:
    'before:bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.10),transparent_72%)]',
  cyan:
    'before:bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.10),transparent_72%)]',
  emerald:
    'before:bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.10),transparent_72%)]',
  pink:
    'before:bg-[radial-gradient(circle_at_top_left,rgba(244,114,182,0.10),transparent_72%)]',
  rose:
    'before:bg-[radial-gradient(circle_at_top_left,rgba(251,113,133,0.10),transparent_72%)]',
  teal:
    'before:bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.10),transparent_72%)]',
  violet:
    'before:bg-[radial-gradient(circle_at_top_left,rgba(167,139,250,0.10),transparent_72%)]',
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function readStoredJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function DashboardWidgetGrid<WidgetId extends string>({
  onReorder,
  onResize,
  storagePrefix,
  widgets,
}: DashboardWidgetGridProps<WidgetId>) {
  const widgetIds = useMemo(() => widgets.map(widget => widget.id), [widgets]);
  const widgetIdSet = useMemo(() => new Set(widgetIds), [widgetIds]);
  const widgetMap = useMemo(
    () => new Map(widgets.map(widget => [widget.id, widget])),
    [widgets],
  );
  const orderKey = `${storagePrefix}.order.v1`;
  const sizeKey = `${storagePrefix}.sizes.v1`;
  const rowKey = `${storagePrefix}.rows.v1`;
  const [widgetOrder, setWidgetOrder] = useState<WidgetId[]>(widgetIds);
  const [widgetSizes, setWidgetSizes] = useState<
    Partial<Record<WidgetId, DashboardWidgetSize>>
  >({});
  const [widgetRows, setWidgetRows] = useState<Partial<Record<WidgetId, number>>>(
    {},
  );
  const [layoutLoaded, setLayoutLoaded] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    const storedOrder = readStoredJson<WidgetId[]>(orderKey);
    if (storedOrder) {
      const deduped = storedOrder.filter(
        (id, index) => widgetIdSet.has(id) && storedOrder.indexOf(id) === index,
      );
      setWidgetOrder([
        ...deduped,
        ...widgetIds.filter(id => !deduped.includes(id)),
      ]);
    } else {
      setWidgetOrder(widgetIds);
    }

    const storedSizes =
      readStoredJson<Partial<Record<WidgetId, DashboardWidgetSize>>>(sizeKey);
    if (storedSizes) {
      setWidgetSizes(
        Object.fromEntries(
          Object.entries(storedSizes)
            .filter(([id, size]) => {
              const widget = widgetMap.get(id as WidgetId);
              return widget && size != null;
            })
            .map(([id, size]) => {
              const widget = widgetMap.get(id as WidgetId);
              if (!widget) return [id, size as DashboardWidgetSize];
              const range = getWidgetSizeRange(widget);
              const span = clamp(toColSpan(size as DashboardWidgetSize), range.min, range.max);
              return [id, span];
            }),
        ) as Partial<Record<WidgetId, DashboardWidgetSize>>,
      );
    } else {
      setWidgetSizes({});
    }

    const storedRows = readStoredJson<Partial<Record<WidgetId, number>>>(rowKey);
    if (storedRows) {
      setWidgetRows(
        Object.fromEntries(
          Object.entries(storedRows)
            .filter(([id, rows]) => widgetIdSet.has(id as WidgetId) && typeof rows === 'number')
            .map(([id, rows]) => [id, clamp(rows as number, 2, 30)]),
        ) as Partial<Record<WidgetId, number>>,
      );
    } else {
      setWidgetRows({});
    }

    setLayoutLoaded(true);
  }, [orderKey, rowKey, sizeKey, widgetIds, widgetIdSet, widgetMap]);

  useEffect(() => {
    if (!layoutLoaded) return;
    window.localStorage.setItem(orderKey, JSON.stringify(widgetOrder));
  }, [layoutLoaded, orderKey, widgetOrder]);

  useEffect(() => {
    if (!layoutLoaded) return;
    window.localStorage.setItem(sizeKey, JSON.stringify(widgetSizes));
  }, [layoutLoaded, sizeKey, widgetSizes]);

  useEffect(() => {
    if (!layoutLoaded) return;
    window.localStorage.setItem(rowKey, JSON.stringify(widgetRows));
  }, [layoutLoaded, rowKey, widgetRows]);

  const handleWidgetDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setWidgetOrder(current => {
      const oldIndex = current.indexOf(active.id as WidgetId);
      const newIndex = current.indexOf(over.id as WidgetId);
      if (oldIndex < 0 || newIndex < 0) return current;
      return arrayMove(current, oldIndex, newIndex);
    });
    onReorder?.(active.id as WidgetId);
  };

  const handleResizeWidget = (
    id: WidgetId,
    deltaCols: number,
    deltaRows: number,
  ) => {
    const widget = widgetMap.get(id);
    if (!widget) return;

    if (deltaCols !== 0) {
      setWidgetSizes(current => {
        const currentSpan = toColSpan(current[id] ?? widget.defaultSize);
        const range = getWidgetSizeRange(widget);
        const nextSpan = clamp(currentSpan + deltaCols, range.min, range.max);
        if (nextSpan === currentSpan) return current;
        return { ...current, [id]: nextSpan };
      });
    }

    if (deltaRows !== 0) {
      setWidgetRows(current => {
        const currentRows = current[id] ?? widget.defaultRows;
        const nextRows = clamp(currentRows + deltaRows, 2, 30);
        if (nextRows === currentRows) return current;
        return { ...current, [id]: nextRows };
      });
    }

    if (deltaCols !== 0 || deltaRows !== 0) {
      onResize?.(id);
    }
  };

  if (!layoutLoaded) {
    return null;
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={handleWidgetDragEnd}
      sensors={sensors}
    >
      <SortableContext items={widgetOrder} strategy={rectSortingStrategy}>
        <div
          data-dashboard-grid
          className="grid auto-rows-auto grid-cols-1 items-stretch gap-4 md:grid-cols-12 xl:auto-rows-[24px] xl:grid-flow-row-dense xl:grid-cols-[repeat(48,minmax(0,1fr))]"
        >
          {widgetOrder
            .filter(id => widgetIdSet.has(id))
            .map(id => {
              const widget = widgetMap.get(id);
              if (!widget) return null;
              return (
                <DashboardSortableWidget
                  key={id}
                  bodyClassName={widget.bodyClassName}
                  compact={widget.compact}
                  description={widget.description}
                  glow={widget.glow}
                  headerExtra={widget.headerExtra}
                  id={id}
                  onResize={handleResizeWidget}
                  panelClassName={widget.panelClassName}
                  rows={widgetRows[id] ?? widget.defaultRows}
                  size={widgetSizes[id] ?? widget.defaultSize}
                  title={widget.title}
                >
                  {widget.content}
                </DashboardSortableWidget>
              );
            })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function DashboardSortableWidget<WidgetId extends string>({
  bodyClassName,
  children,
  compact,
  description,
  glow,
  headerExtra,
  id,
  onResize,
  panelClassName,
  rows,
  size,
  title,
}: {
  bodyClassName?: string;
  children: React.ReactNode;
  compact?: boolean;
  description?: string;
  glow: DashboardWidgetGlow;
  headerExtra?: React.ReactNode;
  id: WidgetId;
  onResize: (id: WidgetId, deltaCols: number, deltaRows: number) => void;
  panelClassName?: string;
  rows: number;
  size: DashboardWidgetSize;
  title: string;
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } =
    useSortable({ id });
  const [activeResize, setActiveResize] = useState<
    'e' | 's' | 'se' | 'sw' | 'w' | null
  >(null);

  const startResize = (
    event: React.PointerEvent<HTMLButtonElement>,
    direction: 'e' | 's' | 'se' | 'sw' | 'w',
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    let lastCols = 0;
    let lastRows = 0;
    setActiveResize(direction);

    // Mirror the actual grid column width so each pointer-pixel of drag maps
    // 1:1 to one col-span tick. Falls back to a sensible default if the host
    // grid hasn't laid out yet.
    let pxPerCol = 24;
    const gridEl = (event.currentTarget as HTMLElement).closest(
      '[data-dashboard-grid]',
    );
    if (gridEl instanceof HTMLElement) {
      const measured = gridEl.getBoundingClientRect().width / MAX_COL_SPAN;
      if (measured > 4) pxPerCol = measured;
    }

    const handleMove = (moveEvent: PointerEvent) => {
      const rawDeltaX =
        direction === 'w' || direction === 'sw'
          ? -(moveEvent.clientX - startX)
          : moveEvent.clientX - startX;
      const rawDeltaY = moveEvent.clientY - startY;
      const nextCols = direction === 's' ? 0 : Math.round(rawDeltaX / pxPerCol);
      const nextRows =
        direction === 'w' || direction === 'e'
          ? 0
          : Math.round(rawDeltaY / 24);
      const deltaCols = nextCols - lastCols;
      const deltaRows = nextRows - lastRows;

      if (deltaCols !== 0 || deltaRows !== 0) {
        lastCols = nextCols;
        lastRows = nextRows;
        onResize(id, deltaCols, deltaRows);
      }
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      setActiveResize(null);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const colSpan = toColSpan(size);

  return (
    <div
      className={cn(
        compact ? 'rounded-xl will-change-transform' : 'rounded-2xl will-change-transform',
        activeResize ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
        'animate-card-in overflow-hidden border-x-0 border-t border-t-black/5 dark:border-t-white/15',
        getColSpanClasses(colSpan),
        getColSpanShadow(colSpan),
        isDragging && 'z-40',
      )}
      ref={setNodeRef}
      style={{
        gridRow: `span ${rows} / span ${rows}`,
        minHeight: `${Math.max(48, rows * 20)}px`,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
      {...(activeResize ? {} : listeners)}
    >
      <motion.div
        className={cn(
          'group relative h-full select-none bg-white/[0.88] before:pointer-events-none before:absolute before:inset-0 dark:bg-[#101216]/95',
          GLOW_CLASS[glow],
          isDragging && 'ring-1 ring-cyan-400/35',
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.55),rgba(255,255,255,0.08)_48%,rgba(255,255,255,0))] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.01)_48%,rgba(255,255,255,0))]" />
        <div className="relative flex h-full flex-col">
          <div
            className={cn(
              'flex items-start justify-between gap-3',
              compact ? 'px-4 pb-0 pt-3' : 'px-5 pb-2 pt-4',
            )}
          >
            <div className="min-w-0">
              <p
                className={cn(
                  compact
                    ? 'text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/75 dark:text-white/75'
                    : 'text-sm font-semibold text-foreground dark:text-white',
                )}
              >
                {title}
              </p>
              {description ? (
                <p className="mt-0.5 text-xs text-muted-foreground dark:text-zinc-500">
                  {description}
                </p>
              ) : null}
            </div>
            {headerExtra ? <div className="shrink-0">{headerExtra}</div> : null}
          </div>

          <div
            className={cn(
              'relative flex min-h-0 flex-1 flex-col',
              compact ? 'flex px-3.5 pb-1.5 pt-0' : 'px-3 pb-3 pt-2',
              bodyClassName,
            )}
          >
            {compact ? (
              children
            ) : (
              <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-black/[0.035] dark:bg-black/25">
                <ScrollFade className={panelClassName ?? 'px-4 py-4'}>
                  {children}
                </ScrollFade>
              </div>
            )}
          </div>

          <ResizeHandle
            active={activeResize === 'sw'}
            className="bottom-0 left-0 h-6 w-6 cursor-sw-resize"
            label={`Resize ${title} smaller or taller`}
            onPointerDown={event => startResize(event, 'sw')}
            spanClassName={cn(
              'bottom-1 left-1 h-4 w-4 border-b-2 border-l-2',
              compact ? 'rounded-bl-[8px]' : 'rounded-bl-[12px]',
            )}
          />
          <ResizeHandle
            active={activeResize === 'w'}
            className="left-0 top-1/2 h-9 w-3 -translate-y-1/2 cursor-ew-resize"
            label={`Resize ${title} wider or narrower`}
            onPointerDown={event => startResize(event, 'w')}
            spanClassName="left-1 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-current"
          />
          <ResizeHandle
            active={activeResize === 'e'}
            className="right-0 top-1/2 h-9 w-3 -translate-y-1/2 cursor-ew-resize"
            label={`Resize ${title} wider or narrower`}
            onPointerDown={event => startResize(event, 'e')}
            spanClassName="right-1 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-current"
          />
          <ResizeHandle
            active={activeResize === 's'}
            className="bottom-0 left-1/2 h-3 w-9 -translate-x-1/2 cursor-ns-resize"
            label={`Resize ${title} taller or shorter`}
            onPointerDown={event => startResize(event, 's')}
            spanClassName="bottom-1 left-1/2 h-[2px] w-4 -translate-x-1/2 rounded-full bg-current"
          />
          <ResizeHandle
            active={activeResize === 'se'}
            className="bottom-0 right-0 h-6 w-6 cursor-se-resize"
            label={`Resize ${title} larger or taller`}
            onPointerDown={event => startResize(event, 'se')}
            spanClassName={cn(
              'bottom-1 right-1 h-4 w-4 border-b-2 border-r-2',
              compact ? 'rounded-br-[8px]' : 'rounded-br-[12px]',
            )}
          />
        </div>
      </motion.div>
    </div>
  );
}

function ResizeHandle({
  active,
  className,
  label,
  onPointerDown,
  spanClassName,
}: {
  active: boolean;
  className: string;
  label: string;
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  spanClassName: string;
}) {
  return (
    <button
      aria-label={label}
      className={cn('group/resize absolute z-[1] outline-none', className)}
      onPointerDown={onPointerDown}
      type="button"
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute text-white/[0.2] transition-all duration-200',
          active
            ? 'border-white/80 text-white/80 opacity-100'
            : 'border-white/[0.2] opacity-0 group-hover/resize:scale-110 group-hover/resize:border-white/[0.55] group-hover/resize:text-white/[0.55] group-hover/resize:opacity-100',
          spanClassName,
        )}
      />
    </button>
  );
}

function ScrollFade({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [showTop, setShowTop] = useState(false);
  const [showBottom, setShowBottom] = useState(false);
  const [heightOpacity, setHeightOpacity] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      setShowTop(el.scrollTop > 4);
      setShowBottom(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
      const t = clamp((el.clientHeight - 120) / (480 - 120), 0, 1);
      setHeightOpacity(0.78 + t * 0.22);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className={cn('flex-1 overflow-y-auto', className)} ref={ref}>
        {children}
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/80 via-white/35 to-transparent transition-opacity duration-200 dark:from-black/70 dark:via-black/30"
        style={{ opacity: showTop ? heightOpacity : 0 }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white/90 via-white/40 to-transparent transition-opacity duration-200 dark:from-black/80 dark:via-black/35"
        style={{ opacity: showBottom ? heightOpacity : 0 }}
      />
    </div>
  );
}
