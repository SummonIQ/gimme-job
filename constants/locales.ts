export const COUNTRIES = {
  US: 'United States',
} as const;

export const US_STATES = {
  AK: 'Alaska',
  AL: 'Alabama',
  AR: 'Arkansas',
  AZ: 'Arizona',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  IA: 'Iowa',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  MA: 'Massachusetts',
  MD: 'Maryland',
  ME: 'Maine',
  MI: 'Michigan',
  MN: 'Minnesota',
  MO: 'Missouri',
  MS: 'Mississippi',
  MT: 'Montana',
  NC: 'North Carolina',
  ND: 'North Dakota',
  NE: 'Nebraska',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NV: 'Nevada',
  NY: 'New York',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VA: 'Virginia',
  VT: 'Vermont',
  WA: 'Washington',
  WI: 'Wisconsin',
  WV: 'West Virginia',
  WY: 'Wyoming',
} as const;

type CountryCode = keyof typeof COUNTRIES;
type StateCode = keyof typeof US_STATES;

export function normalizeCountryCode(
  value: string | null | undefined,
): CountryCode | '' {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'us' || normalized === 'usa' || normalized === 'united states') {
    return 'US';
  }
  return '';
}

export function resolveCountryLabel(
  value: string | null | undefined,
): string | null {
  const code = normalizeCountryCode(value);
  return code ? COUNTRIES[code] : null;
}

export function normalizeUsStateCode(
  value: string | null | undefined,
): StateCode | '' {
  const trimmed = value?.trim();
  if (!trimmed) return '';

  const normalized = trimmed.toUpperCase();
  if (normalized in US_STATES) {
    return normalized as StateCode;
  }

  const matchingEntry = Object.entries(US_STATES).find(
    ([, label]) => label.toLowerCase() === trimmed.toLowerCase(),
  );

  return (matchingEntry?.[0] as StateCode | undefined) ?? '';
}

export function resolveUsStateLabel(
  value: string | null | undefined,
): string | null {
  const code = normalizeUsStateCode(value);
  return code ? US_STATES[code] : null;
}
