import { useCallback, useEffect, useRef, useState } from 'react';
import { gateway } from '@/services/api/GatewayClient';
import { categoryToRailItem, type CategoryRailItem } from '@/services/categoryRail';
import type { VendorApp } from '@/services/categoryVendors';
import { useRefreshStore } from '@/state/refreshStore';

/** Default page size for the header rail. */
export const HEADER_RAIL_PAGE_SIZE = 8;

export interface PagedRail {
  items: CategoryRailItem[];
  loadMore: () => void;
  hasMore: boolean;
  page: number;
  refreshing: boolean;
  /** True when the last fetch failed. The rail decides whether to advertise a retry. */
  error: boolean;
  /** Re-fetch the rail (header affordance). No-op while one is in flight. */
  refresh: () => void;
}

/**
 * Server-backed header category rail. Fetches the flat active top-level categories
 * (`GET /categories/rail`, superadmin-owned `taxonomy.categories`) once, then pages over the local
 * list. There is no fixture fallback: an offline/empty result renders an empty rail. Presentation-
 * agnostic — the rail owns rendering.
 *
 * `app` optionally scopes the rail to one sub-app so a sub-app header never shows another
 * sub-app's chips (the Home hub omits it and may cross sub-apps).
 *
 * The rail is a sibling of the Home body in the collapsing header, so it also reads the shared
 * `home` counter: one pull on the body re-fetches the feed and this rail together. A failed refresh
 * keeps the previously loaded chips (never blanks the header); the failure is logged in dev and
 * surfaced through `error` so a dead rail is never mistaken for "no curated categories".
 */
export function usePagedRail(pageSize = HEADER_RAIL_PAGE_SIZE, app?: VendorApp): PagedRail {
  const [all, setAll] = useState<CategoryRailItem[]>([]);
  const [page, setPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const homeTick = useRefreshStore((s) => s.home);
  const bump = useRefreshStore((s) => s.bump);
  // The scope the currently-loaded chips belong to. A failure keeps the chips for the same scope
  // and clears them only when the scope genuinely changed, so a transient error never blanks the
  // header (and one app's chips never leak into another app's rail).
  const loadedScope = useRef<{ app: VendorApp | undefined } | null>(null);

  useEffect(() => {
    let active = true;
    setPage(0);
    gateway
      .fetchCategoryRail()
      .then((categories) => {
        if (!active) return;
        loadedScope.current = { app };
        setError(false);
        setAll(
          categories
            .map(categoryToRailItem)
            .filter((c): c is CategoryRailItem => c !== null && (!app || c.app === app)),
        );
      })
      .catch((err) => {
        if (!active) return;
        // Never swallow the failure: a 401/500/offline must be diagnosable, not an empty rail that
        // looks like "no curated categories". Dev logs only; no token/PII is logged.
        if (__DEV__) {
          console.warn(`[rail] fetchCategoryRail failed (app=${app ?? 'HOME'})`, err);
        }
        setError(true);
        const scopeChanged = loadedScope.current?.app !== app;
        loadedScope.current = { app };
        if (scopeChanged) setAll([]);
      })
      .finally(() => {
        if (active) setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [app, homeTick]);

  const items = all.slice(0, (page + 1) * pageSize);

  const loadMore = useCallback(() => {
    setPage((p) => ((p + 1) * pageSize >= all.length ? p : p + 1));
  }, [all.length, pageSize]);

  const refresh = useCallback(() => {
    if (refreshing) return;
    setRefreshing(true);
    bump('home');
  }, [refreshing, bump]);

  const hasMore = (page + 1) * pageSize < all.length;

  return { items, loadMore, hasMore, page, refreshing, error, refresh };
}
