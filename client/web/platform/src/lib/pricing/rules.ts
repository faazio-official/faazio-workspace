import type { Sector, SectorCap } from "@/data/types";

export interface OptinValidation {
  ok: boolean;
  message?: string;
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
): OptinValidation {
  const cap = capFor(caps, sector, stateCode);
  if (requestedPercent > cap) {
    return { ok: false, message: `${sector} festival cap is ${cap}% for this campaign scope.` };
  }
  if (requestedPercent <= 0) {
    return { ok: false, message: "Enter a festival discount above 0%." };
  }
  return { ok: true };
}
