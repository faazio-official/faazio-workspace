import type { Coupon } from '../types';

export const coupons: Coupon[] = [
  { code: 'FAAZIO20', discountPercent: 20, label: 'FAAZIO20', minOrder: 499 },
  { code: 'SUPER50', discountPercent: 50, label: 'SUPER50', minOrder: 999 },
  { code: 'FREESHIP', discountPercent: 0, label: 'FREE Delivery', isFreeDelivery: true, minOrder: 500 },
];
