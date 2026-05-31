export function formatRelativeTime(date: Date): string {
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  // Calculate the difference in seconds
  const now = new Date().getTime(); // Current time in milliseconds
  const targetTime = date.getTime(); // Target date in milliseconds
  const diffInSeconds = Math.round((targetTime - now) / 1000); // Positive for future, negative for past

  const units = [
    { divisor: 31536000, unit: 'year' }, // 60 * 60 * 24 * 365
    { divisor: 2592000, unit: 'month' }, // 60 * 60 * 24 * 30
    { divisor: 604800, unit: 'week' }, // 60 * 60 * 24 * 7
    { divisor: 86400, unit: 'day' }, // 60 * 60 * 24
    { divisor: 3600, unit: 'hour' }, // 60 * 60
    { divisor: 60, unit: 'minute' },
    { divisor: 1, unit: 'second' },
  ];

  for (const { unit, divisor } of units) {
    if (Math.abs(diffInSeconds) >= divisor) {
      const value = Math.floor(diffInSeconds / divisor);
      return formatter.format(value, unit as Intl.RelativeTimeFormatUnit);
    }
  }

  return 'just now';
}
