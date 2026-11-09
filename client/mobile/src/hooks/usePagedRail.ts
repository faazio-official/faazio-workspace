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
  /** Re-fetch the rail (sub-app header affordance). No-op while one is in flight. */
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
 * keeps the previously loaded chips (never blanks the header).
 */
export function usePagedRail(pageSize = HEADER_RAIL_PAGE_SIZE, app?: VendorApp): PagedRail {
  const [all, setAll] = useState<CategoryRailItem[]>([]);
  const [page, setPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const homeTick = useRefreshStore((s) => s.home);
  const bump = useRefreshStore((s) => s.bump);
  // A pull keeps the loaded chips on failure; an app change must not keep another app's chips.
  const isRefresh = useRef(false);

  useEffect(() => {
    let active = true;
    setPage(0);
    gateway
      .fetchCategoryRail()
      .then((categories) => {
        if (!active) return;
        setAll(
          categories
            .map(categoryToRailItem)
            .filter((c): c is CategoryRailItem => c !== null && (!app || c.app === app)),
        );
      })
      .catch(() => {
        // Keep the previously loaded chips on a pull; clear on an app change.
        if (active && !isRefresh.current) setAll([]);
      })
      .finally(() => {
        if (active) {
          setRefreshing(false);
          isRefresh.current = false;
        }
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
    isRefresh.current = true;
    setRefreshing(true);
    bump('home');
  }, [refreshing, bump]);

  const hasMore = (page + 1) * pageSize < all.length;

  return { items, loadMore, hasMore, page, refreshing, refresh };
}
