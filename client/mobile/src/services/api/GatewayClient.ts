/**
 * @aspirational The single gateway surface for the app. Joins the normalized
 * microservice-shaped tables (catalog / directory / reviews / inventory /
 * checkout / accounts / home-sdui) as if served by the future Go Chi gateway.
 *
 * This is NOT yet wired into screens — the legacy fixtures (via @data/*) remain
 * live until each screen is migrated onto this client. See data/DATA_CONTROL.md
 * and ARCHITECTURE.md. Methods are async (simulating a network round-trip) so
 * screens can swap to real HTTP later without changing their call sites.
 */
import type { AppBrand } from '@data/types';
import { catalogIndex, getCatalogEntryById, getCatalogEntriesByIds, type CatalogEntry } from '@data/catalog/products';
import { storeDirectory, getStoreById, getStoresByApp, type StoreRecord } from '@data/directory/stores';
import { getReviewsByProductId, type ReviewRow } from '@data/reviews/reviews';
import { stockTable, getStockByProductId, type StockRow } from '@data/inventory/stock';
import { ordersTable, getOrdersByUser, type OrderRow } from '@data/checkout/orders';
import { profileTable, membershipTable, orderStatusTable, navTable, detailsTable, type ProfileRow } from '@data/accounts/profile';
import { homeSdui, type SduiSection } from '@data/home/sdui';

/** Simulated network latency (ms). Drop to 0 to run as a pure in-memory client. */
const LATENCY_MS = 40;

function delay<T>(value: T, ms = LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** A catalog entry joined with its live stock row. */
export interface ProductView extends CatalogEntry {
  stock: StockRow | undefined;
}

export class GatewayClient {
  private joinStock(entries: CatalogEntry[]): ProductView[] {
    return entries.map((entry) => ({ ...entry, stock: getStockByProductId(entry.id) }));
  }

  /** Tantivy-style full-text search over the catalog index. */
  async searchProducts(query: string, app?: AppBrand): Promise<ProductView[]> {
    const q = query.trim().toLowerCase();
    const matches = q === ''
      ? catalogIndex
      : catalogIndex.filter((e) =>
          e.searchTokens.some((t) => t.includes(q)) || e.name.toLowerCase().includes(q) || e.category.toLowerCase().includes(q),
        );
    const scoped = app ? matches.filter((e) => e.app === app) : matches;
    return delay(this.joinStock(scoped));
  }

  /** Fetch one catalog entry with stock and reviews. */
  async getProduct(id: string): Promise<{ product: ProductView; reviews: ReviewRow[] } | undefined> {
    const entry = getCatalogEntryById(id);
    if (!entry) return delay(undefined);
    return delay({ product: this.joinStock([entry])[0], reviews: getReviewsByProductId(id) });
  }

  async getProductsByIds(ids: string[]): Promise<ProductView[]> {
    return delay(this.joinStock(getCatalogEntriesByIds(ids)));
  }

  async getStores(app?: AppBrand): Promise<StoreRecord[]> {
    const rows = app ? getStoresByApp(app as 'MART' | 'FOOD') : storeDirectory;
    return delay(rows);
  }

  async getStore(id: string): Promise<StoreRecord | undefined> {
    return delay(getStoreById(id));
  }

  async getStock(productId: string): Promise<StockRow | undefined> {
    return delay(getStockByProductId(productId));
  }

  async getReviews(productId: string): Promise<ReviewRow[]> {
    return delay(getReviewsByProductId(productId));
  }

  async getOrders(userId = 'user-1'): Promise<OrderRow[]> {
    return delay(getOrdersByUser(userId));
  }

  async getProfile(userId = 'user-1'): Promise<ProfileRow | undefined> {
    return delay(profileTable.find((p) => p.id === userId));
  }

  async getMembership(userId = 'user-1') {
    return delay(membershipTable.find((m) => m.userId === userId));
  }

  async getOrderStatus(userId = 'user-1') {
    return delay(orderStatusTable.filter((s) => s.userId === userId));
  }

  async getAccountNav(userId = 'user-1') {
    return delay(navTable.filter((n) => n.userId === userId));
  }

  async getDetails(userId = 'user-1') {
    return delay(detailsTable.find((d) => d.userId === userId));
  }

  /** Resolve the Home SDUI doc tree into rendered sections with joined data. */
  async getHomeFeed(): Promise<(SduiSection & { products: ProductView[] })[]> {
    const sections = homeSdui.map((section) => ({
      ...section,
      products: this.joinStock(getCatalogEntriesByIds(section.productIds)),
    }));
    return delay(sections);
  }
}

/** App-wide singleton gateway client. */
export const gateway = new GatewayClient();
