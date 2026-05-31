'use client';

import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';

import { UI_INTERACTIVE_ELEMENT_SIZE_HEIGHT } from '@/constants/ui/sizes';
import { cn } from '@/lib/css';

type SwitchSize = 'sm' | 'md' | 'lg' | 'default';

interface SwitchProps extends React.ComponentPropsWithoutRef<
  typeof SwitchPrimitives.Root
> {
  size?: SwitchSize;
}

const SIZE_ROOT: Record<SwitchSize, string> = {
  default: cn(UI_INTERACTIVE_ELEMENT_SIZE_HEIGHT.default, 'w-16'),
  sm: cn(UI_INTERACTIVE_ELEMENT_SIZE_HEIGHT.sm, 'w-14'),
  md: cn(UI_INTERACTIVE_ELEMENT_SIZE_HEIGHT.default, 'w-16'),
  lg: cn(UI_INTERACTIVE_ELEMENT_SIZE_HEIGHT.lg, 'w-20'),
};

const SIZE_THUMB: Record<SwitchSize, string> = {
  default: 'size-8 data-[state=checked]:translate-x-[27px]',
  sm: 'size-7 data-[state=checked]:translate-x-[23px]',
  md: 'size-8 data-[state=checked]:translate-x-[27px]',
  lg: 'size-10 data-[state=checked]:translate-x-[35px]',
};

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, size = 'md', ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      'peer inline-flex shrink-0 cursor-pointer items-center rounded-full border border-border/50 bg-linear-to-br from-black/[0.02] to-white/[0.04] p-0.5 shadow-xs inset-shadow-xs inset-shadow-black/[0.04] transition-[background-color,box-shadow,border-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 data-[state=checked]:border-primary/40 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input dark:from-transparent dark:to-transparent dark:inset-shadow-white/[0.03] dark:data-[state=unchecked]:bg-card',
      SIZE_ROOT[size],
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        'pointer-events-none block rounded-full bg-background shadow-md ring-1 ring-black/5 transition-transform data-[state=unchecked]:translate-x-0 dark:ring-white/10',
        SIZE_THUMB[size],
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
