import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Product, StoreProfile } from '@data/types';
import { gateway } from '@/services/api/GatewayClient';
import { withLiveDistance } from '@/utils/distance';
import { useLiveOrigin } from '@/hooks/useLiveLocation';
import { useActiveDiscounts, applyActiveDiscounts } from '@/services/pricing';
import type { VendorApp, VendorProducts } from '@/services/categoryVendors';

const APP_BRAND: Record<VendorApp, 'MART' | 'PHARMA'> = {
  FA_MART: 'MART',
  PHARMA: 'PHARMA',
};

export interface CategoryVendors {
  vendors: VendorProducts[];
  loading: boolean;
  /** True when the last server read rejected (so the UI can offer "Report issue"). */
  failed: boolean;
  /** True while a manual pull-to-refresh is in flight. */
  refreshing: boolean;
  /** Re-fetch the store-grouped body (pull-to-refresh). No-op while one is in flight. */
  refresh: () => void;
}

/**
 * Store-grouped catalog for the category drill-in, resolved from the server so new seller `ACTIVE`
 * rows appear and the shopper price matches checkout. Products come from the FTS read
 * (`GET /search?q=&app=`), grouped by `storeId` and joined to the store directory
 * (`GET /stores?app=`). There is no local fallback: a failed or empty server read leaves the
 * drill-in empty (customers can report it), never a stale fixture grouping.
 * Approved festival discounts are overlaid here — the pre-overlay pool as one `useActiveDiscounts`
 * batch — so a product without an authored MRP still shows its server discount.
 *
 * A failed *refresh* keeps the previously loaded rows (never blanks mid-pull) and only sets
 * `failed`; an authoritative empty answer still clears them.
 */
export function useCategoryVendors(app: VendorApp, query: string): CategoryVendors {
  const [vendors, setVendors] = useState<VendorProducts[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);
  const origin = useLiveOrigin();
  // True only for a pull (nonce) re-run — a category/query change must never keep the previous
  // category's rows on failure, but a pull must never blank the body.
  const isRefresh = useRef(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    (async () => {
      if (!gateway.remoteEnabled) {
        if (active) setVendors(null);
        return;
      }
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
            const store = storeMap.get(storeId);
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
        // The server answer is authoritative: an empty join clears the body honestly.
        if (active) setVendors(built.length > 0 ? built : null);
      } catch {
        // Keep the previously loaded rows on a pull so it never blanks; on a category/query
        // change clear them so another category's vendors are never shown under the new chip.
        if (active) {
          setFailed(true);
          if (!isRefresh.current) setVendors(null);
        }
      }
    })()
      .catch(() => {
        if (active) {
          setFailed(true);
          if (!isRefresh.current) setVendors(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setRefreshing(false);
          isRefresh.current = false;
        }
      });
    return () => {
      active = false;
    };
  }, [app, query, nonce]);

  const refresh = useCallback(() => {
    if (refreshing) return;
    isRefresh.current = true;
    setRefreshing(true);
    setNonce((n) => n + 1);
  }, [refreshing]);

  const resolved = useMemo(
    () =>
      (vendors ?? [])
        .map((vendor) => ({
          ...vendor,
          store: withLiveDistance(vendor.store, origin) as StoreProfile,
        }))
        .sort((a, b) => {
          const da = a.store.distanceKm ?? Number.POSITIVE_INFINITY;
          const db = b.store.distanceKm ?? Number.POSITIVE_INFINITY;
          return da - db;
        }),
    [vendors, origin],
  );

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

  return { vendors: priced, loading, failed, refreshing, refresh };
}
