import type { Category } from '@/services/api/GatewayClient';
import type { VendorApp } from '@/services/categoryVendors';

/**
 * One tappable chip in the Home/Mart header category rail. Sourced from the superadmin-owned
 * `taxonomy.categories` top-level rows (`GET /categories/rail`) — never a local fixture.
 */
export interface CategoryRailItem {
  /** `taxonomy.categories.id` — deep-links the CategoryDrillIn page. */
  id: string;
  name: string;
  /** Category icon uri (rendered contain); may be empty. */
  icon: string;
  /** Sub-app whose product pool backs the drill-in. */
  app: VendorApp;
}

/**
 * Project one `taxonomy.categories` row onto a rail chip. Returns null for FOOD: the consumer
 * drill-in has no Food vendor pool — Food categories are consumed by seller onboarding instead.
 */
export function categoryToRailItem(c: Category): CategoryRailItem | null {
  const app: VendorApp | null =
    c.app === 'MART' ? 'FA_MART' : c.app === 'PHARMA' ? 'PHARMA' : null;
  if (!app) return null;
  return { id: c.id, name: c.name, icon: c.iconUrl ?? '', app };
}
