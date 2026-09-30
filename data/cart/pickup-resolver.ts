/**
 * @mock Resolves self-pickup points from the items in the cart, derived from the
 * store each product belongs to — NOT a hardcoded Faazio hub. A cart can span
 * several stores; each distinct store yields one pickup point (the user visits
 * whichever applies). Items whose store can't be determined fall back to a single
 * neutral pickup hub.
 *
 * Resolution order per item: product (`getProductById`) → `product.storeId` →
 * store; else `product.shop` matched to a store name; else the app's default
 * outlet (PHARMA has exactly one); else the neutral hub.
 */
import type { PickupPoint } from '../types';
import { getProductById } from '../catalog/products';
import { storeDirectory, getStoreById } from '../directory/stores';
import { getVendorById, resolveVendorIdForProduct } from '../directory/vendors';

/** App → default pickup outlet for single-outlet apps. */
const DEFAULT_STORE_BY_APP: Record<string, string> = {
  PHARMA: 'store-p1',
};

/** Neutral hub used when an item's store cannot be determined. */
export const NEUTRAL_PICKUP: PickupPoint = {
  id: 'pickup-neutral',
  name: 'Greenwood Pickup Hub',
  address: 'Central Collection Desk, Greenwood City Centre, Ring Road - 609602',
  phone: '+91 95005 55500',
  hours: '9 AM – 10 PM',
  isActive: true,
};

interface PickupSourceItem {
  id: string;
  category?: string;
}

/** A cart/order line that can resolve to a vendor (restaurant-tagged lines included). */
interface VendorSourceItem {
  id: string;
  category?: string;
  /** Owning restaurant id set when a line was added from a food restaurant page. */
  restaurantId?: string;
}

/** Resolve one line's vendor id: explicit restaurant tag → product → app default. */
function resolveItemVendorId(item: VendorSourceItem): string | undefined {
  if (item.restaurantId) {
    const tagged = getVendorById(item.restaurantId);
    if (tagged) return tagged.id;
    return item.restaurantId;
  }
  const product = getProductById(item.id);
  if (product) {
    const vendorId = resolveVendorIdForProduct(product);
    if (vendorId) return vendorId;
  }
  return DEFAULT_STORE_BY_APP[item.category ?? ''];
}

/**
 * Distinct vendor ids for a set of cart lines, resolved once at placement and
 * snapshotted onto the order (vendor identity). Preserves first-seen order.
 */
export function getStoreIdsForItems(items: VendorSourceItem[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const vendorId = resolveItemVendorId(item);
    if (!vendorId || seen.has(vendorId)) continue;
    seen.add(vendorId);
    ids.push(vendorId);
  }
  return ids;
}

function storeToPickup(storeId: string): PickupPoint | undefined {
  const store = getStoreById(storeId);
  if (!store || !store.address || !store.phone || !store.hours) return undefined;
  return {
    id: store.id,
    name: store.name,
    address: store.address,
    phone: store.phone,
    hours: store.hours,
    isActive: true,
  };
}

function findStoreByName(name?: string): string | undefined {
  if (!name) return undefined;
  const normalized = name.trim().toLowerCase();
  return storeDirectory.find((s) => s.name.toLowerCase() === normalized)?.id;
}

function resolveItemStore(item: PickupSourceItem): string | undefined {
  const product = getProductById(item.id);
  if (product) {
    if (product.storeId) return product.storeId;
    const byShopName = findStoreByName(product.shop);
    if (byShopName) return byShopName;
    const byApp = DEFAULT_STORE_BY_APP[product.app];
    if (byApp) return byApp;
  }
  const byCategory = DEFAULT_STORE_BY_APP[item.category ?? ''];
  return byCategory;
}

/** Distinct pickup points (one per store) for the given cart items. */
export function getPickupPointsForItems(items: PickupSourceItem[]): PickupPoint[] {
  const points: PickupPoint[] = [];
  const seen = new Set<string>();
  let needsNeutral = false;

  for (const item of items) {
    const storeId = resolveItemStore(item);
    if (!storeId) {
      needsNeutral = true;
      continue;
    }
    if (seen.has(storeId)) continue;
    seen.add(storeId);
    const point = storeToPickup(storeId);
    if (point) points.push(point);
  }

  if (needsNeutral || points.length === 0) {
    points.push(NEUTRAL_PICKUP);
  }

  return points;
}
