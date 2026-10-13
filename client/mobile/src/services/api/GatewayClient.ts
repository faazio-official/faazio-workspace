/**
 * The single gateway surface for the app. Joins the normalized microservice-shaped
 * tables (catalog / directory / reviews / inventory / checkout / accounts / home-sdui)
 * as served by the Go Chi modular monolith (`server/gateway`).
 *
 * Two modes:
 *  - REMOTE (default when `EXPO_PUBLIC_GATEWAY_URL` + `EXPO_PUBLIC_USE_GATEWAY=true`):
 *    real HTTP against the gateway. Every method falls back to the `@data/*` fixture on
 *    a network/HTTP error, so screens never regress during migration.
 *  - MOCK (default): in-memory `@data/*` fixtures (previous behaviour).
 *
 * See data/DATA_CONTROL.md, docs/architecture/data-layer-sdui.md,
 * docs/architecture/mvp-backend.md §3, docs/architecture/monolith-breakdown.md.
 */
import type { AppBrand } from '@data/types';
import { catalogIndex, getCatalogEntryById, getCatalogEntriesByIds, type CatalogEntry } from '@data/catalog/products';
import { storeDirectory, getStoreById, getStoresByApp, type StoreRecord } from '@data/directory/stores';
import { getReviewsByProductId, type ReviewRow } from '@data/reviews/reviews';
import { getStockByProductId, type StockRow } from '@data/inventory/stock';
import { getOrdersByUser, MOCK_USER_ID, type OrderRow } from '@data/checkout/orders';
import { profileTable, membershipTable, orderStatusTable, navTable, detailsTable, type ProfileRow, type MembershipRow, type OrderStatusRow, type NavRowGroup, type DetailsTable } from '@data/accounts/profile';
import { getReviewsByVendorId, type VendorReviewRow } from '@data/reviews/vendorReviews';
import { homeSdui, type SduiSection } from '@data/home/sdui';
import { loadSession } from '../secureSession';

/** Simulated network latency (ms) for mock mode. Drop to 0 to run pure in-memory. */
const LATENCY_MS = 40;

const GATEWAY_URL = (process.env.EXPO_PUBLIC_GATEWAY_URL ?? '').replace(/\/+$/, '');
const GATEWAY_FLAG = (process.env.EXPO_PUBLIC_USE_GATEWAY ?? '').toLowerCase();
const REMOTE_ENABLED = GATEWAY_URL.length > 0 && ['1', 'true', 'yes'].includes(GATEWAY_FLAG);

function delay<T>(value: T, ms = LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** A catalog entry joined with its live stock row. */
export interface ProductView extends CatalogEntry {
  stock: StockRow | undefined;
}

/** One auth-scoped cart line (inventory.carts). */
export interface CartItem {
  productId: string;
  qty: number;
}

/** The auth-scoped cart payload. */
export interface Cart {
  items: CartItem[];
}

/** Public vendor review (no user id / order ids — display fields only). */
export interface VendorReview {
  id: string;
  vendorId: string;
  app: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
}

/** Accepted `POST /events` vocabulary (server-enforced). */
export type TrackableEvent = 'view' | 'cart_add' | 'order' | 'search';

/** `POST /orders` request body. */
export interface PlaceOrderInput {
  items: CartItem[];
  addressId?: string;
  fulfillment?: 'DELIVERY' | 'PICKUP';
  idempotencyKey?: string;
}

export class GatewayClient {
  private accessToken: string | null = null;
  private tokenLoaded = false;

  /** True when the client will attempt real HTTP before falling back to fixtures. */
  get remoteEnabled(): boolean {
    return REMOTE_ENABLED;
  }

  private async authHeader(): Promise<Record<string, string>> {
    if (!this.tokenLoaded) {
      try {
        const session = await loadSession();
        this.accessToken = session?.accessToken ?? null;
      } catch {
        this.accessToken = null;
      }
      this.tokenLoaded = true;
    }
    return this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {};
  }

  private async http<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(await this.authHeader()), ...(init?.headers as Record<string, string> | undefined) };
    const res = await fetch(`${GATEWAY_URL}${path}`, { ...init, headers });
    if (!res.ok) throw new Error(`gateway ${res.status}`);
    return (await res.json()) as T;
  }

  /** Try the remote call; on any failure, use the local mock (keeps screens working). */
  private async withFallback<T>(remote: () => Promise<T>, mock: () => Promise<T>): Promise<T> {
    if (!REMOTE_ENABLED) return mock();
    try {
      return await remote();
    } catch {
      return mock();
    }
  }

  private joinStock(entries: CatalogEntry[]): ProductView[] {
    return entries.map((entry) => ({ ...entry, stock: getStockByProductId(entry.id) }));
  }

  /** Full-text search over the catalog (remote FTS, else Tantivy-style local mirror). */
  async searchProducts(query: string, app?: AppBrand): Promise<ProductView[]> {
    return this.withFallback(
      () => this.http<ProductView[]>(`/search?q=${encodeURIComponent(query)}${app ? `&app=${app}` : ''}`),
      () => this.searchProductsMock(query, app),
    );
  }

  private async searchProductsMock(query: string, app?: AppBrand): Promise<ProductView[]> {
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
    return this.withFallback(
      async () => {
        const { product } = await this.http<{ product: ProductView }>(`/product/${encodeURIComponent(id)}`);
        const reviews = await this.http<ReviewRow[]>(`/product/${encodeURIComponent(id)}/reviews`).catch(() => [] as ReviewRow[]);
        return { product, reviews };
      },
      () => this.getProductMock(id),
    );
  }

  private async getProductMock(id: string): Promise<{ product: ProductView; reviews: ReviewRow[] } | undefined> {
    const entry = getCatalogEntryById(id);
    if (!entry) return delay(undefined);
    return delay({ product: this.joinStock([entry])[0], reviews: getReviewsByProductId(id) });
  }

  async getProductsByIds(ids: string[]): Promise<ProductView[]> {
    return this.withFallback(
      () => this.http<ProductView[]>('/products/batch', { method: 'POST', body: JSON.stringify({ ids }) }),
      () => delay(this.joinStock(getCatalogEntriesByIds(ids))),
    );
  }

  async getStores(app?: AppBrand): Promise<StoreRecord[]> {
    return this.withFallback(
      () => this.http<StoreRecord[]>(`/stores${app ? `?app=${app}` : ''}`),
      () => delay(app ? getStoresByApp(app as 'MART' | 'FOOD') : storeDirectory),
    );
  }

  async getStore(id: string): Promise<StoreRecord | undefined> {
    return this.withFallback(
      () => this.http<StoreRecord>(`/store/${encodeURIComponent(id)}`),
      () => delay(getStoreById(id)),
    );
  }

  async getStock(productId: string): Promise<StockRow | undefined> {
    return this.withFallback(
      () => this.http<StockRow>(`/stock/${encodeURIComponent(productId)}`),
      () => delay(getStockByProductId(productId)),
    );
  }

  async getReviews(productId: string): Promise<ReviewRow[]> {
    return this.withFallback(
      () => this.http<ReviewRow[]>(`/product/${encodeURIComponent(productId)}/reviews`),
      () => delay(getReviewsByProductId(productId)),
    );
  }

  async getOrders(userId = 'user-1'): Promise<OrderRow[]> {
    return this.withFallback(
      () => this.http<OrderRow[]>('/orders'),
      () => delay(getOrdersByUser(userId)),
    );
  }

  async getProfile(userId = 'user-1'): Promise<ProfileRow | undefined> {
    return this.withFallback(
      () => this.http<ProfileRow>('/profile'),
      () => delay(profileTable.find((p) => p.id === userId)),
    );
  }

  async getMembership(userId = 'user-1'): Promise<MembershipRow | undefined> {
    return this.withFallback(
      () => this.http<MembershipRow>('/membership'),
      () => delay(membershipTable.find((m) => m.userId === userId)),
    );
  }

  async getOrderStatus(userId = 'user-1'): Promise<OrderStatusRow[]> {
    return this.withFallback(
      () => this.http<OrderStatusRow[]>('/order-status'),
      () => delay(orderStatusTable.filter((s) => s.userId === userId)),
    );
  }

  async getAccountNav(userId = 'user-1'): Promise<NavRowGroup[]> {
    return this.withFallback(
      () => this.http<NavRowGroup[]>('/account-nav'),
      () => delay(navTable.filter((n) => n.userId === userId)),
    );
  }

  async getDetails(userId = 'user-1'): Promise<DetailsTable | undefined> {
    return this.withFallback(
      () => this.http<DetailsTable>('/profile/details'),
      () => delay(detailsTable.find((d) => d.userId === userId)),
    );
  }

  /** Resolve the Home SDUI doc tree into rendered sections with joined data. */
  async getHomeFeed(): Promise<(SduiSection & { products: ProductView[] })[]> {
    return this.withFallback(
      () => this.http<(SduiSection & { products: ProductView[] })[]>('/sdui/home'),
      () => this.getHomeFeedMock(),
    );
  }

  private async getHomeFeedMock(): Promise<(SduiSection & { products: ProductView[] })[]> {
    const sections = homeSdui.map((section) => ({
      ...section,
      products: this.joinStock(getCatalogEntriesByIds(section.productIds)),
    }));
    return delay(sections);
  }

  /** Public vendor reviews (server projection hides user_id / order_ids). */
  async getVendorReviews(vendorId: string): Promise<VendorReview[]> {
    return this.withFallback(
      () => this.http<VendorReview[]>(`/vendors/${encodeURIComponent(vendorId)}/reviews`),
      () => delay(this.getVendorReviewsMock(vendorId)),
    );
  }

  private getVendorReviewsMock(vendorId: string): VendorReview[] {
    return getReviewsByVendorId(vendorId).map((r: VendorReviewRow) => ({
      id: r.id,
      vendorId: r.vendorId,
      app: r.app,
      userName: r.userName,
      rating: r.rating,
      comment: r.comment,
      date: r.date,
    }));
  }

  /**
   * Upsert the signed-in user's live rating for a vendor. The server re-checks the
   * derived purchase gate, so a false result means "not a verified buyer".
   * Mock fallback is a no-op (offline ratings are owned by vendorRatingStore).
   */
  async rateVendor(vendorId: string, rating: number, comment?: string): Promise<boolean> {
    return this.withFallback(
      () =>
        this.http<{ ok: boolean }>(`/vendors/${encodeURIComponent(vendorId)}/rating`, {
          method: 'PUT',
          body: JSON.stringify({ rating, comment: comment ?? '' }),
        }).then((r) => r.ok === true),
      () => delay(false),
    );
  }

  /** The auth-scoped cart (never edge-cached). */
  async getCart(): Promise<Cart> {
    return this.withFallback(
      () => this.http<Cart>('/cart'),
      () => delay({ items: [] as CartItem[] }),
    );
  }

  async addToCart(productId: string, qty = 1): Promise<Cart> {
    return this.withFallback(
      () => this.http<Cart>('/cart/items', { method: 'POST', body: JSON.stringify({ productId, qty }) }),
      () => delay({ items: [] as CartItem[] }),
    );
  }

  async updateCartItem(productId: string, qty: number): Promise<Cart> {
    return this.withFallback(
      () => this.http<Cart>('/cart/items', { method: 'PUT', body: JSON.stringify({ productId, qty }) }),
      () => delay({ items: [] as CartItem[] }),
    );
  }

  async removeCartItem(productId: string): Promise<Cart> {
    return this.withFallback(
      () => this.http<Cart>(`/cart/items/${encodeURIComponent(productId)}`, { method: 'DELETE' }),
      () => delay({ items: [] as CartItem[] }),
    );
  }

  /** Place an order (server decrements stock + holds an idempotency lock). */
  async placeOrder(input: PlaceOrderInput): Promise<OrderRow> {
    return this.withFallback(
      () => this.http<OrderRow>('/orders', { method: 'POST', body: JSON.stringify(input) }),
      () => delay(this.placeOrderMock(input)),
    );
  }

  private placeOrderMock(input: PlaceOrderInput): OrderRow {
    const entries = getCatalogEntriesByIds(input.items.map((i) => i.productId));
    const lineItems = input.items.map((it, idx) => {
      const entry = entries.find((e) => e.id === it.productId);
      return {
        lineId: `local-${idx + 1}`,
        productId: it.productId,
        name: entry?.name ?? it.productId,
        qty: it.qty,
        unitPrice: entry?.price ?? 0,
      };
    });
    const id = `ORD-LOCAL-${Date.now()}`;
    return {
      id,
      orderNumber: `#${id}`,
      userId: MOCK_USER_ID,
      addressId: input.addressId ?? '',
      placedAt: new Date().toISOString(),
      status: 'Processing',
      lineItems,
      fulfillment: input.fulfillment,
      vendorStoreIds: [],
    };
  }

  /** Fire-and-forget behavior event (ID-only; mock fallback is a silent no-op). */
  async trackEvent(productId: string, event: TrackableEvent = 'view'): Promise<void> {
    await this.withFallback(
      () =>
        this.http<{ ok: boolean }>('/events', { method: 'POST', body: JSON.stringify({ productId, event }) }).then(
          () => undefined,
        ),
      () => delay(undefined),
    );
  }
}

/** App-wide singleton gateway client. */
export const gateway = new GatewayClient();