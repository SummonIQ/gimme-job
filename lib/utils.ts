import {twMerge} from 'tailwind-merge';
/**
 * Format a date to a human-readable string
 */
export function formatDate(date: Date | string): string {
  if (!date) return 'N/A';

  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Truncate a string to a specified length with ellipsis
 */
export function truncateString(str: string, maxLength: number): string {
  if (!str || str.length <= maxLength) return str;
  return `${str.substring(0, maxLength)}...`;
}

/**
 * Generate a random ID
 */
export function generateId(length: number = 6): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Format a number as a percentage
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  if (typeof value !== 'number' || isNaN(value)) return '0%';
  return `${value.toFixed(decimals)}%`;
}

/**
 * Merge class names
 */
export function cn(
  ...classes: (string | undefined | null | boolean)[]
): string {
  return twMerge(classes)
}

/**
 * Normalize location labels for display by removing trailing country suffixes.
 * Example: "Portland, Oregon, United States" -> "Portland, Oregon"
 */
export function formatLocationLabel(location?: string | null): string {
  if (!location) return '';

  const trimmed = location.trim();
  if (!trimmed) return '';

  return trimmed
    .replace(/,?\s*(united states of america|united states|usa|us)\s*$/i, '')
    .replace(/,\s*$/, '')
    .trim();
}
