import { useCallback, useEffect, useState } from 'react';
import {
  getCategoryRailPage,
  HEADER_RAIL_PAGE_SIZE,
  type CategoryRailItem,
} from '@data/categories/railFeed';

/**
 * Client-side pagination over the static header category rail feed. Mirrors the
 * shape the future Go `GET /categories/rail?page=` endpoint will return: a
 * `page` index, an accumulated `items` list, a `hasMore` flag, and a `loadMore`
 * that appends the next page. Presentation-agnostic — the rail owns rendering.
 */
export function usePagedRail(pageSize = HEADER_RAIL_PAGE_SIZE) {
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<CategoryRailItem[]>([]);

  useEffect(() => {
    setItems(getCategoryRailPage(0));
    setPage(0);
  }, [pageSize]);

  const loadMore = useCallback(() => {
    setItems((prev) => {
      const nextPage = page + 1;
      const next = getCategoryRailPage(nextPage);
      if (next.length === 0) return prev;
      setPage(nextPage);
      return [...prev, ...next];
    });
  }, [page]);

  const hasMore = getCategoryRailPage(page + 1).length > 0;

  return { items, loadMore, hasMore, page };
}
