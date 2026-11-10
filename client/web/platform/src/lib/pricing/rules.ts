import type { Sector, SectorCap } from "@/data/types";

export interface OptinValidation {
  ok: boolean;
  message?: string;
}

/** Hard upper bound the gateway accepts for a festival opt-in (`upsertOptin` rejects > 90). */
export const MAX_FESTIVAL_DISCOUNT_PERCENT = 90;

export interface OptinCap {
  percent: number;
  /** False when neither a state override nor a global row exists — the gateway treats a missing
   *  cap as uncapped, so validation must not silently read it as a 0% cap. */
  configured: boolean;
}

/** State override wins over the global cap for that sector (display/add-summary helper). */
export function capFor(caps: SectorCap[], sector: Sector, stateCode?: string): number {
  const override = stateCode
    ? caps.find((c) => c.sector === sector && c.stateCode === stateCode)
    : undefined;
  const global = caps.find((c) => c.sector === sector && !c.stateCode);
  return override?.maxDiscountPercent ?? global?.maxDiscountPercent ?? 0;
}

/** Cap used for seller opt-in validation. A missing row means the gateway's 0–90 write bound is
 *  the only limit (see promo.ActiveDiscounts: `coalesce(cap.max_discount, o.discount)`). */
export function optinCap(caps: SectorCap[], sector: Sector, stateCode?: string): OptinCap {
  const override = stateCode
    ? caps.find((c) => c.sector === sector && c.stateCode === stateCode)
    : undefined;
  const global = caps.find((c) => c.sector === sector && !c.stateCode);
  const row = override ?? global;
  return row
    ? { percent: row.maxDiscountPercent, configured: true }
    : { percent: MAX_FESTIVAL_DISCOUNT_PERCENT, configured: false };
}

export function validateOptin(
  caps: SectorCap[],
  sector: Sector,
  requestedPercent: number,
  stateCode?: string,
): OptinValidation {
  if (!Number.isInteger(requestedPercent) || requestedPercent <= 0) {
    return { ok: false, message: "Enter a whole festival discount above 0%." };
  }
  if (requestedPercent > MAX_FESTIVAL_DISCOUNT_PERCENT) {
    return { ok: false, message: `Festival discounts are capped at ${MAX_FESTIVAL_DISCOUNT_PERCENT}%.` };
  }
  const { percent, configured } = optinCap(caps, sector, stateCode);
  if (configured && requestedPercent > percent) {
    return { ok: false, message: `${sector} festival cap is ${percent}% for this campaign scope.` };
  }
  return { ok: true };
}
