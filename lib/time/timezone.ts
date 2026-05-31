import { z } from 'zod';

const TimezoneSchema = z.string().regex(/^[A-Za-z]+\/[A-Za-z_]+$/);

export const FALLBACK_TIMEZONE = 'America/New_York';

const VALID_TIMEZONES = Intl.supportedValuesOf('timeZone');

export function validateTimezone(timezone: string): boolean {
  return VALID_TIMEZONES.includes(timezone);
}

export function sanitizeTimezone(timezone: string | null | undefined): string {
  if (!timezone) return FALLBACK_TIMEZONE;
  
  try {
    const parsed = TimezoneSchema.parse(timezone);
    if (validateTimezone(parsed)) {
      return parsed;
    }
  } catch {
    // Invalid timezone format
  }
  
  return FALLBACK_TIMEZONE;
}

/**
 * Client-side timezone detection using Intl API
 * This works in both client and server environments
 */
export function detectTimezoneFromClient(): string {
  try {
    // Use Intl API to get the browser's timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone && validateTimezone(timezone)) {
      return timezone;
    }
  } catch (error) {
    console.error('Error detecting timezone from client:', error);
  }
  
  return FALLBACK_TIMEZONE;
}

function getTimezoneFromRegion(region: string): string | null {
  // Common region to timezone mappings
  const regionTimezones: Record<string, string> = {
    US: 'America/New_York',
    GB: 'Europe/London',
    FR: 'Europe/Paris',
    DE: 'Europe/Berlin',
    JP: 'Asia/Tokyo',
    CN: 'Asia/Shanghai',
    IN: 'Asia/Kolkata',
    AU: 'Australia/Sydney',
    CA: 'America/Toronto',
    BR: 'America/Sao_Paulo',
    MX: 'America/Mexico_City',
    ES: 'Europe/Madrid',
    IT: 'Europe/Rome',
    RU: 'Europe/Moscow',
    KR: 'Asia/Seoul',
    NL: 'Europe/Amsterdam',
    SE: 'Europe/Stockholm',
    NO: 'Europe/Oslo',
    DK: 'Europe/Copenhagen',
    FI: 'Europe/Helsinki',
    PL: 'Europe/Warsaw',
    CH: 'Europe/Zurich',
    AT: 'Europe/Vienna',
    BE: 'Europe/Brussels',
    PT: 'Europe/Lisbon',
    GR: 'Europe/Athens',
    TR: 'Europe/Istanbul',
    IL: 'Asia/Jerusalem',
    AE: 'Asia/Dubai',
    SA: 'Asia/Riyadh',
    EG: 'Africa/Cairo',
    ZA: 'Africa/Johannesburg',
    NG: 'Africa/Lagos',
    KE: 'Africa/Nairobi',
    AR: 'America/Argentina/Buenos_Aires',
    CL: 'America/Santiago',
    CO: 'America/Bogota',
    PE: 'America/Lima',
    VE: 'America/Caracas',
    NZ: 'Pacific/Auckland',
    SG: 'Asia/Singapore',
    HK: 'Asia/Hong_Kong',
    TW: 'Asia/Taipei',
    TH: 'Asia/Bangkok',
    VN: 'Asia/Ho_Chi_Minh',
    PH: 'Asia/Manila',
    ID: 'Asia/Jakarta',
    MY: 'Asia/Kuala_Lumpur',
    PK: 'Asia/Karachi',
    BD: 'Asia/Dhaka',
    UA: 'Europe/Kiev',
    CZ: 'Europe/Prague',
    HU: 'Europe/Budapest',
    RO: 'Europe/Bucharest',
    BG: 'Europe/Sofia',
    HR: 'Europe/Zagreb',
    RS: 'Europe/Belgrade',
    SK: 'Europe/Bratislava',
    SI: 'Europe/Ljubljana',
    IE: 'Europe/Dublin',
  };
  
  return regionTimezones[region] || null;
}

export function getUserTimezone(
  userPreferenceTimezone: string | null | undefined,
  detectedTimezone: string | null
): string {
  // Priority order:
  // 1. User's saved preference (if valid)
  // 2. Detected timezone (if valid)
  // 3. Fallback timezone
  
  if (userPreferenceTimezone && validateTimezone(userPreferenceTimezone)) {
    return userPreferenceTimezone;
  }
  
  if (detectedTimezone && validateTimezone(detectedTimezone)) {
    return detectedTimezone;
  }
  
  return FALLBACK_TIMEZONE;
}

export function formatDateTimeInTimezone(
  date: Date | string,
  timezone: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
    ...options,
  };
  
  return new Intl.DateTimeFormat('en-US', defaultOptions).format(dateObj);
}

export function getTimezoneOffset(timezone: string): number {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    });
    
    const parts = formatter.formatToParts(now);
    const timeZoneName = parts.find(part => part.type === 'timeZoneName')?.value || '';
    
    // Extract offset from timezone name (e.g., "EST" -> -5, "PDT" -> -7)
    // This is a simplified approach; for production, consider using a library
    const offsetMatch = timeZoneName.match(/([+-]\d+)/);
    if (offsetMatch) {
      return parseInt(offsetMatch[1], 10);
    }
    
    // Calculate offset by comparing local time to UTC
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60);
  } catch (error) {
    console.error('Error calculating timezone offset:', error);
    return 0;
  }
}

export function isDSTActive(timezone: string, date: Date = new Date()): boolean {
  try {
    const january = new Date(date.getFullYear(), 0, 1);
    const july = new Date(date.getFullYear(), 6, 1);
    
    const januaryOffset = getTimezoneOffset(timezone);
    const julyOffset = getTimezoneOffset(timezone);
    
    const currentOffset = getTimezoneOffset(timezone);
    
    // In Northern Hemisphere, DST is active in summer (July offset is greater)
    // In Southern Hemisphere, DST is active in winter (January offset is greater)
    const maxOffset = Math.max(januaryOffset, julyOffset);
    
    return currentOffset === maxOffset;
  } catch (error) {
    console.error('Error checking DST status:', error);
    return false;
  }
}

export function getTimezoneAbbreviation(timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    });
    
    const parts = formatter.formatToParts(new Date());
    return parts.find(part => part.type === 'timeZoneName')?.value || timezone;
  } catch (error) {
    console.error('Error getting timezone abbreviation:', error);
    return timezone;
  }
}

export function getTimezonesForCountry(countryCode: string): string[] {
  // This would typically use a timezone database
  // For now, returning the main timezone for each country
  const countryTimezones: Record<string, string[]> = {
    US: [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Phoenix',
      'America/Los_Angeles',
      'America/Anchorage',
      'Pacific/Honolulu',
    ],
    CA: [
      'America/Toronto',
      'America/Vancouver',
      'America/Edmonton',
      'America/Winnipeg',
      'America/Halifax',
      'America/St_Johns',
    ],
    AU: [
      'Australia/Sydney',
      'Australia/Melbourne',
      'Australia/Brisbane',
      'Australia/Perth',
      'Australia/Adelaide',
      'Australia/Darwin',
      'Australia/Hobart',
    ],
    BR: [
      'America/Sao_Paulo',
      'America/Manaus',
      'America/Fortaleza',
      'America/Belem',
      'America/Rio_Branco',
    ],
    RU: [
      'Europe/Moscow',
      'Europe/Kaliningrad',
      'Europe/Samara',
      'Asia/Yekaterinburg',
      'Asia/Novosibirsk',
      'Asia/Krasnoyarsk',
      'Asia/Irkutsk',
      'Asia/Yakutsk',
      'Asia/Vladivostok',
      'Asia/Magadan',
      'Asia/Kamchatka',
    ],
  };
  
  return countryTimezones[countryCode] || [];
}