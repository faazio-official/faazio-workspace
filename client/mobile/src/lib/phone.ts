import {
  AsYouType,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
} from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';

/** ISO 3166-1 alpha-2 code used when the caller does not opt into another country. */
export const DEFAULT_COUNTRY = 'IN';

/** A bare international number with no national formatting assumptions. */
const asCountry = (country: string): CountryCode => country.toUpperCase() as CountryCode;

/**
 * Normalize raw input into E.164 (`+CCXXXXXXXXXX`).
 *
 * A leading `+` always wins — an already-international number is never re-parsed against a
 * default country. Otherwise libphonenumber parses the digits for `country`. When parsing fails
 * we keep the historical `+91` assumption for India and fall back to the selected country's
 * calling code elsewhere, so old call sites behave exactly as before.
 */
export function toE164(digits: string, country: string = DEFAULT_COUNTRY): string {
  const raw = (digits ?? '').trim();
  const clean = raw.replace(/\D/g, '');
  if (!clean) return '';

  const international = raw.startsWith('+');
  try {
    const parsed = parsePhoneNumberFromString(
      international ? `+${clean}` : clean,
      international ? undefined : asCountry(country),
    );
    if (parsed?.isValid()) return parsed.number;
  } catch {
    // fall through to a deterministic fallback
  }

  if (clean.startsWith('91') && clean.length === 12) return `+${clean}`;
  if (asCountry(country) === DEFAULT_COUNTRY) return `+91${clean}`;
  try {
    return `+${getCountryCallingCode(asCountry(country))}${clean}`;
  } catch {
    return `+91${clean}`;
  }
}

/** True when the raw input is a valid number for `country` (or a valid international number). */
export function isValidPhone(digits: string, country: string = DEFAULT_COUNTRY): boolean {
  const raw = (digits ?? '').trim();
  if (!raw) return false;
  try {
    return isValidPhoneNumber(raw, asCountry(country));
  } catch {
    return /^\d{10}$/.test(raw.replace(/\D/g, ''));
  }
}

/** Format as the user types, in national format for the selected country. */
export function formatAsYouType(digits: string, country: string = DEFAULT_COUNTRY): string {
  try {
    return new AsYouType(asCountry(country)).input((digits ?? '').replace(/[^\d+]/g, ''));
  } catch {
    return (digits ?? '').replace(/\D/g, '');
  }
}

/** The national (significant) digits only, for storage or display. */
export function nationalDigits(digits: string, country: string = DEFAULT_COUNTRY): string {
  const raw = (digits ?? '').trim();
  try {
    const parsed = parsePhoneNumberFromString(
      raw.startsWith('+') ? raw : raw.replace(/\D/g, ''),
      raw.startsWith('+') ? undefined : asCountry(country),
    );
    if (parsed?.isValid()) return parsed.nationalNumber;
  } catch {
    // fall through
  }
  return (digits ?? '').replace(/\D/g, '');
}
