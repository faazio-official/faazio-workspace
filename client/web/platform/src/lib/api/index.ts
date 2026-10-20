"use client";
// GatewayClient pattern: the only door between pages and data.
// When a real backend arrives, only the internals of this module change.
import { usePortalStore, type PortalState } from "@/lib/api/store";
import { remoteConfigured } from "@/lib/config";
import { ApiError, remote, toCamel, writeAwaited } from "@/lib/api/http";
import { toast } from "sonner";
import { loginPortal, logoutPortal, restorePortalSession } from "@/lib/portal/auth";
import { sellerSeries, stateSeries, globalSeries, productSeries } from "@/data/analytics/series";
import type {
  AdStatus,
  AdTargetType,
  AuthUser,
  BookingConfigRecord,
  BookingStatus,
  CampaignScope,
  CouponRecord,
  CustomerRecord,
  FestivalCampaign,
  HeroCampaign,
  HeroPlacement,
  MenuItemRecord,
  OrderStatus,
  PortalCredential,
  PrescriptionStatus,
  ProductRecord,
  QuoteItemRecord,
  ProductStatus,
  RewardLedgerEntry,
  RewardsRates,
  Role,
  Sector,
  SellerStatus,
  SduiSection,
  StateAdmin,
  TicketRecord,
  TicketStatus,
} from "@/data/types";

function state(): PortalState {
  return usePortalStore.getState();
}

function nowIso(): string {
  return new Date().toISOString();
}

/** paisa -> whole rupees for gateway write bodies (the gateway speaks rupee integers). */
function toRupees(paisa: number): number {
  return Math.round(paisa / 100);
}

/**
 * Push an optimistic mutation to the gateway and, on failure, restore the caller's pre-mutation
 * snapshot and surface a toast. Replaces fire-and-forget `writeBehind` for the promo/ads writes so a
 * seller/admin always knows the change did not persist (Phase 5).
 */
function pushWrite(
  label: string,
  method: "post" | "put" | "patch" | "delete",
  path: string,
  body: unknown,
  rollback: () => void,
): void {
  void writeAwaited(method, path, body).catch((err: unknown) => {
    rollback();
    const description =
      err instanceof Error && err.message ? err.message : "The server rejected the change.";
    toast.error(`${label} failed`, { description });
  });
}

/** Restore a product row to its pre-mutation snapshot after a rejected gateway write. */
function restoreProduct(prev: ProductRecord | undefined): void {
  if (!prev) return;
  state().set((s) => ({
    products: s.products.map((p) => (p.productId === prev.productId ? prev : p)),
  }));
}

function audit(input: {
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}): void {
  const session = state().session;
  state().set((s) => ({
    auditLogs: [
      {
        logId: `log-${s.auditLogs.length + 1}-${Date.now()}`,
        actorId: session?.accountId ?? "acc-system",
        actorRole: (session?.role ?? "SUPER_ADMIN") as Role,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        before: input.before ? JSON.stringify(input.before) : null,
        after: input.after ? JSON.stringify(input.after) : null,
        createdAt: nowIso(),
      },
      ...s.auditLogs,
    ],
  }));
}

/* ---------------------------------- auth --------------------------------- */

/** Signs in against the gateway-native portal credentials (any role). */
export async function signIn(email: string, password: string): Promise<AuthUser> {
  const user = await loginPortal(email, password);
  state().set(() => ({ session: user }));
  return user;
}

/** Restores the HttpOnly-cookie session (null when signed out/expired). */
export async function restoreSession(): Promise<AuthUser | null> {
  const user = await restorePortalSession();
  state().set(() => ({ session: user }));
  return user;
}

export async function signOut(): Promise<void> {
  await logoutPortal();
  state().set(() => ({ session: null }));
}

/* ----------------------------- portal credentials ----------------------------- */

export interface CreatePortalCredentialInput {
  email: string;
  name: string;
  role: "SELLER" | "STATE_ADMIN";
  sellerId?: string | undefined;
  stateCode?: string | undefined;
  password: string;
  forceChange?: boolean | undefined;
}

/** Superadmin-only: every issued portal login. */
export async function listPortalCredentials(): Promise<PortalCredential[]> {
  const res = await remote.get<{ users?: PortalCredential[] }>("/admin/portal-users");
  return res.users ?? [];
}

/** Superadmin-only: issue a scoped seller or state-admin login (temporary password). */
export async function createPortalCredential(
  input: CreatePortalCredentialInput,
): Promise<PortalCredential> {
  return remote.post<PortalCredential>("/admin/portal-users", input);
}

/** Superadmin-only: enable/disable a credential (disabling revokes its refresh sessions). */
export async function setPortalCredentialActive(id: string, active: boolean): Promise<void> {
  await remote.put(`/admin/portal-users/${encodeURIComponent(id)}`, { active });
}

/** Superadmin-only: set a new password. `forceChange` defaults to true for scoped roles, false for
 * SUPER_ADMIN. Returns the effective flag so the caller can update the row's `mustChange` badge. */
export async function resetPortalCredentialPassword(
  id: string,
  newPassword: string,
  opts: { forceChange?: boolean } = {},
): Promise<{ mustChange: boolean }> {
  const res = await remote.put<{ ok?: boolean; mustChange?: boolean }>(
    `/admin/portal-users/${encodeURIComponent(id)}/password`,
    { newPassword, ...(opts.forceChange !== undefined ? { forceChange: opts.forceChange } : {}) },
  );
  return { mustChange: res.mustChange ?? true };
}

/* -------------------------------- products ------------------------------- */

export interface ProductFilter {
  sellerId?: string | undefined;
  stateCode?: string | undefined;
  sector?: Sector | "ALL" | undefined;
  status?: ProductStatus | "ALL" | undefined;
  query?: string | undefined;
}

export function listProducts(filter: ProductFilter = {}): ProductRecord[] {
  const s = state();
  const storeByProduct = new Map(s.stores.map((st) => [st.storeId, st]));
  return s.products.filter((p) => {
    if (filter.sellerId && p.sellerId !== filter.sellerId) return false;
    if (filter.stateCode && storeByProduct.get(p.storeId)?.stateCode !== filter.stateCode)
      return false;
    if (filter.sector && filter.sector !== "ALL" && p.sector !== filter.sector) return false;
    if (filter.status && filter.status !== "ALL" && p.status !== filter.status) return false;
    if (filter.query) {
      const q = filter.query.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.productId.includes(q)) return false;
    }
    return true;
  });
}

export function getProduct(productId: string): ProductRecord | undefined {
  return state().products.find((p) => p.productId === productId);
}

export function createProduct(dto: Omit<ProductRecord, "createdAt">): ProductRecord {
  const record: ProductRecord = {
    ...dto,
    createdAt: nowIso(),
  };
  state().set((s) => ({
    products: [record, ...s.products],
    stock: [
      { productId: record.productId, quantity: 0, lowStockThreshold: 12, etaMinutes: 30, updatedAt: nowIso() },
      ...s.stock,
    ],
  }));
  audit({ action: "PRODUCT_CREATE", entity: "catalog.products", entityId: record.productId, after: record });
  return record;
}

export function updateProduct(productId: string, patch: Partial<ProductRecord>): void {
  const before = getProduct(productId);
  state().set((s) => ({
    products: s.products.map((p) =>
      p.productId === productId
        ? {
            ...p,
            ...patch,
          }
        : p,
    ),
  }));
  audit({ action: "PRODUCT_UPDATE", entity: "catalog.products", entityId: productId, before, after: patch });
}

/**
 * Persists a product's primary image link to the gateway media registry. `image` is the stored value:
 * an `r2:<key>` reference links the uploaded asset, and an empty value clears it. Legacy https/data
 * URLs are ignored (the gateway never trusts a raw URL). No-op in seed mode.
 */
export function saveProductImage(productId: string, image: string | undefined): void {
  const value = (image ?? "").trim();
  const body = value.startsWith("r2:")
    ? { imageKey: value.slice(3) }
    : value === ""
      ? { imageAssetId: "" }
      : null;
  if (!body) return;
  pushWrite("Product image", "put", `/seller/products/${encodeURIComponent(productId)}`, body, () => {});
}

export function upsertPrice(productId: string, pricePaisa: number, mrpPaisa: number): void {
  const before = getProduct(productId);
  updateProduct(productId, { pricePaisa, mrpPaisa });
  // The gateway speaks whole rupees and writes price to catalog.products + inventory.stock in lockstep.
  // Awaited with rollback: a rejected price write must not leave a stale optimistic price on screen.
  pushWrite(
    "Price update",
    "put",
    `/seller/products/${encodeURIComponent(productId)}`,
    { price: toRupees(pricePaisa), mrp: toRupees(mrpPaisa) },
    () => restoreProduct(before),
  );
  audit({
    action: "PRICE_UPDATE",
    entity: "catalog.products",
    entityId: productId,
    before: before && { pricePaisa: before.pricePaisa, mrpPaisa: before.mrpPaisa },
    after: { pricePaisa, mrpPaisa },
  });
}

export function deleteProduct(productId: string, reason: string): void {
  const before = getProduct(productId);
  state().set((s) => ({ products: s.products.filter((p) => p.productId !== productId) }));
  audit({
    action: "PRODUCT_DELETE",
    entity: "catalog.products",
    entityId: productId,
    before,
    after: { reason },
  });
}

export function setProductStatus(productId: string, status: ProductStatus, reason?: string): void {
  const before = getProduct(productId);
  updateProduct(productId, { status });
  pushWrite(
    `Product ${status}`,
    "put",
    `/seller/products/${encodeURIComponent(productId)}/status`,
    { status },
    () => restoreProduct(before),
  );
  audit({
    action: `PRODUCT_${status}`,
    entity: "catalog.products",
    entityId: productId,
    before: before && { status: before.status },
    after: { status, reason },
  });
}

/* -------------------------------- inventory ------------------------------ */

export function listStock(sellerId?: string) {
  const s = state();
  const owned = new Set(
    s.products.filter((p) => !sellerId || p.sellerId === sellerId).map((p) => p.productId),
  );
  return s.stock
    .filter((row) => owned.has(row.productId))
    .map((row) => ({
      ...row,
      product: s.products.find((p) => p.productId === row.productId)!,
    }));
}

export function updateStock(productId: string, quantity: number, etaMinutes: number): void {
  const before = state().stock.find((r) => r.productId === productId);
  state().set((s) => ({
    stock: s.stock.map((row) =>
      row.productId === productId ? { ...row, quantity, etaMinutes, updatedAt: nowIso() } : row,
    ),
  }));
  // inventory.stock in_stock_qty is the gateway-owned field; etaMinutes stays portal-local for now.
  pushWrite(
    "Stock update",
    "put",
    `/seller/products/${encodeURIComponent(productId)}`,
    { inStockQty: quantity },
    () => {
      if (!before) return;
      state().set((s) => ({
        stock: s.stock.map((row) => (row.productId === productId ? before : row)),
      }));
    },
  );
  audit({ action: "STOCK_UPDATE", entity: "inventory.stock", entityId: productId, after: { quantity, etaMinutes } });
}

/* --------------------------------- orders -------------------------------- */

export function listOrders(filter: { sellerId?: string | undefined; stateCode?: string | undefined; status?: OrderStatus | "ALL" | undefined } = {}) {
  return state().orders.filter((o) => {
    if (filter.sellerId && o.sellerId !== filter.sellerId) return false;
    if (filter.stateCode && o.stateCode !== filter.stateCode) return false;
    if (filter.status && filter.status !== "ALL" && o.status !== filter.status) return false;
    return true;
  });
}

export function getOrder(orderId: string) {
  return state().orders.find((o) => o.orderId === orderId);
}

export function advanceOrder(orderId: string, status: OrderStatus): void {
  const before = getOrder(orderId);
  state().set((s) => ({
    orders: s.orders.map((o) => (o.orderId === orderId ? { ...o, status } : o)),
  }));
  pushWrite("Order status", "put", `/orders/${encodeURIComponent(orderId)}/status`, { status }, () => {
    if (!before) return;
    state().set((s) => ({
      orders: s.orders.map((o) => (o.orderId === orderId ? before : o)),
    }));
  });
  audit({
    action: "ORDER_STATUS",
    entity: "checkout.orders",
    entityId: orderId,
    before: before && { status: before.status },
    after: { status },
  });
}

/* --------------------------------- sellers ------------------------------- */

export function listSellers(filter: { stateCode?: string | undefined; status?: SellerStatus | "ALL" | undefined } = {}) {
  return state().sellers.filter((s) => {
    if (filter.stateCode && s.stateCode !== filter.stateCode) return false;
    if (filter.status && filter.status !== "ALL" && s.status !== filter.status) return false;
    return true;
  });
}

export function getSeller(sellerId: string) {
  return state().sellers.find((s) => s.sellerId === sellerId);
}

export function listKyc(sellerId: string) {
  return state().kyc.filter((k) => k.sellerId === sellerId);
}

export function getBankAccount(sellerId: string) {
  return state().bankAccounts.find((b) => b.sellerId === sellerId);
}

export function setSellerStatus(sellerId: string, status: SellerStatus, reason?: string): void {
  const before = getSeller(sellerId);
  state().set((s) => ({
    sellers: s.sellers.map((seller) =>
      seller.sellerId === sellerId ? { ...seller, status } : seller,
    ),
  }));
  pushWrite("Seller status", "patch", `/sellers/${encodeURIComponent(sellerId)}/status`, { status, reason }, () => {
    if (!before) return;
    state().set((s) => ({
      sellers: s.sellers.map((seller) => (seller.sellerId === sellerId ? before : seller)),
    }));
  });
  audit({
    action: `SELLER_${status}`,
    entity: "sellers.sellers",
    entityId: sellerId,
    before: before && { status: before.status },
    after: { status, reason },
  });
}

/* --------------------------------- stores -------------------------------- */

export function listStores(filter: { sellerId?: string | undefined; stateCode?: string | undefined } = {}) {
  return state().stores.filter((st) => {
    if (filter.sellerId && st.sellerId !== filter.sellerId) return false;
    if (filter.stateCode && st.stateCode !== filter.stateCode) return false;
    return true;
  });
}

export function updateStore(storeId: string, patch: Partial<import("@/data/types").StoreRecord>): void {
  const before = state().stores.find((st) => st.storeId === storeId);
  state().set((s) => ({
    stores: s.stores.map((st) => (st.storeId === storeId ? { ...st, ...patch } : st)),
  }));
  if (patch.isLive !== undefined) {
    pushWrite("Store availability", "put", `/seller/stores/${encodeURIComponent(storeId)}/live`, { live: patch.isLive }, () => {
      if (!before) return;
      state().set((s) => ({
        stores: s.stores.map((st) => (st.storeId === storeId ? before : st)),
      }));
    });
  }
  audit({ action: "STORE_UPDATE", entity: "directory.stores", entityId: storeId, after: patch });
}

/* -------------------------------- payments ------------------------------- */

export function listLedger(sellerId: string) {
  return state().ledger.filter((l) => l.sellerId === sellerId);
}

export function listPayouts(sellerId: string) {
  return state().payouts.filter((p) => p.sellerId === sellerId);
}

/* ------------------------------- promotions ------------------------------ */

export function listSectorCaps() {
  return state().sectorCaps;
}

export function setSectorCap(sector: Sector, maxDiscountPercent: number, stateCode?: string): void {
  const existing = state().sectorCaps.find((c) => c.sector === sector && c.stateCode === stateCode);
  state().set((s) => ({
    sectorCaps: existing
      ? s.sectorCaps.map((c) =>
          c.capId === existing.capId ? { ...c, maxDiscountPercent, updatedAt: nowIso() } : c,
        )
      : [
          ...s.sectorCaps,
          {
            capId: `cap-${sector.toLowerCase()}-${stateCode?.toLowerCase() ?? "global"}`,
            sector,
            maxDiscountPercent,
            stateCode,
            updatedAt: nowIso(),
          },
        ],
  }));
  pushWrite("Sector cap", "put", "/promo/sector-caps", { sector, maxDiscountPercent, stateCode }, () => {
    if (existing) {
      state().set((s) => ({
        sectorCaps: s.sectorCaps.map((c) => (c.capId === existing.capId ? existing : c)),
      }));
    } else {
      state().set((s) => ({
        sectorCaps: s.sectorCaps.filter(
          (c) => !(c.sector === sector && c.stateCode === stateCode),
        ),
      }));
    }
  });
  audit({
    action: "SECTOR_CAP_UPDATE",
    entity: "promo.festival_sector_caps",
    entityId: `${sector}:${stateCode ?? "GLOBAL"}`,
    before: existing && { maxDiscountPercent: existing.maxDiscountPercent },
    after: { maxDiscountPercent },
  });
}

export function listCampaigns(filter: { stateCode?: string | undefined; scope?: CampaignScope | undefined } = {}) {
  return state().campaigns.filter((c) => {
    if (filter.scope && c.scope !== filter.scope) return false;
    if (filter.stateCode && c.scope === "STATE" && c.stateCode !== filter.stateCode) return false;
    return true;
  });
}

export interface CampaignDto {
  name: string;
  scope: CampaignScope;
  stateCode?: string | undefined;
  startsAt: string;
  endsAt: string;
  bannerUrl: string;
  status: FestivalCampaign["status"];
}

export function createFestivalCampaign(dto: CampaignDto): FestivalCampaign {
  const record: FestivalCampaign = {
    campaignId: `cmp-${Date.now()}`,
    createdBy: state().session?.accountId ?? "acc-3",
    ...dto,
  };
  state().set((s) => ({ campaigns: [record, ...s.campaigns] }));
  pushWrite(
    "Campaign create",
    "post",
    "/promo/campaigns",
    {
      name: dto.name,
      scope: dto.scope,
      stateCode: dto.stateCode ?? "",
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
      bannerUrl: dto.bannerUrl,
      status: dto.status,
    },
    () => state().set((s) => ({ campaigns: s.campaigns.filter((c) => c.campaignId !== record.campaignId) })),
  );
  audit({
    action: "CAMPAIGN_CREATE",
    entity: "promo.festival_campaigns",
    entityId: record.campaignId,
    after: record,
  });
  return record;
}

export function updateCampaign(campaignId: string, patch: Partial<FestivalCampaign>): void {
  const before = state().campaigns.find((c) => c.campaignId === campaignId);
  state().set((s) => ({
    campaigns: s.campaigns.map((c) => (c.campaignId === campaignId ? { ...c, ...patch } : c)),
  }));
  if (patch.status !== undefined) {
    pushWrite("Campaign status", "put", `/promo/campaigns/${encodeURIComponent(campaignId)}`, { status: patch.status }, () => {
      if (!before) return;
      state().set((s) => ({
        campaigns: s.campaigns.map((c) => (c.campaignId === campaignId ? before : c)),
      }));
    });
  }
  audit({
    action: "CAMPAIGN_UPDATE",
    entity: "promo.festival_campaigns",
    entityId: campaignId,
    after: patch,
  });
}

export function listOptins(filter: { sellerId?: string | undefined; campaignId?: string | undefined } = {}) {
  return state().optins.filter((o) => {
    if (filter.sellerId && o.sellerId !== filter.sellerId) return false;
    if (filter.campaignId && o.campaignId !== filter.campaignId) return false;
    return true;
  });
}

export function upsertOptin(input: {
  campaignId: string;
  sellerId: string;
  productId: string;
  discountPercent: number;
}): void {
  const existing = state().optins.find(
    (o) => o.campaignId === input.campaignId && o.productId === input.productId,
  );
  const before = state().optins;
  state().set((s) => ({
    optins: existing
      ? s.optins.map((o) =>
          o.optinId === existing.optinId
            ? { ...o, discountPercent: input.discountPercent, status: "PENDING" }
            : o,
        )
      : [
          {
            optinId: `opt-${Date.now()}`,
            status: "PENDING" as const,
            ...input,
          },
          ...s.optins,
        ],
  }));
  pushWrite("Opt-in", "put", "/promo/optins", input, () => state().set(() => ({ optins: before })));
  audit({
    action: "FESTIVAL_OPTIN",
    entity: "promo.festival_optins",
    entityId: `${input.campaignId}:${input.productId}`,
    after: input,
  });
}

export function setOptinStatus(optinId: string, status: "APPROVED" | "REJECTED"): void {
  const before = state().optins;
  state().set((s) => ({
    optins: s.optins.map((o) => (o.optinId === optinId ? { ...o, status } : o)),
  }));
  pushWrite("Opt-in review", "put", `/promo/optins/${encodeURIComponent(optinId)}/status`, { status }, () =>
    state().set(() => ({ optins: before })),
  );
  audit({ action: `OPTIN_${status}`, entity: "promo.festival_optins", entityId: optinId, after: { status } });
}

export function listCoupons(filter: { stateCode?: string | undefined; scope?: "GLOBAL" | "STATE" } = {}) {
  return state().coupons.filter((c) => {
    if (filter.scope && c.scope !== filter.scope) return false;
    if (filter.stateCode && c.scope === "STATE" && c.stateCode !== filter.stateCode) return false;
    return true;
  });
}

export function createCoupon(dto: Omit<CouponRecord, "couponId">): CouponRecord {
  const record: CouponRecord = { couponId: `cpn-${Date.now()}`, ...dto };
  const before = state().coupons;
  state().set((s) => ({ coupons: [record, ...s.coupons] }));
  pushWrite(
    "Coupon",
    "post",
    "/promo/coupons",
    {
      code: dto.code,
      scope: dto.scope,
      stateCode: dto.stateCode ?? "",
      sector: dto.sector ?? "",
      valuePercent: dto.valuePercent,
      maxDiscount: toRupees(dto.maxDiscountPaisa),
      validTill: dto.validTill,
    },
    () => state().set(() => ({ coupons: before })),
  );
  audit({ action: "COUPON_CREATE", entity: "promo.coupons", entityId: record.couponId, after: record });
  return record;
}

export function toggleCoupon(couponId: string): void {
  const before = state().coupons;
  const prev = state().coupons.find((c) => c.couponId === couponId);
  state().set((s) => ({
    coupons: s.coupons.map((c) => (c.couponId === couponId ? { ...c, active: !c.active } : c)),
  }));
  pushWrite("Coupon toggle", "put", `/promo/coupons/${encodeURIComponent(couponId)}/toggle`, undefined, () =>
    state().set(() => ({ coupons: before })),
  );
  audit({
    action: "COUPON_TOGGLE",
    entity: "promo.coupons",
    entityId: couponId,
    before: prev && { active: prev.active },
    after: { active: !prev?.active },
  });
}

/* ----------------------------------- ads --------------------------------- */

export function listAdSlots(filter: { sellerId?: string | undefined; stateCode?: string | undefined } = {}) {
  return state().adSlots.filter((a) => {
    if (filter.sellerId && a.sellerId !== filter.sellerId) return false;
    if (filter.stateCode && a.stateCode !== filter.stateCode) return false;
    return true;
  });
}

export function requestAdSlot(dto: {
  sellerId: string;
  productId: string;
  placement: import("@/data/types").AdSlot["placement"];
  stateCode?: string | undefined;
}): void {
  const record = {
    slotId: `ad-${Date.now()}`,
    status: "REQUESTED" as const,
    impressions: 0,
    clicks: 0,
    ordersAttributed: 0,
    requestedAt: nowIso(),
    ...dto,
  };
  const before = state().adSlots;
  state().set((s) => ({ adSlots: [record, ...s.adSlots] }));
  pushWrite(
    "Ad slot request",
    "post",
    "/ads/slots",
    { sellerId: dto.sellerId, productId: dto.productId, placement: dto.placement, stateCode: dto.stateCode },
    () => state().set(() => ({ adSlots: before })),
  );
  audit({ action: "AD_REQUEST", entity: "ads.sponsored_slots", entityId: record.slotId, after: record });
}

export function setAdStatus(slotId: string, status: import("@/data/types").AdStatus): void {
  const before = state().adSlots;
  state().set((s) => ({
    adSlots: s.adSlots.map((a) => (a.slotId === slotId ? { ...a, status } : a)),
  }));
  pushWrite("Ad slot update", "put", `/ads/slots/${encodeURIComponent(slotId)}`, { status }, () =>
    state().set(() => ({ adSlots: before })),
  );
  audit({ action: `AD_${status}`, entity: "ads.sponsored_slots", entityId: slotId, after: { status } });
}

/* --------------------------- hero campaigns (0027) ----------------------- */

/** Anon-visible LIVE hero projection (`GET /ads/hero`) — display fields only. */
export interface HeroAd {
  placementId: string;
  campaignId: string;
  sellerId: string;
  placement: HeroPlacement;
  targetType: AdTargetType;
  targetId: string;
  targetApp: Sector;
  category?: string | undefined;
  storeId?: string | undefined;
  title: string;
  subtitle?: string | undefined;
  imageUrl?: string | undefined;
  cta?: string | undefined;
}

/** Public LIVE heroes for a placement context (empty context dims = any). Never fabricated offline. */
export async function getHeroAds(
  placement?: string | undefined,
  ctx: { app?: string | undefined; category?: string | undefined; storeId?: string | undefined } = {},
): Promise<HeroAd[]> {
  if (!remoteConfigured()) return [];
  const qs = new URLSearchParams();
  if (placement) qs.set("placement", placement);
  if (ctx.app) qs.set("app", ctx.app);
  if (ctx.category) qs.set("category", ctx.category);
  if (ctx.storeId) qs.set("storeId", ctx.storeId);
  const q = qs.toString();
  try {
    return toCamel(await remote.get<HeroAd[]>(`/ads/hero${q ? `?${q}` : ""}`));
  } catch {
    return [];
  }
}

/** Seller/admin-safe campaign rows from the local store (hydrated from `GET /ads/campaigns`). */
export function listHeroCampaigns(
  filter: { sellerId?: string | undefined; stateCode?: string | undefined } = {},
): HeroCampaign[] {
  return state().heroCampaigns.filter((c) => {
    if (filter.sellerId && c.sellerId !== filter.sellerId) return false;
    if (filter.stateCode && c.stateCode !== filter.stateCode) return false;
    return true;
  });
}

export interface HeroCampaignInput {
  sellerId: string;
  placements: HeroPlacement[];
  targetType: AdTargetType;
  targetId: string;
  targetApp: Sector;
  category?: string | undefined;
  storeId?: string | undefined;
  title: string;
  subtitle?: string | undefined;
  imageUrl?: string | undefined;
  cta?: string | undefined;
  stateCode?: string | undefined;
  startsAt?: string | undefined;
  endsAt?: string | undefined;
}

/**
 * Publishes a hero campaign: one optimistic `LIVE` row per selected placement (mirrors the server's
 * one-row-per-placement insert), then a single awaited `POST /ads/campaigns` with rollback. There is
 * no admin approval — the gateway machine-checks ownership/placement/creative/cap and the ad is live
 * in seconds. A rejected publish rolls the optimistic rows back.
 */
export function requestHeroCampaign(dto: HeroCampaignInput): void {
  const before = state().heroCampaigns;
  const campaignId = `cmp-${Date.now()}`;
  const requestedAt = nowIso();
  const created: HeroCampaign[] = dto.placements.map((placement, i) => ({
    placementId: `ad-cmp-${Date.now()}-${i}`,
    campaignId,
    sellerId: dto.sellerId,
    creativeType: "HERO",
    placement,
    targetType: dto.targetType,
    targetId: dto.targetId,
    targetApp: dto.targetApp,
    category: dto.category,
    storeId: dto.storeId,
    title: dto.title,
    subtitle: dto.subtitle,
    imageUrl: dto.imageUrl,
    cta: dto.cta,
    stateCode: dto.stateCode,
    status: "LIVE",
    reports: 0,
    impressions: 0,
    clicks: 0,
    ordersAttributed: 0,
    startsAt: dto.startsAt ?? requestedAt,
    endsAt: dto.endsAt ?? "",
    requestedAt,
  }));
  state().set((s) => ({ heroCampaigns: [...created, ...s.heroCampaigns] }));
  pushWrite(
    "Hero campaign publish",
    "post",
    "/ads/campaigns",
    {
      sellerId: dto.sellerId,
      placements: dto.placements,
      targetType: dto.targetType,
      targetId: dto.targetId,
      targetApp: dto.targetApp,
      category: dto.category,
      storeId: dto.storeId,
      title: dto.title,
      subtitle: dto.subtitle,
      imageUrl: dto.imageUrl,
      cta: dto.cta,
      stateCode: dto.stateCode,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
    },
    () => state().set(() => ({ heroCampaigns: before })),
  );
  audit({ action: "AD_CAMPAIGN_PUBLISH", entity: "ads.campaigns", entityId: campaignId, after: created });
}

/** Reports an abusive hero ad (`POST /ads/campaigns/{id}/report`): optimistic + awaited with rollback. */
export function reportHeroAd(placementId: string): void {
  const before = state().heroCampaigns;
  state().set((s) => ({
    heroCampaigns: s.heroCampaigns.map((c) =>
      c.placementId === placementId ? { ...c, reports: (c.reports ?? 0) + 1 } : c,
    ),
  }));
  pushWrite(
    "Hero campaign report",
    "post",
    `/ads/campaigns/${encodeURIComponent(placementId)}/report`,
    {},
    () => state().set(() => ({ heroCampaigns: before })),
  );
  audit({ action: "AD_CAMPAIGN_REPORT", entity: "ads.campaigns", entityId: placementId, after: { reports: 1 } });
}

/** Moderates one hero placement (admin): takedown (REJECTED + reason) or restore (LIVE). */
export function setHeroCampaignStatus(placementId: string, status: AdStatus, reason?: string): void {
  const before = state().heroCampaigns;
  state().set((s) => ({
    heroCampaigns: s.heroCampaigns.map((c) =>
      c.placementId === placementId
        ? { ...c, status, takedownReason: status === "REJECTED" ? (reason ?? "") : undefined }
        : c,
    ),
  }));
  pushWrite(
    "Hero campaign update",
    "put",
    `/ads/campaigns/${encodeURIComponent(placementId)}/status`,
    { status, reason },
    () => state().set(() => ({ heroCampaigns: before })),
  );
  audit({ action: `AD_CAMPAIGN_${status}`, entity: "ads.campaigns", entityId: placementId, after: { status, reason } });
}

/* ------------------------------ state admins ----------------------------- */

export function listStateAdmins(stateCode?: string) {
  return state().stateAdmins.filter((a) => !stateCode || a.stateCode === stateCode);
}

/**
 * Reduces a phone to its bare 10 Indian digits (strips +91/91/0 prefixes and every separator), or ""
 * when the result is not exactly 10 digits. Shared by the state-admin form and the credentials page.
 */
export function normalizePhoneDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  switch (true) {
    case digits.startsWith("091") && digits.length === 13:
      return digits.slice(3);
    case digits.startsWith("91") && digits.length === 12:
      return digits.slice(2);
    case digits.startsWith("0") && digits.length === 11:
      return digits.slice(1);
    default:
      return digits.length === 10 ? digits : "";
  }
}

export interface CreateStateAdminInput {
  name: string;
  email: string;
  phone: string;
  stateCode: string;
  issueLogin: boolean;
  password?: string | undefined;
}

export interface StateAdminCreateResult {
  admin: StateAdmin;
  credential?: PortalCredential | undefined;
  /** Non-blocking soft notices from the server: a shared phone that already belongs to a seller/roster row. */
  warnings?: string[] | undefined;
}

/**
 * Unified state-admin creator (superadmin-only). One server call writes the roster and — when
 * `issueLogin` — the STATE_ADMIN portal login atomically; a duplicate email rejects with a
 * specific 409 `code` so the form can be kept (never an optimistic flash-then-rollback). A
 * duplicate PHONE is allowed and reported back as `warnings` (soft, policy decision).
 */
export async function createStateAdminWithLogin(
  input: CreateStateAdminInput,
): Promise<StateAdminCreateResult> {
  const res = await remote.post<{
    admin: StateAdmin;
    credential?: PortalCredential;
    warnings?: string[];
  }>("/state-admins", {
    name: input.name,
    email: input.email,
    phone: input.phone,
    stateCode: input.stateCode,
    issueLogin: input.issueLogin,
    ...(input.issueLogin ? { password: input.password } : {}),
  });
  state().set((s) => ({
    stateAdmins: [res.admin, ...s.stateAdmins.filter((a) => a.adminId !== res.admin.adminId)],
  }));
  audit({ action: "STATE_ADMIN_CREATE", entity: "admins.state_admins", entityId: res.admin.adminId, after: res.admin });
  if (res.credential) {
    audit({ action: "PORTAL_USER_CREATE", entity: "admins.portal_users", entityId: res.credential.id, after: res.credential });
  }
  return { admin: res.admin, credential: res.credential, warnings: res.warnings };
}

export interface IdentityHint {
  field: "email" | "phone";
  /** kind "error" hard-blocks (email — one person, one role); kind "warning" is a soft phone notice. */
  kind: "error" | "warning";
  message: string;
}

/** Pre-submit identity lint (fast, non-authoritative; the server is the source of truth). */
export function stateAdminDuplicateHint(
  email: string,
  phone: string,
  creds: PortalCredential[],
  sellers: readonly { sellerId: string; contactPhone: string }[],
  admins: StateAdmin[],
): IdentityHint | null {
  const lower = email.trim().toLowerCase();
  const digits = normalizePhoneDigits(phone);
  const login = creds.find((c) => c.email.toLowerCase() === lower);
  if (login) {
    if (login.role === "SUPER_ADMIN") return { field: "email", kind: "error", message: "This email already belongs to an active SUPER_ADMIN login." };
    if (login.role === "SELLER") return { field: "email", kind: "error", message: `This email already belongs to seller ${login.sellerId ?? ""}.` };
    return { field: "email", kind: "error", message: `This email already has a STATE_ADMIN login for ${login.stateCode ?? ""}.` };
  }
  const seller = digits ? sellers.find((s) => normalizePhoneDigits(s.contactPhone) === digits) : undefined;
  if (seller) return { field: "phone", kind: "warning", message: `This phone also belongs to seller ${seller.sellerId}. You can still create — shared phone.` };
  const rosterEmail = admins.find((a) => a.email.toLowerCase() === lower);
  if (rosterEmail) return { field: "email", kind: "error", message: `This email already has a STATE_ADMIN roster for ${rosterEmail.stateCode}.` };
  if (digits) {
    const rosterPhone = admins.find((a) => normalizePhoneDigits(a.phone) === digits);
    if (rosterPhone) return { field: "phone", kind: "warning", message: `This phone also belongs to the STATE_ADMIN roster for ${rosterPhone.stateCode}. You can still create — shared phone.` };
  }
  return null;
}

/** Maps a 409/400 `code` from POST /state-admins to a field + friendly block message. */
export function stateAdminConflictMessage(err: unknown): { field: "email" | "phone" | null; message: string } {
  const code = err instanceof ApiError ? err.code : undefined;
  const id = err instanceof ApiError ? err.conflictingId : undefined;
  switch (code) {
    case "email_used_by_super_admin":
      return { field: "email", message: "This email already belongs to an active SUPER_ADMIN login. Deactivate it before registering a state admin." };
    case "email_used_by_seller":
      return { field: "email", message: `This email already belongs to seller ${id ?? "?"}. One person, one role — deactivate the seller login first.` };
    case "email_has_state_login":
      return { field: "email", message: "This email already has a STATE_ADMIN login. Deactivate or delete it first." };
    case "email_has_state_roster":
      return { field: "email", message: "This email already has a STATE_ADMIN roster. Delete it first to move the person." };
    case "weak_password":
      return { field: null, message: "Password must be at least 12 characters and not a common value." };
    case "invalid_phone":
      return { field: "phone", message: "Enter a valid 10-digit Indian mobile number." };
    case "unknown_state":
    case "bad_request":
      return { field: null, message: err instanceof Error ? err.message : "Invalid request." };
    default:
      return { field: null, message: err instanceof Error ? err.message : "The request was blocked." };
  }
}

export function updateStateAdmin(adminId: string, patch: Partial<StateAdmin>): void {
  const before = state().stateAdmins.find((a) => a.adminId === adminId);
  state().set((s) => ({
    stateAdmins: s.stateAdmins.map((a) => (a.adminId === adminId ? { ...a, ...patch } : a)),
  }));
  if (patch.active !== undefined) {
    pushWrite("State admin", "put", `/state-admins/${encodeURIComponent(adminId)}`, { active: patch.active }, () => {
      if (!before) return;
      state().set((s) => ({
        stateAdmins: s.stateAdmins.map((a) => (a.adminId === adminId ? before : a)),
      }));
    });
  }
  audit({
    action: "STATE_ADMIN_UPDATE",
    entity: "admins.state_admins",
    entityId: adminId,
    before,
    after: patch,
  });
}

export function deleteStateAdmin(adminId: string): void {
  const before = state().stateAdmins.find((a) => a.adminId === adminId);
  state().set((s) => ({ stateAdmins: s.stateAdmins.filter((a) => a.adminId !== adminId) }));
  pushWrite("State admin delete", "delete", `/state-admins/${encodeURIComponent(adminId)}`, undefined, () => {
    if (!before) return;
    state().set((s) => ({ stateAdmins: [before, ...s.stateAdmins] }));
  });
  audit({ action: "STATE_ADMIN_DELETE", entity: "admins.state_admins", entityId: adminId, before });
}

/* --------------------------------- reviews ------------------------------- */

export function listReviews(filter: { sellerId?: string | undefined; flaggedOnly?: boolean | undefined } = {}) {
  return state().reviews.filter((r) => {
    if (filter.sellerId && r.sellerId !== filter.sellerId) return false;
    if (filter.flaggedOnly && !r.flagged) return false;
    return true;
  });
}

export function replyToReview(reviewId: string, reply: string): void {
  state().set((s) => ({
    reviews: s.reviews.map((r) => (r.reviewId === reviewId ? { ...r, sellerReply: reply } : r)),
  }));
  audit({ action: "REVIEW_REPLY", entity: "reviews.reviews", entityId: reviewId, after: { reply } });
}

export function flagReview(reviewId: string): void {
  state().set((s) => ({
    reviews: s.reviews.map((r) => (r.reviewId === reviewId ? { ...r, flagged: true } : r)),
  }));
  audit({ action: "REVIEW_FLAG", entity: "reviews.reviews", entityId: reviewId, after: { flagged: true } });
}

/* -------------------------------- analytics ------------------------------ */

export function sellerMetrics(sellerId: string, days = 30) {
  return sellerSeries(sellerId, days);
}
export function stateMetrics(stateCode: string, days = 30) {
  return stateSeries(stateCode, days);
}
export function globalMetrics(days = 30) {
  return globalSeries(days);
}
export function productMetrics(productId: string, days = 30) {
  return productSeries(productId, days);
}

/* ---------------------------------- audit -------------------------------- */

export function listAuditLogs(filter: { actorRole?: Role | undefined; entity?: string | undefined; query?: string | undefined } = {}) {
  return state().auditLogs.filter((l) => {
    if (filter.actorRole && l.actorRole !== filter.actorRole) return false;
    if (filter.entity && l.entity !== filter.entity) return false;
    if (filter.query) {
      const q = filter.query.toLowerCase();
      if (
        !l.action.toLowerCase().includes(q) &&
        !l.entityId.toLowerCase().includes(q) &&
        !l.actorId.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });
}

/* ------------------------------ prescriptions ---------------------------- */

export function listPrescriptions(
  filter: { sellerId?: string | undefined; storeId?: string | undefined; status?: PrescriptionStatus | "ALL" | undefined } = {},
) {
  return state().prescriptions.filter((p) => {
    if (filter.sellerId && p.sellerId !== filter.sellerId) return false;
    if (filter.storeId && p.storeId !== filter.storeId) return false;
    if (filter.status && filter.status !== "ALL" && p.status !== filter.status) return false;
    return true;
  });
}

export function setPrescriptionStatus(prescriptionId: string, status: PrescriptionStatus): void {
  const before = state().prescriptions.find((p) => p.prescriptionId === prescriptionId);
  state().set((s) => ({
    prescriptions: s.prescriptions.map((p) =>
      p.prescriptionId === prescriptionId ? { ...p, status, updatedAt: nowIso() } : p,
    ),
  }));
  pushWrite(`Rx ${status}`, "put", `/prescriptions/${encodeURIComponent(prescriptionId)}/status`, { status }, () => {
    if (!before) return;
    state().set((s) => ({
      prescriptions: s.prescriptions.map((p) => (p.prescriptionId === prescriptionId ? before : p)),
    }));
  });
  audit({
    action: `RX_${status}`,
    entity: "pharma.prescriptions",
    entityId: prescriptionId,
    before: before && { status: before.status },
    after: { status },
  });
}

/**
 * Replaces the seller's priced lines and advances the Rx to QUOTED (optimistic + awaited write).
 * The server recomputes the total and appends status history; a READY/FULFILLED/CANCELLED Rx keeps
 * its status (only the lines change).
 */
export function savePrescriptionQuote(prescriptionId: string, items: QuoteItemRecord[]): void {
  const before = state().prescriptions.find((p) => p.prescriptionId === prescriptionId);
  const totalPaisa = items.reduce((sum, it) => sum + it.qty * (it.pricePaisa - it.discountPaisa), 0);
  const frozen = before?.status === "READY" || before?.status === "FULFILLED" || before?.status === "CANCELLED";
  state().set((s) => ({
    prescriptions: s.prescriptions.map((p) =>
      p.prescriptionId === prescriptionId
        ? {
            ...p,
            quote: items,
            quotedTotalPaisa: totalPaisa,
            status: frozen ? p.status : "QUOTED",
            updatedAt: nowIso(),
          }
        : p,
    ),
  }));
  pushWrite(
    "Save quote",
    "post",
    `/seller/prescriptions/${encodeURIComponent(prescriptionId)}/quotes`,
    {
      items: items.map((it) => ({
        name: it.name,
        qty: it.qty,
        mrp: toRupees(it.mrpPaisa),
        price: toRupees(it.pricePaisa),
        discount: toRupees(it.discountPaisa),
      })),
    },
    () => {
      if (!before) return;
      state().set((s) => ({
        prescriptions: s.prescriptions.map((p) => (p.prescriptionId === prescriptionId ? before : p)),
      }));
    },
  );
  audit({
    action: "RX_QUOTED",
    entity: "pharma.prescriptions",
    entityId: prescriptionId,
    before: before && { status: before.status, total: before.quotedTotalPaisa ?? 0 },
    after: { status: frozen ? before?.status : "QUOTED", total: totalPaisa, lines: items.length },
  });
}

/**
 * Marks an Rx READY. Requires at least one quote line and a positive total (mirrors the server gate).
 * The reveal (customer phone/address visible to the seller) is recorded + audited server-side.
 */
export function setPrescriptionReady(prescriptionId: string): boolean {
  const rx = state().prescriptions.find((p) => p.prescriptionId === prescriptionId);
  const lines = rx?.quote?.length ?? 0;
  const totalPaisa = rx?.quotedTotalPaisa ?? 0;
  if (lines < 1 || totalPaisa <= 0) return false;
  state().set((s) => ({
    prescriptions: s.prescriptions.map((p) =>
      p.prescriptionId === prescriptionId
        ? { ...p, status: "READY", revealedAt: nowIso(), updatedAt: nowIso() }
        : p,
    ),
  }));
  pushWrite("Rx ready", "put", `/prescriptions/${encodeURIComponent(prescriptionId)}/status`, { status: "READY" }, () => {
    if (!rx) return;
    state().set((s) => ({
      prescriptions: s.prescriptions.map((p) => (p.prescriptionId === prescriptionId ? rx : p)),
    }));
  });
  audit({
    action: "RX_READY",
    entity: "pharma.prescriptions",
    entityId: prescriptionId,
    before: rx && { status: rx.status },
    after: { status: "READY", total: totalPaisa },
  });
  return true;
}

/**
 * Fetches short-lived signed download URLs for an Rx's images. Only the owner, assigned vendor or
 * an admin may call it; returns [] in seed mode or on any failure.
 */
export async function fetchPrescriptionImages(
  prescriptionId: string,
): Promise<{ objectPath: string; url: string }[]> {
  if (!remoteConfigured()) return [];
  try {
    const res = await remote.get<{ images?: { objectPath: string; url: string }[] }>(
      `/prescriptions/${encodeURIComponent(prescriptionId)}/images`,
    );
    return res.images ?? [];
  } catch {
    return [];
  }
}

/* --------------------------------- bookings ------------------------------ */

export function listBookings(
  filter: { sellerId?: string | undefined; stateCode?: string | undefined; status?: BookingStatus | "ALL" | undefined } = {},
) {
  return state().bookings.filter((b) => {
    if (filter.sellerId && b.sellerId !== filter.sellerId) return false;
    if (filter.stateCode && b.stateCode !== filter.stateCode) return false;
    if (filter.status && filter.status !== "ALL" && b.status !== filter.status) return false;
    return true;
  });
}

export function setBookingStatus(bookingId: string, status: BookingStatus): void {
  const before = state().bookings.find((b) => b.bookingId === bookingId);
  state().set((s) => ({
    bookings: s.bookings.map((b) => (b.bookingId === bookingId ? { ...b, status } : b)),
  }));
  pushWrite("Booking status", "put", `/bookings/${encodeURIComponent(bookingId)}/status`, { status }, () => {
    if (!before) return;
    state().set((s) => ({
      bookings: s.bookings.map((b) => (b.bookingId === bookingId ? before : b)),
    }));
  });
  audit({
    action: `BOOKING_${status.toUpperCase()}`,
    entity: "bookings.tables",
    entityId: bookingId,
    before: before && { status: before.status },
    after: { status },
  });
}

/** Seller decision: accept a pending request (server captures the held fee). */
export function acceptBooking(bookingId: string): void {
  decideBooking(bookingId, "confirmed", "accept");
}

/** Seller decision: reject a pending request (server refunds the held fee). */
export function rejectBooking(bookingId: string): void {
  decideBooking(bookingId, "rejected", "reject");
}

function decideBooking(bookingId: string, status: BookingStatus, action: "accept" | "reject"): void {
  const before = state().bookings.find((b) => b.bookingId === bookingId);
  state().set((s) => ({
    bookings: s.bookings.map((b) => (b.bookingId === bookingId ? { ...b, status } : b)),
  }));
  pushWrite(`Booking ${action}`, "put", `/bookings/${encodeURIComponent(bookingId)}/status`, { status: action }, () => {
    if (!before) return;
    state().set((s) => ({
      bookings: s.bookings.map((b) => (b.bookingId === bookingId ? before : b)),
    }));
  });
  audit({
    action: `BOOKING_${action.toUpperCase()}`,
    entity: "bookings.tables",
    entityId: bookingId,
    before: before && { status: before.status },
    after: { status },
  });
}

/** Mark an accepted party as vacated (occupancy freed) once the floor clears it. */
export function vacateBooking(bookingId: string): void {
  const before = state().bookings.find((b) => b.bookingId === bookingId);
  state().set((s) => ({
    bookings: s.bookings.map((b) => (b.bookingId === bookingId ? { ...b, status: "completed" } : b)),
  }));
  pushWrite("Booking vacate", "post", `/bookings/${encodeURIComponent(bookingId)}/vacate`, {}, () => {
    if (!before) return;
    state().set((s) => ({
      bookings: s.bookings.map((b) => (b.bookingId === bookingId ? before : b)),
    }));
  });
  audit({
    action: "BOOKING_VACATE",
    entity: "bookings.tables",
    entityId: bookingId,
    before: before && { status: before.status },
    after: { status: "completed" },
  });
}

/** Seller-private booking config for a vendor (defaults when never configured). */
export function getBookingConfig(vendorId: string): BookingConfigRecord {
  const existing = state().bookingConfigs.find((c) => c.vendorId === vendorId);
  if (existing) return existing;
  return {
    vendorId,
    enabled: false,
    totalSeats: 0,
    trackOccupancy: true,
    openTime: "09:00",
    closeTime: "21:00",
    paused: false,
  };
}

/** Save the seller-private booking config (seats / timings / tracking / pause). */
export function saveBookingConfig(cfg: BookingConfigRecord): void {
  const before = state().bookingConfigs.find((c) => c.vendorId === cfg.vendorId);
  state().set((s) => ({
    bookingConfigs: [...s.bookingConfigs.filter((c) => c.vendorId !== cfg.vendorId), cfg],
  }));
  pushWrite("Booking config", "put", "/seller/booking-config", cfg, () => {
    if (!before) return;
    state().set((s) => ({
      bookingConfigs: [...s.bookingConfigs.filter((c) => c.vendorId !== cfg.vendorId), before],
    }));
  });
  audit({
    action: "BOOKING_CONFIG_UPDATE",
    entity: "bookings.venue_configs",
    entityId: cfg.vendorId,
    after: { enabled: cfg.enabled, totalSeats: cfg.totalSeats, paused: cfg.paused },
  });
}

/**
 * Best-effort fetch of a vendor's seller-private config (remote mode only). Merges the server row
 * into the store so the settings form reflects what was saved; seed mode keeps the local default.
 */
export async function refreshBookingConfig(vendorId: string): Promise<BookingConfigRecord | null> {
  if (!remoteConfigured() || !vendorId) return null;
  try {
    const raw = toCamel(await remote.get<Record<string, unknown>>("/seller/booking-config", {
      query: { vendorId },
    }));
    const cfg: BookingConfigRecord = {
      vendorId: raw["vendorId"] ? String(raw["vendorId"]) : vendorId,
      sellerId: raw["sellerId"] ? String(raw["sellerId"]) : undefined,
      enabled: raw["enabled"] === true,
      totalSeats: Number(raw["totalSeats"] ?? 0),
      trackOccupancy: raw["trackOccupancy"] === undefined ? true : raw["trackOccupancy"] === true,
      openTime: raw["openTime"] ? String(raw["openTime"]) : "09:00",
      closeTime: raw["closeTime"] ? String(raw["closeTime"]) : "21:00",
      paused: raw["paused"] === true,
    };
    state().set((s) => ({
      bookingConfigs: [...s.bookingConfigs.filter((c) => c.vendorId !== vendorId), cfg],
    }));
    return cfg;
  } catch {
    return null;
  }
}

/* ------------------------------ blood requests --------------------------- */

export function listBloodRequests(
  filter: { stateCode?: string | undefined; city?: string | undefined; bloodGroup?: string | undefined } = {},
) {
  return state().bloodRequests.filter((r) => {
    if (filter.stateCode && r.stateCode !== filter.stateCode) return false;
    if (filter.city && r.city !== filter.city) return false;
    if (filter.bloodGroup && r.bloodGroup !== filter.bloodGroup) return false;
    return true;
  });
}

export function removeBloodRequest(requestId: string): void {
  const before = state().bloodRequests.find((r) => r.requestId === requestId);
  state().set((s) => ({ bloodRequests: s.bloodRequests.filter((r) => r.requestId !== requestId) }));
  pushWrite("Blood request remove", "delete", `/blood-requests/${encodeURIComponent(requestId)}`, undefined, () => {
    if (!before) return;
    state().set((s) => ({ bloodRequests: [before, ...s.bloodRequests] }));
  });
  audit({
    action: "BLOOD_REQUEST_REMOVE",
    entity: "blood.requests",
    entityId: requestId,
    before,
  });
}

/* ---------------------------------- sdui --------------------------------- */

export function listSduiLayouts(
  filter: { layoutId?: string | undefined } = {},
) {
  return state().sduiLayouts.filter((l) => !filter.layoutId || l.layoutId === filter.layoutId);
}

/**
 * Publishes the Home SDUI layout: writes ID-only sections to the gateway (Mongo sdui_layouts),
 * which bumps the version, purges the compiled-feed cache and changes the ETag — the app picks up
 * the new content on its next poll with no release. Optimistic with rollback (Phase 3 pattern).
 */
export function saveSduiLayoutHome(sections: SduiSection[], locale = "en"): void {
  const before = state().sduiLayouts.find((l) => l.layoutId === "home");
  const prev = before ? { ...before, sections: before.sections } : undefined;
  const version = (before?.version ?? 0) + 1;
  const next = {
    layoutId: "home",
    locale,
    version,
    sections,
    updatedAt: nowIso(),
  };
  state().set((s) => ({
    sduiLayouts: before
      ? s.sduiLayouts.map((l) => (l.layoutId === "home" ? next : l))
      : [next],
  }));
  pushWrite("Publish Home layout", "put", "/admin/sdui/home", { locale, sections }, () => {
    if (!prev) return;
    state().set((s) => ({
      sduiLayouts: s.sduiLayouts.map((l) => (l.layoutId === "home" ? prev : l)),
    }));
  });
  audit({
    action: "SDUI_PUBLISH",
    entity: "sdui_layouts",
    entityId: `home@v${version}`,
    before: prev && { version: prev.version },
    after: { version },
  });
}

/* ------------------------------- customers ------------------------------- */

export function listCustomers(filter: { stateCode?: string | undefined; query?: string | undefined } = {}): CustomerRecord[] {
  return state().customers.filter((c) => {
    if (filter.stateCode && c.stateCode !== filter.stateCode) return false;
    if (filter.query) {
      const q = filter.query.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !c.userId.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

/* ---------------------------------- menus -------------------------------- */

export function listMenus(
  filter: { sellerId?: string | undefined; venueId?: string | undefined; status?: ProductStatus | "ALL" | undefined } = {},
): MenuItemRecord[] {
  return state().menus.filter((m) => {
    if (filter.sellerId && m.sellerId !== filter.sellerId) return false;
    if (filter.venueId && m.venueId !== filter.venueId) return false;
    if (filter.status && filter.status !== "ALL" && m.status !== filter.status) return false;
    return true;
  });
}

export interface MenuDto {
  venueId: string;
  dishId: string;
  name: string;
  pricePaisa: number;
  /** List price (MRP) for the strike-through; must be ≥ pricePaisa. Omit for no offer. */
  mrpPaisa?: number | undefined;
  isVeg?: boolean | undefined;
  cuisine?: string | undefined;
  rating?: number | undefined;
  image?: string | undefined;
  sellerId?: string | undefined;
}

export function upsertMenu(dto: MenuDto): void {
  const existing = state().menus.find((m) => m.venueId === dto.venueId && m.dishId === dto.dishId);
  const record: MenuItemRecord = {
    ...dto,
    sellerId: dto.sellerId ?? existing?.sellerId,
    status: existing?.status ?? "DRAFT",
  };
  state().set((s) => ({
    menus: existing
      ? s.menus.map((m) => (m.venueId === dto.venueId && m.dishId === dto.dishId ? { ...m, ...record } : m))
      : [record, ...s.menus],
  }));
  pushWrite(
    existing ? "Menu update" : "Menu create",
    "put",
    `/seller/menus/${encodeURIComponent(dto.venueId)}/${encodeURIComponent(dto.dishId)}`,
    {
      name: dto.name,
      price: toRupees(dto.pricePaisa),
      ...(dto.mrpPaisa != null ? { mrp: toRupees(dto.mrpPaisa) } : {}),
      isVeg: dto.isVeg,
      cuisine: dto.cuisine ?? "",
      rating: dto.rating,
      image: dto.image ?? "",
      ...(dto.image?.startsWith("r2:") ? { imageKey: dto.image.slice(3) } : {}),
    },
    () => {
      state().set((s) => ({
        menus: existing
          ? s.menus.map((m) => (m.venueId === dto.venueId && m.dishId === dto.dishId ? existing : m))
          : s.menus.filter((m) => !(m.venueId === dto.venueId && m.dishId === dto.dishId)),
      }));
    },
  );
  audit({
    action: existing ? "MENU_UPDATE" : "MENU_CREATE",
    entity: "directory.menus",
    entityId: `${dto.venueId}:${dto.dishId}`,
    before: existing,
    after: record,
  });
}

export function setMenuStatus(venueId: string, dishId: string, status: ProductStatus): void {
  const before = state().menus.find((m) => m.venueId === venueId && m.dishId === dishId);
  state().set((s) => ({
    menus: s.menus.map((m) =>
      m.venueId === venueId && m.dishId === dishId ? { ...m, status } : m,
    ),
  }));
  pushWrite(`Menu ${status}`, "put", `/seller/menus/${encodeURIComponent(venueId)}/${encodeURIComponent(dishId)}/status`, { status }, () => {
    if (!before) return;
    state().set((s) => ({
      menus: s.menus.map((m) => (m.venueId === venueId && m.dishId === dishId ? before : m)),
    }));
  });
  audit({ action: `MENU_${status}`, entity: "directory.menus", entityId: `${venueId}:${dishId}`, after: { status } });
}

export function deleteMenu(venueId: string, dishId: string): void {
  const before = state().menus.find((m) => m.venueId === venueId && m.dishId === dishId);
  state().set((s) => ({ menus: s.menus.filter((m) => !(m.venueId === venueId && m.dishId === dishId)) }));
  pushWrite("Menu delete", "delete", `/seller/menus/${encodeURIComponent(venueId)}/${encodeURIComponent(dishId)}`, undefined, () => {
    if (!before) return;
    state().set((s) => ({ menus: [before, ...s.menus] }));
  });
  audit({ action: "MENU_DELETE", entity: "directory.menus", entityId: `${venueId}:${dishId}`, before });
}

/* --------------------------------- tickets ------------------------------- */

export function listTickets(
  filter: { stateCode?: string | undefined; status?: TicketStatus | "ALL" | undefined; query?: string | undefined } = {},
): TicketRecord[] {
  return state().tickets.filter((t) => {
    if (filter.stateCode && t.stateCode !== filter.stateCode) return false;
    if (filter.status && filter.status !== "ALL" && t.status !== filter.status) return false;
    if (filter.query) {
      const q = filter.query.toLowerCase();
      if (!t.subject.toLowerCase().includes(q) && !t.ticketId.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

export function setTicketStatus(ticketId: string, status: TicketStatus): void {
  const before = state().tickets.find((t) => t.ticketId === ticketId);
  state().set((s) => ({
    tickets: s.tickets.map((t) => (t.ticketId === ticketId ? { ...t, status } : t)),
  }));
  pushWrite(`Ticket ${status}`, "put", `/support/tickets/${encodeURIComponent(ticketId)}`, { status }, () => {
    if (!before) return;
    state().set((s) => ({
      tickets: s.tickets.map((t) => (t.ticketId === ticketId ? before : t)),
    }));
  });
  audit({
    action: `TICKET_${status}`,
    entity: "support.tickets",
    entityId: ticketId,
    before: before && { status: before.status },
    after: { status },
  });
}

/* ------------------------------ rewards rates ---------------------------- */

export function getRewardRates(): RewardsRates {
  return state().rewardRates;
}

export function listRewardLedger(): RewardLedgerEntry[] {
  return state().rewardLedger;
}

export function updateRewardRates(patch: Partial<RewardsRates>): void {
  const before = state().rewardRates;
  const next: RewardsRates = { ...before, ...patch, updatedAt: nowIso() };
  state().set(() => ({ rewardRates: next }));
  pushWrite(
    "Rewards rates",
    "put",
    "/rewards/rates",
    {
      coinEarnRate: next.coinEarnRate,
      coinRedeemRate: next.coinRedeemRate,
      streakTargetDays: next.streakTargetDays,
      discountCardPercent: next.discountCardPercent,
      cardValidityDays: next.cardValidityDays,
    },
    () => state().set(() => ({ rewardRates: before })),
  );
  audit({ action: "REWARDS_RATES_UPDATE", entity: "rewards.rates", entityId: "default", before, after: next });
}
