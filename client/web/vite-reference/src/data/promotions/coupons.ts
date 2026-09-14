// Provenance: promo.coupons (code, scope, state_code, value_percent, max_discount_paisa)
import type { CouponRecord } from "@/data/types";

export const COUPONS: CouponRecord[] = [
  {
    couponId: "cpn-1",
    code: "FAAZIO100",
    scope: "GLOBAL",
    valuePercent: 10,
    maxDiscountPaisa: 10000,
    validTill: "2026-10-31T23:59:00.000Z",
    active: true,
  },
  {
    couponId: "cpn-2",
    code: "MHFOOD50",
    scope: "STATE",
    stateCode: "MH",
    sector: "FOOD",
    valuePercent: 15,
    maxDiscountPaisa: 5000,
    validTill: "2026-09-30T23:59:00.000Z",
    active: true,
  },
  {
    couponId: "cpn-3",
    code: "MARTBIG",
    scope: "STATE",
    stateCode: "MH",
    sector: "MART",
    valuePercent: 8,
    maxDiscountPaisa: 25000,
    validTill: "2026-09-20T23:59:00.000Z",
    active: false,
  },
  {
    couponId: "cpn-4",
    code: "CARE20",
    scope: "STATE",
    stateCode: "DL",
    sector: "PHARMA",
    valuePercent: 5,
    maxDiscountPaisa: 3000,
    validTill: "2026-12-31T23:59:00.000Z",
    active: true,
  },
];
