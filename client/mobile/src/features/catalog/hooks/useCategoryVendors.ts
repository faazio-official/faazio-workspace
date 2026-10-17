import { useEffect, useMemo, useState } from 'react';
import type { Product, StoreProfile } from '@data/types';
import { getStoreById } from '@data/directory/stores';
import { gateway } from '@/services/api/GatewayClient';
import { useActiveDiscounts, applyActiveDiscounts } from '@/services/pricing';
import {
  getVendorsWithProducts,
  type VendorApp,
  type VendorProducts,
} from '@/services/categoryVendors';

const APP_BRAND: Record<VendorApp, 'MART' | 'PHARMA'> = {
  FA_MART: 'MART',
  PHARMA: 'PHARMA',
};

export interface CategoryVendors {
  vendors: VendorProducts[];
  loading: boolean;
}

/**
 * Store-grouped catalog for the category drill-in, resolved from the server so new seller `ACTIVE`
 * rows appear and the shopper price matches checkout. Products come from the FTS read
 * (`GET /search?q=&app=`), grouped by `storeId` and joined to the store directory
 * (`GET /stores?app=`). The local token-containment grouping (`getVendorsWithProducts`) is the
 * offline authority *and* the safety net when the server FTS returns nothing for a multi-word
 * sub-category query, so the drill-in can never regress to empty for a query it used to serve.
 * Approved festival discounts are overlaid here — the pre-overlay pool as one `useActiveDiscounts`
 * batch — so a product without an authored MRP still shows its server discount.
 */
export function useCategoryVendors(app: VendorApp, query: string): CategoryVendors {
  const [vendors, setVendors] = useState<VendorProducts[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      let list: VendorProducts[] | null = null;
      if (gateway.remoteEnabled) {
        try {
          const brand = APP_BRAND[app];
          const [stores, products] = await Promise.all([
            gateway.getStores(brand),
            gateway.searchProducts(query, brand),
          ]);
          const storeMap = new Map<string, StoreProfile>(
            stores.map((s) => [s.id, s as unknown as StoreProfile]),
          );
          const byStore = new Map<string, Product[]>();
          for (const p of products) {
            if (!p.storeId) continue;
            const bucket = byStore.get(p.storeId);
            if (bucket) bucket.push(p as unknown as Product);
            else byStore.set(p.storeId, [p as unknown as Product]);
          }
          const built = [...byStore.entries()]
            .map(([storeId, prods]) => {
              const store = storeMap.get(storeId) ?? getStoreById(storeId);
              return store
                ? {
                    store: store as unknown as StoreProfile,
                    matchCount: prods.length,
                    products: prods,
                  }
                : null;
            })
            .filter((v): v is VendorProducts => v !== null)
            .sort((a, b) => b.matchCount - a.matchCount || b.store.rating - a.store.rating);
          if (built.length > 0) list = built;
        } catch {
          list = null;
        }
      }
      if (!list) list = getVendorsWithProducts(app, query);
      if (active) setVendors(list);
    })()
      .catch(() => {
        if (active) setVendors(getVendorsWithProducts(app, query));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [app, query]);

  const resolved = vendors ?? [];

  // Overlay server festival discounts on the whole resolved pool (no-op offline / none apply).
  const ids = useMemo(() => resolved.flatMap((v) => v.products.map((p) => p.id)), [resolved]);
  const discounts = useActiveDiscounts(ids);
  const priced = useMemo(
    () =>
      resolved.map((v) => ({
        ...v,
        products: applyActiveDiscounts(v.products, discounts),
      })),
    [resolved, discounts],
  );

  return { vendors: priced, loading };
}