/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 */
import type { Coupon } from '../types';

export const coupons: Coupon[] = [
  { code: 'FAAZIO20', discountPercent: 20, label: 'FAAZIO20', minOrder: 499 },
  { code: 'SUPER50', discountPercent: 50, label: 'SUPER50', minOrder: 999 },
  { code: 'FREESHIP', discountPercent: 0, label: 'FREE Delivery', isFreeDelivery: true, minOrder: 500 },
  { code: 'MART30', discountPercent: 30, label: 'MART30', minOrder: 799 },
  { code: 'WELCOME15', discountPercent: 15, label: 'WELCOME15', minOrder: 299 },
];
