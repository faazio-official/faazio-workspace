import { useCallback, useEffect, useRef, useState } from 'react';
import { gateway, type Category } from '@/services/api/GatewayClient';
import type { VendorApp } from '@/services/categoryVendors';

const APP_BRAND: Record<VendorApp, 'MART' | 'PHARMA'> = {
  FA_MART: 'MART',
  PHARMA: 'PHARMA',
};

export interface CategoryTree {
  categories: Category[];
  loading: boolean;
  refreshing: boolean;
  /** Re-fetch the taxonomy (pull-to-refresh). No-op while one is in flight. */
  refresh: () => void;
}

/**
 * Server-backed category tree for one sub-app. Reads the superadmin-owned `taxonomy.categories`
 * list (`GET /categories?app=`) — no fixture fallback. The flat list is turned into a parent/child
 * tree by the caller.
 *
 * A failed refresh keeps the previously loaded categories (never blanks the chips) — the drill-in
 * `app` is fixed for the panel's lifetime, so stale rows can never leak another sub-app's taxonomy.
 */
export function useCategoryTree(app: VendorApp): CategoryTree {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);
  const brand = APP_BRAND[app];
  // A pull keeps the loaded tree on failure; an app change must not keep another app's taxonomy.
  const isRefresh = useRef(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    gateway
      .fetchCategories(brand)
      .then((list) => {
        if (active) setCategories(list);
      })
      .catch(() => {
        // Keep the previously loaded tree on a pull; clear it on an app change.
        if (active && !isRefresh.current) setCategories([]);
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
  }, [brand, nonce]);

  const refresh = useCallback(() => {
    if (refreshing) return;
    isRefresh.current = true;
    setRefreshing(true);
    setNonce((n) => n + 1);
  }, [refreshing]);

  return { categories, loading, refreshing, refresh };
}
