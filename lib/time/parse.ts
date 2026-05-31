import { sub } from 'date-fns';

/**
 * Converts a relative time string like "5 days ago" or "hace 5 días" into a Date object.
 * Supports English and Spanish formats.
 * @param relativeTime - The relative time string (e.g., "5 days ago", "hace 5 días").
 * @returns A Date object representing the calculated time.
 */
export function parseRelativeTimeToDate(relativeTime: string): Date | null {
  // English format: "5 days ago"
  const englishRegex =
    /(\d+)\s*(seconds?|minutes?|hours?|days?|weeks?|months?|years?)\s*ago/i;

  // Spanish format: "hace 5 días"
  const spanishRegex =
    /hace\s+(\d+)\s*(segundos?|minutos?|horas?|días?|dia|semanas?|meses?|años?)/i;

  let match = relativeTime.match(englishRegex);
  let isSpanish = false;

  if (!match) {
    match = relativeTime.match(spanishRegex);
    isSpanish = true;
  }

  if (!match) {
    console.error(`Invalid relative time format: ${relativeTime}`);
    return null;
  }

  const value = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  // Normalize Spanish units to English equivalents
  const normalizedUnit = isSpanish ? normalizeSpanishUnit(unit) : unit;

  switch (normalizedUnit) {
    case 'second':
    case 'seconds':
      return sub(new Date(), { seconds: value });
    case 'minute':
    case 'minutes':
      return sub(new Date(), { minutes: value });
    case 'hour':
    case 'hours':
      return sub(new Date(), { hours: value });
    case 'day':
    case 'days':
      return sub(new Date(), { days: value });
    case 'week':
    case 'weeks':
      return sub(new Date(), { weeks: value });
    case 'month':
    case 'months':
      return sub(new Date(), { months: value });
    case 'year':
    case 'years':
      return sub(new Date(), { years: value });
    default:
      console.error(`Unhandled time unit: ${normalizedUnit} (original: ${unit})`);
      return null;
  }
}

/**
 * Normalizes Spanish time units to English equivalents
 */
function normalizeSpanishUnit(unit: string): string {
  const unitMap: Record<string, string> = {
    'segundo': 'second',
    'segundos': 'seconds',
    'minuto': 'minute',
    'minutos': 'minutes',
    'hora': 'hour',
    'horas': 'hours',
    'día': 'day',
    'días': 'days',
    'dia': 'day',
    'semana': 'week',
    'semanas': 'weeks',
    'mes': 'month',
    'meses': 'months',
    'año': 'year',
    'años': 'years',
  };

  return unitMap[unit] || unit;
}
