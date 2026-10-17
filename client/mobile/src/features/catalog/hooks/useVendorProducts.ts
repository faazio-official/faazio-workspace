import { useEffect, useMemo, useState } from 'react';
import type { Product } from '@data/types';
import { gateway, type ActiveDiscount } from '@/services/api/GatewayClient';
import { applyActiveDiscounts, useActiveDiscounts } from '@/services/pricing';
import { isDiscounted } from '@/services/categoryVendors';

export interface VendorProducts {
  /** The store's ACTIVE catalog rows, with any server festival discount overlaid. */
  products: Product[];
  /** `products` filtered to what is actually on offer (authored MRP or an active opt-in). */
  discounted: Product[];
  /** Raw catalog ids (pre-overlay) so a host can share one `useActiveDiscounts` batch. */
  ids: string[];
  loading: boolean;
}

/**
 * Single owner for a store's server inventory (`GET /stores/{id}/products`, `catalog.products` by
 * `store_id` + `status = ACTIVE`). `GatewayClient` falls back to the local `@data` pool offline, so
 * the vendor surfaces never regress. Approved festival discounts are overlaid here so every surface
 * shows the same shopper price the vendor drill-in, deals landing and PDP already render.
 *
 * Pass `discounts` to share a host-owned batch (the Mart feed's single `useActiveDiscounts` for
 * deals + essentials + vendor pool); omit it to self-serve (the standalone vendor-details screen).
 */
export function useVendorProducts(
  storeId: string | undefined,
  discounts?: Record<string, ActiveDiscount>,
): VendorProducts {
  const [raw, setRaw] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!storeId) {
      setRaw([]);
      return;
    }
    let active = true;
    setLoading(true);
    gateway
      .getStoreProducts(storeId)
      .then((rows) => {
        if (active) setRaw(rows as unknown as Product[]);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [storeId]);

  const ids = useMemo(() => raw.map((p) => p.id), [raw]);
  // When the host owns the batch (`discounts` provided) the hook skips its own fetch (empty id set
  // = no request); otherwise it self-serves — the standalone vendor-details / deals-landing usage.
  const ownDiscounts = useActiveDiscounts(discounts ? [] : ids);
  const map = discounts ?? ownDiscounts;
  const products = useMemo(() => applyActiveDiscounts(raw, map), [raw, map]);
  const discounted = useMemo(() => products.filter(isDiscounted), [products]);

  return { products, discounted, ids, loading };
}