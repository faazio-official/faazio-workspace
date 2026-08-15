import { MASTER_CATEGORIES } from '@data/categories/masterCategories';
import type { SubAppId } from '@/state/uiStore';

export interface CategoryCard {
  id: string;
  name: string;
  icon: string;
}

/** Max category cards shown in a home rail. */
export const CATEGORY_RAIL_LIMIT = 10;

/**
 * Builds the category cards for a home's "Shop by Category" rail.
 *
 * Cards are sourced directly from the unified Master Categories tree
 * (`MASTER_CATEGORIES[subApp]`) — the exact same tabs the common categories
 * page's sidebar renders. Because the rail and the sidebar share ids and
 * titles, tapping a card can deep-link the sidebar to that tab with no
 * id mapping. Food has no category tree.
 */
export function getCategoryCards(subApp: SubAppId): CategoryCard[] {
  if (subApp === 'FOOD') return [];
  const tabs = MASTER_CATEGORIES[subApp] ?? [];
  return tabs.slice(0, CATEGORY_RAIL_LIMIT).map((tab) => ({
    id: tab.id,
    name: tab.title,
    icon: tab.icon,
  }));
}
