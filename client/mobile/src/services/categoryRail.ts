import type { Category } from '@/services/api/GatewayClient';
import type { VendorApp } from '@/services/categoryVendors';
import type { CategoryApp } from '@data/types';
import { localizedName } from '@/lib/localizedText';

/**
 * One tappable chip in the Home/Mart header category rail. Sourced from the superadmin-owned
 * `taxonomy.categories` rows curated with `show_on_home_rail` (`GET /categories/rail`) —
 * never a local fixture. The rail is unbounded: every curated Mart, Pharma **and** main-app-header
 * category (any tree level) is a chip and the header scrolls horizontally to the end (FOOD is not
 * eligible).
 */
export interface CategoryRailItem {
  /** `taxonomy.categories.id` — deep-links the CategoryDrillIn page. */
  id: string;
  name: string;
  /** Category icon uri (rendered contain); may be empty. */
  icon: string;
  /** Sub-app whose product pool backs the drill-in. */
  app: VendorApp;
  /**
   * Which taxonomy pool the drill-in walks. Usually the same sub-app as `app`, but a
   * `MAIN_APP_HEADER` category (e.g. "Electronics") has no vendor pool of its own — it drills into
   * its own sub-categories and searches the Mart pool.
   */
  treeApp: CategoryApp;
}

/**
 * Project one `taxonomy.categories` row onto a rail chip. The combined rail carries Mart **and**
 * Pharma categories at any tree level (a child chip opens that node's subtree), plus header-only
 * `MAIN_APP_HEADER` categories; FOOD is intentionally excluded — the consumer drill-in has no Food
 * vendor pool (Food categories are consumed by seller onboarding instead). A header-only category
 * uses the Mart pool for the body while keeping its own taxonomy for the sub-category walk.
 * `language` is the shopper's selection: Tamil pickers get the Tamil chip label when the category
 * has been translated, and the English canonical name otherwise.
 */
export function categoryToRailItem(c: Category, language = 'en'): CategoryRailItem | null {
  // FOOD is intentionally excluded from the combined header rail.
  const app: VendorApp | null =
    c.app === 'MART' || c.app === 'MAIN_APP_HEADER'
      ? 'FA_MART'
      : c.app === 'PHARMA'
        ? 'PHARMA'
        : null;
  if (!app) return null;
  return {
    id: c.id,
    name: localizedName({ name: c.name, nameTa: c.nameTa }, language),
    icon: c.iconUrl ?? '',
    app,
    treeApp: c.app,
  };
}
