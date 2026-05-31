'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';

interface AnimatedSortIconProps {
  sortDirection: 'asc' | 'desc';
  onToggle?: () => void;
  className?: string;
  size?: number;
  inactive?: boolean;
}

export function AnimatedSortIcon({
  sortDirection,
  onToggle,
  className,
  size = 18,
  inactive = false,
}: AnimatedSortIconProps) {
  const [isHovered, setIsHovered] = useState(false);

  const icon = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="overflow-visible"
    >
      {/* Up Arrow */}
      <g
        className="origin-center transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        style={{
          transform:
            sortDirection === 'asc'
              ? `translateX(${isHovered ? -1 : 0}px) translateY(${isHovered ? -2 : 0}px)`
              : `translateX(${isHovered ? 1 : 0}px) translateY(${isHovered ? 2 : 0}px) rotate(180deg)`,
          transformOrigin: '8px 12px',
        }}
      >
        <path
          d="M8 4L4 9H6.5V20H9.5V9H12L8 4Z"
          fill="currentColor"
          className={cn(
            'transition-opacity duration-300',
            inactive
              ? 'opacity-40'
              : sortDirection === 'asc'
                ? 'opacity-100'
                : 'opacity-40',
          )}
        />
      </g>

      {/* Down Arrow */}
      <g
        className="origin-center transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        style={{
          transform:
            sortDirection === 'desc'
              ? `translateX(${isHovered ? 1 : 0}px) translateY(${isHovered ? 2 : 0}px)`
              : `translateX(${isHovered ? -1 : 0}px) translateY(${isHovered ? -2 : 0}px) rotate(-180deg)`,
          transformOrigin: '16px 12px',
        }}
      >
        <path
          d="M16 20L20 15H17.5V4H14.5V15H12L16 20Z"
          fill="currentColor"
          className={cn(
            'transition-opacity duration-300',
            inactive
              ? 'opacity-40'
              : sortDirection === 'desc'
                ? 'opacity-100'
                : 'opacity-40',
          )}
        />
      </g>
    </svg>
  );

  const wrapperClassName = cn(
    'relative inline-flex items-center justify-center rounded transition-colors',
    className,
  );

  if (onToggle) {
    return (
      <button
        type="button"
        onClick={onToggle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={wrapperClassName}
        aria-label={`Sort ${sortDirection === 'asc' ? 'ascending' : 'descending'}`}
      >
        {icon}
      </button>
    );
  }

  return (
    <span
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={wrapperClassName}
      aria-hidden="true"
    >
      {icon}
    </span>
  );
}
