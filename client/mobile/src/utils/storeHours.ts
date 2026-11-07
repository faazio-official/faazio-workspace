/**
 * Store open/closed derivation from the free-text `hours` string.
 *
 * The backend stores hours as display text (e.g. `10 AM – 9 PM`, `5 PM – 3 AM`). Until a
 * structured open-hours field exists, parse the common single-range formats locally and return
 * `unknown` for anything else — never guess. An overnight range (`5 PM – 3 AM`) is handled.
 */

export type StoreOpenStatus = 'open' | 'closed' | 'unknown';

interface Range {
  /** Minutes from midnight. */
  open: number;
  /** Minutes from midnight; may be <= open for an overnight range. */
  close: number;
}

function parseTime(token: string): number | null {
  const match = token.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) return null;
  const hour12 = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  if (!Number.isFinite(hour12) || hour12 < 1 || hour12 > 12 || minutes > 59) return null;
  let hour = hour12 % 12;
  if (/PM/i.test(match[3])) hour += 12;
  return hour * 60 + minutes;
}

/** Parse a single `open – close` range; `null` when the text is not a recognised format. */
export function parseOpenHours(hours?: string): Range[] | null {
  if (!hours) return null;
  if (/(open\s*)?24\s*(hours|hrs)/i.test(hours)) return [{ open: 0, close: 24 * 60 }];
  const normalized = hours.replace(/[\u2013\u2014-]/g, '-');
  const parts = normalized.split('-').map((part) => part.trim());
  if (parts.length !== 2) return null;
  const open = parseTime(parts[0]);
  const close = parseTime(parts[1]);
  if (open === null || close === null) return null;
  return [{ open, close }];
}

/**
 * `open` / `closed` when the hours were understood, otherwise `unknown` (render only the text).
 * `now` is injectable so the derivation is testable.
 */
export function getStoreOpenStatus(hours?: string, now: Date = new Date()): StoreOpenStatus {
  const ranges = parseOpenHours(hours);
  if (!ranges) return 'unknown';
  const minutes = now.getHours() * 60 + now.getMinutes();
  for (const range of ranges) {
    const { open, close } = range;
    if (open === 0 && close === 24 * 60) return 'open';
    if (open <= close) {
      if (minutes >= open && minutes < close) return 'open';
    } else if (minutes >= open || minutes < close) {
      // Overnight, e.g. 5 PM – 3 AM.
      return 'open';
    }
  }
  return 'closed';
}