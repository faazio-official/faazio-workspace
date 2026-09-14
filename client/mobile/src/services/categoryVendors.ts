import { martProducts } from '@data/mart/products';
import { pharmaProducts } from '@data/pharma/products';
import { getStoreById } from '@data/directory/stores';
import type { Product, StoreProfile } from '@data/types';
import type { SubAppId } from '@/state/uiStore';

/** Sub-apps that have a product-to-vendor mapping (Mart & Pharma only). */
export type VendorApp = Extract<SubAppId, 'FA_MART' | 'PHARMA'>;

/** A vendor (store) with the number of products it carries that matched a search. */
export interface VendorMatch {
  store: StoreProfile;
  matchCount: number;
}

/** The product pool backing a sub-app's catalog. */
const APP_PRODUCTS: Record<VendorApp, Product[]> = {
  FA_MART: martProducts,
  PHARMA: pharmaProducts,
};

/**
 * Lowercased searchable text for a product — mirrors the exact predicate used by
 * the Mart/Pharma search configs (name + category + desc + attributes).
 */
export function productSearchableText(p: Product): string {
  const parts = [
    p.name,
    p.category,
    p.desc,
    ...Object.values(p.attributes ?? {}).flatMap((v) =>
      Array.isArray(v) ? v : [String(v)],
    ),
  ];
  return parts.join(' ').toLowerCase();
}

/**
 * Per-token containment test: every query word must appear in the product's
 * searchable text. Unlike the Search screen's contiguous-substring match, this
 * lets a multi-word sub-category ("Bluetooth Headphones") match products whose
 * tokens are spread across name/desc/attributes — the semantics needed to group
 * the mock catalog into per-vendor rows (a full-phrase match yields nothing).
 */
export function matchesQuery(p: Product, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = productSearchableText(p);
  return words.every((w) => text.includes(w));
}

/**
 * Groups an app's products by `storeId` into one-per-vendor results for the
 * category drill-in page. Each vendor lists the count of products that matched
 * the (optional) search query, so a live search can filter the vendor list.
 * Vendors are sorted by match count (desc) then rating (desc).
 */
export function getVendorsForApp(app: VendorApp, searchQuery = ''): VendorMatch[] {
  const byStore = new Map<string, number>();

  for (const p of APP_PRODUCTS[app]) {
    if (!matchesQuery(p, searchQuery)) continue;
    if (!p.storeId) continue;
    byStore.set(p.storeId, (byStore.get(p.storeId) ?? 0) + 1);
  }

  return [...byStore.entries()]
    .map(([storeId, matchCount]) => {
      const store = getStoreById(storeId);
      return store ? { store, matchCount } : null;
    })
    .filter((v): v is VendorMatch => v !== null)
    .sort((a, b) => b.matchCount - a.matchCount || b.store.rating - a.store.rating);
}

/**
 * Resolves a vendor's product pool (all products carrying `storeId`). Same logic
 * as `FaMartScreen.getVendorProducts`, generalised to both Mart and Pharma.
 */
export function getVendorProducts(storeId: string, app: VendorApp): Product[] {
  return APP_PRODUCTS[app].filter((p) => p.storeId === storeId);
}

/**
 * A vendor's items currently on offer — products with a pre-discount MRP
 * (`originalPrice` > `price`). Shared by the Mart vendor profile "Discounted
 * Products" rail and the `DealsLanding` page in `discounts` mode, so the
 * predicate isn't duplicated across screens.
 */
export function getDiscountedProducts(storeId: string, app: VendorApp): Product[] {
  return getVendorProducts(storeId, app).filter(
    (p) => p.originalPrice !== undefined && p.originalPrice > p.price,
  );
}
