import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import React from 'react';

// Glass variants with subtle but visible effect
const glassVariants = cva(
  // Base glass effect with improved visibility
  "relative before:absolute before:inset-0 before:content-[''] before:backdrop-blur-xl before:backdrop-brightness-110 before:backdrop-saturate-110 before:bg-white/5 dark:before:bg-white/3",
  {
    variants: {
      edge: {
        bottom:
          'before:[mask-image:linear-gradient(to_bottom,black_0,black_calc(100%_-_2rem),transparent_calc(100%_-_2rem))]',
        top: 'before:[mask-image:linear-gradient(to_top,black_0,black_calc(100%_-_2rem),transparent_calc(100%_-_2rem))]',
        left: 'before:[mask-image:linear-gradient(to_left,black_0,black_calc(100%_-_2rem),transparent_calc(100%_-_2rem))]',
        right:
          'before:[mask-image:linear-gradient(to_right,black_0,black_calc(100%_-_2rem),transparent_calc(100%_-_2rem))]',
        none: 'before:[mask-image:linear-gradient(black,black)]',
      },
      intensity: {
        subtle: 'before:backdrop-brightness-102 before:backdrop-saturate-102',
        normal: 'before:backdrop-brightness-105 before:backdrop-saturate-105',
        strong: 'before:backdrop-brightness-110 before:backdrop-saturate-110',
        intense: 'before:backdrop-brightness-115 before:backdrop-saturate-115',
      },
      blur: {
        sm: 'before:backdrop-blur-sm',
        md: 'before:backdrop-blur-md',
        lg: 'before:backdrop-blur-lg',
        xl: 'before:backdrop-blur-xl',
        '2xl': 'before:backdrop-blur-2xl',
      },
    },
    defaultVariants: {
      edge: 'bottom',
      intensity: 'normal',
      blur: 'xl',
    },
  },
);

// Edge line variants for the glowing border effect - subtle but prominent
const edgeLineVariants = cva(
  'pointer-events-none absolute saturate-150 backdrop-blur-xl backdrop-brightness-110 backdrop-saturate-120',
  {
    variants: {
      edge: {
        bottom: 'right-0 bottom-0 left-0 h-[2px] bg-gradient-to-r from-transparent via-primary/30 to-transparent',
        top: 'right-0 top-0 left-0 h-[2px] bg-gradient-to-r from-transparent via-primary/30 to-transparent',
        left: 'top-0 left-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-primary/30 to-transparent',
        right: 'top-0 right-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-primary/30 to-transparent',
      },
      glow: {
        none: 'opacity-0',
        subtle: 'opacity-60',
        normal: 'opacity-80',
        intense: 'opacity-100 saturate-200 backdrop-brightness-130 animate-pulse shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]',
      },
    },
    defaultVariants: {
      edge: 'bottom',
      glow: 'normal',
    },
  },
);

// Glow effect variants - dramatically enhanced for maximum prominence
const glowVariants = cva(
  'pointer-events-none absolute inset-0 saturate-200 backdrop-blur-xl',
  {
    variants: {
      edge: {
        bottom:
          '[mask-image:linear-gradient(to_bottom,transparent_0,transparent_30%,black_70%,black_85%,transparent_100%)] bg-gradient-to-t from-primary/15 via-primary/5 to-transparent',
        top: '[mask-image:linear-gradient(to_top,transparent_0,transparent_30%,black_70%,black_85%,transparent_100%)] bg-gradient-to-b from-primary/15 via-primary/5 to-transparent',
        left: '[mask-image:linear-gradient(to_left,transparent_0,transparent_30%,black_70%,black_85%,transparent_100%)] bg-gradient-to-r from-primary/15 via-primary/5 to-transparent',
        right:
          '[mask-image:linear-gradient(to_right,transparent_0,transparent_30%,black_70%,black_85%,transparent_100%)] bg-gradient-to-l from-primary/15 via-primary/5 to-transparent',
      },
      intensity: {
        none: 'opacity-0',
        subtle: 'opacity-60 backdrop-brightness-130 backdrop-saturate-175',
        normal: 'opacity-80 backdrop-brightness-160 backdrop-saturate-200',
        intense: 'opacity-100 backdrop-brightness-200 backdrop-saturate-300 shadow-[0_0_80px_rgba(var(--primary-glow),0.3),0_0_50px_rgba(var(--primary-glow),0.2),0_0_30px_rgba(var(--primary-rgb),0.15)]',
      },
    },
    defaultVariants: {
      edge: 'bottom',
      intensity: 'normal',
    },
  },
);

// Main glass container component
interface GlassProps extends React.HTMLAttributes<HTMLDivElement> {
  edge?: VariantProps<typeof glassVariants>['edge'];
  intensity?: VariantProps<typeof glassVariants>['intensity'];
  blur?: VariantProps<typeof glassVariants>['blur'];
  showEdgeLine?: boolean;
  edgeGlow?: VariantProps<typeof edgeLineVariants>['glow'];
  showGlow?: boolean;
  glowIntensity?: VariantProps<typeof glowVariants>['intensity'];
  children: React.ReactNode;
}

function Glass({
  className,
  edge = 'bottom',
  intensity = 'normal',
  blur = 'xl',
  showEdgeLine = true,
  edgeGlow = 'normal',
  showGlow = true,
  glowIntensity = 'normal',
  children,
  ...props
}: GlassProps) {
  return (
    <div
      className={cn(
        'relative', // Removed overflow-hidden to prevent content clipping
        glassVariants({ edge, intensity, blur }),
        intensity === 'intense' && 'animate-intense-glow',
        className
      )}
      {...props}
    >
      {/* Multiple glow layers for enhanced effect */}
      {showGlow && edge !== 'none' && (
        <>
          {/* Primary glow */}
          <div className={glowVariants({ edge, intensity: glowIntensity })} />
          
          {/* Secondary enhanced glow for intense setting - much more prominent */}
          {glowIntensity === 'intense' && (
            <>
              {/* Primary intense glow layer */}
              <div 
                className={cn(
                  'pointer-events-none absolute inset-0',
                  edge === 'bottom' && 'bg-gradient-to-t from-primary/20 via-primary/10 to-transparent h-[250%] translate-y-[30%]',
                  edge === 'top' && 'bg-gradient-to-b from-primary/20 via-primary/10 to-transparent h-[250%] -translate-y-[30%]',
                  edge === 'left' && 'bg-gradient-to-r from-primary/20 via-primary/10 to-transparent w-[250%] -translate-x-[30%]',
                  edge === 'right' && 'bg-gradient-to-l from-primary/20 via-primary/10 to-transparent w-[250%] translate-x-[30%]',
                  'blur-3xl opacity-80 animate-pulse'
                )}
              />
              {/* Secondary ambient glow */}
              <div 
                className={cn(
                  'pointer-events-none absolute inset-0',
                  edge === 'bottom' && 'bg-gradient-to-t from-primary/15 via-transparent to-transparent h-[300%] translate-y-[40%]',
                  edge === 'top' && 'bg-gradient-to-b from-primary/15 via-transparent to-transparent h-[300%] -translate-y-[40%]',
                  edge === 'left' && 'bg-gradient-to-r from-primary/15 via-transparent to-transparent w-[300%] -translate-x-[40%]',
                  edge === 'right' && 'bg-gradient-to-l from-primary/15 via-transparent to-transparent w-[300%] translate-x-[40%]',
                  'blur-[100px] opacity-60'
                )}
              />
              {/* Tertiary color accent glow */}
              <div 
                className={cn(
                  'pointer-events-none absolute inset-0',
                  edge === 'bottom' && 'bg-gradient-to-t from-blue-500/10 via-purple-500/5 to-transparent h-[200%] translate-y-[20%]',
                  edge === 'top' && 'bg-gradient-to-b from-blue-500/10 via-purple-500/5 to-transparent h-[200%] -translate-y-[20%]',
                  edge === 'left' && 'bg-gradient-to-r from-blue-500/10 via-purple-500/5 to-transparent w-[200%] -translate-x-[20%]',
                  edge === 'right' && 'bg-gradient-to-l from-blue-500/10 via-purple-500/5 to-transparent w-[200%] translate-x-[20%]',
                  'blur-2xl opacity-70 mix-blend-screen'
                )}
              />
            </>
          )}
        </>
      )}

      {/* Edge line with enhanced glow */}
      {showEdgeLine && edge !== 'none' && (
        <>
          <div className={cn(
            edgeLineVariants({ edge, glow: edgeGlow }),
            edgeGlow === 'intense' && 'shadow-[0_0_40px_rgba(255,255,255,0.8),0_0_20px_rgba(var(--primary-rgb),0.6)]'
          )} />
          {/* Additional shimmer effect for intense mode */}
          {edgeGlow === 'intense' && (
            <div className={cn(
              'pointer-events-none absolute',
              edge === 'bottom' && 'right-0 bottom-0 left-0 h-[1px] animate-shimmer',
              edge === 'top' && 'right-0 top-0 left-0 h-[1px] animate-shimmer',
              edge === 'left' && 'top-0 left-0 bottom-0 w-[1px]',
              edge === 'right' && 'top-0 right-0 bottom-0 w-[1px]',
            )} />
          )}
        </>
      )}

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// Usage examples:
const examples = {
  // Basic usage like your button variants
  basicUsage: () => (
    <div
      className={cn(
        glassVariants({ edge: 'bottom', intensity: 'strong', blur: '2xl' }),
        'h-48 w-80 rounded-2xl',
      )}
    >
      <div className="relative z-10 p-6">
        <span className="text-white">Basic glass effect</span>
      </div>
    </div>
  ),

  // Using the component
  componentUsage: () => (
    <Glass
      edge="bottom"
      intensity="intense"
      glowIntensity="intense"
      className="h-56 w-96 rounded-lg"
    >
      <h2 className="font-bold text-white">Glass Container</h2>
      <p className="text-gray-300">With glow effect</p>
    </Glass>
  ),

  // Link with glass effect (like your button example)
  linkUsage: () => (
    <a
      className={cn(
        glassVariants({ edge: 'bottom', intensity: 'normal' }),
        'inline-flex items-center px-4 py-2 rounded-md',
      )}
    >
      <span className="relative z-10 text-white">Glass Link</span>
    </a>
  ),
};

export {
  glassVariants,
  edgeLineVariants,
  glowVariants,
  Glass,
  type GlassProps,
};
