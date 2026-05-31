import React, { useState } from 'react';

import { cn } from '@/lib/utils';

interface CheckboxProps {
  ariaLabel?: string;
  borderColor?: string;
  checked?: boolean;
  checkedColor?: string;
  className?: string;
  defaultChecked?: boolean;
  focusRingColor?: string;
  indeterminate?: boolean;
  label?: string;
  onChange?: (checked: boolean) => void;
  onCheckedChange?: (checked: boolean) => void;
  onClick?: (e: React.MouseEvent) => void;
  size?: string;
}

export const Checkbox = ({
  defaultChecked = false,
  checked: controlledChecked,
  onChange,
  onCheckedChange,
  label,
  className = '',
  onClick,
  size,
  checkedColor = 'bg-primary',
  borderColor = 'border-gray-300 dark:border-neutral-600',
  focusRingColor = 'ring-primary dark:ring-primary/80',
  indeterminate = false,
  ariaLabel,
}: CheckboxProps) => {
  const [internalChecked, setInternalChecked] = useState(defaultChecked);
  const [isFocused, setIsFocused] = useState(false);

  const checked =
    controlledChecked !== undefined ? controlledChecked : internalChecked;

  const handleChange = () => {
    const newChecked = !checked;
    if (controlledChecked === undefined) {
      setInternalChecked(newChecked);
    }
    onChange?.(newChecked);
    onCheckedChange?.(newChecked);
  };

  const handleClick = (e: React.MouseEvent) => {
    // Prevent double-firing from label clicking hidden input
    e.preventDefault();
    e.stopPropagation();

    if (onClick) {
      onClick(e);
    }
    handleChange();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleChange();
    }
  };

  return (
    <label
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={ariaLabel}
      className={cn(
        'group/checkbox relative inline-flex items-center gap-2 cursor-pointer select-none',
        'hover:[&>svg]:scale-100 hover:[&>svg]:opacity-100',
        className,
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="checkbox"
      tabIndex={0}
    >
      <input
        aria-checked={indeterminate ? 'mixed' : checked}
        aria-label={ariaLabel}
        checked={checked}
        className="hidden"
        onBlur={() => setIsFocused(false)}
        onChange={() => {}}
        onFocus={() => setIsFocused(true)}
        readOnly
        type="checkbox"
      />
      <div
        className={cn(
          'relative rounded-sm transition-all duration-200 ease-out',
          size || 'w-5 h-5',
          'group-hover/checkbox:scale-110',
          'group-active/checkbox:scale-95',
        )}
      >
        <div
          className={cn(
            'absolute inset-0 rounded-sm border-2 transition-all duration-200 ease-in-out',
            checked || indeterminate
              ? `${checkedColor} border-primary shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]`
              : `bg-white dark:bg-background ${borderColor} shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.25)]`,
            !checked &&
              'group-hover/checkbox:shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)] group-hover/checkbox:border-[#d1d5db] dark:group-hover/checkbox:border-white/20',
            isFocused && 'ring-2 ring-offset-2',
            isFocused && focusRingColor,
          )}
        />
        {indeterminate ? (
          <div
            className={cn(
              'absolute inset-0 flex items-center justify-center',
              'transition-all duration-300 ease-out',
              checked || indeterminate
                ? 'opacity-100 scale-100'
                : 'opacity-0 scale-50',
            )}
          >
            <div className="w-3/5 h-0.5 bg-white rounded" />
          </div>
        ) : (
          <svg
            className={cn(
              'absolute inset-0 m-auto w-4/5 h-4/5 text-white transition-all duration-300 ease-out',
              checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
            )}
            fill="none"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <title>Checkmark</title>
            <path
              d="M4 12L10 18L20 6"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
              style={{
                strokeDasharray: 40,
                strokeDashoffset: checked ? 0 : 40,
                transition: checked
                  ? 'stroke-dashoffset 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0.1s'
                  : 'stroke-dashoffset 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          </svg>
        )}
      </div>
      {label && (
        <span className="text-sm text-foreground font-medium">{label}</span>
      )}
    </label>
  );
};

export default Checkbox;
