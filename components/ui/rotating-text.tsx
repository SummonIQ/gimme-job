'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/css/index';

const rotatingTextVariants = cva(
  'pointer-events-none overflow-hidden',
  {
    defaultVariants: { size: 'default' },
    variants: {
      size: {
        xs: 'h-3 text-xs leading-3',
        sm: 'h-3.5 text-sm leading-3.5',
        default: 'h-4 text-sm leading-4',
        lg: 'h-5 text-base leading-5',
        xl: 'h-6 text-lg leading-6',
      },
    },
  },
);

type RotatingTextSize = NonNullable<
  VariantProps<typeof rotatingTextVariants>['size']
>;

interface RotatingTextProps {
  items: string[];
  interval?: number;
  size?: RotatingTextSize;
  className?: string;
  itemClassName?: string;
  /** Pause the rotation (e.g. when input is focused or has a value) */
  paused?: boolean;
}

function RotatingText({
  items,
  interval = 3000,
  size = 'default',
  className,
  itemClassName,
  paused = false,
}: RotatingTextProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (paused || items.length <= 1) return;

    const timer = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % items.length);
    }, interval);

    return () => clearInterval(timer);
  }, [paused, items.length, interval]);

  return (
    <div className={cn(rotatingTextVariants({ size }), className)}>
      <span className="inline-block relative size-full">
        {items.map((item, index) => (
          <span
            key={item}
            className={cn(
              'absolute left-0 top-0 whitespace-nowrap transition-all duration-500',
              index === activeIndex
                ? 'opacity-100 translate-y-0'
                : index ===
                    (activeIndex - 1 + items.length) % items.length
                  ? 'opacity-0 translate-y-full'
                  : 'opacity-0 -translate-y-full',
              itemClassName,
            )}
          >
            {item}
          </span>
        ))}
      </span>
    </div>
  );
}

RotatingText.displayName = 'RotatingText';

export { RotatingText, rotatingTextVariants, type RotatingTextSize };
