// Provenance: promo.festival_sector_caps (sector, max_discount_percent, state_code)
import type { SectorCap } from "@/data/types";

export const SECTOR_CAPS: SectorCap[] = [
  { capId: "cap-mart", sector: "MART", maxDiscountPercent: 40, updatedAt: "2026-08-20T06:00:00.000Z" },
  { capId: "cap-food", sector: "FOOD", maxDiscountPercent: 30, updatedAt: "2026-08-20T06:00:00.000Z" },
  { capId: "cap-pharma", sector: "PHARMA", maxDiscountPercent: 15, updatedAt: "2026-08-20T06:00:00.000Z" },
  {
    capId: "cap-mart-mh",
    sector: "MART",
    maxDiscountPercent: 35,
    stateCode: "MH",
    updatedAt: "2026-08-24T06:00:00.000Z",
  },
];
