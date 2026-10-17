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
import type { AppBrand, PickupPoint, SavedAddress, UserDetailsData } from '@data/types';
import { catalogIndex, getCatalogEntryById, getCatalogEntriesByIds, getCatalogEntriesByStore, type CatalogEntry } from '@data/catalog/products';
import { storeDirectory, getStoreById, getStoresByApp, type StoreRecord } from '@data/directory/stores';
import { NEUTRAL_PICKUP } from '@data/cart/pickup-resolver';
import { coupons as fixtureCoupons } from '@data/cart/coupons';
import { diningVenues } from '@data/food/diningVenues';
import { menuForVenueName } from '@data/food/menus';
import { getReviewsByProductId, type ReviewRow } from '@data/reviews/reviews';
import { getStockByProductId, type StockRow } from '@data/inventory/stock';
import { getOrdersByUser, MOCK_USER_ID, type OrderRow } from '@data/checkout/orders';
import { profileTable, membershipTable, orderStatusTable, navTable, detailsTable, type ProfileRow, type MembershipRow, type OrderStatusRow, type NavRowGroup, type DetailsTable } from '@data/accounts/profile';
import { getReviewsByVendorId, type VendorReviewRow } from '@data/reviews/vendorReviews';
import { homeSdui, type SduiSection } from '@data/home/sdui';
import { seedFavorites } from '@data/home/seeds';
import { savedAddresses } from '@data/account/addresses';
import { loadSession } from '../secureSession';

/** Simulated network latency (ms) for mock mode. Drop to 0 to run pure in-memory. */
const LATENCY_MS = 40;

const GATEWAY_URL = (process.env.EXPO_PUBLIC_GATEWAY_URL ?? '').replace(/\/+$/, '');
const GATEWAY_FLAG = (process.env.EXPO_PUBLIC_USE_GATEWAY ?? '').toLowerCase();
const REMOTE_ENABLED = GATEWAY_URL.length > 0 && ['1', 'true', 'yes'].includes(GATEWAY_FLAG);
/**
 * Strict mode (`EXPO_PUBLIC_STRICT=true`): money/Rx/address WRITES never silently fall back to a
 * local mock. A failed remote write surfaces as an error instead of a fake local success — the
 * safety net that keeps reads working during migration must never fabricate a payment or a script.
 */
const STRICT_FLAG = ['1', 'true', 'yes'].includes((process.env.EXPO_PUBLIC_STRICT ?? '').toLowerCase());
const REMOTE_STRICT = REMOTE_ENABLED && STRICT_FLAG;

function delay<T>(value: T, ms = LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** Fixed per-seat booking platform fee shown in the UI (server authoritatively derives ₹50/seat). */
const BOOKING_FEE_PER_SEAT = 50;

/** Client-side idempotency key so a retried POST /bookings never double-holds. */
function bookingIdempotencyKey(): string {
  return `bkg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Build a `?a=b&c=d` string from defined, non-empty filter values. */
function queryString(params?: Record<string, string | undefined>): string {
  if (!params) return '';
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`);
  return parts.length ? `?${parts.join('&')}` : '';
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

/** Server-maintained vendor rating aggregate (reviews.vendor_summary). */
export interface VendorReviewSummary {
  average: number;
  count: number;
  /** Counts for 1..5 stars, index 0 = 1 star. */
  distribution: number[];
}

/** Accepted `POST /events` vocabulary (server-enforced). */
export type TrackableEvent = 'view' | 'cart_add' | 'order' | 'search';

/** `POST /orders` request body. */
export interface PlaceOrderInput {
  items: CartItem[];
  addressId?: string;
  fulfillment?: 'DELIVERY' | 'PICKUP';
  idempotencyKey?: string;
  /** Self-pickup snapshot (single) persisted on the order. */
  pickup?: { name: string; address: string };
  /** Multi-vendor self-pickup snapshot persisted on the order. */
  pickups?: { name: string; address: string; hours?: string; phone?: string }[];
  paymentMethod?: string;
  coinsRedeemed?: number;
  /** Coupon code the server re-validates + settles (the client figure is display-only). */
  couponCode?: string;
  /** Buyer state for state-scoped coupon validation. */
  stateCode?: string;
  /** Last-clicked sponsored slot for closed-loop ads attribution (best-effort). */
  attribution?: { slotId?: string };
}

/** Server-authoritative coupon ruling (`POST /checkout/validate-coupon`); money in whole rupees. */
export interface CouponValidation {
  valid: boolean;
  /** Machine reason when invalid: not_found | inactive | expired | wrong_sector | wrong_state | min_order. */
  reason: string;
  code: string;
  valuePercent: number;
  maxDiscount: number;
  minOrder: number;
  /** Server-computed discount in whole rupees (capped); 0 for free-delivery-only coupons. */
  discount: number;
  freeDelivery: boolean;
}

/** A LIVE sponsored product joined to the catalog, carrying its slot id for event attribution. */
export interface SponsoredProduct extends ProductView {
  slotId: string;
}

/** One durable payment row (checkout.payments), amount in whole rupees. */
export interface PaymentRecord {
  id: string;
  orderId: string;
  userId: string;
  method: string;
  amount: number;
  coinsRedeemed: number;
  status: string;
  createdAt: string;
}

/** Server-authoritative rewards view (GET /rewards) — the client reconciles against this. */
export interface RewardsView {
  coins: number;
  streak: number;
  lastOrderDay?: string | null;
  card?: { id: string; percent: number; grantedAt: string; expiresAt: string } | null;
  ledger: {
    id: string;
    type: 'EARN' | 'REDEEM' | 'EXPIRE' | 'STREAK';
    coins: number;
    rupees: number;
    orderId?: string;
    at: string;
  }[];
}

/** One venue menu dish (directory.menus). Display fields mirror the Food SpecialDish card. */
export interface MenuDish {
  id: string;
  name: string;
  price: number;
  /** List price (MRP) in whole rupees; present only when authored (discount = mrp > price). */
  mrp?: number;
  isVeg?: boolean;
  cuisine?: string;
  rating?: number;
  image?: string;
  description?: string;
  emoji?: string;
  deliveryTime?: string;
}

/** One dining venue (directory.dining_venues) as served by `GET /venues`. */
export interface Venue {
  id: string;
  app: string;
  name: string;
  rating?: number;
  coverImage: string;
  categories: string[];
  /** PII — only present on an authenticated read. */
  address?: string;
  /** PII — only present on an authenticated read. */
  phone?: string;
  hours?: string;
}

/** One anon-visible active coupon (`GET /coupons`); money in whole rupees. */
export interface PublicCoupon {
  code: string;
  title?: string;
  valuePercent: number;
  maxDiscount: number;
  minOrder: number;
  freeDelivery: boolean;
  validTill: string;
}

/**
 * One anon-visible LIVE sponsored ad (`GET /ads/live?slot=`). Display fields only — the
 * app joins `productId` to the catalog; performance counters stay control-plane.
 */
export interface LiveAd {
  slotId: string;
  sellerId: string;
  productId: string;
  placement: string;
}

/**
 * One anon-visible LIVE hero campaign (`GET /ads/hero?placement=&app=&category=&storeId=`). Display
 * fields only: the poster `imageUrl` plus the deep-link target (`targetType`/`targetId`/`targetApp`).
 * `placementId` keys impressions/clicks (same event pipeline as the rail `slotId`).
 */
export interface HeroAd {
  placementId: string;
  campaignId: string;
  sellerId: string;
  placement: string;
  targetType: 'PRODUCT' | 'DISH' | 'STORE' | 'VENUE';
  targetId: string;
  targetApp: AppBrand;
  category?: string;
  storeId?: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  cta?: string;
}

/**
 * One anon-visible active festival discount (`GET /promo/active-discounts`). It is the shopper
 * price authority's read side: the app keeps base catalog prices pure and overlays this. The
 * discount is already approved + LIVE + sector-capped server-side; the client only derives the
 * effective price. Never fabricated offline (fallback is empty).
 */
export interface ActiveDiscount {
  productId: string;
  campaignId: string;
  discountPercent: number;
}

/** Lightweight owner-scoped order status (GET /orders/tracking/{id}) for the tracking poll. */
export interface OrderTrackingView {
  id: string;
  status: string;
  statusDate?: string;
  placedAt: string;
}

/** One notifications.outbox row (user-facing copy only). */
export interface NotificationRecord {
  id: string;
  kind: string;
  title: string;
  body: string;
  status: string;
  createdAt: string;
  sentAt?: string;
  data?: unknown;
}

/** One seller quote line (pharma.quote_items); money in whole rupees. */
export interface PrescriptionQuoteItem {
  id?: string;
  name: string;
  qty: number;
  mrp: number;
  price: number;
  discount: number;
}

/** One status-history transition (pharma.status_history). */
export interface PrescriptionHistoryEntry {
  fromStatus?: string;
  toStatus: string;
  actorId: string;
  actorRole: string;
  createdAt: string;
}

/** A durable prescription (pharma.prescriptions); imagePaths are Storage object keys. */
export interface PrescriptionRecord {
  id: string;
  userId: string;
  vendorId?: string;
  fulfillment?: 'DELIVERY' | 'PICKUP';
  pages: number;
  note?: string;
  imagePaths: string[];
  status: string;
  /** Seller quote + server-derived total (whole rupees); present once quoted. */
  quote?: PrescriptionQuoteItem[];
  quotedTotal?: number;
  revealedAt?: string;
  history?: PrescriptionHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

/** Body for POST /sellers — a partner onboarding application (sellers.sellers). */
export interface SellerApplicationInput {
  businessName: string;
  ownerName: string;
  /** app_brand enum (MART | FOOD | PHARMA). */
  category: AppBrand;
  gstin?: string;
  pan?: string;
  businessAddress?: string;
  contactPhone?: string;
  /** 2-letter state code (sellers.sellers.state_code). */
  stateCode: string;
}

/** A sellers.sellers row (server creates it PENDING_REVIEW; contactPhone is PII). */
export interface SellerApplication {
  sellerId: string;
  businessName: string;
  ownerName: string;
  category: string;
  gstin: string;
  pan: string;
  businessAddress: string;
  contactPhone?: string;
  stateCode: string;
  status: string;
  rating: number;
  createdAt: string;
}

/** Body for POST /prescriptions. */
export interface PrescriptionInput {
  vendorId?: string;
  fulfillment?: 'DELIVERY' | 'PICKUP';
  pages?: number;
  note?: string;
  /** Storage object keys (never URLs) — mint with uploadPrescriptionImage. */
  imagePaths?: string[];
  /** Delivery address id for a DELIVERY Rx (revealed to the seller only after READY). */
  addressId?: string;
}

/** A blood.donors row / blood.donor_directory projection. */
export interface BloodDonorProfile {
  userId: string;
  name: string;
  bloodGroup: string;
  ageRange?: string;
  weightKg?: number;
  city: string;
  willingToTravel: boolean;
  donationType?: string;
  notif?: Record<string, boolean>;
  available: boolean;
  consent: boolean;
}

/** A blood.requests row (contact/address omitted for anon). */
export interface BloodRequestRecord {
  id: string;
  hospital: string;
  city: string;
  state: string;
  bloodGroup: string;
  unitsRequired: number;
  patientContext: string;
  neededWithin: string;
  verified: boolean;
  urgency: string;
  contact?: string;
  address?: string;
  remarks?: string;
  postedAt: string;
  postedHoursAgo: number;
  expiresAt?: string;
}

/** A blood.match_requests row. */
export interface DonorMatchRecord {
  id: string;
  requesterUserId: string;
  donorUserId: string;
  bloodGroup: string;
  city: string;
  status: string;
  createdAt: string;
}

/** A bookings.tables row (seat reservation). `fee` is whole rupees, `amountPaisa` for Razorpay. */
export interface BookingRecordDto {
  id: string;
  userId: string;
  vendorId: string;
  restaurantName: string;
  date: string;
  time?: string;
  seats: number;
  fee: number;
  status: string;
  paymentStatus?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  amountPaisa?: number;
  paymentKeyId?: string;
  currency?: string;
  createdAt: string;
  /** Legacy alias for `seats` (server mirrors it). */
  guests?: number;
}

/** Public, seat-count-free availability projection (never totals/remaining seats). */
export interface BookingAvailabilityDto {
  vendorId: string;
  bookable: boolean;
  feePerSeat: number;
  timingLabel?: string;
  openNow: boolean;
}

/** A checkout.addresses row as served by `GET /profile/addresses` (delivery PII, auth-scoped). */
interface AddressRecord {
  addressId: string;
  label?: string;
  name?: string;
  phone?: string;
  address: string;
  isDefault: boolean;
}

/** Map a server address row onto the app's `SavedAddress` card shape (label → tag). */
function toSavedAddress(a: AddressRecord): SavedAddress {
  const tag = a.label === 'HOME' || a.label === 'WORK' ? a.label : 'OTHER';
  return { id: a.addressId, tag, isDefault: a.isDefault, name: a.name ?? '', phone: a.phone ?? '', address: a.address };
}

export class GatewayClient {
  private accessToken: string | null = null;
  private tokenLoaded = false;
  /** In-memory favourites shelf for mock mode (mirrors the durable favourites.items table). */
  private mockFavourites: string[] = [...seedFavorites];

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

  /**
   * The strict variant for money/Rx/address WRITES. In strict mode the remote error propagates
   * (no fake local success); otherwise it behaves exactly like `withFallback`.
   */
  private async withStrict<T>(remote: () => Promise<T>, mock: () => Promise<T>): Promise<T> {
    if (REMOTE_STRICT) return remote();
    return this.withFallback(remote, mock);
  }

  /** True when money/Rx/address writes fail loudly instead of using the local mock. */
  get strictWritesEnabled(): boolean {
    return REMOTE_STRICT;
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

  /** Fetch one catalog entry with stock and reviews. Price/stock are money-critical → strict. */
  async getProduct(id: string): Promise<{ product: ProductView; reviews: ReviewRow[] } | undefined> {
    return this.withStrict(
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

  /** Batch catalog read (used by deals/home price overlays). Strict — prices are never fabricated. */
  async getProductsByIds(ids: string[]): Promise<ProductView[]> {
    return this.withStrict(
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

  /**
   * A store's ACTIVE catalog rows (vendor drill-in; mirrors `catalog.products` filtered by
   * `store_id` + `status = 'ACTIVE'`). Server is the origin; the local mock filters `catalogIndex`
   * by `storeId` so the drill-in never regresses offline. The server caps a page at 100.
   */
  async getStoreProducts(storeId: string, cursor?: string): Promise<ProductView[]> {
    return this.withFallback(
      () =>
        this.http<ProductView[]>(
          `/stores/${encodeURIComponent(storeId)}/products${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
        ),
      () => delay(this.joinStock(getCatalogEntriesByStore(storeId, 'MART'))),
    );
  }

  /** Dining venues (durable directory.dining_venues; falls back to the @data identity table). */
  async getVenues(app?: string): Promise<Venue[]> {
    return this.withFallback(
      () => this.http<Venue[]>(`/venues${app ? `?app=${app}` : ''}`),
      () =>
        delay(
          diningVenues.map((v) => ({
            id: v.id,
            app: 'FOOD',
            name: v.name,
            coverImage: '',
            categories: [],
          })),
        ),
    );
  }

  /** Live stock for a product. Strict — availability/price must not be faked offline. */
  /** One dining venue by id (single read). Mirrors the @data identity table offline. */
  async getVenue(id: string): Promise<Venue | undefined> {
    return this.withFallback(
      () => this.http<Venue>(`/venues/${encodeURIComponent(id)}`),
      () => {
        const v = diningVenues.find((x) => x.id === id);
        return delay(v ? { id: v.id, app: 'FOOD', name: v.name, coverImage: '', categories: [] } : undefined);
      },
    );
  }

  async getStock(productId: string): Promise<StockRow | undefined> {
    return this.withStrict(
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

  /**
   * Lightweight status poll for one of the caller's own orders (GET /orders/tracking/{id}) — no line
   * items/PII. Used to watch a delivery without refetching the full orders list. Strict, so a status
   * is never fabricated offline.
   */
  async getOrderTracking(orderId: string): Promise<OrderTrackingView | undefined> {
    return this.withStrict(
      () => this.http<OrderTrackingView>(`/orders/tracking/${encodeURIComponent(orderId)}`),
      () => delay(undefined),
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
      async () => {
        // The server stores the payload as a nested blob ({ userId, accountId, data }); flatten it
        // to the app's `DetailsTable` row so the screen can read personalInfo/preferences directly.
        const d = await this.http<{ userId: string; accountId?: string; data: UserDetailsData }>('/profile/details');
        return { ...d.data, accountId: d.accountId ?? d.data?.accountId ?? '', userId: d.userId };
      },
      () => delay(detailsTable.find((d) => d.userId === userId)),
    );
  }

  /** The caller's saved delivery addresses (auth-scoped; falls back to the @data fixtures). */
  async getAddresses(): Promise<SavedAddress[]> {
    return this.withFallback(
      () => this.http<AddressRecord[]>('/profile/addresses').then((rows) => rows.map(toSavedAddress)),
      () => delay([...savedAddresses]),
    );
  }

  /**
   * Upsert the caller's saved address (PUT /profile/addresses; server-enforced ownership). An
   * empty `id` creates a new address (the server mints the id); a non-empty id updates it. Mock
   * fallback is a no-op echo so the screen still confirms offline.
   */
  async saveAddress(addr: SavedAddress): Promise<SavedAddress> {
    const body = {
      addressId: addr.id,
      label: addr.tag,
      name: addr.name,
      phone: addr.phone,
      address: addr.address,
      isDefault: !!addr.isDefault,
    };
    return this.withStrict(
      () =>
        this.http<AddressRecord>('/profile/addresses', { method: 'PUT', body: JSON.stringify(body) }).then(
          toSavedAddress,
        ),
      () => delay(addr),
    );
  }

  /** Remove one of the caller's saved addresses (DELETE /profile/addresses/{id}). */
  async deleteAddress(id: string): Promise<void> {
    await this.withFallback(
      () =>
        this.http<{ ok: boolean }>(`/profile/addresses/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(
          () => undefined,
        ),
      () => delay(undefined),
    );
  }

  /** Durable favourites shelf (auth-scoped, never edge-cached). */
  async getFavourites(): Promise<string[]> {
    return this.withFallback(
      () => this.http<{ items: string[] }>('/favourites').then((r) => r.items ?? []),
      () => delay([...this.mockFavourites]),
    );
  }

  async addFavourite(productId: string): Promise<string[]> {
    return this.withFallback(
      () => this.http<{ items: string[] }>(`/favourites/${encodeURIComponent(productId)}`, { method: 'PUT' }).then((r) => r.items ?? []),
      () =>
        delay(
          this.mockFavourites.includes(productId)
            ? [...this.mockFavourites]
            : [...this.mockFavourites, productId],
        ),
    );
  }

  async removeFavourite(productId: string): Promise<string[]> {
    return this.withFallback(
      () => this.http<{ items: string[] }>(`/favourites/${encodeURIComponent(productId)}`, { method: 'DELETE' }).then((r) => r.items ?? []),
      () => delay((this.mockFavourites = this.mockFavourites.filter((id) => id !== productId))),
    );
  }

  /** Server-authoritative rewards (coins / streak / card / ledger) — client reconciles on read. */
  async getRewards(): Promise<RewardsView> {
    return this.withFallback(
      () => this.http<RewardsView>('/rewards'),
      () => delay({ coins: 0, streak: 0, lastOrderDay: null, card: null, ledger: [] }),
    );
  }

  /** The caller's notification inbox (newest first); mock fallback is empty. */
  async getNotifications(): Promise<NotificationRecord[]> {
    return this.withFallback(
      () => this.http<NotificationRecord[]>('/notifications'),
      () => delay([] as NotificationRecord[]),
    );
  }

  /**
   * Active, unexpired coupons visible to an app (public, anon, cached). Strict: the server is the
   * authority for which coupons exist and their terms — a discount is never fabricated offline.
   */
  async getCoupons(app?: AppBrand): Promise<PublicCoupon[]> {
    return this.withStrict(
      () => this.http<PublicCoupon[]>(`/coupons${app ? `?app=${app}` : ''}`),
      () =>
        delay(
          fixtureCoupons.map((c) => ({
            code: c.code,
            title: c.label,
            valuePercent: c.discountPercent,
            maxDiscount: 0,
            minOrder: c.minOrder ?? 0,
            freeDelivery: !!c.isFreeDelivery,
            validTill: '',
          })),
        ),
    );
  }

  /**
   * LIVE sponsored ads for a placement (public, anon, cached 600 s server-side). Paid placements
   * are **never** fabricated offline: the fallback is an empty list, so the rail collapses rather
   * than faking a sponsored disclosure.
   */
  async getLiveAds(placement?: string): Promise<LiveAd[]> {
    return this.withFallback(
      () => this.http<LiveAd[]>(`/ads/live${queryString({ slot: placement })}`),
      () => delay([] as LiveAd[]),
    );
  }

  /**
   * LIVE sponsored products for a placement, joined to the catalog. `LiveAd`s are ID-only (SDUI
   * rule): resolve each `productId` via `getProductsByIds` and drop any id the catalog no longer
   * has, preserving ad order. Empty when there are no LIVE rows. Each row keeps its `slotId` so the
   * rail can report impressions/clicks.
   */
  async getSponsoredProducts(placement?: string): Promise<SponsoredProduct[]> {
    const ads = await this.getLiveAds(placement);
    const ids = ads.map((a) => a.productId);
    if (ids.length === 0) return [];
    const products = await this.getProductsByIds(ids);
    const byId = new Map(products.map((p) => [p.id, p]));
    const out: SponsoredProduct[] = [];
    for (const a of ads) {
      const p = byId.get(a.productId);
      if (p) out.push({ ...p, slotId: a.slotId });
    }
    return out;
  }

  /**
   * LIVE hero campaigns for a placement context (`GET /ads/hero`). Paid placements are **never**
   * fabricated offline: the fallback is an empty list, so a hero collapses rather than faking a
   * sponsored disclosure (same contract as `getLiveAds`).
   */
  async getHeroAds(
    placement?: string,
    ctx: { app?: string; category?: string; storeId?: string } = {},
  ): Promise<HeroAd[]> {
    return this.withFallback(
      () =>
        this.http<HeroAd[]>(
          `/ads/hero${queryString({
            placement,
            app: ctx.app,
            category: ctx.category,
            storeId: ctx.storeId,
          })}`,
        ),
      () => delay([] as HeroAd[]),
    );
  }

  /**
   * Report a sponsored impression/click (`POST /ads/events`). Best-effort: the server de-dupes
   * impressions per (user, slot), and any failure is swallowed so rendering never blocks.
   */
  async recordAdEvent(slotId: string, event: 'impression' | 'click'): Promise<void> {
    if (!slotId) return;
    await this.withFallback(
      () =>
        this.http<{ ok: boolean }>('/ads/events', {
          method: 'POST',
          body: JSON.stringify({ slotId, event }),
        }).then(() => undefined),
      () => delay(undefined),
    );
  }

  /**
   * Report an abusive hero ad (`POST /ads/campaigns/{id}/report`). Best-effort and de-duped per
   * (user, placement) server-side; a failure is swallowed so the tap never blocks. A human admin
   * performs the takedown — this only raises the flag.
   */
  async reportHeroAd(placementId: string): Promise<void> {
    if (!placementId) return;
    await this.withFallback(
      () =>
        this.http<{ ok: boolean }>(`/ads/campaigns/${encodeURIComponent(placementId)}/report`, {
          method: 'POST',
        }).then(() => undefined),
      () => delay(undefined),
    );
  }

  /**
   * Server-authoritative coupon ruling for a cart (`POST /checkout/validate-coupon`, auth-scoped).
   * Strict — a coupon discount is money and is never fabricated from a local fixture.
   */
  async validateCoupon(input: {
    code: string;
    app?: string;
    state?: string;
    subtotal: number;
  }): Promise<CouponValidation> {
    return this.withStrict(
      () =>
        this.http<CouponValidation>('/checkout/validate-coupon', {
          method: 'POST',
          body: JSON.stringify(input),
        }),
      () => delay(this.validateCouponMock(input)),
    );
  }

  private validateCouponMock(input: {
    code: string;
    subtotal: number;
  }): CouponValidation {
    const code = input.code.toUpperCase().trim();
    const empty: CouponValidation = {
      valid: false,
      reason: 'not_found',
      code,
      valuePercent: 0,
      maxDiscount: 0,
      minOrder: 0,
      discount: 0,
      freeDelivery: false,
    };
    const c = fixtureCoupons.find((x) => x.code === code);
    if (!c) return empty;
    if (c.minOrder && input.subtotal < c.minOrder) {
      return { ...empty, reason: 'min_order', minOrder: c.minOrder };
    }
    const discount = c.isFreeDelivery ? 0 : Math.round((input.subtotal * c.discountPercent) / 100);
    return {
      valid: true,
      reason: '',
      code,
      valuePercent: c.discountPercent,
      maxDiscount: 0,
      minOrder: c.minOrder ?? 0,
      discount,
      freeDelivery: !!c.isFreeDelivery,
    };
  }

  /**
   * Active festival discounts for a batch of products (public, anon, cached per product). The
   * server only returns approved + LIVE + sector-capped discounts, so the client never invents one.
   * Fallback is empty — a discount is never fabricated offline.
   */
  async getActiveDiscounts(productIds: string[]): Promise<ActiveDiscount[]> {
    if (productIds.length === 0) return [];
    const ids = productIds.slice(0, 200).join(',');
    return this.withFallback(
      () => this.http<ActiveDiscount[]>(`/promo/active-discounts?ids=${encodeURIComponent(ids)}`),
      () => delay([] as ActiveDiscount[]),
    );
  }

  /** A venue's dishes (durable directory.menus). Strict — menu prices are money-critical. */
  async getMenu(venueId: string): Promise<MenuDish[]> {
    return this.withStrict(
      () => this.http<MenuDish[]>(`/venues/${encodeURIComponent(venueId)}/menu`),
      () => {
        const venue = getStoreById(venueId) ?? diningVenues.find((v) => v.id === venueId);
        const dishes = venue ? menuForVenueName(venue.name) : [];
        return delay(
          dishes.map((d) => ({
            id: d.id,
            name: d.dishName,
            price: d.price,
            mrp: d.mrp,
            isVeg: d.isVeg,
            cuisine: d.cuisine,
            rating: d.rating,
            image: d.image,
            description: d.description,
            deliveryTime: d.deliveryTime,
          })),
        );
      },
    );
  }

  /**
   * Upload one Rx photo to the private `prescriptions` bucket via a signed upload URL, returning the
   * Storage object key (never a URL). Returns null in mock mode or on any failure so the caller can
   * still create the Rx with whatever keys succeeded. The key/bytes are never logged.
   */
  async uploadPrescriptionImage(uri: string): Promise<string | null> {
    if (!REMOTE_ENABLED) return null;
    try {
      const { objectPath, uploadUrl } = await this.http<{ objectPath: string; uploadUrl: string }>(
        '/prescriptions/upload-url',
        { method: 'POST' },
      );
      const blob = await (await fetch(uri)).blob();
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: blob,
      });
      if (!res.ok) return null;
      return objectPath;
    } catch {
      return null;
    }
  }

  /** Create a durable prescription (images are Storage object keys, never bytes/URLs). */
  async createPrescription(input: PrescriptionInput): Promise<PrescriptionRecord> {
    return this.withStrict(
      () =>
        this.http<PrescriptionRecord>('/prescriptions', {
          method: 'POST',
          body: JSON.stringify(input),
        }),
      () =>
        delay({
          id: `RX-LOCAL-${Date.now()}`,
          userId: MOCK_USER_ID,
          vendorId: input.vendorId,
          fulfillment: input.fulfillment,
          pages: input.pages ?? 1,
          note: input.note,
          imagePaths: input.imagePaths ?? [],
          status: 'RECEIVED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
    );
  }

  /** The signed-in user's durable prescriptions. */
  async getPrescriptions(): Promise<PrescriptionRecord[]> {
    return this.withFallback(
      () => this.http<{ items: PrescriptionRecord[] }>('/prescriptions').then((r) => r.items ?? []),
      () => delay([] as PrescriptionRecord[]),
    );
  }

  /** One of the signed-in user's own prescriptions (owner-scoped; undefined off-server). */
  async getPrescription(id: string): Promise<PrescriptionRecord | undefined> {
    return this.withFallback(
      () => this.http<PrescriptionRecord>(`/prescriptions/${encodeURIComponent(id)}`),
      () => delay(undefined),
    );
  }

  /** The caller's own donor profile, or null if not registered. */
  async getDonorProfile(): Promise<BloodDonorProfile | null> {
    return this.withFallback(
      () => this.http<BloodDonorProfile | null>('/donors/me'),
      () => delay(null),
    );
  }

  /** Upsert the caller's donor profile (consent gates the public directory). */
  async saveDonorProfile(profile: Partial<BloodDonorProfile> & { bloodGroup: string; name: string; city: string }): Promise<BloodDonorProfile> {
    return this.withFallback(
      () => this.http<BloodDonorProfile>('/donors/me', { method: 'PUT', body: JSON.stringify(profile) }),
      () => delay({ userId: MOCK_USER_ID, willingToTravel: false, available: true, consent: true, ...profile } as BloodDonorProfile),
    );
  }

  /** The consented donor directory, filtered by blood group / city when provided. */
  async getBloodDonors(filters?: { bloodGroup?: string; city?: string }): Promise<BloodDonorProfile[]> {
    return this.withFallback(
      () => this.http<BloodDonorProfile[]>(`/donors${queryString(filters)}`),
      () => delay([] as BloodDonorProfile[]),
    );
  }

  /** The public blood-request board (contact/address hidden for anon callers). */
  async getBloodRequests(filters?: { bloodGroup?: string; city?: string }): Promise<BloodRequestRecord[]> {
    return this.withFallback(
      () => this.http<BloodRequestRecord[]>(`/blood-requests${queryString(filters)}`),
      () => delay([] as BloodRequestRecord[]),
    );
  }

  /** Post a blood request. */
  async createBloodRequest(input: Partial<BloodRequestRecord> & { bloodGroup: string }): Promise<BloodRequestRecord> {
    return this.withFallback(
      () => this.http<BloodRequestRecord>('/blood-requests', { method: 'POST', body: JSON.stringify(input) }),
      () =>
        delay({
          id: `br-local-${Date.now()}`,
          hospital: '', city: '', state: '', unitsRequired: 1,
          patientContext: '', neededWithin: '', verified: false, urgency: 'normal',
          postedAt: new Date().toISOString(), postedHoursAgo: 0,
          ...input,
        } as BloodRequestRecord),
    );
  }

  /** Mark interest / acceptance on a blood request (idempotent). */
  async setBloodInterest(requestId: string, kind: 'interested' | 'accepted'): Promise<void> {
    await this.withFallback(
      () => this.http<{ ok: boolean }>(`/blood-requests/${encodeURIComponent(requestId)}/interest`, { method: 'PUT', body: JSON.stringify({ kind }) }).then(() => undefined),
      () => delay(undefined),
    );
  }

  /** Send a targeted request to one matching donor. */
  async createDonorMatch(donorUserId: string, bloodGroup: string, city: string): Promise<DonorMatchRecord> {
    return this.withFallback(
      () => this.http<DonorMatchRecord>('/donor-match-requests', { method: 'POST', body: JSON.stringify({ donorUserId, bloodGroup, city }) }),
      () => delay({ id: `dmr-local-${Date.now()}`, requesterUserId: MOCK_USER_ID, donorUserId, bloodGroup, city, status: 'pending', createdAt: new Date().toISOString() }),
    );
  }

  /** The caller's outgoing donor-match requests. */
  async getDonorMatches(): Promise<DonorMatchRecord[]> {
    return this.withFallback(
      () => this.http<DonorMatchRecord[]>('/donor-match-requests'),
      () => delay([] as DonorMatchRecord[]),
    );
  }

  /** Public booking availability for a venue (bookable / ₹ per seat / timing only). */
  async getBookingAvailability(venueId: string): Promise<BookingAvailabilityDto> {
    return this.withFallback(
      () => this.http<BookingAvailabilityDto>(`/venues/${encodeURIComponent(venueId)}/booking-availability`),
      () =>
        delay({
          vendorId: venueId,
          bookable: true,
          feePerSeat: BOOKING_FEE_PER_SEAT,
          timingLabel: '09:00 – 21:00',
          openNow: true,
        } as BookingAvailabilityDto),
    );
  }

  /** The caller's table reservations. */
  async getBookings(): Promise<BookingRecordDto[]> {
    return this.withFallback(
      () => this.http<BookingRecordDto[]>('/bookings'),
      () => delay([] as BookingRecordDto[]),
    );
  }

  /**
   * Create a seat reservation hold. The server derives the ₹50/seat fee (the client never sets an
   * amount) and returns a Razorpay order for checkout. `idempotencyKey` makes a retry a no-op.
   */
  async createBooking(input: {
    vendorId: string;
    restaurantName?: string;
    date: string;
    time?: string;
    seats: number;
    idempotencyKey?: string;
  }): Promise<BookingRecordDto> {
    const body = JSON.stringify({ ...input, idempotencyKey: input.idempotencyKey ?? bookingIdempotencyKey() });
    return this.withFallback(
      () => this.http<BookingRecordDto>('/bookings', { method: 'POST', body }),
      () =>
        delay({
          id: `BKG-LOCAL-${Date.now()}`,
          userId: MOCK_USER_ID,
          vendorId: input.vendorId,
          restaurantName: input.restaurantName ?? '',
          date: input.date,
          seats: input.seats,
          fee: input.seats * BOOKING_FEE_PER_SEAT,
          status: 'pending',
          paymentStatus: 'CREATED',
          createdAt: new Date().toISOString(),
        }),
    );
  }

  /** Attach the Razorpay payment id returned by the client checkout (marks it authorized server-side). */
  async attachBookingPayment(id: string, razorpayPaymentId: string): Promise<BookingRecordDto> {
    return this.withFallback(
      () =>
        this.http<BookingRecordDto>(`/bookings/${encodeURIComponent(id)}/payment`, {
          method: 'POST',
          body: JSON.stringify({ razorpayPaymentId }),
        }),
      () =>
        delay({
          id,
          userId: MOCK_USER_ID,
          vendorId: '',
          restaurantName: '',
          date: '',
          seats: 0,
          fee: 0,
          status: 'pending',
          paymentStatus: 'AUTHORIZED',
          razorpayPaymentId,
          createdAt: new Date().toISOString(),
        }),
    );
  }

  /** Cancel a table reservation (own rows only; server refunds the held fee). */
  async cancelBooking(id: string): Promise<void> {
    await this.withFallback(
      () => this.http<{ ok: boolean }>(`/bookings/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(() => undefined),
      () => delay(undefined),
    );
  }

  /** Resolve the Home SDUI doc tree into rendered sections with joined data. */
  async getHomeFeed(): Promise<(SduiSection & { products: ProductView[]; stores?: StoreRecord[] })[]> {
    return this.withFallback(
      () => this.http<(SduiSection & { products: ProductView[]; stores?: StoreRecord[] })[]>('/sdui/home'),
      () => this.getHomeFeedMock(),
    );
  }

  /**
   * Resolve only the Mart SDUI sections (`martHero`/`martDeals`/`martEssentials`) with joined data
   * (`GET /sdui/mart`). The Mart feed stays decoupled from the full Home payload/ETag; the offline
   * mock filters the same Home doc so remote and mock shapes match.
   */
  async getMartFeed(): Promise<(SduiSection & { products: ProductView[]; stores?: StoreRecord[] })[]> {
    return this.withFallback(
      () => this.http<(SduiSection & { products: ProductView[]; stores?: StoreRecord[] })[]>('/sdui/mart'),
      () => this.getMartFeedMock(),
    );
  }

  private async getMartFeedMock(): Promise<(SduiSection & { products: ProductView[]; stores?: StoreRecord[] })[]> {
    const martIds = new Set(['martHero', 'martDeals', 'martEssentials']);
    const sections = homeSdui
      .filter((section) => martIds.has(section.id))
      .map((section) => ({
        ...section,
        products: this.joinStock(getCatalogEntriesByIds(section.productIds)),
        stores: (section.storeIds ?? []).map((id) => getStoreById(id)).filter((s): s is StoreRecord => !!s),
      }));
    return delay(sections);
  }

  private async getHomeFeedMock(): Promise<(SduiSection & { products: ProductView[]; stores?: StoreRecord[] })[]> {
    const sections = homeSdui.map((section) => ({
      ...section,
      products: this.joinStock(getCatalogEntriesByIds(section.productIds)),
      stores: (section.storeIds ?? []).map((id) => getStoreById(id)).filter((s): s is StoreRecord => !!s),
    }));
    return delay(sections);
  }

  /**
   * Personalized recommendations (Mongo `recommendations`/`product_stats` joined to catalog).
   * Cold-start / offline fallback: highest-rated catalog entries (mirrors the trending rail).
   */
  async getRecommendations(): Promise<ProductView[]> {
    return this.withFallback(
      () => this.http<ProductView[]>('/recommendations'),
      () => delay(this.joinStock([...catalogIndex].sort((a, b) => b.rating - a.rating).slice(0, 12))),
    );
  }

  /**
   * Submit a partner onboarding application. The server creates a PENDING_REVIEW seller
   * (sellers.sellers) and audits the write; KYC documents + bank account are added afterwards.
   * Mock fallback returns a local PENDING_REVIEW row so the screen still confirms.
   */
  async submitSellerApplication(input: SellerApplicationInput): Promise<SellerApplication> {
    return this.withFallback(
      () => this.http<SellerApplication>('/sellers', { method: 'POST', body: JSON.stringify(input) }),
      () =>
        delay({
          sellerId: `sel-local-${Date.now().toString(36)}`,
          businessName: input.businessName,
          ownerName: input.ownerName,
          category: input.category,
          gstin: input.gstin ?? '',
          pan: input.pan ?? '',
          businessAddress: input.businessAddress ?? '',
          contactPhone: input.contactPhone,
          stateCode: input.stateCode.toUpperCase(),
          status: 'PENDING_REVIEW',
          rating: 0,
          createdAt: new Date().toISOString(),
        }),
    );
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
   * The server-maintained vendor rating aggregate (`reviews.vendor_summary`) — an O(1) read
   * that covers ALL reviews, not just the fetched page. Falls back to a local derivation.
   */
  async getVendorReviewSummary(vendorId: string): Promise<VendorReviewSummary> {
    return this.withFallback(
      () => this.http<VendorReviewSummary>(`/vendors/${encodeURIComponent(vendorId)}/reviews/summary`),
      () => {
        const reviews = getReviewsByVendorId(vendorId);
        const distribution = [0, 0, 0, 0, 0];
        let sum = 0;
        for (const r of reviews) {
          const v = Math.max(1, Math.min(5, Math.round(r.rating)));
          distribution[v - 1] += 1;
          sum += v;
        }
        return delay({
          average: reviews.length ? sum / reviews.length : 0,
          count: reviews.length,
          distribution,
        });
      },
    );
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
    return this.withStrict(
      () => this.http<OrderRow>('/orders', { method: 'POST', body: JSON.stringify(input) }),
      () => delay(this.placeOrderMock(input)),
    );
  }

  /** Durable self-pickup locations (public). Falls back to the store-backed resolver. */
  async getPickupPoints(storeIds?: string[]): Promise<PickupPoint[]> {
    return this.withFallback(
      () =>
        this.http<PickupPoint[]>(
          `/pickup-points${storeIds && storeIds.length ? `?storeIds=${encodeURIComponent(storeIds.join(','))}` : ''}`,
        ),
      () => {
        const wanted = new Set(storeIds ?? []);
        const points: PickupPoint[] = storeDirectory
          .filter((s) => (wanted.size === 0 || wanted.has(s.id)) && s.address && s.phone && s.hours)
          .map((s) => ({ id: s.id, name: s.name, address: s.address as string, phone: s.phone as string, hours: s.hours as string, isActive: true }));
        if (points.length === 0) points.push(NEUTRAL_PICKUP);
        return delay(points);
      },
    );
  }

  /** Record a payment for an owned order (server derives the amount). */
  async payForOrder(orderId: string, method: string, coinsRedeemed = 0): Promise<PaymentRecord> {
    return this.withStrict(
      () =>
        this.http<PaymentRecord>(`/orders/${encodeURIComponent(orderId)}/payments`, {
          method: 'POST',
          body: JSON.stringify({ method, coinsRedeemed }),
        }),
      () =>
        delay({
          id: `pay-local-${Date.now()}`,
          orderId,
          userId: MOCK_USER_ID,
          method,
          amount: 0,
          coinsRedeemed,
          status: 'PAID',
          createdAt: new Date().toISOString(),
        }),
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