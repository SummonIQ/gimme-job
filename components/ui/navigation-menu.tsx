import * as NavigationMenuPrimitive from '@radix-ui/react-navigation-menu';
import { cva } from 'class-variance-authority';
import { ChevronDown } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

const NavigationMenu = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <NavigationMenuPrimitive.Root
    className={cn(
      'relative z-50 flex max-w-max flex-1 items-center justify-center',
      className,
    )}
    ref={ref}
    {...props}
  >
    {children}
    <NavigationMenuViewport />
  </NavigationMenuPrimitive.Root>
));
NavigationMenu.displayName = NavigationMenuPrimitive.Root.displayName;

const NavigationMenuList = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.List>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.List
    className={cn(
      'group flex flex-1 list-none items-center justify-center space-x-3',
      className,
    )}
    ref={ref}
    {...props}
  />
));
NavigationMenuList.displayName = NavigationMenuPrimitive.List.displayName;

const NavigationMenuItem = NavigationMenuPrimitive.Item;

const navigationMenuTriggerStyle = cva(
  'group inline-flex h-8.5 w-max items-center justify-center rounded-lg border-y border-y-transparent px-3 py-[7px] text-sm font-medium text-muted-foreground/70 transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[parent-active]:border-t-zinc-200 data-[parent-active]:border-b-zinc-300/40 data-[parent-active]:bg-zinc-100/80 data-[parent-active]:text-zinc-700 data-[parent-active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:data-[parent-active]:border-t-[#34343b] dark:data-[parent-active]:border-b-[#18181c] dark:data-[parent-active]:bg-white/[0.055] dark:data-[parent-active]:text-zinc-300 dark:data-[parent-active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.055)] data-[active]:[background:linear-gradient(135deg,color-mix(in_srgb,hsl(var(--primary))_10%,white),color-mix(in_srgb,hsl(var(--primary))_20%,white))] data-[active]:border-t-white dark:data-[active]:[background:linear-gradient(135deg,color-mix(in_srgb,hsl(var(--primary))_34%,hsl(var(--background))),color-mix(in_srgb,hsl(var(--primary))_18%,hsl(var(--background))))] dark:data-[active]:border-t-[#252650] data-[active]:border-b-primary/8 data-[active]:text-[hsl(var(--brand-1))] dark:data-[active]:text-[hsl(var(--brand-1-light))] data-[active]:shadow-[0_4px_8px_0px_rgba(0,0,0,0.08),0_10px_25px_-6px_rgba(91,94,240,0.15),0_-4px_14px_-6px_rgba(91,94,240,0.08)] dark:data-[active]:shadow-[0_6px_12px_0px_rgba(0,0,0,0.4),0_16px_40px_-8px_rgba(91,94,240,0.3),0_-8px_22px_-8px_rgba(91,94,240,0.15)] data-[state=open]:bg-accent/50',
);

const NavigationMenuTrigger = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <NavigationMenuPrimitive.Trigger
    className={cn(navigationMenuTriggerStyle(), 'group', className)}
    ref={ref}
    {...props}
  >
    {children}{' '}
    <ChevronDown
      aria-hidden="true"
      className="relative top-px ml-1 size-3 transition duration-200 group-data-[state=open]:rotate-180"
    />
  </NavigationMenuPrimitive.Trigger>
));
NavigationMenuTrigger.displayName = NavigationMenuPrimitive.Trigger.displayName;

const NavigationMenuContent = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Content
    className={cn(
      'left-0 top-0 z-50 w-full md:absolute md:w-auto',
      'data-[motion^=from-]:animate-[navigation-fade-in_200ms_cubic-bezier(0.16,1,0.3,1)]',
      'data-[motion^=to-]:animate-[navigation-fade-out_150ms_cubic-bezier(0.16,1,0.3,1)]',
      className,
    )}
    ref={ref}
    {...props}
  />
));
NavigationMenuContent.displayName = NavigationMenuPrimitive.Content.displayName;

const NavigationMenuLink = NavigationMenuPrimitive.Link;

const NavigationMenuViewport = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <div className={cn('absolute left-0 top-full flex justify-center z-[9999]')}>
    <NavigationMenuPrimitive.Viewport
      className={cn(
        'origin-top-center relative mt-1.5 h-[var(--radix-navigation-menu-viewport-height)] w-full overflow-hidden rounded-lg text-popover-foreground md:w-[var(--radix-navigation-menu-viewport-width)]',
        'data-[state=open]:animate-[navigation-zoom-in_200ms_cubic-bezier(0.16,1,0.3,1)]',
        'data-[state=closed]:animate-[navigation-zoom-out_150ms_cubic-bezier(0.16,1,0.3,1)]',
        'navigation-blur border shadow-lg backdrop-blur-2xl dark:border-white/[0.09]',
        className,
      )}
      ref={ref}
      {...props}
    />
  </div>
));
NavigationMenuViewport.displayName =
  NavigationMenuPrimitive.Viewport.displayName;

const NavigationMenuIndicator = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Indicator>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Indicator>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Indicator
    className={cn(
      'top-full z-[1] flex h-1.5 items-end justify-center overflow-hidden',
      'data-[state=visible]:animate-[fade-in_150ms_cubic-bezier(0.16,1,0.3,1)]',
      'data-[state=hidden]:animate-[fade-out_100ms_cubic-bezier(0.16,1,0.3,1)]',
      className,
    )}
    ref={ref}
    {...props}
  >
    <div className="relative top-[60%] size-2 rotate-45 rounded-tl-sm bg-border shadow-md" />
  </NavigationMenuPrimitive.Indicator>
));
NavigationMenuIndicator.displayName =
  NavigationMenuPrimitive.Indicator.displayName;

export {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
  NavigationMenuViewport,
};
