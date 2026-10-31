import { useCallback, useEffect, useState } from 'react';
import { gateway } from '@/services/api/GatewayClient';
import { categoryToRailItem, type CategoryRailItem } from '@/services/categoryRail';

/** Default page size for the header rail. */
export const HEADER_RAIL_PAGE_SIZE = 8;

/**
 * Server-backed header category rail. Fetches the flat active top-level categories
 * (`GET /categories/rail`, superadmin-owned `taxonomy.categories`) once, then pages over the local
 * list. There is no fixture fallback: an offline/empty result renders an empty rail. Presentation-
 * agnostic — the rail owns rendering.
 */
export function usePagedRail(pageSize = HEADER_RAIL_PAGE_SIZE) {
  const [all, setAll] = useState<CategoryRailItem[]>([]);
  const [page, setPage] = useState(0);

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
            .filter((c): c is CategoryRailItem => c !== null),
        );
      })
      .catch(() => {
        if (active) setAll([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const items = all.slice(0, (page + 1) * pageSize);

  const loadMore = useCallback(() => {
    setPage((p) => ((p + 1) * pageSize >= all.length ? p : p + 1));
  }, [all.length, pageSize]);

  const hasMore = (page + 1) * pageSize < all.length;

  return { items, loadMore, hasMore, page };
}
