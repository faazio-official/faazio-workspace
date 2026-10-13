"use client";
// GatewayClient pattern: the only door between pages and data.
// When a real backend arrives, only the internals of this module change.
import { usePortalStore, AUTH_DIRECTORY, type PortalState } from "@/lib/api/store";
import { discountPercent } from "@/lib/pricing/rules";
import { sellerSeries, stateSeries, globalSeries, productSeries } from "@/data/analytics/series";
import type {
  AuthUser,
  CampaignScope,
  CouponRecord,
  FestivalCampaign,
  OrderStatus,
  ProductRecord,
  ProductStatus,
  Role,
  Sector,
  SellerStatus,
  StateAdmin,
} from "@/data/types";

function state(): PortalState {
  return usePortalStore.getState();
}

function nowIso(): string {
  return new Date().toISOString();
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

export function signIn(email: string, password: string): AuthUser | null {
  const user = AUTH_DIRECTORY.find(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password,
  );
  if (!user) return null;
  state().set(() => ({ session: user }));
  return user;
}

export function signOut(): void {
  state().set(() => ({ session: null }));
}

export const DEMO_ACCOUNTS = AUTH_DIRECTORY.map((u) => ({
  email: u.email,
  password: u.password,
  role: u.role,
  name: u.name,
  stateCode: u.stateCode,
}));

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

export function createProduct(dto: Omit<ProductRecord, "createdAt" | "discountPercent">): ProductRecord {
  const record: ProductRecord = {
    ...dto,
    discountPercent: discountPercent(dto.mrpPaisa, dto.pricePaisa),
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
            discountPercent: discountPercent(
              patch.mrpPaisa ?? p.mrpPaisa,
              patch.pricePaisa ?? p.pricePaisa,
            ),
          }
        : p,
    ),
  }));
  audit({ action: "PRODUCT_UPDATE", entity: "catalog.products", entityId: productId, before, after: patch });
}

export function upsertPrice(productId: string, pricePaisa: number, mrpPaisa: number): void {
  const before = getProduct(productId);
  updateProduct(productId, { pricePaisa, mrpPaisa });
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
  state().set((s) => ({
    stock: s.stock.map((row) =>
      row.productId === productId ? { ...row, quantity, etaMinutes, updatedAt: nowIso() } : row,
    ),
  }));
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
  state().set((s) => ({
    stores: s.stores.map((st) => (st.storeId === storeId ? { ...st, ...patch } : st)),
  }));
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
  audit({
    action: "CAMPAIGN_CREATE",
    entity: "promo.festival_campaigns",
    entityId: record.campaignId,
    after: record,
  });
  return record;
}

export function updateCampaign(campaignId: string, patch: Partial<FestivalCampaign>): void {
  state().set((s) => ({
    campaigns: s.campaigns.map((c) => (c.campaignId === campaignId ? { ...c, ...patch } : c)),
  }));
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
  audit({
    action: "FESTIVAL_OPTIN",
    entity: "promo.festival_optins",
    entityId: `${input.campaignId}:${input.productId}`,
    after: input,
  });
}

export function setOptinStatus(optinId: string, status: "APPROVED" | "REJECTED"): void {
  state().set((s) => ({
    optins: s.optins.map((o) => (o.optinId === optinId ? { ...o, status } : o)),
  }));
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
  state().set((s) => ({ coupons: [record, ...s.coupons] }));
  audit({ action: "COUPON_CREATE", entity: "promo.coupons", entityId: record.couponId, after: record });
  return record;
}

export function toggleCoupon(couponId: string): void {
  const before = state().coupons.find((c) => c.couponId === couponId);
  state().set((s) => ({
    coupons: s.coupons.map((c) => (c.couponId === couponId ? { ...c, active: !c.active } : c)),
  }));
  audit({
    action: "COUPON_TOGGLE",
    entity: "promo.coupons",
    entityId: couponId,
    before: before && { active: before.active },
    after: { active: !before?.active },
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
  state().set((s) => ({ adSlots: [record, ...s.adSlots] }));
  audit({ action: "AD_REQUEST", entity: "ads.sponsored_slots", entityId: record.slotId, after: record });
}

export function setAdStatus(slotId: string, status: import("@/data/types").AdStatus): void {
  state().set((s) => ({
    adSlots: s.adSlots.map((a) => (a.slotId === slotId ? { ...a, status } : a)),
  }));
  audit({ action: `AD_${status}`, entity: "ads.sponsored_slots", entityId: slotId, after: { status } });
}

/* ------------------------------ state admins ----------------------------- */

export function listStateAdmins(stateCode?: string) {
  return state().stateAdmins.filter((a) => !stateCode || a.stateCode === stateCode);
}

export function createStateAdmin(dto: Omit<StateAdmin, "adminId" | "createdAt" | "lastActiveAt" | "active">): StateAdmin {
  const record: StateAdmin = {
    adminId: `adm-${Date.now()}`,
    active: true,
    createdAt: nowIso(),
    lastActiveAt: nowIso(),
    ...dto,
  };
  state().set((s) => ({ stateAdmins: [record, ...s.stateAdmins] }));
  audit({ action: "STATE_ADMIN_CREATE", entity: "admins.state_admins", entityId: record.adminId, after: record });
  return record;
}

export function updateStateAdmin(adminId: string, patch: Partial<StateAdmin>): void {
  const before = state().stateAdmins.find((a) => a.adminId === adminId);
  state().set((s) => ({
    stateAdmins: s.stateAdmins.map((a) => (a.adminId === adminId ? { ...a, ...patch } : a)),
  }));
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
