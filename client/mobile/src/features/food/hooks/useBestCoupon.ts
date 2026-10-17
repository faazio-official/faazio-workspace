import { useEffect, useState } from 'react';
import type { AppBrand } from '@data/types';
import { gateway, type PublicCoupon } from '@/services/api/GatewayClient';

/** Best live coupon for an app: highest percentage off, then lowest minimum order. */
function pickBest(coupons: PublicCoupon[]): PublicCoupon | null {
  if (coupons.length === 0) return null;
  return [...coupons].sort(
    (a, b) => b.valuePercent - a.valuePercent || a.minOrder - b.minOrder,
  )[0];
}

/**
 * The best live coupon for an app (`GET /coupons?app=…`). Server-authoritative and strict — an
 * empty result on error/offline collapses the surface, so a coupon (money) is never fabricated
 * on-device. Used by the Food profile's offer slot so the admin-owned coupon is the visible offer.
 */
export function useBestCoupon(app: AppBrand = 'FOOD'): PublicCoupon | null {
  const [coupon, setCoupon] = useState<PublicCoupon | null>(null);

  useEffect(() => {
    let active = true;
    gateway
      .getCoupons(app)
      .then((list) => {
        if (active) setCoupon(pickBest(list));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [app]);

  return coupon;
}