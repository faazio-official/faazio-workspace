/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 *
 * Header category rail feed for the Home hub. Items are derived from the merged
 * Mart category tree (which now includes the former grocery tabs), so the rail
 * stays in sync with the Master Categories sidebar: each item carries the source
 * `CategoryTab.id`, letting a tap deep-link the sidebar to that exact tab.
 *
 * `getCategoryRailPage` pages over the merged Mart tabs. `usePagedRail` (client)
 * owns the client-side pagination state over this static feed — the Go backend
 * will serve the same shape once wired.
 */
import { MASTER_CATEGORIES } from './masterCategories';

/** One tappable category chip in the Home header rail. */
export interface CategoryRailItem {
  /** The source `CategoryTab.id` — deep-links the Master Categories sidebar. */
  id: string;
  name: string;
  /** Category icon image uri (rendered contain). */
  icon: string;
}

/** Categories shown in the Home header rail, sourced from the merged Mart tree. */
export const HEADER_CATEGORY_RAIL: CategoryRailItem[] = (
  MASTER_CATEGORIES.FA_MART ?? []
).map((tab) => ({ id: tab.id, name: tab.title, icon: tab.icon }));

/** Default page size for the header rail pagination. */
export const HEADER_RAIL_PAGE_SIZE = 8;

/**
 * Returns one page of the header rail starting at `page` (0-indexed), clipped to
 * the feed length. Mirrors the shape the future Go `GET /categories/rail?page=`
 * endpoint will return.
 */
export function getCategoryRailPage(page: number): CategoryRailItem[] {
  const start = page * HEADER_RAIL_PAGE_SIZE;
  return HEADER_CATEGORY_RAIL.slice(start, start + HEADER_RAIL_PAGE_SIZE);
}

export const HEADER_RAIL_TOTAL = HEADER_CATEGORY_RAIL.length;
