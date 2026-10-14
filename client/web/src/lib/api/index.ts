"use client";
// GatewayClient pattern: the only door between pages and data.
// When a real backend arrives, only the internals of this module change.
import { usePortalStore, AUTH_DIRECTORY, type PortalState } from "@/lib/api/store";
import { authConfigured, authMocked, remoteConfigured } from "@/lib/config";
import { remote, writeBehind } from "@/lib/api/http";
import { getSession, signInWithPassword, signOutRemote } from "@/lib/supabase/auth";
import { sellerSeries, stateSeries, globalSeries, productSeries } from "@/data/analytics/series";
import type {
  AuthUser,
  BookingStatus,
  CampaignScope,
  CouponRecord,
  CustomerRecord,
  FestivalCampaign,
  MenuItemRecord,
  OrderStatus,
  PrescriptionStatus,
  ProductRecord,
  QuoteItemRecord,
  ProductStatus,
  RewardLedgerEntry,
  RewardsRates,
  Role,
  Sector,
  SellerStatus,
  SduiLayoutStatus,
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

/**
 * Signs in. Auth is **mocked by default** (`authMocked()`) against the built-in
 * demo directory, even when Supabase credentials are present; set
 * `NEXT_PUBLIC_AUTH_MODE=supabase` to use GoTrue instead.
 */
export async function signIn(email: string, password: string): Promise<AuthUser> {
  if (!authMocked() && authConfigured()) {
    const session = await signInWithPassword(email, password);
    state().set(() => ({ session: session.user }));
    return session.user;
  }
  const user = AUTH_DIRECTORY.find(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password,
  );
  if (!user) throw new Error("That email and password pair is not in the demo directory.");
  state().set(() => ({ session: user }));
  return user;
}

/**
 * Restores the persisted session into the store. Mock auth (the default) uses the
 * store's own `localStorage`-persisted session; Supabase mode restores its JWT.
 */
export async function restoreSession(): Promise<AuthUser | null> {
  if (authMocked() || !authConfigured()) return state().session;
  const session = await getSession();
  if (!session) return null;
  state().set(() => ({ session: session.user }));
  return session.user;
}

export async function signOut(): Promise<void> {
  if (!authMocked() && authConfigured()) await signOutRemote();
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

export function upsertPrice(productId: string, pricePaisa: number, mrpPaisa: number): void {
  const before = getProduct(productId);
  updateProduct(productId, { pricePaisa, mrpPaisa });
  // The gateway speaks whole rupees and writes price to catalog.products + inventory.stock in lockstep.
  writeBehind("put", `/seller/products/${encodeURIComponent(productId)}`, {
    price: toRupees(pricePaisa),
    mrp: toRupees(mrpPaisa),
  });
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
  writeBehind("put", `/seller/products/${encodeURIComponent(productId)}/status`, { status });
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
  // inventory.stock in_stock_qty is the gateway-owned field; etaMinutes stays portal-local for now.
  writeBehind("put", `/seller/products/${encodeURIComponent(productId)}`, { inStockQty: quantity });
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
  writeBehind("put", `/orders/${encodeURIComponent(orderId)}/status`, { status });
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
  writeBehind("patch", `/sellers/${encodeURIComponent(sellerId)}/status`, { status, reason });
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
  if (patch.isLive !== undefined) {
    writeBehind("put", `/seller/stores/${encodeURIComponent(storeId)}/live`, { live: patch.isLive });
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
  writeBehind("put", "/promo/sector-caps", { sector, maxDiscountPercent, stateCode });
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
  writeBehind("post", "/promo/campaigns", {
    name: dto.name,
    scope: dto.scope,
    stateCode: dto.stateCode ?? "",
    startsAt: dto.startsAt,
    endsAt: dto.endsAt,
    bannerUrl: dto.bannerUrl,
    status: dto.status,
  });
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
  if (patch.status !== undefined) {
    writeBehind("put", `/promo/campaigns/${encodeURIComponent(campaignId)}`, { status: patch.status });
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
  writeBehind("put", "/promo/optins", input);
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
  writeBehind("put", `/promo/optins/${encodeURIComponent(optinId)}/status`, { status });
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
  writeBehind("post", "/promo/coupons", {
    code: dto.code,
    scope: dto.scope,
    stateCode: dto.stateCode ?? "",
    sector: dto.sector ?? "",
    valuePercent: dto.valuePercent,
    maxDiscount: toRupees(dto.maxDiscountPaisa),
    validTill: dto.validTill,
  });
  audit({ action: "COUPON_CREATE", entity: "promo.coupons", entityId: record.couponId, after: record });
  return record;
}

export function toggleCoupon(couponId: string): void {
  const before = state().coupons.find((c) => c.couponId === couponId);
  state().set((s) => ({
    coupons: s.coupons.map((c) => (c.couponId === couponId ? { ...c, active: !c.active } : c)),
  }));
  writeBehind("put", `/promo/coupons/${encodeURIComponent(couponId)}/toggle`);
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
  writeBehind("post", "/ads/slots", { sellerId: dto.sellerId, productId: dto.productId, placement: dto.placement, stateCode: dto.stateCode });
  audit({ action: "AD_REQUEST", entity: "ads.sponsored_slots", entityId: record.slotId, after: record });
}

export function setAdStatus(slotId: string, status: import("@/data/types").AdStatus): void {
  state().set((s) => ({
    adSlots: s.adSlots.map((a) => (a.slotId === slotId ? { ...a, status } : a)),
  }));
  writeBehind("put", `/ads/slots/${encodeURIComponent(slotId)}`, { status });
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
  writeBehind("post", "/state-admins", { name: dto.name, email: dto.email, phone: dto.phone, stateCode: dto.stateCode });
  audit({ action: "STATE_ADMIN_CREATE", entity: "admins.state_admins", entityId: record.adminId, after: record });
  return record;
}

export function updateStateAdmin(adminId: string, patch: Partial<StateAdmin>): void {
  const before = state().stateAdmins.find((a) => a.adminId === adminId);
  state().set((s) => ({
    stateAdmins: s.stateAdmins.map((a) => (a.adminId === adminId ? { ...a, ...patch } : a)),
  }));
  if (patch.active !== undefined) {
    writeBehind("put", `/state-admins/${encodeURIComponent(adminId)}`, { active: patch.active });
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
  writeBehind("delete", `/state-admins/${encodeURIComponent(adminId)}`);
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
  writeBehind("put", `/prescriptions/${encodeURIComponent(prescriptionId)}/status`, { status });
  audit({
    action: `RX_${status}`,
    entity: "pharma.prescriptions",
    entityId: prescriptionId,
    before: before && { status: before.status },
    after: { status },
  });
}

/**
 * Replaces the seller's priced lines and advances the Rx to QUOTED (optimistic + write-behind).
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
  writeBehind("post", `/seller/prescriptions/${encodeURIComponent(prescriptionId)}/quotes`, {
    items: items.map((it) => ({
      name: it.name,
      qty: it.qty,
      mrp: toRupees(it.mrpPaisa),
      price: toRupees(it.pricePaisa),
      discount: toRupees(it.discountPaisa),
    })),
  });
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
  writeBehind("put", `/prescriptions/${encodeURIComponent(prescriptionId)}/status`, { status: "READY" });
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
  writeBehind("put", `/bookings/${encodeURIComponent(bookingId)}/status`, { status });
  audit({
    action: `BOOKING_${status.toUpperCase()}`,
    entity: "bookings.tables",
    entityId: bookingId,
    before: before && { status: before.status },
    after: { status },
  });
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
  writeBehind("delete", `/blood-requests/${encodeURIComponent(requestId)}`);
  audit({
    action: "BLOOD_REQUEST_REMOVE",
    entity: "blood.requests",
    entityId: requestId,
    before,
  });
}

/* ---------------------------------- sdui --------------------------------- */

export function listSduiLayouts(
  filter: { layoutId?: string | undefined; status?: SduiLayoutStatus | "ALL" | undefined } = {},
) {
  return state().sduiLayouts.filter((l) => {
    if (filter.layoutId && l.layoutId !== filter.layoutId) return false;
    if (filter.status && filter.status !== "ALL" && l.status !== filter.status) return false;
    return true;
  });
}

export function setSduiLayoutStatus(layoutId: string, version: number, status: SduiLayoutStatus): void {
  const before = state().sduiLayouts.find((l) => l.layoutId === layoutId && l.version === version);
  state().set((s) => ({
    sduiLayouts: s.sduiLayouts.map((l) =>
      l.layoutId === layoutId && l.version === version ? { ...l, status, updatedAt: nowIso() } : l,
    ),
  }));
  audit({
    action: `SDUI_${status}`,
    entity: "sdui_layouts",
    entityId: `${layoutId}@v${version}`,
    before: before && { status: before.status },
    after: { status },
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
  writeBehind("put", `/seller/menus/${encodeURIComponent(dto.venueId)}/${encodeURIComponent(dto.dishId)}`, {
    name: dto.name,
    price: toRupees(dto.pricePaisa),
    isVeg: dto.isVeg,
    cuisine: dto.cuisine ?? "",
    rating: dto.rating,
    image: dto.image ?? "",
  });
  audit({
    action: existing ? "MENU_UPDATE" : "MENU_CREATE",
    entity: "directory.menus",
    entityId: `${dto.venueId}:${dto.dishId}`,
    before: existing,
    after: record,
  });
}

export function setMenuStatus(venueId: string, dishId: string, status: ProductStatus): void {
  state().set((s) => ({
    menus: s.menus.map((m) =>
      m.venueId === venueId && m.dishId === dishId ? { ...m, status } : m,
    ),
  }));
  writeBehind("put", `/seller/menus/${encodeURIComponent(venueId)}/${encodeURIComponent(dishId)}/status`, { status });
  audit({ action: `MENU_${status}`, entity: "directory.menus", entityId: `${venueId}:${dishId}`, after: { status } });
}

export function deleteMenu(venueId: string, dishId: string): void {
  const before = state().menus.find((m) => m.venueId === venueId && m.dishId === dishId);
  state().set((s) => ({ menus: s.menus.filter((m) => !(m.venueId === venueId && m.dishId === dishId)) }));
  writeBehind("delete", `/seller/menus/${encodeURIComponent(venueId)}/${encodeURIComponent(dishId)}`);
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
  writeBehind("put", `/support/tickets/${encodeURIComponent(ticketId)}`, { status });
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
  writeBehind("put", "/rewards/rates", {
    coinEarnRate: next.coinEarnRate,
    coinRedeemRate: next.coinRedeemRate,
    streakTargetDays: next.streakTargetDays,
    discountCardPercent: next.discountCardPercent,
    cardValidityDays: next.cardValidityDays,
  });
  audit({ action: "REWARDS_RATES_UPDATE", entity: "rewards.rates", entityId: "default", before, after: next });
}
