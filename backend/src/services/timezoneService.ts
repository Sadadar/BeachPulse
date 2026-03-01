import { DateTime } from 'luxon';

// Maps tournament city names (lowercase) to IANA timezone identifiers.
// Entries exist both as "city,country_code" (preferred) and bare "city" (fallback for unambiguous cities).
const CITY_TIMEZONE_MAP: Record<string, string> = {
  // Asia
  'doha,qa': 'Asia/Qatar',
  'doha': 'Asia/Qatar',
  'dubai,ae': 'Asia/Dubai',
  'dubai': 'Asia/Dubai',
  'abu dhabi,ae': 'Asia/Dubai',
  'abu dhabi': 'Asia/Dubai',
  'muscat,om': 'Asia/Muscat',
  'muscat': 'Asia/Muscat',
  'bali,id': 'Asia/Makassar',
  'bali': 'Asia/Makassar',
  'jakarta,id': 'Asia/Jakarta',
  'jakarta': 'Asia/Jakarta',
  'bangkok,th': 'Asia/Bangkok',
  'bangkok': 'Asia/Bangkok',
  'phuket,th': 'Asia/Bangkok',
  'phuket': 'Asia/Bangkok',
  'tokyo,jp': 'Asia/Tokyo',
  'tokyo': 'Asia/Tokyo',
  'osaka,jp': 'Asia/Tokyo',
  'osaka': 'Asia/Tokyo',
  'seoul,kr': 'Asia/Seoul',
  'seoul': 'Asia/Seoul',
  'beijing,cn': 'Asia/Shanghai',
  'beijing': 'Asia/Shanghai',
  'shanghai,cn': 'Asia/Shanghai',
  'shanghai': 'Asia/Shanghai',
  'shenzhen,cn': 'Asia/Shanghai',
  'shenzhen': 'Asia/Shanghai',
  'singapore,sg': 'Asia/Singapore',
  'singapore': 'Asia/Singapore',
  'kuala lumpur,my': 'Asia/Kuala_Lumpur',
  'kuala lumpur': 'Asia/Kuala_Lumpur',
  'kathmandu,np': 'Asia/Kathmandu',
  'kathmandu': 'Asia/Kathmandu',
  'new delhi,in': 'Asia/Kolkata',
  'new delhi': 'Asia/Kolkata',
  'mumbai,in': 'Asia/Kolkata',
  'mumbai': 'Asia/Kolkata',
  'hyderabad,in': 'Asia/Kolkata',
  'hyderabad': 'Asia/Kolkata',
  'chennai,in': 'Asia/Kolkata',
  'chennai': 'Asia/Kolkata',
  // Europe
  'paris,fr': 'Europe/Paris',
  'paris': 'Europe/Paris',
  'rome,it': 'Europe/Rome',
  'rome': 'Europe/Rome',
  'milan,it': 'Europe/Rome',
  'milan': 'Europe/Rome',
  'madrid,es': 'Europe/Madrid',
  'madrid': 'Europe/Madrid',
  'barcelona,es': 'Europe/Madrid',
  'barcelona': 'Europe/Madrid',
  'berlin,de': 'Europe/Berlin',
  'berlin': 'Europe/Berlin',
  'munich,de': 'Europe/Berlin',
  'munich': 'Europe/Berlin',
  'hamburg,de': 'Europe/Berlin',
  'hamburg': 'Europe/Berlin',
  'vienna,at': 'Europe/Vienna',
  'vienna': 'Europe/Vienna',
  'zurich,ch': 'Europe/Zurich',
  'zurich': 'Europe/Zurich',
  'geneva,ch': 'Europe/Zurich',
  'geneva': 'Europe/Zurich',
  'amsterdam,nl': 'Europe/Amsterdam',
  'amsterdam': 'Europe/Amsterdam',
  'brussels,be': 'Europe/Brussels',
  'brussels': 'Europe/Brussels',
  'stockholm,se': 'Europe/Stockholm',
  'stockholm': 'Europe/Stockholm',
  'oslo,no': 'Europe/Oslo',
  'oslo': 'Europe/Oslo',
  'copenhagen,dk': 'Europe/Copenhagen',
  'copenhagen': 'Europe/Copenhagen',
  'helsinki,fi': 'Europe/Helsinki',
  'helsinki': 'Europe/Helsinki',
  'warsaw,pl': 'Europe/Warsaw',
  'warsaw': 'Europe/Warsaw',
  'prague,cz': 'Europe/Prague',
  'prague': 'Europe/Prague',
  'budapest,hu': 'Europe/Budapest',
  'budapest': 'Europe/Budapest',
  'athens,gr': 'Europe/Athens',
  'athens': 'Europe/Athens',
  'istanbul,tr': 'Europe/Istanbul',
  'istanbul': 'Europe/Istanbul',
  'lisbon,pt': 'Europe/Lisbon',
  'lisbon': 'Europe/Lisbon',
  'london,gb': 'Europe/London',
  'london': 'Europe/London',
  'edinburgh,gb': 'Europe/London',
  'edinburgh': 'Europe/London',
  'moscow,ru': 'Europe/Moscow',
  'moscow': 'Europe/Moscow',
  'sochi,ru': 'Europe/Moscow',
  'sochi': 'Europe/Moscow',
  // Americas
  'new york,us': 'America/New_York',
  'new york': 'America/New_York',
  'chicago,us': 'America/Chicago',
  'chicago': 'America/Chicago',
  'los angeles,us': 'America/Los_Angeles',
  'los angeles': 'America/Los_Angeles',
  'las vegas,us': 'America/Los_Angeles',
  'las vegas': 'America/Los_Angeles',
  'san francisco,us': 'America/Los_Angeles',
  'san francisco': 'America/Los_Angeles',
  'miami,us': 'America/New_York',
  'miami': 'America/New_York',
  'toronto,ca': 'America/Toronto',
  'toronto': 'America/Toronto',
  'montreal,ca': 'America/Toronto',
  'montreal': 'America/Toronto',
  'vancouver,ca': 'America/Vancouver',
  'vancouver': 'America/Vancouver',
  'mexico city,mx': 'America/Mexico_City',
  'mexico city': 'America/Mexico_City',
  'sao paulo,br': 'America/Sao_Paulo',
  'sao paulo': 'America/Sao_Paulo',
  'rio de janeiro,br': 'America/Sao_Paulo',
  'rio de janeiro': 'America/Sao_Paulo',
  'buenos aires,ar': 'America/Argentina/Buenos_Aires',
  'buenos aires': 'America/Argentina/Buenos_Aires',
  'santiago,cl': 'America/Santiago',
  'santiago': 'America/Santiago',
  'bogota,co': 'America/Bogota',
  'bogota': 'America/Bogota',
  'lima,pe': 'America/Lima',
  'lima': 'America/Lima',
  // Oceania
  'sydney,au': 'Australia/Sydney',
  'sydney': 'Australia/Sydney',
  'melbourne,au': 'Australia/Melbourne',
  'melbourne': 'Australia/Melbourne',
  'brisbane,au': 'Australia/Brisbane',
  'brisbane': 'Australia/Brisbane',
  'perth,au': 'Australia/Perth',
  'perth': 'Australia/Perth',
  'auckland,nz': 'Pacific/Auckland',
  'auckland': 'Pacific/Auckland',
  // Africa
  'cairo,eg': 'Africa/Cairo',
  'cairo': 'Africa/Cairo',
  'johannesburg,za': 'Africa/Johannesburg',
  'johannesburg': 'Africa/Johannesburg',
  'nairobi,ke': 'Africa/Nairobi',
  'nairobi': 'Africa/Nairobi',
  'casablanca,ma': 'Africa/Casablanca',
  'casablanca': 'Africa/Casablanca',
};

export interface ParsedDateTime {
  utc: string;           // ISO8601 UTC
  localEvent: string;    // ISO8601 with original offset
  timezone: string;      // IANA timezone used
}

/**
 * Look up IANA timezone for a city/country combination.
 * Falls back to 'UTC' with a warning if city is unknown.
 */
export function resolveTimezone(city: string, countryCode?: string): string {
  const cityLower = city.toLowerCase().trim();
  const key = countryCode ? `${cityLower},${countryCode.toLowerCase()}` : cityLower;

  if (CITY_TIMEZONE_MAP[key]) return CITY_TIMEZONE_MAP[key];
  if (CITY_TIMEZONE_MAP[cityLower]) return CITY_TIMEZONE_MAP[cityLower];

  console.warn(`[timezoneService] Unknown city timezone: "${city}" (${countryCode ?? 'unknown country'}). Defaulting to UTC.`);
  return 'UTC';
}

/**
 * Convert a local datetime string to UTC.
 *
 * @param localDateStr  Date/time as published (e.g. "2025-06-15T18:00:00" or "June 15 2025 6:00 PM")
 * @param city          Tournament city
 * @param countryCode   ISO 3166-1 alpha-2 country code (optional, improves accuracy)
 * @returns             ParsedDateTime with utc, localEvent ISO strings, and timezone used
 */
export function toUTC(localDateStr: string, city: string, countryCode?: string): ParsedDateTime {
  const timezone = resolveTimezone(city, countryCode);

  // Try parsing as ISO first, then common formats
  let dt = DateTime.fromISO(localDateStr, { zone: timezone });
  if (!dt.isValid) {
    dt = DateTime.fromFormat(localDateStr, "MMMM d yyyy h:mm a", { zone: timezone });
  }
  if (!dt.isValid) {
    dt = DateTime.fromFormat(localDateStr, "M/d/yyyy HH:mm", { zone: timezone });
  }
  if (!dt.isValid) {
    console.warn(`[timezoneService] Could not parse date string: "${localDateStr}". Using current time.`);
    dt = DateTime.now().setZone(timezone);
  }

  return {
    utc: dt.toUTC().toISO()!,
    localEvent: dt.toISO()!,
    timezone,
  };
}

/**
 * Check whether a UTC ISO timestamp falls within the "current" active match window
 * (within last 3 hours, for use in live detection).
 */
export function isLikelyLive(scheduledAtUtc: string): boolean {
  const scheduled = DateTime.fromISO(scheduledAtUtc, { zone: 'UTC' });
  const now = DateTime.now().toUTC();
  const diffHours = now.diff(scheduled, 'hours').hours;
  return diffHours >= 0 && diffHours < 3;
}

/**
 * Convert a UTC ISO string to a user's timezone for display (e.g. push notification copy).
 * Defaults to America/Los_Angeles (PST/PDT) — the app's home timezone.
 * On iOS, pass TimeZone.current.identifier from the device instead.
 */
export function fromUTC(utcIso: string, userTimezone = 'America/Los_Angeles'): string {
  return DateTime.fromISO(utcIso, { zone: 'UTC' })
    .setZone(userTimezone)
    .toLocaleString(DateTime.DATETIME_SHORT);
}

/** @deprecated Use fromUTC() */
export const formatForDisplay = fromUTC;
