'use client';

import { cn } from '@/lib/utils';
import { Target } from 'lucide-react';

interface LogoProps {
  className?: string;
  iconClassName?: string;
  briefcaseClassName?: string;
  iconVariant?: 'briefcase' | 'target';
  briefcaseStyle?: 'default' | 'stylized';
  textClassName?: string;
  betaClassName?: string;
  size?: 'sm' | 'md' | 'lg';
  shadowOpacity?: number;
  showBorder?: boolean;
  borderColor?: string;
}

export function Logo({
  className,
  iconClassName,
  briefcaseClassName,
  iconVariant = 'briefcase',
  briefcaseStyle = 'default',
  textClassName,
  betaClassName,
  size = 'md',
}: LogoProps) {
  const sizeClasses = {
    sm: {
      icon: 'size-8 min-h-8',
      iconInner: 'size-4 stroke-[2.2px]',
      text: 'text-sm',
      beta: 'text-[10px]',
      gap: 'space-x-2',
    },
    md: {
      icon: 'size-10 min-h-10',
      iconInner: 'size-5 stroke-[2.2px]',
      text: 'text-base',
      beta: 'text-xs',
      gap: 'space-x-2.5',
    },
    lg: {
      icon: 'size-11 min-h-11',
      iconInner: 'size-6 stroke-[2.2px]',
      text: 'text-base',
      beta: 'text-xs',
      gap: 'space-x-3',
    },
  };

  return (
    <div
      className={cn(
        'relative z-10 flex flex-row items-center justify-center',
        sizeClasses[size].gap,
        className,
      )}
    >
      <div
        className={cn(
          'relative isolate flex rounded-[22%] items-center justify-center',
          // 'bg-linear-to-br from-[hsl(238.7_83.5%_71%)] to-[hsl(238.7_83.5%_35%)]',
          // 'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),inset_0_-1px_0_0_hsl(var(--brand-1-darker)),0_2px_8px_-2px_hsl(var(--primary)/0.3)]',
          sizeClasses[size].icon,
          iconClassName,
        )}
      >
        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.4),transparent_50%)]" />
        <span className="pointer-events-none absolute -top-3 -right-3 size-7 rounded-full bg-white/25 blur-md" />
        <span className="pointer-events-none absolute -bottom-2 left-1/2 -translate-x-1/2 h-3 w-3/4 rounded-full bg-white/10 blur-sm" />
        {iconVariant === 'target' ? (
          <Target
            className={cn(
              'relative text-white/95 drop-shadow-[0_2px_6px_rgba(0,0,0,0.25)] stroke-[2.35px]',
              sizeClasses[size].iconInner,
              briefcaseClassName,
            )}
          />
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            overflow="visible"
            xmlns="http://www.w3.org/2000/svg"
            className={cn(
              'relative scale-200 drop-shadow-[0_2px_6px_rgba(0,0,0,0.25)] top-px left-px ',
              // briefcaseClassName,
            )}
          >
            {/* Multicolor splash gradients behind the hand */}
            <defs>
              <radialGradient id="splash" cx="50%" cy="55%" r="65%">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.85" />
                <stop offset="25%" stopColor="#6366f1" stopOpacity="0.7" />
                <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.55" />
                <stop offset="75%" stopColor="#06b6d4" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="splash-warm" cx="60%" cy="70%" r="50%">
                <stop offset="0%" stopColor="#FFD700" stopOpacity="0.6" />
                <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#DAA520" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="splash-pink" cx="30%" cy="35%" r="50%">
                <stop offset="0%" stopColor="#ec4899" stopOpacity="0.5" />
                <stop offset="50%" stopColor="#a855f7" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
              </radialGradient>
              {/* Hand cutout mask — white = visible gradient, black = transparent hole */}
              <mask id="hand-cutout">
                <rect x="-20" y="-20" width="64" height="64" fill="white" />
                {/* Palm */}
                <rect
                  className="rotate-[6deg] scale-x-99 origin-top"
                  x="9.2"
                  y="10.5"
                  width="10.1"
                  height="11.2"
                  rx="4.5"
                  fill="black"
                />
                {/* Thumb */}
                <rect
                  x="2.9"
                  y="12.8"
                  width="2.7"
                  height="8.8"
                  rx="1.3"
                  fill="black"
                  transform="rotate(-50 4.6 14.75)"
                />
                {/* Index */}
                <rect
                  x="7.5"
                  y="4.5"
                  width="2.3"
                  height="10"
                  rx="1.2"
                  fill="black"
                  transform="rotate(-10 8.7 8.5)"
                />
                {/* Middle */}
                <rect
                  x="10.8"
                  y="2.5"
                  width="2.4"
                  height="9"
                  rx="1.2"
                  fill="black"
                />
                {/* Ring */}
                <rect
                  x="14"
                  y="4.5"
                  width="2.3"
                  height="8"
                  rx="1.2"
                  fill="black"
                  transform="rotate(10 15.2 8.5)"
                />
                {/* Pinky */}
                <rect
                  x="16.9"
                  y="7.8"
                  width="1.9"
                  height="6.5"
                  rx="1.1"
                  fill="black"
                  transform="rotate(24 18.1 10.25)"
                />
              </mask>
            </defs>
            {/* Gradient splashes with hand cutout */}
            <g mask="url(#hand-cutout)">
              {/* Main purple-blue-cyan splash */}
              <circle
                cx="12.5"
                cy="13"
                r="13"
                fill="url(#splash)"
                style={{ filter: 'blur(3px)' }}
              />
              {/* Warm gold splash - bottom right */}
              <circle
                cx="15"
                cy="16"
                r="10"
                fill="url(#splash-warm)"
                style={{ filter: 'blur(2.5px)' }}
              />
              {/* Pink-magenta splash - top left */}
              <circle
                cx="8"
                cy="8"
                r="9"
                fill="url(#splash-pink)"
                style={{ filter: 'blur(2.5px)' }}
              />
            </g>
          </svg>
        )}
        <span
          className="absolute -rotate-[6deg] translate-x-[2.2px] translate-y-[18.5px] font-semibold text-[23px]"
          style={{
            color: '#E8C860',
            textShadow: [
              '0 -1px 0 rgba(255,229,102,0.45)',
              '0 -0.5px 0 rgba(255,215,0,0.4)',
              '0 0.5px 0 rgba(184,134,11,0.4)',
              '0 1px 0 rgba(139,101,8,0.35)',
              '0 0 4px rgba(255,215,0,0.5)',
              '0 0 8px rgba(255,215,0,0.25)',
            ].join(', '),
          }}
        >
          $
        </span>
      </div>

      {/* Mr. T gold chain — adjust position with translate classes */}
      <svg
        viewBox="0 0 20 10"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="pointer-events-none absolute scale-81 scale-y-150 z-20 w-[15.5px] -translate-x-[40px] translate-y-[2.8px] -rotate-[4deg]"
      >
        {/* Chain - narrower U shape */}
        <path
          d="M2 0C2 0 3 4 5 6C7 8 9 9 10 9C11 9 13 8 15 6C17 4 18 0 18 0"
          stroke="#DAA520"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        {/* Inner chain highlight */}
        <path
          d="M3 0.5C3 0.5 4 4 6 6C7.5 7.5 9 8 10 8C11 8 12.5 7.5 14 6C16 4 17 0.5 17 0.5"
          stroke="#FFD700"
          strokeWidth="1"
          strokeLinecap="round"
          fill="none"
          opacity="0.6"
        />
      </svg>

      <div className="flex flex-col justify-center text-left">
        <span
          className={cn(
            'mt-0.5 font-semibold leading-tight tracking-tight text-gray-900 dark:text-foreground',
            sizeClasses[size].text,
            textClassName,
          )}
        >
          Gimme Job
        </span>
        <span
          className={cn(
            'truncate text-gray-500 dark:text-muted-foreground/90',
            sizeClasses[size].beta,
            betaClassName,
          )}
        >
          Beta
        </span>
      </div>
    </div>
  );
}
