'use client';

import { SearchIcon, X } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/css/index';

import {
  clearButtonVariants,
  inputVariants,
  searchIconVariants,
  searchPaddingVariants,
  type InputSize,
} from './input';

type SearchInputProps = Omit<React.ComponentProps<'input'>, 'size' | 'type'> & {
  size?: InputSize;
};

export function SearchInput({
  className,
  onChange,
  size = 'default',
  value,
  ...props
}: SearchInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [hasValue, setHasValue] = React.useState(() => {
    if (value !== undefined) {
      return Boolean(value);
    }
    if (props.defaultValue !== undefined) {
      return Boolean(props.defaultValue);
    }
    return false;
  });

  React.useEffect(() => {
    if (value !== undefined) {
      setHasValue(Boolean(value));
    }
  }, [value]);

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setHasValue(Boolean(event.target.value));
      onChange?.(event);
    },
    [onChange],
  );

  const handleClear = React.useCallback(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    nativeInputValueSetter?.call(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.focus();
    setHasValue(false);
  }, []);

  return (
    <div className="relative w-full">
      <SearchIcon
        className={cn(
          searchIconVariants({ size }),
          hasValue ? 'text-foreground' : 'text-muted-foreground/55',
        )}
      />
      <input
        className={cn(
          inputVariants({ size }),
          'w-full',
          searchPaddingVariants({ size }),
          className,
        )}
        data-slot="input"
        onChange={handleChange}
        ref={inputRef}
        type="search"
        value={value}
        {...props}
      />
      {hasValue ? (
        <button
          aria-label="Clear search"
          className={clearButtonVariants({ size })}
          onClick={handleClear}
          tabIndex={-1}
          type="button"
        >
          <X />
        </button>
      ) : null}
    </div>
  );
}
