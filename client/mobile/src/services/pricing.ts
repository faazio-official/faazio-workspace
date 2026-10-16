import { useEffect, useMemo, useState } from 'react';
import type { Product } from '@data/types';
import { gateway, type ActiveDiscount } from '@/services/api/GatewayClient';

/**
 * Shopper pricing helpers. The server is the discount authority (`GET /promo/active-discounts`):
 * base catalog prices stay pure and the app overlays the approved, sector-capped discount. A
 * discount is never synthesized on-device — no server discount means base price, no strike-through.
 */

/** The effective (post-discount) price of a base price at `discountPercent`, floored at ₹1. */
export function effectivePrice(basePrice: number, discountPercent: number): number {
  if (discountPercent <= 0) return basePrice;
  return Math.max(1, Math.round((basePrice * (100 - discountPercent)) / 100));
}

/** The strikethrough list price to show beside an effective price (MRP when present, else base). */
export function listPrice(product: Product): number {
  return product.originalPrice !== undefined && product.originalPrice > product.price
    ? product.originalPrice
    : product.price;
}

/**
 * Overlay one active discount on a product for display. Untouched when there is no discount (or it
 * does not lower the price), so an un-discounted product renders exactly as before. Subtype-safe.
 */
export function applyActiveDiscount<T extends Product>(product: T, discount?: ActiveDiscount): T {
  if (!discount || discount.discountPercent <= 0) return product;
  const price = effectivePrice(product.price, discount.discountPercent);
  if (price >= product.price) return product;
  return { ...product, price, originalPrice: listPrice(product) };
}

/** Overlay a batch of discounts, keyed by product id. */
export function applyActiveDiscounts<T extends Product>(
  products: T[],
  discounts: Record<string, ActiveDiscount>,
): T[] {
  if (Object.keys(discounts).length === 0) return products;
  return products.map((p) => applyActiveDiscount(p, discounts[p.id]));
}

/**
 * The active festival discounts for a set of product ids, keyed by product id. Remote-only: in mock
 * mode (or on any failure) it returns `{}`, so base prices stand and no discount is invented. The
 * effect is keyed on the id-set so a screen refetch only fires when the ids actually change.
 */
export function useActiveDiscounts(productIds: string[]): Record<string, ActiveDiscount> {
  const key = useMemo(() => [...new Set(productIds)].sort().join(','), [productIds]);
  const [map, setMap] = useState<Record<string, ActiveDiscount>>({});

  useEffect(() => {
    if (!gateway.remoteEnabled || !key) {
      setMap({});
      return;
    }
    let active = true;
    gateway
      .getActiveDiscounts(key.split(','))
      .then((discounts) => {
        if (!active) return;
        const next: Record<string, ActiveDiscount> = {};
        for (const d of discounts) next[d.productId] = d;
        setMap(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [key]);

  return map;
}

/**
 * Non-hook counterpart to `useActiveDiscounts` for async list sources (e.g. the search `fetch`
 * seam): fetch the active discounts for a set of ids as a lookup map. Remote-only — `{}` in mock
 * mode or on failure, so a discount is never invented.
 */
export async function fetchActiveDiscounts(
  productIds: string[],
): Promise<Record<string, ActiveDiscount>> {
  if (!gateway.remoteEnabled || productIds.length === 0) return {};
  try {
    const discounts = await gateway.getActiveDiscounts(productIds);
    const map: Record<string, ActiveDiscount> = {};
    for (const d of discounts) map[d.productId] = d;
    return map;
  } catch {
    return {};
  }
}

/**
 * Fetch the active discounts for `products` and overlay them in one step. The convenience used by
 * async product sources (search) so their result rows carry the shopper price with no synthesized
 * fallback.
 */
export async function withActiveDiscounts<T extends Product>(products: T[]): Promise<T[]> {
  if (products.length === 0) return products;
  return applyActiveDiscounts(products, await fetchActiveDiscounts(products.map((p) => p.id)));
}