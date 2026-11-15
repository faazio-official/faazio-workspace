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

/** Counts, hours, distances — grouped Indian-style with a controlled precision. */
export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
