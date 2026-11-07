import {
  AsYouType,
  getCountryCallingCode,
  isSupportedCountry,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
} from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';

/** ISO 3166-1 alpha-2 code used when the caller does not opt into another country. */
export const DEFAULT_COUNTRY = 'IN';

/**
 * Resolve a caller-supplied country into a libphonenumber `CountryCode`.
 * Unsupported or missing values fall back to `DEFAULT_COUNTRY` so a bad caller can never make a
 * number silently resolve against a bogus region.
 */
const asCountry = (country: string | undefined | null): CountryCode => {
  const code = (country ?? '').trim().toUpperCase();
  return isSupportedCountry(code) ? code : (DEFAULT_COUNTRY as CountryCode);
};

const digitsOnly = (value: string): string => (value ?? '').replace(/\D/g, '');

/**
 * Normalize raw input into E.164 (`+CCXXXXXXXXXX`).
 *
 * An explicit leading `+` always wins: an international number is never re-homed into the selected
 * country. If it cannot be validated we preserve the international form rather than mis-dial a
 * different country (an OTP must never go to a silently rewritten number).
 *
 * For national input, libphonenumber parses against `country`. When parsing fails we fall back to
 * the selected country's calling code (keeping the historical `+91` default for existing callers).
 */
export function toE164(digits: string, country: string = DEFAULT_COUNTRY): string {
  const raw = (digits ?? '').trim();
  const clean = digitsOnly(raw);
  if (!clean) return '';

  const resolved = asCountry(country);

  if (raw.startsWith('+')) {
    try {
      const parsed = parsePhoneNumberFromString(`+${clean}`);
      if (parsed?.isValid()) return parsed.number;
    } catch {
      // fall through
    }
    // Never reinterpret an explicitly international number against the selected country.
    return `+${clean}`;
  }

  try {
    const parsed = parsePhoneNumberFromString(clean, resolved);
    if (parsed?.isValid()) return parsed.number;
  } catch {
    // fall through to a deterministic fallback
  }

  // A national value that already carries its calling code without a `+`
  // (e.g. `919876543210` for IN) is accepted as-is.
  try {
    const dial = getCountryCallingCode(resolved);
    if (clean.startsWith(dial) && isValidPhoneNumber(clean.slice(dial.length), resolved)) {
      return `+${clean}`;
    }
    return `+${dial}${clean}`;
  } catch {
    return `+91${clean}`;
  }
}

/**
 * True when the raw input is a valid number for `country` (or a valid international number).
 * Delegates to `toE164` so validation and normalization can never disagree.
 */
export function isValidPhone(digits: string, country: string = DEFAULT_COUNTRY): boolean {
  try {
    const normalized = toE164(digits, country);
    return normalized ? isValidPhoneNumber(normalized) : false;
  } catch {
    return false;
  }
}

/** Format as the user types, in national format for the selected country. */
export function formatAsYouType(digits: string, country: string = DEFAULT_COUNTRY): string {
  try {
    return new AsYouType(asCountry(country)).input((digits ?? '').replace(/[^\d+]/g, ''));
  } catch {
    return digitsOnly(digits);
  }
}

/** The national (significant) digits only, for storage or display. */
export function nationalDigits(digits: string, country: string = DEFAULT_COUNTRY): string {
  const raw = (digits ?? '').trim();
  try {
    const parsed = parsePhoneNumberFromString(
      raw.startsWith('+') ? raw : digitsOnly(raw),
      raw.startsWith('+') ? undefined : asCountry(country),
    );
    if (parsed?.isValid()) return parsed.nationalNumber;
  } catch {
    // fall through
  }
  return digitsOnly(digits);
}
