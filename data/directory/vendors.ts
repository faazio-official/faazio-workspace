/**
 * @mock Vendor identity resolver — the single owner of "which vendor does this
 * product/order belong to". A vendor is a ratable place: a Mart/Pharma store
 * (`directory/stores.ts`) or a Food restaurant venue (`food/diningVenues.ts`).
 *
 * Identity is resolved once (here) and snapshotted onto orders at placement, so
 * an old order keeps resolving to the same vendor even if catalog linkage later
 * changes. See data/DATA_CONTROL.md and docs/architecture/db-schema.md §7.7.
 */
import type { AppBrand, Product } from '../types';
import { storeDirectory, getStoreById } from './stores';
import { restaurantVenues, findRestaurantVenueByName } from '../food/diningVenues';

export interface VendorRef {
  id: string;
  name: string;
  app: AppBrand;
}

/** Flattened vendor directory (stores + restaurant venues), deduped by id. */
export const vendorDirectory: VendorRef[] = [
  ...storeDirectory.map((store) => ({ id: store.id, name: store.name, app: store.app })),
  ...restaurantVenues
    .filter((venue) => !storeDirectory.some((store) => store.id === venue.id))
    .map((venue) => ({ id: venue.id, name: venue.name, app: 'FOOD' as const })),
];

export function getVendorById(id: string): VendorRef | undefined {
  return vendorDirectory.find((vendor) => vendor.id === id);
}

export function findVendorByName(name?: string, app?: AppBrand): VendorRef | undefined {
  if (!name) return undefined;
  const normalized = name.trim().toLowerCase();
  return vendorDirectory.find(
    (vendor) =>
      vendor.name.trim().toLowerCase() === normalized && (app ? vendor.app === app : true),
  );
}

/**
 * Resolve the vendor a product is sold by. Resolution order mirrors the pickup
 * resolver: `product.storeId` → store/dining-venue directory, then `product.shop`
 * matched by name, then the app's default outlet (PHARMA flagship). Returns
 * `undefined` when no vendor can be determined.
 */
export function resolveVendorForProduct(product: Product): VendorRef | undefined {
  if (product.storeId) {
    const byId = getVendorById(product.storeId) ?? getStoreById(product.storeId);
    if (byId) return { id: byId.id, name: byId.name, app: byId.app };
  }

  const byShop = findVendorByName(product.shop, product.app);
  if (byShop) return byShop;

  if (product.app === 'PHARMA') {
    const flagship = getStoreById('store-p1');
    if (flagship) return { id: flagship.id, name: flagship.name, app: 'PHARMA' };
  }
  return undefined;
}

export function resolveVendorIdForProduct(product: Product): string | undefined {
  return resolveVendorForProduct(product)?.id;
}

/** Resolve a vendor by a free-text shop/restaurant name (used for legacy orders). */
export function resolveVendorIdByName(name?: string): string | undefined {
  return findVendorByName(name)?.id ?? findRestaurantVenueByName(name)?.id;
}
