/**
 * Money and number formatting for the Delivery Partner app.
 *
 * One helper for every ₹ figure so the same amount never renders two ways
 * (`docs/UI_DESIGN_SYSTEM.md` §3 Pass 5 — numbers use one format across the
 * screen). Rule: headline amounts (offer payout, totals, KPI figures) use
 * `0` decimals; itemised ledger lines (fee / extra-km / tip splits) use `2`.
 * Never mix the two within a single block.
 */

/** Paisa → `₹1,234` (0 decimals) or `₹1,234.50` (2 decimals). */
export function formatRupees(paisa: number, decimals: 0 | 2 = 0): string {
  const value = Number.isFinite(paisa) ? paisa / 100 : 0;
  return `₹${value.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/** Headline figure (offer payout, totals, KPI sums): whole rupees. */
export function headlineRupees(paisa: number): string {
  return formatRupees(paisa, 0);
}

/** Itemised ledger line (fee / extra-km / surge split): two decimals. */
export function lineRupees(paisa: number): string {
  return formatRupees(paisa, 2);
}

/** Counts, hours, distances — grouped Indian-style with a controlled precision. */
export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Worked time for the shift grid: `3h 24m`, or `42m` under an hour. Invalid → `0m`. */
export function formatOnlineTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}
