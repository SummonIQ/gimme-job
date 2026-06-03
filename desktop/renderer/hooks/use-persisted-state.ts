import { useEffect, useRef, useState } from 'react';

/**
 * Drop-in replacement for useState that mirrors the value to localStorage so
 * it survives app restarts. The initial value comes from storage if present
 * and parses as the expected type; otherwise it falls back to `defaultValue`.
 *
 * Storage failures (private mode, quota, etc.) degrade silently — the hook
 * still functions as a normal useState in that case.
 */
export function usePersistedState<T>(
  storageKey: string,
  defaultValue: T,
  options: {
    readonly parse?: (raw: string) => T | undefined;
    readonly serialize?: (value: T) => string;
  } = {},
): [T, (next: T | ((prev: T) => T)) => void] {
  const parse = options.parse ?? defaultJsonParse<T>;
  const serialize = options.serialize ?? defaultJsonSerialize<T>;
  const isHydrated = useRef(false);

  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw === null) return defaultValue;
      const parsed = parse(raw);
      return parsed === undefined ? defaultValue : parsed;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    // Skip the first effect run — the value was just loaded from storage, so
    // writing it back is redundant and would trip 'storage' listeners
    // pointlessly. After that, every change persists.
    if (!isHydrated.current) {
      isHydrated.current = true;
      return;
    }
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey, serialize(value));
    } catch {
      // Storage may be unavailable — ignore and continue working in-memory.
    }
  }, [serialize, storageKey, value]);

  return [value, setValue];
}

function defaultJsonParse<T>(raw: string): T | undefined {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function defaultJsonSerialize<T>(value: T): string {
  return JSON.stringify(value);
}
