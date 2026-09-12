/**
 * @repository Home feed data seam — the single async entry point the Home
 * screens read from. Backed today by the in-memory `@data/*` fixtures and
 * resolving on a microtask (never blocks the UI), this is the contract the
 * future Go Chi gateway / local cache will fulfil. Swapping the backend is a
 * one-file change: keep these signatures, resolve from HTTP instead.
 */
import { homeSections, type HomeSectionDescriptor } from '@data/home/sections';
import { filterChips, filterFeedPools, type FilterChipId } from '@data/home/filterFeed';
import type { Product } from '@data/types';

/** Number of products returned per filter-feed page. */
export const FILTER_FEED_PAGE_SIZE = 8;

export interface FilterFeedPage {
  /** Products for this chip + page (0-indexed). */
  items: Product[];
  /** Total products available for this chip. */
  total: number;
  /** Whether more pages exist after this one. */
  hasMore: boolean;
}

/** Ordered Home feed section registry (header → feed). */
export function getHomeSections(): Promise<HomeSectionDescriptor[]> {
  return Promise.resolve(homeSections);
}

/**
 * Fetches one page of a filter chip's feed pool. Paginated + promise-based so
 * the UI never blocks on data; callers can slice the result against their own
 * visible-window state (e.g. the batched grid) or cancel by ignoring the
 * resolved page. Mirrors the Future-gateway contract.
 */
export function getFilterFeedPage(chip: FilterChipId, page = 0, pageSize = FILTER_FEED_PAGE_SIZE): Promise<FilterFeedPage> {
  const pool = filterFeedPools[chip] ?? [];
  const start = page * pageSize;
  const items = pool.slice(start, start + pageSize);
  return Promise.resolve({
    items,
    total: pool.length,
    hasMore: start + pageSize < pool.length,
  });
}

/** All valid filter-chip ids, in display order. */
export function getFilterChips(): Promise<FilterChipId[]> {
  return Promise.resolve(filterChips.map((c) => c.id));
}
