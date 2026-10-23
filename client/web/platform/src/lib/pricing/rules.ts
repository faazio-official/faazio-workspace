import type { Sector, SectorCap } from "@/data/types";

export function discountPercent(mrpPaisa: number, sellingPricePaisa: number): number {
  if (mrpPaisa <= 0) return 0;
  return Math.round(((mrpPaisa - sellingPricePaisa) / mrpPaisa) * 100);
}

/** Money is integer paisa on every wire (D1) — reject any fractional input. */
export function isIntPaisa(value: number): boolean {
  return Number.isInteger(value);
}

/** Minimum floor: a seller cannot price below 25% of MRP (commission no longer applies). */
export function floorPaisa(mrpPaisa: number): number {
  return Math.round(mrpPaisa * 0.25);
}

export interface PriceValidation {
  ok: boolean;
  message?: string;
  discountPercent: number;
}

export function validatePrice(mrpPaisa: number, sellingPricePaisa: number): PriceValidation {
  const pct = discountPercent(mrpPaisa, sellingPricePaisa);
  if (!isIntPaisa(mrpPaisa) || !isIntPaisa(sellingPricePaisa)) {
    return { ok: false, message: "Prices must be whole paisa (integers).", discountPercent: pct };
  }
  if (sellingPricePaisa <= 0) {
    return { ok: false, message: "Selling price is required.", discountPercent: pct };
  }
  if (sellingPricePaisa > mrpPaisa) {
    return { ok: false, message: "Selling price cannot exceed MRP.", discountPercent: pct };
  }
  const floor = floorPaisa(mrpPaisa);
  if (sellingPricePaisa < floor) {
    return {
      ok: false,
      message: `Below the minimum floor for this MRP.`,
      discountPercent: pct,
    };
  }
  return { ok: true, discountPercent: pct };
}

/** State override wins over the global cap for that sector. */
export function capFor(caps: SectorCap[], sector: Sector, stateCode?: string): number {
  const override = stateCode
    ? caps.find((c) => c.sector === sector && c.stateCode === stateCode)
    : undefined;
  const global = caps.find((c) => c.sector === sector && !c.stateCode);
  return override?.maxDiscountPercent ?? global?.maxDiscountPercent ?? 0;
}

export function validateOptin(
  caps: SectorCap[],
  sector: Sector,
  requestedPercent: number,
  stateCode?: string,
): PriceValidation {
  const cap = capFor(caps, sector, stateCode);
  if (requestedPercent > cap) {
    return {
      ok: false,
      message: `${sector} festival cap is ${cap}% for this campaign scope.`,
      discountPercent: requestedPercent,
    };
  }
  if (requestedPercent <= 0) {
    return { ok: false, message: "Enter a festival discount above 0%.", discountPercent: 0 };
  }
  return { ok: true, discountPercent: requestedPercent };
}
