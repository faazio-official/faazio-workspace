"use client";
// GatewayClient pattern: the only door between pages and data.
// When a real backend arrives, only the internals of this module change.
import { usePortalStore, type PortalState } from "@/lib/api/store";
import { remoteConfigured } from "@/lib/config";
import { ApiError, remote, toCamel, writeAwaited } from "@/lib/api/http";
import { toast } from "sonner";
import {
  armProactiveRefresh,
  cancelProactiveRefresh,
  loginPortal,
  logoutPortal,
  restorePortalSession,
} from "@/lib/portal/auth";
import type {
  AddonRecord,
  AdStatus,
  AdTargetType,
  AppConfigCategory,
  AppConfigRow,
  AppConfigVariant,
  AuthUser,
  BankAccount,
  BankAccountInput,
  CampaignScope,
  CouponRecord,
  CustomerRecord,
  FestivalCampaign,
  HeroCampaign,
  HeroPlacement,
  MenuItemRecord,
  MenuAddonRecord,
  NotificationPreferences,
  OrderRecord,
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
  SellerDetail,
  InquiryStage,
  KycDocument,
  LegalMetrology,
  ShopPhoto,

  SellerLoginCredential,
  SellerProfilePatch,
  SellerRecord,
  SellerStatus,
  SellerOptin,
  SduiSection,
  StoreRecord,
  DistrictAdmin,
  DistrictAdminVerticalScope,
  SubUser,
  SubUserInvite,
  SubUserRole,
  FeeChangeRequest,
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
 * snapshot and surface a toast, so a seller/admin always knows the change did not persist (Phase 5).
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
function restoreProductSnapshot(prev: ProductRecord | undefined): void {
  if (!prev) return;
  state().set((s) => ({
    products: s.products.map((p) => (p.productId === prev.productId ? prev : p)),
  }));
}

/** Re-insert a product removed optimistically when its gateway delete is rejected. */
function reinsertProductSnapshot(prev: ProductRecord | undefined): void {
  if (!prev) return;
  state().set((s) =>
    s.products.some((p) => p.productId === prev.productId)
      ? s
      : { products: [prev, ...s.products] },
  );
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
 * Signs in against the gateway-native portal credentials (any role). `remember` mirrors the
 * GCP-style "Stay signed in" checkbox (default on). On success the proactive keep-alive timer
 * arms at ~80% of the access token's life so the { 401 → silent refresh } path is rare.
 */
export async function signIn(
  email: string,
  password: string,
  remember = true,
): Promise<AuthUser> {
  const { user, expiresIn } = await loginPortal(email, password, remember);
  state().set(() => ({ session: user, sessionStatus: "signed-in" }));
  armProactiveRefresh(Math.round(expiresIn * 1000 * 0.8));
  return user;
}

export interface SessionRestore {
  status: "signed-in" | "signed-out" | "reconnecting";
  user: AuthUser | null;
}

/**
 * Restores the HttpOnly-cookie session. A gateway blip reports `reconnecting`, never `signed-out`:
 * the cookie is still valid, so the caller should retry instead of treating the user as logged out.
 * `signed-out` only follows a truly dead refresh (the server cleared the cookie).
 */
export async function restoreSession(): Promise<SessionRestore> {
  const outcome = await restorePortalSession();
  if (outcome.status === "ok") {
    state().set(() => ({ session: outcome.user, sessionStatus: "signed-in" }));
    armProactiveRefresh(Math.round(outcome.expiresIn * 1000 * 0.8));
    return { status: "signed-in", user: outcome.user };
  }
  if (outcome.status === "transient") {
    // Never clobber a live session during a gateway blip.
    state().set((s) => ({ session: s.session, sessionStatus: "reconnecting" }));
    return { status: "reconnecting", user: state().session };
  }
  state().set(() => ({ session: null, sessionStatus: "signed-out" }));
  cancelProactiveRefresh();
  return { status: "signed-out", user: null };
}

export async function signOut(): Promise<void> {
  // Drop this device's push token first: otherwise the next seller login on the same phone
  // would inherit the previous session's order notifications.
  await remote.delete("/notifications/register").catch(() => undefined);
  await logoutPortal();
  cancelProactiveRefresh();
  state().set(() => ({ session: null, sessionStatus: "signed-out" }));
}

/* ----------------------------- portal credentials ----------------------------- */

export interface CreatePortalCredentialInput {
  email: string;
  name: string;
  role: "SELLER" | "DISTRICT_ADMIN";
  sellerId?: string | undefined;
  districtCode?: string | undefined;
  stateCode?: string | undefined;
  password: string;
  forceChange?: boolean | undefined;
}

/** Superadmin-only: every issued portal login. */
export async function listPortalCredentials(): Promise<PortalCredential[]> {
  const res = await remote.get<{ users?: PortalCredential[] }>("/admin/portal-users");
  return res.users ?? [];
}

/** Superadmin-only: trashed logins still inside the 7-day restore window. */
export async function listDeletedPortalCredentials(): Promise<PortalCredential[]> {
  const res = await remote.get<{ users?: PortalCredential[] }>("/admin/portal-users/trash");
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

/**
 * Superadmin-only: move a credential to the trash. It stops authenticating immediately and can be
 * restored for 7 days, after which the gateway purges the row for good. Returns the purge instant.
 */
export async function deletePortalCredential(
  id: string,
  reason = "",
): Promise<{ purgeAt?: string | undefined }> {
  const res = await remote.delete<{ ok?: boolean; purgeAt?: string }>(
    `/admin/portal-users/${encodeURIComponent(id)}`,
    { body: { reason } },
  );
  return { purgeAt: res.purgeAt };
}

/** Superadmin-only: restore a trashed credential (it comes back deactivated). */
export async function restorePortalCredential(id: string): Promise<void> {
  await remote.post(`/admin/portal-users/${encodeURIComponent(id)}/restore`);
}

/* --------------------------- remote config (app-config) --------------------------- */

export interface UpdateAppConfigInput {
  category: AppConfigCategory;
  /**
   * The raw JSON value (string / number / boolean / object / array). For a masked secret row the
   * gateway returns `value: null`; sending `null` on PUT keeps the stored secret value unchanged.
   */
  value: unknown;
  isPublic: boolean;
  appVariant: AppConfigVariant;
  valueSecret: boolean;
  description: string;
}

/** Superadmin-only: every app_config row. Secret values are masked by the gateway as `null`. */
export async function listAppConfig(): Promise<AppConfigRow[]> {
  const res = await remote.get<{ items?: AppConfigRow[] }>("/admin/app-config");
  return res.items ?? [];
}

/** Superadmin-only: create or update one config key (audit-logged). */
export async function updateAppConfig(
  key: string,
  input: UpdateAppConfigInput,
): Promise<AppConfigRow> {
  return remote.put<AppConfigRow>(`/admin/app-config/${encodeURIComponent(key)}`, input);
}

/** Superadmin-only: remove one config key (audit-logged); apps fall back to their baked defaults. */
export async function deleteAppConfig(key: string): Promise<void> {
  await remote.delete(`/admin/app-config/${encodeURIComponent(key)}`);
}

/** The single delivery UPI QR (public — shown to riders so a COD customer can pay). */
export async function getDeliveryUpipQr(): Promise<{ qrUrl: string; assetId?: string }> {
  return remote.get<{ qrUrl: string; assetId?: string }>("/app-config/delivery-upi-qr");
}

/** Superadmin-only: set/clear the single delivery UPI QR (R2 asset or direct URL). */
export async function updateDeliveryUpipQr(input: {
  qrUrl: string;
  assetId?: string;
}): Promise<{ qrUrl: string; assetId?: string }> {
  return remote.put<{ qrUrl: string; assetId?: string }>("/app-config/delivery-upi-qr", input);
}

/** One owed/paid summary per seller + cycle on the manual payout board (0077). */
export interface SellerPayoutSummary {
  sellerId: string;
  businessName: string;
  stateCode?: string;
  districtCode?: string;
  cycle: string;
  orderCount: number;
  grossPaisa: number;
  commissionPaisa: number;
  tcsPaisa: number;
  tdsPaisa: number;
  netPaisa: number;
  paidPaisa: number;
  balancePaisa: number;
  status: "PENDING" | "PARTIAL" | "PAID";
  /** Accumulated payout row id (0078); links the separate payout invoice download. */
  payoutId?: string;
}

/** Super/state admin: seller payout board (owed + paid + balance per seller per cycle). */
export async function listSellerPayouts(
  filter: { state?: string; district?: string } = {},
): Promise<SellerPayoutSummary[]> {
  const q = new URLSearchParams();
  if (filter.state) q.set("state", filter.state.toUpperCase());
  if (filter.district) q.set("district", filter.district.toUpperCase());
  const qs = q.toString();
  return remote.get<SellerPayoutSummary[]>(`/admin/seller/payouts${qs ? `?${qs}` : ""}`);
}

/** Superadmin-only: record a manual seller payout. The typed amount may be less than owed — the
 * balance carries forward to the same cycle (paid_amount_paisa accumulates). */
export async function markSellerPayoutPaid(
  sellerId: string,
  input: { cycle: string; amountPaisa: number },
): Promise<unknown> {
  return remote.post(
    `/admin/seller/payouts/${encodeURIComponent(sellerId)}/mark-paid`,
    input,
  );
}

/** One payments.payout_invoices row — the separate B2B payout settlement document (0078),
 * distinct from the per-order tax invoice. Amounts are in paisa. */
export interface PayoutInvoice {
  payoutInvoiceId: string;
  payoutId: string;
  sellerId: string;
  cycle: string;
  invoiceNumber: string;
  grossPaisa: number;
  commissionPaisa: number;
  tcsPaisa: number;
  tdsPaisa: number;
  netPaisa: number;
  paidAmountPaisa: number;
  balancePaisa: number;
  generatedAt: string;
}

/** Superadmin: the separate payout invoice(s) for one payout row. */
export async function getPayoutInvoice(payoutId: string): Promise<PayoutInvoice[]> {
  return remote.get<PayoutInvoice[]>(
    `/admin/seller/payout-invoices/${encodeURIComponent(payoutId)}`,
  );
}

/** Seller: the payout invoice(s) for one of the caller's own payout rows. */
export async function getSellerPayoutInvoice(payoutId: string): Promise<PayoutInvoice[]> {
  return remote.get<PayoutInvoice[]>(
    `/seller/payout-invoices/${encodeURIComponent(payoutId)}`,
  );
}

/* ---------------------------- category taxonomy --------------------------- */

/**
 * Curated header lists a category can belong to (`taxonomy.category_headers`, `0115`). A category's
 * primary `app` is one of MART/FOOD/PHARMA, or MAIN_APP_HEADER for a header-only category that
 * belongs to no vendor sub-app.
 */
export type CategoryHeader = "MAIN_APP_HEADER" | "MART" | "FOOD" | "PHARMA";

export const CATEGORY_HEADERS: CategoryHeader[] = ["MAIN_APP_HEADER", "MART", "FOOD", "PHARMA"];

/**
 * Pools a category can be created in. MAIN_APP_HEADER is the standalone header pool: a header-only
 * category (e.g. "Electronics") appears in the main app header and drills into its own sub-categories
 * (e.g. "Android", "iPhone") instead of belonging to Mart/Food/Pharma.
 */
export type CategoryApp = "MART" | "FOOD" | "PHARMA" | "MAIN_APP_HEADER";

export const CATEGORY_APPS: CategoryApp[] = ["MART", "FOOD", "PHARMA", "MAIN_APP_HEADER"];

/** One selectable value in a facet group (Chicken, Cheddar, Brioche). */
export interface MenuAttributeOption {
  id: string;
  label: string;
  /** Tamil display label (0141). Empty → fall back to `label`. */
  nameTa?: string;
  /** Optional visual tab inside a group (Patty → Chicken | Paneer | Vegetables). */
  parentFilterTab?: string;
  iconUrl?: string;
  /** Lower-case keywords the seller form auto-tagger matches against a dish name. */
  keywords?: string[];
  displayOrder?: number;
}

/**
 * One superadmin-authored facet group attached to a leaf sub-category (Burger → Patty, Cheese Type,
 * Bun). Separate from the navigation/GST taxonomy tree so attribute permutations never become
 * categories.
 */
export interface MenuAttributeGroup {
  id: string;
  subcategoryId: string;
  slug: string;
  displayName: string;
  /** Tamil display name (0141). Empty → fall back to `displayName`. */
  nameTa?: string;
  inputType: "single_select" | "multi_select";
  displayOrder: number;
  options: MenuAttributeOption[];
}

/** Writable shape for the superadmin replace-all attribute write. */
export interface MenuAttributeGroupInput {
  /** Supplied on edit so existing dish tags survive; omit to create. */
  id?: string;
  slug?: string;
  displayName: string;
  nameTa?: string;
  inputType: "single_select" | "multi_select";
  displayOrder?: number;
  options: {
    id?: string;
    label: string;
    nameTa?: string;
    parentFilterTab?: string;
    iconUrl?: string;
    keywords?: string[];
    displayOrder?: number;
  }[];
}

/** One `taxonomy.categories` row (superadmin-owned parent/child tree shared by every sub-app). */
export interface CategoryRow {
  id: string;
  app: string;
  name: string;
  slug: string;
  /** Tamil display name (0107). Empty → the app falls back to `name`. */
  nameTa?: string;
  /** Customer price-filter bucket set (0143): standard / premium / snack. */
  priceTierSet?: "standard" | "premium" | "snack";
  /** Atomic Food Taxonomy v2 mapping of a FOOD carousel category (0145). */
  atomicCategory?: string;
  atomicSubcategory?: string;
  iconUrl?: string;
  parentId: string | null;
  searchQuery?: string;
  isActive: boolean;
  /**
   * Curated onto the shared main app header. MART/PHARMA (and header-only) rows, any tree level,
   * unbounded count — the app scrolls the rail horizontally. FOOD is not eligible. Mirrors the
   * MAIN_APP_HEADER label.
   */
  showOnHomeRail: boolean;
  /** Curated header lists this row belongs to (`0115`); always includes the primary `app`. */
  headerLabels: CategoryHeader[];
  /** Mandatory GST of this category (`tax.category_gst_rates`, `0119`). */
  gstRatePct?: number;
  /** The `tax.gst_rate_categories` row the superadmin picked (`0118`). */
  gstRateCategoryId?: string;
  /** Display name of the picked GST slab (e.g. "Fresh & Unbranded Staples"). */
  gstRateCategoryName?: string;
  /**
   * Live listings linked directly to this node. A delete needs a move target as soon as this node
   * or any descendant reports a non-zero count.
   */
  productCount?: number;
  /** Set when the row is in the trash (soft deleted, `0136`). Restorable for 7 days. */
  deletedAt?: string;
  /** Why the row was deleted, from the superadmin confirmation. */
  deleteReason?: string;
  /** `deletedAt + 7 days` — the instant the purger removes the row for good. */
  purgeAt?: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

/** One inline sub-category row in the create/edit sheet (Option B: its own mandatory GST pick). */
export interface SubCategoryInput {
  /** Existing child id on edit; omit to create a new child. */
  id?: string;
  /** Defaults to the parent's app server-side when omitted. */
  app?: CategoryApp;
  name: string;
  /** Mandatory Tamil name (0107) — every child is a customer-facing drill-in label. */
  nameTa: string;
  searchQuery?: string;
  iconUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
  /** Mandatory GST slab pick (except FOOD, which is pinned to 5%). */
  gstRateCategoryId: string;
}

export interface CategoryInput {
  app: CategoryApp;
  name: string;
  slug?: string;
  nameTa?: string;
  iconUrl?: string;
  parentId?: string | null;
  searchQuery?: string;
  sortOrder?: number;
  isActive?: boolean;
  /** Legacy alias for the MAIN_APP_HEADER label (kept in sync by the gateway). */
  showOnHomeRail?: boolean;
  /** Replaces the curated header lists; the primary `app` label is always added server-side. */
  headerLabels?: CategoryHeader[];
  /** Mandatory GST slab pick (except FOOD, which the gateway pins to 5%). */
  gstRateCategoryId?: string;
  /** Display-only; the gateway always copies the slab's own percentage. */
  gstRatePct?: number;
  /** Inline child rows. Omit on update to leave the child set unchanged. */
  subCategories?: SubCategoryInput[];
}

/** One `tax.gst_rate_categories` row — a named GST slab the superadmin picks from (`0118`). */
export interface GSTRateCategory {
  id: string;
  name: string;
  sector: CategoryApp;
  gstRatePct: number;
  isActive: boolean;
}

export type GSTRateCategoryInput = {
  id?: string;
  name: string;
  sector: CategoryApp;
  gstRatePct: number;
  isActive?: boolean;
};

/** One `tax.category_gst_rates` row — the mandatory GST link of a taxonomy category (`0119`). */
export interface CategoryGSTRate {
  categoryId: string;
  gstRatePct: number;
  gstRateCategoryId: string;
  gstRateCategoryName?: string;
  isActive: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

/** One Atomic Food Taxonomy v2 row (`taxonomy.food_atomic_taxonomy`, migration 0145). */
export interface FoodAtomicTaxonomyRow {
  id: string;
  app: string;
  recordType: string;
  category: string;
  subCategory: string;
  gstCategoryName: string;
  gstSlug: string;
  gstRatePct: number;
  gstRuleStatus: string;
  displayOrder: number;
}

/** One store-onboarding rule from the FOOD catalogue workbook (`taxonomy.store_config_options`). */
export interface StoreConfigOption {
  id: string;
  storeAttributeGroup: string;
  optionValue: string;
  atomicCategory?: string;
  atomicSubcategory?: string;
  collectionStage: string;
  behaviorNote: string;
  displayOrder: number;
}

/** One generated sample dish template (`taxonomy.food_sample_menu_items`), not a live menu row. */
export interface FoodSampleMenuItem {
  id: string;
  dishName: string;
  appSubcategory: string;
  atomicCategory: string;
  atomicSubcategory: string;
  dietaryPreference: string;
  basePriceInr: number;
  autoPriceBucket: string;
  primaryFlavourOrIngredient: string;
  masterTabGroup: string;
  typeOrBase: string;
  additiveOrSauce: string;
  cuisineOrigin: string;
  deliveryMode: string;
  applicableGstRate: string;
  displayOrder: number;
}

/** The read-only FOOD reference master data bundle (`GET /admin/food-master`). */
export interface FoodMasterData {
  atomicTaxonomy: FoodAtomicTaxonomyRow[];
  storeConfig: StoreConfigOption[];
  sampleMenu: FoodSampleMenuItem[];
}

/** Superadmin-only: the FOOD reference master data seeded from the catalogue workbook. */
export async function fetchFoodMaster(): Promise<FoodMasterData> {
  return remote.get<FoodMasterData>("/admin/food-master");
}

/** Superadmin-only: every category (including deactivated) for the portal, optionally app-scoped. */
export async function listCategories(app?: CategoryApp | "ALL"): Promise<CategoryRow[]> {
  const q = app && app !== "ALL" ? `?app=${app}` : "";
  return remote.get<CategoryRow[]>(`/admin/categories${q}`);
}

/** Superadmin-only: the soft-deleted categories still inside the 7-day undo window. */
export async function listDeletedCategories(app?: CategoryApp | "ALL"): Promise<CategoryRow[]> {
  const q = app && app !== "ALL" ? `?app=${app}` : "";
  return remote.get<CategoryRow[]>(`/admin/categories/trash${q}`);
}

/** Superadmin-only: one curated header list (`?header=`), e.g. the shared Main App Header table. */
export async function listCategoriesByHeader(header: CategoryHeader): Promise<CategoryRow[]> {
  return remote.get<CategoryRow[]>(`/admin/categories?header=${header}`);
}

/**
 * The facet groups + options defined for a sub-category (`GET /categories/{id}/attribute-groups`).
 * Any signed-in portal account can read it: the seller dish form and the customer filter drawer use
 * the same definition.
 */
export async function fetchSubcategoryAttributes(
  subcategoryId: string,
): Promise<MenuAttributeGroup[]> {
  if (!subcategoryId) return [];
  return remote.get<MenuAttributeGroup[]>(
    `/categories/${encodeURIComponent(subcategoryId)}/attribute-groups`,
  );
}

/**
 * Superadmin-only: replace all facet groups for a sub-category. Group/option ids supplied by the
 * portal are preserved (so existing dish tags survive); omitted ids are deleted.
 */
export async function replaceSubcategoryAttributes(
  subcategoryId: string,
  groups: MenuAttributeGroupInput[],
): Promise<MenuAttributeGroup[]> {
  return remote.put<MenuAttributeGroup[]>(
    `/admin/categories/${encodeURIComponent(subcategoryId)}/attribute-groups`,
    { groups },
  );
}

/** Superadmin-only: create a category (audit-logged). */
export async function createCategory(input: CategoryInput): Promise<CategoryRow> {
  return remote.post<CategoryRow>("/categories", input);
}

/** Superadmin-only: update a category (audit-logged). */
export async function updateCategory(id: string, input: CategoryInput): Promise<CategoryRow> {
  return remote.put<CategoryRow>(`/categories/${encodeURIComponent(id)}`, input);
}

/** What one category delete trashed and how many listings it re-linked to the destination leaf. */
export interface CategoryDeleteResult {
  ok: boolean;
  id: string;
  /** Number of taxonomy rows moved to the trash (the category plus its descendants). */
  trashed: number;
  /** Number of listings re-linked onto the destination's drill-in leaf. */
  movedProducts: number;
  targetId?: string;
  targetName?: string;
}

/**
 * Superadmin-only: delete a category and its subtree (soft delete — moves it to the trash).
 *
 * Listings inside the subtree are never orphaned: pass `moveTo` — a live category at the same tree
 * level (top-level→top-level, child→child) in the same app — and they are re-linked to that
 * destination's drill-in leaf. A delete that would orphan listings and names no target fails with
 * code `move_required`, which the caller should surface as "pick a category to move them to".
 *
 * The row is restorable for 7 days, then the gateway purger removes it for good.
 */
export async function deleteCategory(
  id: string,
  moveTo?: string,
  reason?: string,
): Promise<CategoryDeleteResult> {
  const params = new URLSearchParams();
  if (moveTo) params.set("moveTo", moveTo);
  if (reason) params.set("reason", reason);
  const qs = params.toString();
  return remote.delete<CategoryDeleteResult>(
    `/categories/${encodeURIComponent(id)}${qs ? `?${qs}` : ""}`,
  );
}

/** Superadmin-only: flip the plain Active/Inactive hide flag (never touches the trash). */
export async function setCategoryActive(id: string, isActive: boolean): Promise<CategoryRow> {
  return remote.patch<CategoryRow>(`/categories/${encodeURIComponent(id)}/toggle`, { isActive });
}

/** Superadmin-only: restore a trashed category and its subtree (it comes back deactivated). */
export async function restoreCategory(id: string): Promise<CategoryRow> {
  return remote.post<CategoryRow>(`/categories/${encodeURIComponent(id)}/restore`);
}

/** Superadmin-only: permanently delete one trashed, unreferenced category subtree now. */
export async function purgeCategory(id: string): Promise<void> {
  await remote.delete(`/categories/${encodeURIComponent(id)}/permanent`);
}

/* --------------------------------- GST rates ------------------------------- */

/** Superadmin-only: every GST rate slab, active and deactivated (`GET /admin/tax/gst-rate-categories`). */
export async function listGSTRateCategories(): Promise<GSTRateCategory[]> {
  return remote.get<GSTRateCategory[]>("/admin/tax/gst-rate-categories");
}

/** Superadmin-only: create or update one GST rate slab. */
export async function upsertGSTRateCategory(
  input: GSTRateCategoryInput,
): Promise<GSTRateCategory> {
  return remote.post<GSTRateCategory>("/admin/tax/gst-rate-categories", input);
}

/** Superadmin-only: deactivate a GST rate slab (refused while a category still links to it). */
export async function deleteGSTRateCategory(id: string): Promise<void> {
  await remote.delete(`/admin/tax/gst-rate-categories/${encodeURIComponent(id)}`);
}

/** Superadmin-only: the GST links of every category, or one (`?category_id=`). */
export async function listCategoryGSTRates(categoryId?: string): Promise<CategoryGSTRate[]> {
  const q = categoryId ? `?category_id=${encodeURIComponent(categoryId)}` : "";
  return remote.get<CategoryGSTRate[]>(`/admin/tax/category-gst-rates${q}`);
}

/** Superadmin-only: link one category to a GST rate slab (the slab's own percentage is copied). */
export async function upsertCategoryGSTRate(
  categoryId: string,
  gstRateCategoryId: string,
): Promise<CategoryGSTRate> {
  return remote.put<CategoryGSTRate>(
    `/admin/tax/category-gst-rates/${encodeURIComponent(categoryId)}`,
    { gstRateCategoryId },
  );
}

/* -------------------------------- products ------------------------------- */

export interface ProductFilter {
  sellerId?: string | undefined;
  storeId?: string | undefined;
  stateCode?: string | undefined;
  sector?: Sector | "ALL" | undefined;
  status?: ProductStatus | "ALL" | undefined;
  query?: string | undefined;
}

/**
 * Applies a ProductFilter to a product list. Pure, so a live read can filter server rows without
 * touching the persisted store slice (`listProducts` is the store-backed convenience wrapper).
 * `stateCode` needs the store lookup; pass `stores` when filtering by state.
 */
export function filterProducts(
  products: ProductRecord[],
  filter: ProductFilter = {},
  stores: StoreRecord[] = [],
): ProductRecord[] {
  const storeByProduct = new Map(stores.map((st) => [st.storeId, st]));
  return products.filter((p) => {
    if (filter.sellerId && p.sellerId !== filter.sellerId) return false;
    if (filter.storeId && p.storeId !== filter.storeId) return false;
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

export function listProducts(filter: ProductFilter = {}): ProductRecord[] {
  const s = state();
  return filterProducts(s.products, filter, s.stores);
}

export function getProduct(productId: string): ProductRecord | undefined {
  return state().products.find((p) => p.productId === productId);
}

export type CreateProductInput = Omit<ProductRecord, "createdAt" | "productId"> & {
  /** Active taxonomy leaf for the store's app; the gateway validates and derives search tokens. */
  taxonomyCategoryId?: string;
};

export async function createProduct(dto: CreateProductInput): Promise<ProductRecord> {
  // The gateway owns the product id. Seed/dev mode (no gateway) still needs a local row id.
  const record: ProductRecord = {
    ...dto,
    productId: remoteConfigured() ? "" : `local-${Date.now().toString(36)}`,
    createdAt: nowIso(),
  };
  // Live mode: persist the listing through the gateway (PENDING_REVIEW + catalog/stock in one
  // transaction) and adopt the server-owned id/status. Offline seed mode keeps the local row.
  if (remoteConfigured()) {
    const image = (dto.imageUrl ?? "").trim();
    const imageKey = image.startsWith("r2:") ? image.slice(3) : undefined;
    if (image.startsWith("data:")) {
      throw new Error("Photo upload did not reach the media service. Please retry the upload.");
    }
    const created = await remote.post<{ id: string; status?: ProductStatus }>("/seller/products", {
      storeId: dto.storeId,
      name: dto.name,
      category: dto.category,
      taxonomyCategoryId: dto.taxonomyCategoryId,
      description: dto.description,
      // Tamil copy is optional; an untranslated listing sends nothing so the column stays empty.
      ...(dto.nameTa?.trim() ? { nameTa: dto.nameTa.trim() } : {}),
      ...(dto.descriptionTa?.trim() ? { descriptionTa: dto.descriptionTa.trim() } : {}),
      // Gateway speaks whole rupees; the DB stores paisa.
      price: toRupees(dto.pricePaisa),
      mrp: dto.mrpPaisa !== undefined ? toRupees(dto.mrpPaisa) : undefined,
      brand: dto.brand?.trim() || undefined,
      packType: dto.packType,
      netQty: dto.netQty,
      netUnit: dto.netUnit,
      galleryKeys: (dto.galleryUrls ?? [])
        .map((url) => (url.startsWith("r2:") ? url.slice(3) : ""))
        .filter((key): key is string => key.length > 0),
      variantGroupId: dto.variantGroupId,
      variantLabel: dto.variantLabel,
      variantOrder: dto.variantOrder,
      unit: dto.unit,
      emoji: dto.emoji,
      imageUrl: imageKey ? undefined : /^https?:\/\//.test(image) ? image : undefined,
      imageKey,
      attributes: dto.attributes,
      isVeg: dto.isVeg,
      isPrescription: dto.isPrescription,
    });
    record.productId = created.id;
    record.status = created.status ?? "PENDING_REVIEW";
  }
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

/** Applies a product patch to the local store only. Callers push their own gateway write. */
function patchProductLocal(
  productId: string,
  patch: Partial<ProductRecord>,
): ProductRecord | undefined {
  const before = getProduct(productId);
  state().set((s) => ({
    products: s.products.map((p) => (p.productId === productId ? { ...p, ...patch } : p)),
  }));
  return before;
}

/**
 * Edits a listing's descriptive fields through the gateway (PUT /seller/products/{id}). Only the
 * fields the gateway owns are sent; price/image/status have their own endpoints. The local store is
 * updated optimistically and rolled back if the server rejects the write.
 */
export function updateProduct(productId: string, patch: Partial<ProductRecord>): void {
  const before = patchProductLocal(productId, patch);
  const body: {
    name?: string;
    description?: string;
    nameTa?: string;
    descriptionTa?: string;
    category?: string;
    isVeg?: boolean;
    isPrescription?: boolean;
    mrp?: number;
    brand?: string;
    packType?: ProductRecord["packType"];
    netQty?: number;
    netUnit?: ProductRecord["netUnit"];
    galleryKeys?: string[];
    variantGroupId?: string;
    variantLabel?: string;
    variantOrder?: number;
    attributes?: ProductRecord["attributes"];
  } = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.nameTa !== undefined) body.nameTa = patch.nameTa;
  if (patch.descriptionTa !== undefined) body.descriptionTa = patch.descriptionTa;
  if (patch.category !== undefined) body.category = patch.category;
  if (patch.isVeg !== undefined) body.isVeg = patch.isVeg;
  if (patch.isPrescription !== undefined) body.isPrescription = patch.isPrescription;
  if (patch.mrpPaisa !== undefined) body.mrp = toRupees(patch.mrpPaisa);
  if (patch.brand !== undefined) body.brand = patch.brand;
  if (patch.packType !== undefined) body.packType = patch.packType;
  if (patch.netQty !== undefined) body.netQty = patch.netQty;
  if (patch.netUnit !== undefined) body.netUnit = patch.netUnit;
  if (patch.galleryUrls !== undefined)
    body.galleryKeys = patch.galleryUrls
      .map((url) => (url.startsWith("r2:") ? url.slice(3) : ""))
      .filter((key): key is string => key.length > 0);
  if (patch.variantGroupId !== undefined) body.variantGroupId = patch.variantGroupId;
  if (patch.variantLabel !== undefined) body.variantLabel = patch.variantLabel;
  if (patch.variantOrder !== undefined) body.variantOrder = patch.variantOrder;
  if (patch.attributes !== undefined) body.attributes = patch.attributes;
  if (Object.keys(body).length > 0) {
    pushWrite(
      "Product update",
      "put",
      `/seller/products/${encodeURIComponent(productId)}`,
      body,
      () => restoreProductSnapshot(before),
    );
  }
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

export function upsertPrice(productId: string, pricePaisa: number, mrpPaisa?: number): void {
  const before = getProduct(productId);
  patchProductLocal(productId, { pricePaisa, ...(mrpPaisa !== undefined ? { mrpPaisa } : {}) });
  // The gateway speaks whole rupees and writes price to catalog.products + inventory.stock in lockstep.
  // Awaited with rollback: a rejected price write must not leave a stale optimistic price on screen.
  pushWrite(
    "Price update",
    "put",
    `/seller/pricing/${encodeURIComponent(productId)}`,
    { price: toRupees(pricePaisa), ...(mrpPaisa !== undefined ? { mrp: toRupees(mrpPaisa) } : {}) },
    () => restoreProductSnapshot(before),
  );
  audit({
    action: "PRICE_UPDATE",
    entity: "catalog.products",
    entityId: productId,
    before: before && { pricePaisa: before.pricePaisa },
    after: { pricePaisa },
  });
}

/**
 * Soft-deletes a listing through the gateway (DELETE /seller/products/{id}). The row leaves the
 * active list immediately but stays restorable from the trash for 7 days. The optimistic removal is
 * rolled back if the server rejects the delete.
 */
export function deleteProduct(productId: string, reason: string): void {
  const before = getProduct(productId);
  state().set((s) => ({ products: s.products.filter((p) => p.productId !== productId) }));
  const note = (reason ?? "").trim();
  pushWrite(
    "Product delete",
    "delete",
    `/seller/products/${encodeURIComponent(productId)}${
      note ? `?reason=${encodeURIComponent(note)}` : ""
    }`,
    undefined,
    () => reinsertProductSnapshot(before),
  );
  audit({
    action: "PRODUCT_DELETE",
    entity: "catalog.products",
    entityId: productId,
    before,
    after: { reason },
  });
}

/** A soft-deleted listing from GET /seller/products/trash (purgeAt = deletedAt + 7 days). */
export interface TrashProduct {
  id: string;
  name: string;
  category: string;
  app: Sector;
  status: ProductStatus;
  price: number;
  storeId?: string;
  sellerId?: string;
  deletedAt: string;
  deleteReason?: string;
  purgeAt: string;
}

/** Live trash list: the caller-scoped soft-deleted products still inside the 7-day window. */
export async function fetchProductTrash(): Promise<TrashProduct[]> {
  if (!remoteConfigured()) return [];
  return toCamel(await remote.get<TrashProduct[]>("/seller/products/trash"));
}

/** Restores a trashed listing (POST /seller/products/{id}/restore). */
export async function restoreDeletedProduct(productId: string): Promise<void> {
  if (!remoteConfigured()) return;
  await remote.post(`/seller/products/${encodeURIComponent(productId)}/restore`);
}

/** Permanently deletes one trashed listing now (DELETE /seller/products/{id}/permanent). */
export async function purgeDeletedProduct(productId: string): Promise<void> {
  if (!remoteConfigured()) return;
  await remote.delete(`/seller/products/${encodeURIComponent(productId)}/permanent`);
}

export function setProductStatus(productId: string, status: ProductStatus, reason?: string): void {
  const before = getProduct(productId);
  const note = (reason ?? "").trim();
  const reviewReason = status === "REJECTED" ? note : "";
  patchProductLocal(productId, { status, reviewReason });
  pushWrite(
    `Product ${status}`,
    "put",
    `/seller/products/${encodeURIComponent(productId)}/status`,
    status === "REJECTED" ? { status, reason: reviewReason } : { status },
    () => restoreProductSnapshot(before),
  );
  audit({
    action: `PRODUCT_${status}`,
    entity: "catalog.products",
    entityId: productId,
    before: before && { status: before.status },
    after: { status, reason: note },
  });
}

/* -------------------------------- inventory ------------------------------ */

export function listStock(sellerId?: string, storeId?: string) {
  const s = state();
  const owned = new Set(
    s.products
      .filter((p) => (!sellerId || p.sellerId === sellerId) && (!storeId || p.storeId === storeId))
      .map((p) => p.productId),
  );
  return s.stock
    .filter((row) => owned.has(row.productId))
    .map((row) => ({
      ...row,
      product: s.products.find((p) => p.productId === row.productId)!,
    }));
}

/**
 * Writes one stock row. `lot` carries the regulated/perishable metadata (0123): omit a key to leave
 * that column alone, pass an empty string to clear it.
 */
export function updateStock(
  productId: string,
  quantity: number,
  etaMinutes: number,
  lot: { batchNo?: string | undefined; expiryDate?: string | undefined } = {},
): void {
  const before = state().stock.find((r) => r.productId === productId);
  // The gateway clamps ETA to 0..600 minutes; clamp here so the optimistic row matches what persists.
  const eta = Math.max(0, Math.min(600, Math.round(etaMinutes)));
  const hasBatch = lot.batchNo !== undefined;
  const hasExpiry = lot.expiryDate !== undefined;
  state().set((s) => ({
    stock: s.stock.map((row) =>
      row.productId === productId
        ? {
            ...row,
            quantity,
            etaMinutes: eta,
            ...(hasBatch ? { batchNo: lot.batchNo || undefined } : {}),
            ...(hasExpiry ? { expiryDate: lot.expiryDate || undefined } : {}),
            updatedAt: nowIso(),
          }
        : row,
    ),
  }));
  // The seller inventory endpoint writes inventory.stock (qty + ETA + lot) in one scoped call.
  pushWrite(
    "Stock update",
    "put",
    `/seller/inventory/${encodeURIComponent(productId)}`,
    {
      inStockQty: quantity,
      etaMinutes: eta,
      ...(hasBatch ? { batchNo: lot.batchNo ?? "" } : {}),
      ...(hasExpiry ? { expiryDate: lot.expiryDate ?? "" } : {}),
    },
    () => {
      if (!before) return;
      state().set((s) => ({
        stock: s.stock.map((row) => (row.productId === productId ? before : row)),
      }));
    },
  );
  audit({ action: "STOCK_UPDATE", entity: "inventory.stock", entityId: productId, after: { quantity, etaMinutes: eta, ...lot } });
}

/* ------------------- seller console (live gateway reads) ------------------ */

/**
 * One gateway seller-product row (`GET /seller/inventory` or `/seller/pricing`). The two endpoints
 * share this projection; money is whole rupees on the wire.
 */
export interface SellerConsoleRow {
  id: string;
  name: string;
  app: string;
  category: string;
  taxonomyCategoryId?: string;
  status: ProductStatus;
  sellerId?: string;
  storeId?: string;
  price: number;
  description?: string;
  /** Tamil display name (0107). Empty → the app falls back to `name`. */
  nameTa?: string;
  /** Tamil display description (0107). Empty → the app falls back to `description`. */
  descriptionTa?: string;
  unit?: string;
  mrp?: number;
  brand?: string;
  packType?: ProductRecord["packType"];
  netQty?: number;
  netUnit?: ProductRecord["netUnit"];
  galleryKeys?: string[];
  variantGroupId?: string;
  variantLabel?: string;
  variantOrder?: number;
  attributes?: ProductRecord["attributes"];
  emoji?: string;
  imageUrl?: string;
  imageKey?: string;
  isVeg?: boolean;
  isPrescription: boolean;
  inStockQty: number;
  available: boolean;
  eta?: string;
  /** Regulated/perishable lot (0123). Absent when the SKU carries none. */
  batchNo?: string;
  expiryDate?: string;
  reviewReason?: string;
  updatedAt: string;
}

async function fetchSellerRows(path: string): Promise<SellerConsoleRow[]> {
  if (!remoteConfigured()) return [];
  return toCamel(await remote.get<SellerConsoleRow[]>(path));
}

/** Live seller inventory rows: stock qty/ETA plus product identity. */
export function fetchSellerInventory(): Promise<SellerConsoleRow[]> {
  return fetchSellerRows("/seller/inventory");
}

/** Live seller pricing rows: shelf price plus product identity. */
export function fetchSellerPricing(): Promise<SellerConsoleRow[]> {
  return fetchSellerRows("/seller/pricing");
}

/** Live seller promotions: festival campaigns plus the caller's own opt-ins, in one read. */
export interface SellerPromotionsView {
  campaigns: FestivalCampaign[];
  optins: SellerOptin[];
}

export async function fetchSellerPromotions(): Promise<SellerPromotionsView> {
  if (!remoteConfigured()) return { campaigns: [], optins: [] };
  return toCamel(await remote.get<SellerPromotionsView>("/seller/promotions"));
}

/* --------------------------------- orders -------------------------------- */

export function listOrders(filter: { sellerId?: string | undefined; storeId?: string | undefined; stateCode?: string | undefined; status?: OrderStatus | "ALL" | undefined } = {}) {
  return state().orders.filter((o) => {
    if (filter.sellerId && o.sellerId !== filter.sellerId) return false;
    // An order whose store could not be resolved (storeId blank on the wire) is never hidden from a
    // store-scoped seller list — a gateway omitting the field must not empty the board.
    if (filter.storeId && o.storeId && o.storeId !== filter.storeId) return false;
    if (filter.stateCode && o.stateCode !== filter.stateCode) return false;
    if (filter.status && filter.status !== "ALL" && o.status !== filter.status) return false;
    return true;
  });
}

export function getOrder(orderId: string) {
  return state().orders.find((o) => o.orderId === orderId);
}

/** Seller-side pickup handover QR: the short-lived token the rider scans at the store (0088). */
export interface SellerPickupQr {
  customerOrderId: string;
  stopId: string;
  token: string;
  expiresAt: string;
}

export async function fetchSellerPickupQr(orderId: string): Promise<SellerPickupQr> {
  return remote.get<SellerPickupQr>(`/seller/orders/${encodeURIComponent(orderId)}/pickup-qr`);
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

/** Seller NEW → PACKED (dispatches). Optimistic with rollback, mirroring advanceOrder. */
export function acceptOrder(orderId: string): void {
  const before = getOrder(orderId);
  state().set((s) => ({
    orders: s.orders.map((o) => (o.orderId === orderId ? { ...o, status: "PACKED" } : o)),
  }));
  pushWrite("Accept order", "put", `/seller/orders/${encodeURIComponent(orderId)}/accept`, undefined, () => {
    if (!before) return;
    state().set((s) => ({
      orders: s.orders.map((o) => (o.orderId === orderId ? before : o)),
    }));
  });
  audit({
    action: "ORDER_ACCEPTED",
    entity: "checkout.orders",
    entityId: orderId,
    before: before && { status: before.status },
    after: { status: "PACKED" },
  });
}

/** Seller NEW → REJECTED + captured-payment refund. The portal vocabulary shows it as CANCELLED. */
export function rejectOrder(orderId: string, reason: string): void {
  const before = getOrder(orderId);
  state().set((s) => ({
    orders: s.orders.map((o) => (o.orderId === orderId ? { ...o, status: "CANCELLED" } : o)),
  }));
  pushWrite(
    "Reject order",
    "put",
    `/seller/orders/${encodeURIComponent(orderId)}/reject`,
    { reason },
    () => {
      if (!before) return;
      state().set((s) => ({
        orders: s.orders.map((o) => (o.orderId === orderId ? before : o)),
      }));
    },
  );
  audit({
    action: "ORDER_REJECTED",
    entity: "checkout.orders",
    entityId: orderId,
    before: before && { status: before.status },
    after: { status: "CANCELLED" },
  });
}

/* ------------------------------ admin orders ----------------------------- */

/**
 * Filter accepted by the role-isolated admin order boards. Empty values are dropped from the query
 * string, so an unfiltered call reads the whole scope (all orders for a super admin, the caller's
 * district for a district admin).
 */
export interface AdminOrdersFilter {
  sellerId?: string | undefined;
  storeId?: string | undefined;
  stateCode?: string | undefined;
  districtCode?: string | undefined;
  status?: OrderStatus | "ALL" | undefined;
  q?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  limit?: number | undefined;
}

type Raw = Record<string, unknown>;

/** One order line on the admin drill-in (unit price in whole rupees, like the seller wire). */
export interface AdminOrderLineItem {
  lineId: string;
  productId?: string | undefined;
  name: string;
  variant?: string | undefined;
  qty: number;
  unitPrice: number;
  storeId?: string | undefined;
}

/** The latest delivery job for an order (absent when it was never dispatched). */
export interface AdminOrderDelivery {
  jobId?: string | undefined;
  riderId?: string | undefined;
  riderName?: string | undefined;
  riderPhone?: string | undefined;
  status?: string | undefined;
  payoutMode?: string | undefined;
  assignedAt?: string | undefined;
}

export interface AdminOrderDetail extends OrderRecord {
  lineItems: AdminOrderLineItem[];
  delivery?: AdminOrderDelivery | undefined;
}

function toStr(v: unknown): string {
  return v == null ? "" : String(v);
}

function optStr(v: unknown): string | undefined {
  return v == null || v === "" ? undefined : String(v);
}

/** Maps a `GET /admin/orders` row (the checkout admin-board projection) to the portal OrderRecord. */
export function mapAdminOrderRow(raw: Raw): OrderRecord {
  const status = toStr(raw["status"]).toUpperCase();
  const mappedStatus: OrderStatus =
    status === "REJECTED"
      ? "CANCELLED"
      : status === "NEW" ||
          status === "PACKED" ||
          status === "SHIPPED" ||
          status === "DELIVERED" ||
          status === "CANCELLED" ||
          status === "RETURNED"
        ? status
        : "NEW";
  const placedAt = toStr(raw["placedAt"]);
  const placed = Date.parse(placedAt);
  const slaRaw = toStr(raw["slaDueAt"]);
  return {
    orderId: toStr(raw["orderId"]),
    orderNumber: optStr(raw["orderNumber"]),
    sellerId: toStr(raw["sellerId"]),
    storeId: toStr(raw["storeId"]),
    customerName: toStr(raw["customerName"]) || "Customer",
    customerPhone: optStr(raw["customerPhone"]),
    sellerName: optStr(raw["sellerName"]),
    // `districtName` is the revenue district (never a city). Older gateway builds emitted the same
    // value under `city`, so fall back to it until every environment runs the renamed field.
    districtName: optStr(raw["districtName"]) ?? optStr(raw["city"]),
    stateCode: toStr(raw["stateCode"]),
    districtCode: optStr(raw["districtCode"]),
    sector: (toStr(raw["sector"]) || "MART") as Sector,
    itemsCount: Number(raw["itemsCount"] ?? 0) || 0,
    amountPaisa: Number(raw["amountPaisa"] ?? 0) || 0,
    status: mappedStatus,
    placedAt,
    statusDate: optStr(raw["statusDate"]),
    slaDueAt: slaRaw || (Number.isFinite(placed) ? new Date(placed + 4 * 3600 * 1000).toISOString() : placedAt),
    fulfillment: optStr(raw["fulfillment"]),
  };
}

function adminOrderQuery(filter: AdminOrdersFilter): Record<string, string | number | undefined> {
  return {
    sellerId: filter.sellerId,
    storeId: filter.storeId,
    stateCode: filter.stateCode,
    districtCode: filter.districtCode,
    status: filter.status && filter.status !== "ALL" ? filter.status : undefined,
    q: filter.q,
    from: filter.from,
    to: filter.to,
    limit: filter.limit,
  };
}

/** SUPER_ADMIN: every order across all districts/states (real customer identity, live filters). */
export async function fetchAdminOrders(filter: AdminOrdersFilter = {}): Promise<OrderRecord[]> {
  if (!remoteConfigured()) return [];
  const rows = await remote.get<Raw[]>("/admin/orders", { query: adminOrderQuery(filter) });
  return (toCamel(rows) as Raw[]).map(mapAdminOrderRow);
}

/** DISTRICT_ADMIN: orders scoped server-side to the caller's own district. */
export async function fetchDistrictAdminOrders(filter: AdminOrdersFilter = {}): Promise<OrderRecord[]> {
  if (!remoteConfigured()) return [];
  const rows = await remote.get<Raw[]>("/admin/district/orders", { query: adminOrderQuery(filter) });
  return (toCamel(rows) as Raw[]).map(mapAdminOrderRow);
}

/** SUPER_ADMIN single-order drill-in: line items + the latest delivery job. */
export async function getAdminOrder(orderId: string): Promise<AdminOrderDetail | null> {
  if (!remoteConfigured()) return null;
  const res = await remote.get<Raw | null>(`/admin/orders/${encodeURIComponent(orderId)}`, { allow404: true });
  if (!res) return null;
  const raw = toCamel(res) as Raw;
  const row = mapAdminOrderRow(raw);
  const lineItems: AdminOrderLineItem[] = Array.isArray(raw["lineItems"])
    ? (raw["lineItems"] as Raw[]).map((li) => ({
        lineId: toStr(li["lineId"]),
        productId: optStr(li["productId"]),
        name: toStr(li["name"]),
        variant: optStr(li["variant"]),
        qty: Number(li["qty"] ?? 0) || 0,
        unitPrice: Number(li["unitPrice"] ?? 0) || 0,
        storeId: optStr(li["storeId"]),
      }))
    : [];
  const d = raw["delivery"] as Raw | undefined;
  const delivery: AdminOrderDelivery | undefined = d
    ? {
        jobId: optStr(d["jobId"]),
        riderId: optStr(d["riderId"]),
        riderName: optStr(d["riderName"]),
        riderPhone: optStr(d["riderPhone"]),
        status: optStr(d["status"]),
        payoutMode: optStr(d["payoutMode"]),
        assignedAt: optStr(d["assignedAt"]),
      }
    : undefined;
  return { ...row, lineItems, ...(delivery ? { delivery } : {}) };
}

/** SUPER_ADMIN status override (the "customer called" support flow). */
export async function updateAdminOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  await writeAwaited("put", `/admin/orders/${encodeURIComponent(orderId)}/status`, { status });
}

/* --------------------------------- sellers ------------------------------- */

/**
 * Seller roster from the hydrated store.
 *
 * `INQUIRY` rows are web enquiries, not applications: they have no KYC and no vendors, and they are
 * triaged in Seller enquiries. "ALL" therefore means "every application", and the enquiry queue is the
 * only way to list enquiries — mixing the two here would put call-backs next to KYC decisions.
 */
export function listSellers(filter: { stateCode?: string | undefined; districtCode?: string | undefined; status?: SellerStatus | "ALL" | undefined } = {}) {
  return state().sellers.filter((s) => {
    if (filter.stateCode && s.stateCode !== filter.stateCode) return false;
    if (filter.districtCode && s.districtCode !== filter.districtCode) return false;
    if (filter.status && filter.status !== "ALL") {
      if (s.status !== filter.status) return false;
    } else if (s.status === "INQUIRY") {
      return false;
    }
    return true;
  });
}

export function getSeller(sellerId: string) {
  return state().sellers.find((s) => s.sellerId === sellerId);
}

/** Live seller roster from `GET /sellers` — the DB is the authority, the store is a cache.
 *  Same shape mapping as hydrateFromGateway; the caller keeps the hydrated/seed slice on error. */
export async function fetchSellers(): Promise<SellerRecord[]> {
  if (!remoteConfigured()) return [];
  const rows = await remote.get<
    {
      sellerId: string;
      businessName: string;
      ownerName: string;
      gstin: string;
      pan: string;
      businessAddress: string;
      contactPhone?: string;
      stateCode: string;
      districtCode?: string;
      status: string;
      rating: number;
      createdAt: string;
      contactEmail?: string;
      otpVerified?: boolean;
      otpVerifiedAt?: string;
      rejectionReason?: string;
      source?: "web" | "app";
      inquiryCategory?: SellerRecord["inquiryCategory"];
      inquiryPlatformFeePct?: number;
      inquiryNotes?: string;
      shopPhotos?: ShopPhoto[];
      inquiryStage?: InquiryStage;
      inquiryAssignedTo?: string;
      inquiryAssignedAt?: string;
    }[]
  >("/sellers");
  return rows.map((s) => ({
    ...s,
    status: s.status as SellerStatus,
    contactPhone: s.contactPhone ?? "",
  }));
}

export function listKyc(sellerId: string) {
  return state().kyc.filter((k) => k.sellerId === sellerId);
}

export function getBankAccount(sellerId: string) {
  return state().bankAccounts.find((b) => b.sellerId === sellerId);
}

/** Mask a full account number to the tail the gateway stores. An already-masked value is kept. */
export function maskAccountNumber(value: string): string {
  const trimmed = value.trim();
  if (trimmed.includes("*")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length > 4 ? `****${digits.slice(-4)}` : "*".repeat(Math.max(4, digits.length));
}

/**
 * Live payout account from `GET /sellers/{id}/bank-account`. A 404 is an honest "no account yet"
 * (not an error), so the store slice is cleared rather than left stale.
 */
export async function fetchBankAccount(sellerId: string): Promise<BankAccount | null> {
  if (!remoteConfigured()) return getBankAccount(sellerId) ?? null;
  const row = await remote.get<BankAccount>(
    `/sellers/${encodeURIComponent(sellerId)}/bank-account`,
    { allow404: true },
  );
  if (!row) {
    state().set((s) => ({
      bankAccounts: s.bankAccounts.filter((b) => b.sellerId !== sellerId),
    }));
    return null;
  }
  const account = toCamel(row);
  state().set((s) => ({
    bankAccounts: [...s.bankAccounts.filter((b) => b.sellerId !== sellerId), account],
  }));
  return account;
}

/**
 * Save the seller payout account (upsert — one per seller, `PUT /sellers/{id}/bank-account`).
 * The gateway accepts only a masked tail, so a full number is masked before it leaves the client.
 * Awaitable so the caller only shows success once the write has actually landed; a rejection rolls
 * the optimistic row back and rethrows.
 */
export async function upsertBankAccount(sellerId: string, input: BankAccountInput): Promise<void> {
  const before = getBankAccount(sellerId);
  const accountNumberMasked = maskAccountNumber(input.accountNumber);
  const ifsc = input.ifsc.toUpperCase();
  const optimistic: BankAccount = {
    bankAccountId: before?.bankAccountId ?? `bank-local-${sellerId}`,
    sellerId,
    bankName: input.bankName,
    accountNumberMasked,
    ifsc,
    beneficiaryName: input.beneficiaryName,
  };
  state().set((s) => ({
    bankAccounts: [...s.bankAccounts.filter((b) => b.sellerId !== sellerId), optimistic],
  }));
  try {
    await writeAwaited("put", `/sellers/${encodeURIComponent(sellerId)}/bank-account`, {
      bankName: input.bankName ?? "",
      accountNumberMasked,
      ifsc,
      beneficiaryName: input.beneficiaryName,
    });
  } catch (err) {
    state().set((s) => ({
      bankAccounts: [
        ...s.bankAccounts.filter((b) => b.sellerId !== sellerId),
        ...(before ? [before] : []),
      ],
    }));
    throw err;
  }
  audit({
    action: "BANK_UPDATE",
    entity: "sellers.bank_accounts",
    entityId: sellerId,
    before: before ?? null,
    after: optimistic,
  });
}

/**
 * Change a seller's moderation status (`PATCH /sellers/{id}/status`). Optimistic with rollback.
 *
 * Activating a seller has a server side effect: the gateway auto-provisions the seller's portal
 * login from the application's `contact_email` and returns it once as
 * `credential.temporaryPassword` (never stored, never logged). The result is returned to the caller
 * so the approving admin can actually share it — dropping it would leave the seller activated with
 * a login nobody knows the password to. An existing login is reused (`created: false`), and a
 * seller with no usable email is reported as `skipped` with a reason.
 */
export async function setSellerStatus(
  sellerId: string,
  status: SellerStatus,
  reason?: string,
): Promise<SellerLoginCredential | null> {
  const before = getSeller(sellerId);
  state().set((s) => ({
    sellers: s.sellers.map((seller) =>
      seller.sellerId === sellerId ? { ...seller, status } : seller,
    ),
  }));
  try {
    if (!remoteConfigured()) return null;
    const res = await remote.patch<SellerRecord & { credential?: SellerLoginCredential }>(
      `/sellers/${encodeURIComponent(sellerId)}/status`,
      { status, ...(reason ? { reason } : {}) },
    );
    // The gateway is the authority on the resulting status (it can refuse an activation).
    patchSellerLocal(sellerId, { status: (res.status as SellerStatus | undefined) ?? status });
    const credential = res.credential ? toCamel(res.credential) : null;
    audit({
      action: `SELLER_${status}`,
      entity: "sellers.sellers",
      entityId: sellerId,
      before: before && { status: before.status },
      after: { status, reason },
    });
    return credential;
  } catch (err) {
    if (before) patchSellerLocal(sellerId, { status: before.status });
    throw err;
  }
}

/** Live review projection. Returns null in seed mode (the page falls back to local fixtures). */
export async function fetchSellerDetail(sellerId: string): Promise<SellerDetail | null> {
  if (!remoteConfigured()) return null;
  const detail = await remote.get<SellerDetail>(`/sellers/${encodeURIComponent(sellerId)}`);
  return toCamel(detail);
}

/**
 * The signed-in seller's own application row (`GET /sellers/me`, auth-scoped by the caller's
 * identity). Returns null when the account has no seller application. Used to surface the real
 * onboarding/moderation status (PENDING_REVIEW / ACTIVE / REJECTED / SUSPENDED) in the portal.
 */
export async function fetchSellerMe(): Promise<SellerRecord | null> {
  if (!remoteConfigured()) return null;
  try {
    const row = await remote.get<SellerRecord>("/sellers/me");
    return toCamel(row);
  } catch {
    return null;
  }
}

function patchSellerLocal(sellerId: string, patch: Partial<SellerRecord>): void {
  state().set((s) => ({
    sellers: s.sellers.map((seller) =>
      seller.sellerId === sellerId ? { ...seller, ...patch } : seller,
    ),
  }));
}

/**
 * Save a seller's editable business-profile fields through `PATCH /sellers/{id}`. Optimistic with
 * rollback so a rejected write never lingers. KYC-bearing changes (GSTIN/PAN/address) re-enter admin
 * review server-side (the account returns to PENDING_REVIEW for a seller-initiated edit).
 */
export async function updateSeller(sellerId: string, patch: SellerProfilePatch): Promise<void> {
  const before = getSeller(sellerId);
  patchSellerLocal(sellerId, patch);
  try {
    if (remoteConfigured()) {
      const row = await remote.patch<SellerRecord>(`/sellers/${encodeURIComponent(sellerId)}`, patch);
      // Reconcile with the authoritative row: a KYC edit may have re-queued the account's status.
      const server = toCamel(row);
      state().set((s) => ({
        sellers: s.sellers.map((seller) =>
          seller.sellerId === sellerId ? { ...seller, ...server } : seller,
        ),
      }));
    }
  } catch (err) {
    if (before) {
      state().set((s) => ({
        sellers: s.sellers.map((seller) => (seller.sellerId === sellerId ? before : seller)),
      }));
    }
    throw err;
  }
  const beforeValues: SellerProfilePatch = {};
  if (before) {
    if (patch.businessName !== undefined) beforeValues.businessName = before.businessName;
    if (patch.ownerName !== undefined) beforeValues.ownerName = before.ownerName;
    if (patch.gstin !== undefined) beforeValues.gstin = before.gstin;
    if (patch.pan !== undefined) beforeValues.pan = before.pan;
    if (patch.businessAddress !== undefined) beforeValues.businessAddress = before.businessAddress;
    if (patch.contactPhone !== undefined) beforeValues.contactPhone = before.contactPhone;
  }
  audit({
    action: "SELLER_PROFILE_UPDATE",
    entity: "sellers.sellers",
    entityId: sellerId,
    before: beforeValues,
    after: patch,
  });
}

/* ------------------------------ seller settings --------------------------- */

/**
 * Per-seller alert preferences (`sellers.notification_preferences`). The optimistic write rolls back
 * on a rejected gateway call so the switch never lies about being saved.
 */
export function getNotificationPreferences(): NotificationPreferences {
  return state().notificationPreferences;
}

/** Hydrates the seller's alert preferences from `GET /seller/notifications/preferences`. */
export async function fetchNotificationPreferences(): Promise<NotificationPreferences | null> {
  if (!remoteConfigured()) return null;
  const raw = await remote.get<Partial<NotificationPreferences>>("/seller/notifications/preferences");
  return {
    newOrder: raw.newOrder !== false,
    lowStock: raw.lowStock !== false,
    slaBreach: raw.slaBreach !== false,
    campaigns: raw.campaigns !== false,
  };
}

export function updateNotificationPreferences(patch: Partial<NotificationPreferences>): void {
  const before = getNotificationPreferences();
  const next = { ...before, ...patch };
  state().set(() => ({ notificationPreferences: next }));
  pushWrite("Notification preferences", "put", "/seller/notifications/preferences", next, () => {
    state().set(() => ({ notificationPreferences: before }));
  });
  audit({
    action: "NOTIFICATION_PREFS_UPDATE",
    entity: "sellers.notification_preferences",
    entityId: state().session?.sellerId ?? "",
    before,
    after: next,
  });
}

export function listSubUsers(sellerId: string): SubUser[] {
  return state().subUsers.filter((u) => u.sellerId === sellerId);
}

export function getSubUser(subUserId: string): SubUser | undefined {
  return state().subUsers.find((u) => u.subUserId === subUserId);
}

/** The seller's staff roster from `GET /seller/sub-users` (local slice in seed mode). */
export async function fetchSubUsers(): Promise<SubUser[]> {
  if (!remoteConfigured()) return state().subUsers;
  return remote.get<SubUser[]>("/seller/sub-users");
}

export interface InviteSubUserInput {
  name: string;
  email: string;
  role: SubUserRole;
}

/**
 * Invite a staff sub-user via `POST /seller/sub-users`. The gateway mints the roster row and a
 * one-time accept token (returned once, never stored client-side); the caller shows the link to the
 * owner to share. Requires the gateway — a credential cannot be minted offline.
 */
export async function inviteSubUser(_sellerId: string, input: InviteSubUserInput): Promise<SubUserInvite> {
  if (!remoteConfigured()) throw new ApiError(0, "unconfigured", "Gateway is not configured");
  const invite = await remote.post<SubUserInvite>("/seller/sub-users", {
    name: input.name.trim(),
    email: input.email.trim(),
    role: input.role,
  });
  state().set((s) => ({
    subUsers: [invite, ...s.subUsers.filter((u) => u.subUserId !== invite.subUserId)],
  }));
  audit({
    action: "SUBUSER_INVITE",
    entity: "sellers.sub_users",
    entityId: invite.subUserId,
    after: invite,
  });
  return invite;
}

/** Rotate a pending invite's one-time accept link. Returns the new token (shown once). */
export async function resendSubUserInvite(_sellerId: string, subUserId: string): Promise<SubUserInvite> {
  if (!remoteConfigured()) throw new ApiError(0, "unconfigured", "Gateway is not configured");
  const invite = await remote.post<SubUserInvite>(
    `/seller/sub-users/${encodeURIComponent(subUserId)}/resend`,
  );
  state().set((s) => ({
    subUsers: s.subUsers.map((u) => (u.subUserId === subUserId ? invite : u)),
  }));
  audit({
    action: "SUBUSER_INVITE_RESEND",
    entity: "sellers.sub_users",
    entityId: subUserId,
    after: invite,
  });
  return invite;
}

/** Revoke a staff sub-user via `DELETE /seller/sub-users/{id}`. Optimistic removal with re-insert on a rejected write. */
export async function removeSubUser(subUserId: string): Promise<void> {
  const before = getSubUser(subUserId);
  if (!before) return;
  state().set((s) => ({ subUsers: s.subUsers.filter((u) => u.subUserId !== subUserId) }));
  try {
    await writeAwaited("delete", `/seller/sub-users/${encodeURIComponent(subUserId)}`);
  } catch (err) {
    state().set((s) =>
      s.subUsers.some((u) => u.subUserId === subUserId) ? s : { subUsers: [before, ...s.subUsers] },
    );
    throw err;
  }
  audit({ action: "SUBUSER_REVOKE", entity: "sellers.sub_users", entityId: subUserId, before });
}

/** Admin: set one vendor's platform fee (server re-checks the app's floor). */
export async function updateVendorPlatformFee(
  sellerId: string,
  storeId: string,
  platformFeePct: number,
): Promise<void> {
  if (!remoteConfigured()) throw new ApiError(0, "unconfigured", "Gateway is not configured");
  await remote.patch(`/sellers/${encodeURIComponent(sellerId)}/platform-fee`, {
    storeId,
    platformFeePct,
  });
  audit({
    action: "SELLER_PLATFORM_FEE",
    entity: "directory.stores",
    entityId: storeId,
    after: { sellerId, storeId, platformFeePct },
  });
}

/** Admin: mark one manual document check (PAN, GSTIN, FSSAI, PASSBOOK). */
export async function verifySellerDocument(
  sellerId: string,
  docType: string,
  notes = "",
): Promise<SellerDetail | null> {
  if (!remoteConfigured()) {
    state().set((s) => ({
      kyc: s.kyc.map((doc) =>
        doc.sellerId === sellerId && doc.docType === docType ? { ...doc, verified: true } : doc,
      ),
    }));
    return null;
  }
  const detail = await remote.post<SellerDetail>(
    `/sellers/${encodeURIComponent(sellerId)}/verify-doc/${encodeURIComponent(docType.toUpperCase())}`,
    { notes },
  );
  return toCamel(detail);
}

/** Admin: verify KYC and activate the seller. */
export async function verifySellerKyc(sellerId: string): Promise<SellerDetail | null> {
  if (!remoteConfigured()) {
    patchSellerLocal(sellerId, { status: "ACTIVE" });
    return null;
  }
  const detail = toCamel(
    await remote.post<SellerDetail>(`/sellers/${encodeURIComponent(sellerId)}/verify-kyc`, {}),
  );
  patchSellerLocal(sellerId, { status: detail.status });
  audit({
    action: "SELLER_VERIFY_KYC",
    entity: "sellers.sellers",
    entityId: sellerId,
    after: { status: detail.status },
  });
  return detail;
}

/** Admin: reject with a reason (appended to the rejection history). */
export async function rejectSellerApplication(sellerId: string, reason: string): Promise<void> {
  patchSellerLocal(sellerId, { status: "REJECTED", rejectionReason: reason });
  if (!remoteConfigured()) return;
  try {
    await remote.post(`/sellers/${encodeURIComponent(sellerId)}/reject`, { reason });
    audit({
      action: "SELLER_REJECTED",
      entity: "sellers.sellers",
      entityId: sellerId,
      after: { status: "REJECTED", reason },
    });
  } catch (err) {
    patchSellerLocal(sellerId, { status: "PENDING_REVIEW" });
    throw err;
  }
}

/**
 * Admin: append one KYC document to an application (`POST /sellers/{id}/kyc`). Used when a document is
 * missing entirely — a fresh upload rather than a replacement.
 */
export async function addSellerKycDocument(
  sellerId: string,
  docType: KycDocument["docType"],
  upload: { key: string; assetId: string },
): Promise<SellerDetail> {
  if (!remoteConfigured()) throw new ApiError(0, "unconfigured", "Gateway is not configured");
  const detail = toCamel(
    await remote.post<SellerDetail>(`/sellers/${encodeURIComponent(sellerId)}/kyc`, {
      docType,
      fileKey: upload.key,
      assetId: upload.assetId,
    }),
  );
  audit({
    action: "KYC_ADD",
    entity: "sellers.sellers",
    entityId: sellerId,
    after: { docType },
  });
  return detail;
}

/**
 * Admin: replace the current document of one type (`PUT /sellers/{id}/kyc/{docType}`). The old row is
 * removed and the new upload lands unverified, so it re-enters review. Distinct from appending.
 */
export async function replaceSellerKycDocument(
  sellerId: string,
  docType: KycDocument["docType"],
  upload: { key: string; assetId: string },
): Promise<SellerDetail> {
  if (!remoteConfigured()) throw new ApiError(0, "unconfigured", "Gateway is not configured");
  const detail = toCamel(
    await remote.put<SellerDetail>(
      `/sellers/${encodeURIComponent(sellerId)}/kyc/${encodeURIComponent(docType)}`,
      { fileKey: upload.key, assetId: upload.assetId },
    ),
  );
  audit({
    action: "KYC_REPLACE",
    entity: "sellers.sellers",
    entityId: sellerId,
    after: { docType },
  });
  return detail;
}

/**
 * Admin: ask the applicant to (re)upload a KYC document. The applicant fulfils it from the
 * customer-app Sell with us screen; the returned detail carries the new `documentRequests` trail.
 */
export async function requestSellerDocument(
  sellerId: string,
  docType: KycDocument["docType"],
  note = "",
): Promise<SellerDetail> {
  if (!remoteConfigured()) throw new ApiError(0, "unconfigured", "Gateway is not configured");
  const detail = toCamel(
    await remote.post<SellerDetail>(`/sellers/${encodeURIComponent(sellerId)}/document-requests`, {
      docType,
      note,
    }),
  );
  audit({
    action: "DOCUMENT_REQUEST",
    entity: "sellers.sellers",
    entityId: sellerId,
    after: { docType },
  });
  return detail;
}

/** Short-lived presigned GET for a private KYC asset (creator or admin only). */
export async function fetchPrivateDocumentUrl(assetId: string): Promise<string | null> {  if (!remoteConfigured()) return null;
  const res = await remote.get<{ url: string }>(`/media/private/${encodeURIComponent(assetId)}`);
  return res.url;
}

/* --------------------------------- stores -------------------------------- */

export function listStores(filter: { sellerId?: string | undefined; stateCode?: string | undefined } = {}) {
  return state().stores.filter((st) => {
    if (filter.sellerId && st.sellerId !== filter.sellerId) return false;
    if (filter.stateCode && st.stateCode !== filter.stateCode) return false;
    return true;
  });
}

/** One seller-owned store as returned by `GET /seller/stores` (server scope, not the seed fixture). */
export interface SellerStoreSummary {
  storeId: string;
  name: string;
  /** Tamil display copy (0108). Empty → the customer app falls back to `name`/`desc`. */
  nameTa?: string;
  descTa?: string;
  sector: Sector;
  address?: string;
  phone?: string;
  hours?: string;
  deliveryTime?: string;
  /** Advance-order availability (0142), configured once on the store profile. */
  instantDelivery: boolean;
  acceptsScheduledOrders: boolean;
  scheduleLeadTimeMinutes: number;
  scheduleSlots: string[];
  isVeg: boolean;
  isLive: boolean;
  /** Per-vendor platform fee (0069) — the fee is a property of the shop, not the account. */
  platformFeePct: number;
  sellerCategoryId?: string;
  /** Per-shop licences: FOOD FSSAI (0069) and PHARMA drug licence (0076). */
  fssaiNumber?: string;
  fssaiCertKey?: string;
  fssaiCertAssetId?: string;
  drugLicenseNumber?: string;
  drugLicenseCertKey?: string;
  drugLicenseCertAssetId?: string;
  /**
   * The shop's public geo pin (0041). Null when it was never pinned — delivery-fee quoting and
   * auto-dispatch both require it, so the console surfaces a missing pin as an actionable warning
   * rather than silently quoting the base fee.
   */
  latitude?: number;
  longitude?: number;
  /** Per-shop restock defaults (0123) applied when a retail SKU is turned back on. */
  restockQty: number;
  restockEtaMinutes: number;
  /** Saved legal-metrology defaults used to prefill a new listing (0137). */
  complianceDefaults?: LegalMetrology;
}

/**
 * The caller's real store rows. Used by the create-listing flow because the gateway only accepts a
 * store the logged-in seller owns; the local seed directory can diverge from production ids. Also the
 * data source for the seller console vendor switcher.
 */
export async function fetchSellerStores(): Promise<SellerStoreSummary[]> {
  if (!remoteConfigured()) return [];
  const rows = await remote.get<
    {
      id: string;
      name: string;
      nameTa?: string;
      descTa?: string;
      app: string;
      address?: string;
      phone?: string;
      hours?: string;
      deliveryTime?: string;
      instantDelivery?: boolean;
      acceptsScheduledOrders?: boolean;
      scheduleLeadTimeMinutes?: number;
      scheduleSlots?: string[];
      isVeg?: boolean;
      isLive?: boolean;
      platformFeePct?: number;
      sellerCategoryId?: string;
      fssaiNumber?: string;
      fssaiCertKey?: string;
      fssaiCertAssetId?: string;
      drugLicenseNumber?: string;
      drugLicenseCertKey?: string;
      drugLicenseCertAssetId?: string;
      latitude?: number | null;
      longitude?: number | null;
      restockQty?: number;
      restockEtaMinutes?: number;
      complianceDefaults?: LegalMetrology;
    }[]
  >("/seller/stores");
  return rows.map((row) => ({
    storeId: row.id,
    name: row.name,
    ...(row.nameTa ? { nameTa: row.nameTa } : {}),
    ...(row.descTa ? { descTa: row.descTa } : {}),
    sector: row.app as Sector,
    ...(row.address ? { address: row.address } : {}),
    ...(row.phone ? { phone: row.phone } : {}),
    ...(row.hours ? { hours: row.hours } : {}),
    ...(row.deliveryTime ? { deliveryTime: row.deliveryTime } : {}),
    instantDelivery: row.instantDelivery ?? true,
    acceptsScheduledOrders: row.acceptsScheduledOrders ?? false,
    scheduleLeadTimeMinutes: row.scheduleLeadTimeMinutes ?? 60,
    scheduleSlots: row.scheduleSlots ?? [],
    isVeg: row.isVeg === true,
    isLive: row.isLive === true,
    platformFeePct: row.platformFeePct ?? 0,
    ...(row.sellerCategoryId ? { sellerCategoryId: row.sellerCategoryId } : {}),
    ...(row.fssaiNumber ? { fssaiNumber: row.fssaiNumber } : {}),
    ...(row.fssaiCertKey ? { fssaiCertKey: row.fssaiCertKey } : {}),
    ...(row.fssaiCertAssetId ? { fssaiCertAssetId: row.fssaiCertAssetId } : {}),
    ...(row.drugLicenseNumber ? { drugLicenseNumber: row.drugLicenseNumber } : {}),
    ...(row.drugLicenseCertKey ? { drugLicenseCertKey: row.drugLicenseCertKey } : {}),
    ...(row.drugLicenseCertAssetId ? { drugLicenseCertAssetId: row.drugLicenseCertAssetId } : {}),
    ...(typeof row.latitude === "number" ? { latitude: row.latitude } : {}),
    ...(typeof row.longitude === "number" ? { longitude: row.longitude } : {}),
    restockQty: row.restockQty ?? 10,
    restockEtaMinutes: row.restockEtaMinutes ?? 30,
    ...(row.complianceDefaults ? { complianceDefaults: row.complianceDefaults } : {}),
  }));
}

/* ------------------------------ notifications ---------------------------- */

/** One row from `GET /notifications` (notifications.outbox, scoped to the signed-in portal user). */
export interface PortalNotification {
  id: string;
  kind: string;
  title: string;
  body: string;
  /** PII-free payload; product moderation rows carry `deepLink` + `productId`. */
  data?: Record<string, unknown>;
  status: string;
  createdAt: string;
  readAt?: string;
}

/** The caller's notification inbox, newest first. Empty when the gateway is unconfigured. */
export async function fetchNotifications(): Promise<PortalNotification[]> {
  if (!remoteConfigured()) return [];
  const rows = await remote.get<
    {
      id: string;
      kind: string;
      title: string;
      body: string;
      data?: Record<string, unknown>;
      status: string;
      createdAt: string;
      readAt?: string;
    }[]
  >("/notifications");
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    ...(row.data ? { data: row.data } : {}),
    status: row.status,
    createdAt: row.createdAt,
    ...(row.readAt ? { readAt: row.readAt } : {}),
  }));
}

/** Mark one notification read (in-app state; a foreign/unknown id is a server no-op). */
export async function markNotificationRead(id: string): Promise<void> {
  if (!remoteConfigured()) return;
  await remote.post(`/notifications/${encodeURIComponent(id)}/read`);
}

/** Mark every notification for the signed-in user read. */
export async function markAllNotificationsRead(): Promise<void> {
  if (!remoteConfigured()) return;
  await remote.post("/notifications/read-all");
}

/** Unread inbox badge count for the signed-in portal user (incoming-call rows excluded). */
export async function fetchUnreadNotificationCount(): Promise<number> {
  if (!remoteConfigured()) return 0;
  try {
    const res = await remote.get<{ count: number }>("/notifications/unread-count");
    return res.count ?? 0;
  } catch {
    return 0;
  }
}

/** One row from `GET /admin/notifications` (admin-only cross-user outbox view). */
export interface AdminNotification extends PortalNotification {
  /** Recipient user id (admin outbox only; never shown to end users). */
  userId?: string;
  attempts?: number;
}

/** Admin console outbox (`GET /admin/notifications`), optionally filtered by delivery status. */
export async function fetchAdminNotifications(status?: string): Promise<AdminNotification[]> {
  if (!remoteConfigured()) return [];
  const qs = status && status !== "ALL" ? `?status=${encodeURIComponent(status)}` : "";
  const rows = await remote.get<AdminNotification[]>(`/admin/notifications${qs}`);
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    ...(row.data ? { data: row.data } : {}),
    status: row.status,
    createdAt: row.createdAt,
    ...(row.readAt ? { readAt: row.readAt } : {}),
    ...(row.userId ? { userId: row.userId } : {}),
    ...(typeof row.attempts === "number" ? { attempts: row.attempts } : {}),
  }));
}

export interface CreateVendorInput {
  name: string;
  /** Tamil display copy (0108). Empty/absent → the customer app falls back to the English copy. */
  nameTa?: string;
  descTa?: string;
  app: Sector;
  address?: string;
  phone?: string;
  hours?: string;
  instantDelivery?: boolean;
  acceptsScheduledOrders?: boolean;
  scheduleLeadTimeMinutes?: number;
  scheduleSlots?: string[];
  isLive?: boolean;
  fssaiNumber?: string;
  fssaiFileKey?: string;
  fssaiAssetId?: string;
  drugLicenseNumber?: string;
  drugLicenseFileKey?: string;
  drugLicenseAssetId?: string;
  /** The shop's pin. Both or neither; absent leaves the vendor unpinned (base delivery fee). */
  latitude?: number;
  longitude?: number;
}

/** Create a vendor for the signed-in seller account. Commercial fields stay server-validated. */
export async function createSellerVendor(input: CreateVendorInput): Promise<SellerStoreSummary> {
  if (!remoteConfigured()) throw new ApiError(0, "unconfigured", "Gateway is not configured");
  const row = await remote.post<{
    id: string;
    name: string;
    app: string;
    address?: string;
    phone?: string;
    hours?: string;
    instantDelivery?: boolean;
    acceptsScheduledOrders?: boolean;
    scheduleLeadTimeMinutes?: number;
    scheduleSlots?: string[];
    isVeg?: boolean;
    isLive?: boolean;
    platformFeePct?: number;
    sellerCategoryId?: string;
    fssaiNumber?: string;
    fssaiCertKey?: string;
    fssaiCertAssetId?: string;
    drugLicenseNumber?: string;
    drugLicenseCertKey?: string;
    drugLicenseCertAssetId?: string;
    latitude?: number | null;
    longitude?: number | null;
    restockQty?: number;
    restockEtaMinutes?: number;
  }>("/seller/stores", {
    name: input.name,
    ...(input.nameTa ? { nameTa: input.nameTa } : {}),
    ...(input.descTa ? { descTa: input.descTa } : {}),
    app: input.app,
    address: input.address ?? "",
    phone: input.phone ?? "",
    hours: input.hours ?? "",
    ...(input.instantDelivery !== undefined ? { instantDelivery: input.instantDelivery } : {}),
    ...(input.acceptsScheduledOrders !== undefined
      ? { acceptsScheduledOrders: input.acceptsScheduledOrders }
      : {}),
    ...(input.scheduleLeadTimeMinutes !== undefined
      ? { scheduleLeadTimeMinutes: input.scheduleLeadTimeMinutes }
      : {}),
    ...(input.scheduleSlots ? { scheduleSlots: input.scheduleSlots } : {}),
    ...(input.isLive !== undefined ? { isLive: input.isLive } : {}),
    ...(input.fssaiNumber ? { fssaiNumber: input.fssaiNumber } : {}),
    ...(input.fssaiFileKey ? { fssaiFileKey: input.fssaiFileKey } : {}),
    ...(input.fssaiAssetId ? { fssaiAssetId: input.fssaiAssetId } : {}),
    ...(input.drugLicenseNumber ? { drugLicenseNumber: input.drugLicenseNumber } : {}),
    ...(input.drugLicenseFileKey ? { drugLicenseFileKey: input.drugLicenseFileKey } : {}),
    ...(input.drugLicenseAssetId ? { drugLicenseAssetId: input.drugLicenseAssetId } : {}),
    ...(typeof input.latitude === "number" && typeof input.longitude === "number"
      ? { latitude: input.latitude, longitude: input.longitude }
      : {}),
  });
  return {
    storeId: row.id,
    name: row.name,
    sector: row.app as Sector,
    ...(row.address ? { address: row.address } : {}),
    ...(row.phone ? { phone: row.phone } : {}),
    ...(row.hours ? { hours: row.hours } : {}),
    instantDelivery: row.instantDelivery ?? true,
    acceptsScheduledOrders: row.acceptsScheduledOrders ?? false,
    scheduleLeadTimeMinutes: row.scheduleLeadTimeMinutes ?? 60,
    scheduleSlots: row.scheduleSlots ?? [],
    isVeg: row.isVeg === true,
    isLive: row.isLive === true,
    platformFeePct: row.platformFeePct ?? 0,
    ...(row.sellerCategoryId ? { sellerCategoryId: row.sellerCategoryId } : {}),
    ...(row.fssaiNumber ? { fssaiNumber: row.fssaiNumber } : {}),
    ...(row.fssaiCertKey ? { fssaiCertKey: row.fssaiCertKey } : {}),
    ...(row.fssaiCertAssetId ? { fssaiCertAssetId: row.fssaiCertAssetId } : {}),
    ...(row.drugLicenseNumber ? { drugLicenseNumber: row.drugLicenseNumber } : {}),
    ...(row.drugLicenseCertKey ? { drugLicenseCertKey: row.drugLicenseCertKey } : {}),
    ...(row.drugLicenseCertAssetId ? { drugLicenseCertAssetId: row.drugLicenseCertAssetId } : {}),
    ...(typeof row.latitude === "number" ? { latitude: row.latitude } : {}),
    ...(typeof row.longitude === "number" ? { longitude: row.longitude } : {}),
    restockQty: row.restockQty ?? 10,
    restockEtaMinutes: row.restockEtaMinutes ?? 30,
  };
}

/** Save a vendor profile (name/address/phone/hours/live/veg + licences). Sellers cannot set the fee here. */
export async function updateSellerStore(
  storeId: string,
  patch: {
    name?: string;
    /** Tamil display copy (0108). An empty string clears the translation. */
    nameTa?: string;
    descTa?: string;
    address?: string;
    phone?: string;
    hours?: string;
    /** Advance-order availability (0142). Omitted keeps the stored value. */
    instantDelivery?: boolean;
    acceptsScheduledOrders?: boolean;
    scheduleLeadTimeMinutes?: number;
    scheduleSlots?: string[];
    isLive?: boolean;
    isVeg?: boolean;
    fssaiNumber?: string;
    fssaiFileKey?: string;
    fssaiAssetId?: string;
    drugLicenseNumber?: string;
    drugLicenseFileKey?: string;
    drugLicenseAssetId?: string;
    /** The shop's pin. Both or neither; omitted keeps the current pin. */
    latitude?: number;
    longitude?: number;
    /** Per-shop restock defaults (0123). Omitted keeps the current values. */
    restockQty?: number;
    restockEtaMinutes?: number;
    /** Saved legal-metrology defaults (0137). Omitted keeps the stored profile. */
    complianceDefaults?: LegalMetrology;
  },
): Promise<void> {
  if (!remoteConfigured()) throw new ApiError(0, "unconfigured", "Gateway is not configured");
  // Only a complete pin is sent: the gateway rejects a half pin, and a caller that never touched the
  // map must not clear an existing one.
  const { latitude, longitude, ...rest } = patch;
  const body =
    typeof latitude === "number" && typeof longitude === "number"
      ? { ...rest, latitude, longitude }
      : rest;
  await remote.put(`/seller/stores/${encodeURIComponent(storeId)}`, body);
}

/* --------------------------- reference data ------------------------------ */

/** One state/UT from `GET /geo/states` (admins.states — the DB is the authority; no client literals). */
export interface StateSummary {
  stateCode: string;
  name: string;
  kind: "STATE" | "UT";
}

/** One app brand from `GET /geo/apps` (ops.app_brand). */
export interface AppBrandSummary {
  brand: Sector;
  label: string;
}

/** One ad placement from `GET /ads/placements` (ads.placements). */
export interface PlacementSummary {
  placement: string;
  label: string;
  reachNote: string;
  apps: Sector[];
  targetTypes: string[];
}

export async function fetchStates(): Promise<StateSummary[]> {
  if (!remoteConfigured()) return [];
  return remote.get<StateSummary[]>("/geo/states");
}

/** One row from `GET /geo/districts` (admins.district_master — the DB is the authority). */
export interface DistrictInfo {
  districtCode: string;
  name: string;
  stateCode: string;
}

export async function fetchDistricts(): Promise<DistrictInfo[]> {
  if (!remoteConfigured()) return [];
  return remote.get<DistrictInfo[]>("/geo/districts");
}

/** One district row from the SUPER_ADMIN coverage API (`GET /admin/districts`) — every row,
 * including deactivated ones, with its lifecycle timestamps. */
export interface AdminDistrictRow extends DistrictInfo {
  isActive: boolean;
  /** True when a seller, admin, login or delivery order still references the code. */
  inUse: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | undefined;
  deleteReason?: string | undefined;
  purgeAt?: string | undefined;
}

/** Create/update payload for the district coverage API. `districtCode` is read only on create —
 * it is the primary key, so an edit addresses the row by code and never rewrites it. */
export interface DistrictInput {
  districtCode?: string;
  name: string;
  stateCode: string;
  isActive?: boolean;
}

/** Superadmin-only: every district (including deactivated), optionally state-filtered. */
export async function listAdminDistricts(stateCode?: string): Promise<AdminDistrictRow[]> {
  const q = stateCode ? `?state=${encodeURIComponent(stateCode)}` : "";
  return remote.get<AdminDistrictRow[]>(`/admin/districts${q}`);
}

/** Superadmin-only: create a district (audit-logged; the geo mirror reloads immediately). */
export async function createDistrict(input: DistrictInput): Promise<AdminDistrictRow> {
  return remote.post<AdminDistrictRow>("/admin/districts", input);
}

/** Superadmin-only: rename a district and/or move it to another state (code is immutable). */
export async function updateDistrict(
  code: string,
  input: DistrictInput,
): Promise<AdminDistrictRow> {
  return remote.put<AdminDistrictRow>(`/admin/districts/${encodeURIComponent(code)}`, input);
}

/** Superadmin-only: flip is_active — hides the district from the seller picker without deleting it. */
export async function toggleDistrict(code: string, isActive: boolean): Promise<AdminDistrictRow> {
  return remote.patch<AdminDistrictRow>(`/admin/districts/${encodeURIComponent(code)}/toggle`, {
    isActive,
  });
}

/**
 * Superadmin-only: move a district to the trash. Blocked with `district_in_use` when sellers,
 * admins or payouts still reference it — deactivate instead. Restorable for 7 days, then purged.
 */
export async function deleteDistrict(code: string, reason = ""): Promise<AdminDistrictRow | null> {
  const q = reason.trim() ? `?reason=${encodeURIComponent(reason.trim())}` : "";
  return remote.delete<AdminDistrictRow>(`/admin/districts/${encodeURIComponent(code)}${q}`);
}

/** Superadmin-only: trashed districts still inside the 7-day restore window. */
export async function listDeletedDistricts(stateCode?: string): Promise<AdminDistrictRow[]> {
  const q = stateCode ? `?state=${encodeURIComponent(stateCode)}` : "";
  return remote.get<AdminDistrictRow[]>(`/admin/districts/trash${q}`);
}

/** Superadmin-only: restore a trashed district (it comes back deactivated). */
export async function restoreDistrict(code: string): Promise<AdminDistrictRow> {
  return remote.post<AdminDistrictRow>(`/admin/districts/${encodeURIComponent(code)}/restore`);
}

/** Superadmin-only: permanently delete one trashed, unreferenced district now. */
export async function purgeDistrict(code: string): Promise<void> {
  await remote.delete(`/admin/districts/${encodeURIComponent(code)}/permanent`);
}

export async function fetchApps(): Promise<AppBrandSummary[]> {
  if (!remoteConfigured()) return [];
  return remote.get<AppBrandSummary[]>("/geo/apps");
}

export async function fetchPlacements(): Promise<PlacementSummary[]> {
  if (!remoteConfigured()) return [];
  return remote.get<PlacementSummary[]>("/ads/placements");
}

/** Active top-level categories of one app from `GET /categories?app=&top_level=true` (taxonomy is the authority). */
export async function fetchCategories(app: Sector): Promise<CategoryRow[]> {
  if (!remoteConfigured()) return [];
  return remote.get<CategoryRow[]>(`/categories?app=${app}&top_level=true`);
}

/** Full active category tree of one app (`GET /categories?app=`), used by seller product creation. */
export async function fetchCategoryTree(app: Sector): Promise<CategoryRow[]> {
  if (!remoteConfigured()) return [];
  return remote.get<CategoryRow[]>(`/categories?app=${app}`);
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

export function listCampaigns(
  filter: {
    stateCode?: string | undefined;
    scope?: CampaignScope | undefined;
    /** Keep only campaigns open to this vertical (sector-less campaigns always pass). */
    sector?: Sector | undefined;
  } = {},
) {
  return state().campaigns.filter((c) => {
    if (filter.scope && c.scope !== filter.scope) return false;
    if (filter.stateCode && c.scope === "STATE" && c.stateCode !== filter.stateCode) return false;
    if (filter.sector && c.sector && c.sector !== filter.sector) return false;
    return true;
  });
}

export interface CampaignDto {
  name: string;
  scope: CampaignScope;
  stateCode?: string | undefined;
  /** Vertical the campaign is limited to (0123). Omitted = every vertical. */
  sector?: Sector | undefined;
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
      sector: dto.sector ?? "",
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
  /** Active store the opt-in is made from; the gateway rejects products outside this store's sector. */
  storeId?: string;
  productId: string;
  discountPercent: number;
}): void {
  const existing = state().optins.find(
    (o) => o.campaignId === input.campaignId && o.productId === input.productId,
  );
  const { storeId: _storeId, ...optinInput } = input;
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
            ...optinInput,
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

export function listAdSlots(
  filter: {
    sellerId?: string | undefined;
    stateCode?: string | undefined;
    storeId?: string | undefined;
  } = {},
) {
  const s = state();
  // A rail slot belongs to the store that owns its product, so a store switch re-scopes the rails.
  const storeByProduct = new Map(s.products.map((p) => [p.productId, p.storeId]));
  return s.adSlots.filter((a) => {
    if (filter.sellerId && a.sellerId !== filter.sellerId) return false;
    if (filter.stateCode && a.stateCode !== filter.stateCode) return false;
    if (filter.storeId && storeByProduct.get(a.productId) !== filter.storeId) return false;
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

/** The store a hero campaign actually runs for: its explicit storeId when set (STORE_TOP), else the
 *  store that owns its target (PRODUCT → product.storeId, DISH/VENUE → dish.venueId, STORE → id). */
function campaignStoreId(c: HeroCampaign): string {
  if (c.storeId) return c.storeId;
  const s = state();
  if (c.targetType === "PRODUCT") return s.products.find((p) => p.productId === c.targetId)?.storeId ?? "";
  if (c.targetType === "DISH" || c.targetType === "VENUE") {
    return s.menus.find((m) => m.dishId === c.targetId)?.venueId ?? "";
  }
  if (c.targetType === "STORE") return c.targetId;
  return "";
}

/** Seller/admin-safe campaign rows from the local store (hydrated from `GET /ads/campaigns`). */
export function listHeroCampaigns(
  filter: { sellerId?: string | undefined; stateCode?: string | undefined; storeId?: string | undefined } = {},
): HeroCampaign[] {
  return state().heroCampaigns.filter((c) => {
    if (filter.sellerId && c.sellerId !== filter.sellerId) return false;
    if (filter.stateCode && c.stateCode !== filter.stateCode) return false;
    if (filter.storeId && campaignStoreId(c) !== filter.storeId) return false;
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
  /** DRAFT (saved, hidden) or LIVE (served). Defaults to LIVE for the buy-a-hero wizard. */
  status?: AdStatus | undefined;
  sortOrder?: number | undefined;
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
  const status: AdStatus = dto.status ?? "LIVE";
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
    status,
    reports: 0,
    impressions: 0,
    clicks: 0,
    ordersAttributed: 0,
    sortOrder: dto.sortOrder ?? 0,
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
      status,
      sortOrder: dto.sortOrder ?? 0,
    },
    () => state().set(() => ({ heroCampaigns: before })),
  );
  audit({
    action: status === "DRAFT" ? "AD_CAMPAIGN_DRAFT" : "AD_CAMPAIGN_PUBLISH",
    entity: "ads.campaigns",
    entityId: campaignId,
    after: created,
  });
}

/** Re-reads the caller's campaign rows into the store (after a playlist write). */
export async function refreshHeroCampaigns(): Promise<HeroCampaign[]> {
  if (!remoteConfigured()) return state().heroCampaigns;
  const rows = await remote.get<HeroCampaign[]>("/ads/campaigns").then(toCamel);
  state().set(() => ({ heroCampaigns: rows }));
  return rows;
}

/** One storefront (STORE_TOP) creative: the seller's own item + poster + call to action. */
export interface ShopAdInput {
  sellerId: string;
  storeId: string;
  stateCode?: string | undefined;
  targetType: AdTargetType;
  targetId: string;
  title: string;
  subtitle?: string | undefined;
  imageUrl: string;
  cta: string;
  status: AdStatus;
  sortOrder: number;
  startsAt?: string | undefined;
  endsAt?: string | undefined;
}

export type ShopAdPatch = Omit<ShopAdInput, "sellerId" | "stateCode">;

function shopAdBody(dto: Omit<ShopAdInput, "sellerId">) {
  return {
    placements: ["STORE_TOP"],
    targetType: dto.targetType,
    targetId: dto.targetId,
    targetApp: "MART",
    storeId: dto.storeId,
    title: dto.title,
    subtitle: dto.subtitle,
    imageUrl: dto.imageUrl,
    cta: dto.cta,
    stateCode: dto.stateCode,
    startsAt: dto.startsAt,
    endsAt: dto.endsAt,
    status: dto.status,
    sortOrder: dto.sortOrder,
  };
}

/**
 * Saves one shop-page creative as DRAFT or LIVE. Awaited (not optimistic) so the freshly minted
 * server row replaces the local list before the seller edits or reorders it.
 */
export async function saveShopAd(dto: ShopAdInput): Promise<void> {
  await writeAwaited("post", "/ads/campaigns", { sellerId: dto.sellerId, ...shopAdBody(dto) });
  await refreshHeroCampaigns();
  audit({
    action: dto.status === "DRAFT" ? "AD_CAMPAIGN_DRAFT" : "AD_CAMPAIGN_PUBLISH",
    entity: "ads.campaigns",
    entityId: dto.storeId,
    after: dto,
  });
}

/** Edits a shop-page creative (save, pause LIVE→DRAFT, play DRAFT→LIVE). */
export async function updateShopAd(placementId: string, patch: ShopAdPatch): Promise<void> {
  await writeAwaited("put", `/ads/campaigns/${encodeURIComponent(placementId)}`, shopAdBody(patch));
  await refreshHeroCampaigns();
  audit({
    action: patch.status === "DRAFT" ? "AD_CAMPAIGN_PAUSE" : "AD_CAMPAIGN_EDIT",
    entity: "ads.campaigns",
    entityId: placementId,
    after: patch,
  });
}

/** Deletes one shop-page creative. */
export async function deleteShopAd(placementId: string): Promise<void> {
  await writeAwaited("delete", `/ads/campaigns/${encodeURIComponent(placementId)}`);
  await refreshHeroCampaigns();
  audit({ action: "AD_CAMPAIGN_DELETE", entity: "ads.campaigns", entityId: placementId });
}

/** Persists the explicit STORE_TOP play order for one shop. */
export async function reorderShopAds(sellerId: string, storeId: string, ids: string[]): Promise<void> {
  await writeAwaited("post", "/ads/campaigns/reorder", { sellerId, storeId, ids });
  await refreshHeroCampaigns();
  audit({ action: "AD_CAMPAIGN_REORDER", entity: "ads.campaigns", entityId: storeId, after: { ids } });
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

/* ------------------------------ district admins ----------------------------- */

export function listDistrictAdmins(districtCode?: string) {
  return state().districtAdmins.filter((a) => !districtCode || a.districtCode === districtCode);
}

/**
 * Reduces a phone to its bare 10 Indian digits (strips +91/91/0 prefixes and every separator), or ""
 * when the result is not exactly 10 digits. Shared by the district-admin form and the credentials page.
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

export interface CreateDistrictAdminInput extends DistrictAdminVerticalScope {
  name: string;
  email: string;
  phone: string;
  districtCode: string;
  issueLogin: boolean;
  /** When true the server mints a single-use invite token instead of a temporary password. */
  inviteMode?: boolean;
  password?: string | undefined;
}

export interface DistrictAdminCreateResult {
  admin: DistrictAdmin;
  credential?: PortalCredential | undefined;
  /** One-time invite token (returned once on invite-mode create / resend; never persisted). */
  inviteToken?: string | undefined;
  /** When the pending invite link stops working. */
  inviteExpiresAt?: string | undefined;
  /** Non-blocking soft notices from the server: a shared phone that already belongs to a seller/roster row. */
  warnings?: string[] | undefined;
}

/** Absolute URL of the public district-admin invite acceptance page for a one-time token. */
export function districtAdminInviteUrl(token: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/accept-invite/admin?token=${encodeURIComponent(token)}`;
}

/**
 * Unified district-admin creator (superadmin-only). One server call writes the roster and — when
 * `issueLogin` — the DISTRICT_ADMIN portal login atomically; a duplicate email rejects with a
 * specific 409 `code` so the form can be kept (never an optimistic flash-then-rollback). A
 * duplicate PHONE is allowed and reported back as `warnings` (soft, policy decision).
 */
export async function createDistrictAdminWithLogin(
  input: CreateDistrictAdminInput,
): Promise<DistrictAdminCreateResult> {
  const res = await remote.post<{
    admin: DistrictAdmin;
    credential?: PortalCredential;
    inviteToken?: string;
    inviteExpiresAt?: string;
    warnings?: string[];
  }>("/district-admins", {
    name: input.name,
    email: input.email,
    phone: input.phone,
    districtCode: input.districtCode,
    issueLogin: input.issueLogin,
    inviteMode: input.inviteMode === true,
    martAccess: input.martAccess,
    foodAccess: input.foodAccess,
    pharmaAccess: input.pharmaAccess,
    ...(input.issueLogin && !input.inviteMode ? { password: input.password } : {}),
  });
  state().set((s) => ({
    districtAdmins: [res.admin, ...s.districtAdmins.filter((a) => a.adminId !== res.admin.adminId)],
  }));
  audit({ action: "DISTRICT_ADMIN_CREATE", entity: "admins.district_admins", entityId: res.admin.adminId, after: res.admin });
  if (res.credential) {
    audit({ action: "PORTAL_USER_CREATE", entity: "admins.portal_users", entityId: res.credential.id, after: res.credential });
  }
  return {
    admin: res.admin,
    credential: res.credential,
    inviteToken: res.inviteToken,
    inviteExpiresAt: res.inviteExpiresAt,
    warnings: res.warnings,
  };
}

/**
 * Rotate a pending district-admin invite's one-time link (`POST /district-admins/{id}/resend-invite`).
 * The previous link stops working immediately; the new raw token is returned once.
 */
export async function resendDistrictAdminInvite(
  adminId: string,
): Promise<{ inviteToken: string; inviteExpiresAt?: string | undefined }> {
  if (!remoteConfigured()) throw new ApiError(0, "unconfigured", "Gateway is not configured");
  const res = await remote.post<{ inviteToken: string; inviteExpiresAt?: string }>(
    `/district-admins/${encodeURIComponent(adminId)}/resend-invite`,
  );
  audit({ action: "DISTRICT_ADMIN_INVITE_RESEND", entity: "admins.portal_users", entityId: adminId });
  return { inviteToken: res.inviteToken, inviteExpiresAt: res.inviteExpiresAt };
}

export interface IdentityHint {
  field: "email" | "phone";
  /** kind "error" hard-blocks (email — one person, one role); kind "warning" is a soft phone notice. */
  kind: "error" | "warning";
  message: string;
}

/** Pre-submit identity lint (fast, non-authoritative; the server is the source of truth). */
export function districtAdminDuplicateHint(
  email: string,
  phone: string,
  creds: PortalCredential[],
  sellers: readonly { sellerId: string; contactPhone: string }[],
  admins: DistrictAdmin[],
): IdentityHint | null {
  const lower = email.trim().toLowerCase();
  const digits = normalizePhoneDigits(phone);
  const login = creds.find((c) => c.email.toLowerCase() === lower);
  if (login) {
    if (login.role === "SUPER_ADMIN") return { field: "email", kind: "error", message: "This email already belongs to an active SUPER_ADMIN login." };
    if (login.role === "SELLER") return { field: "email", kind: "error", message: `This email already belongs to seller ${login.sellerId ?? ""}.` };
    return { field: "email", kind: "error", message: `This email already has a DISTRICT_ADMIN login for ${login.districtCode ?? ""}.` };
  }
  const seller = digits ? sellers.find((s) => normalizePhoneDigits(s.contactPhone) === digits) : undefined;
  if (seller) return { field: "phone", kind: "warning", message: `This phone also belongs to seller ${seller.sellerId}. You can still create — shared phone.` };
  const rosterEmail = admins.find((a) => a.email.toLowerCase() === lower);
  if (rosterEmail) return { field: "email", kind: "error", message: `This email already has a DISTRICT_ADMIN roster for ${rosterEmail.districtCode}.` };
  if (digits) {
    const rosterPhone = admins.find((a) => normalizePhoneDigits(a.phone) === digits);
    if (rosterPhone) return { field: "phone", kind: "warning", message: `This phone also belongs to the DISTRICT_ADMIN roster for ${rosterPhone.districtCode}. You can still create — shared phone.` };
  }
  return null;
}

/** Maps a 409/400 `code` from POST /district-admins to a field + friendly block message. */
export function districtAdminConflictMessage(err: unknown): { field: "email" | "phone" | null; message: string } {
  const code = err instanceof ApiError ? err.code : undefined;
  const id = err instanceof ApiError ? err.conflictingId : undefined;
  switch (code) {
    case "email_used_by_super_admin":
      return { field: "email", message: "This email already belongs to an active SUPER_ADMIN login. Deactivate it before registering a district admin." };
    case "email_used_by_seller":
      return { field: "email", message: `This email already belongs to seller ${id ?? "?"}. One person, one role — deactivate the seller login first.` };
    case "email_has_district_login":
      return { field: "email", message: "This email already has a DISTRICT_ADMIN login. Deactivate or delete it first." };
    case "email_has_district_roster":
      return { field: "email", message: "This email already has a DISTRICT_ADMIN roster. Delete it first to move the person." };
    case "weak_password":
      return { field: null, message: "Password must be at least 12 characters and not a common value." };
    case "invalid_phone":
      return { field: "phone", message: "Enter a valid 10-digit Indian mobile number." };
    case "unknown_district":
    case "bad_request":
      return { field: null, message: err instanceof Error ? err.message : "Invalid request." };
    default:
      return { field: null, message: err instanceof Error ? err.message : "The request was blocked." };
  }
}

/**
 * Update a district admin via `PUT /district-admins/{id}` — the roster identity (name/email/phone/
 * district) and/or `active`. Optimistic with rollback so a rejected write never lingers; the caller
 * awaits it to render an honest success toast.
 */
export async function updateDistrictAdmin(adminId: string, patch: Partial<DistrictAdmin>): Promise<void> {
  const before = state().districtAdmins.find((a) => a.adminId === adminId);
  state().set((s) => ({
    districtAdmins: s.districtAdmins.map((a) => (a.adminId === adminId ? { ...a, ...patch } : a)),
  }));
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body["name"] = patch.name;
  if (patch.email !== undefined) body["email"] = patch.email;
  if (patch.phone !== undefined) body["phone"] = patch.phone;
  if (patch.districtCode !== undefined) body["districtCode"] = patch.districtCode;
  if (patch.active !== undefined) body["active"] = patch.active;
  if (patch.martAccess !== undefined) body["martAccess"] = patch.martAccess;
  if (patch.foodAccess !== undefined) body["foodAccess"] = patch.foodAccess;
  if (patch.pharmaAccess !== undefined) body["pharmaAccess"] = patch.pharmaAccess;
  try {
    if (Object.keys(body).length > 0) {
      await writeAwaited("put", `/district-admins/${encodeURIComponent(adminId)}`, body);
    }
  } catch (err) {
    if (before) {
      state().set((s) => ({
        districtAdmins: s.districtAdmins.map((a) => (a.adminId === adminId ? before : a)),
      }));
    }
    throw err;
  }
  audit({
    action: "DISTRICT_ADMIN_UPDATE",
    entity: "admins.district_admins",
    entityId: adminId,
    before,
    after: patch,
  });
}

/**
 * Delete a district admin via `DELETE /district-admins/{id}`. Optimistic with rollback; the caller
 * awaits it so it only reports success once the delete has landed.
 */
export async function deleteDistrictAdmin(adminId: string): Promise<void> {
  const before = state().districtAdmins.find((a) => a.adminId === adminId);
  state().set((s) => ({ districtAdmins: s.districtAdmins.filter((a) => a.adminId !== adminId) }));
  try {
    await writeAwaited("delete", `/district-admins/${encodeURIComponent(adminId)}`);
  } catch (err) {
    if (before) {
      state().set((s) => ({ districtAdmins: [before, ...s.districtAdmins] }));
    }
    throw err;
  }
  audit({ action: "DISTRICT_ADMIN_DELETE", entity: "admins.district_admins", entityId: adminId, before });
}

/* --------------------- platform-fee change requests ---------------------- */

/**
 * Seller: file a platform-fee change request for ONE vendor (`POST /sellers/{id}/platform-fee-request`).
 * The live fee is untouched — a district/super admin approves it. The gateway resolves the current
 * fee + app brand from the store itself, so only the store, the requested whole percent and the
 * seller's optional reason are sent (`DisallowUnknownFields` rejects anything else).
 */
export async function requestSellerPlatformFeeChange(
  sellerId: string,
  storeId: string,
  platformFeePct: number,
  reason = "",
): Promise<FeeChangeRequest> {
  if (!remoteConfigured()) throw new ApiError(0, "unconfigured", "Gateway is not configured");
  const request = await remote.post<FeeChangeRequest>(
    `/sellers/${encodeURIComponent(sellerId)}/platform-fee-request`,
    { storeId, platformFeePct, reason: reason.trim() },
  );
  audit({
    action: "SELLER_PLATFORM_FEE_REQUEST",
    entity: "sellers.seller_fee_change_requests",
    entityId: request.requestId,
    after: { storeId, platformFeePct },
  });
  return request;
}

/** Seller: own platform-fee request history (`GET /sellers/{id}/platform-fee-requests`, server-scoped). */
export async function listSellerFeeChangeRequests(sellerId: string): Promise<FeeChangeRequest[]> {
  if (!remoteConfigured()) return [];
  return remote.get<FeeChangeRequest[]>(
    `/sellers/${encodeURIComponent(sellerId)}/platform-fee-requests`,
  );
}

/** Admin review queue. The gateway scopes district admins automatically. */
export async function listFeeChangeRequests(
  filter: { districtCode?: string | undefined; status?: string | undefined } = {},
): Promise<FeeChangeRequest[]> {
  const rows = await remote.get<FeeChangeRequest[]>("/seller/fee-change-requests", {
    query: { district: filter.districtCode, status: filter.status },
  });
  return rows;
}

export async function approveFeeChangeRequest(requestId: string): Promise<void> {
  await remote.patch(`/seller/fee-change-requests/${encodeURIComponent(requestId)}/approve`, {});
  audit({ action: "FEE_CHANGE_APPROVE", entity: "sellers.seller_fee_change_requests", entityId: requestId });
}

export async function rejectFeeChangeRequest(requestId: string, reason: string): Promise<void> {
  await remote.patch(`/seller/fee-change-requests/${encodeURIComponent(requestId)}/reject`, { reason });
  audit({ action: "FEE_CHANGE_REJECT", entity: "sellers.seller_fee_change_requests", entityId: requestId, after: { reason } });
}

/* ---------------------------- seller enquiries --------------------------- */

/**
 * Public web enquiries (`GET /seller-inquiries`). An enquiry is a `sellers.sellers` row with status
 * INQUIRY (source 'web'), so it reads through the same `SellerRecord` shape as an application.
 *
 * Admin-only; the gateway scopes a district admin to their own district and lets a super admin see
 * every district, so the `districtCode` filter here only narrows the super admin's view.
 */
export async function listSellerInquiries(
  filter: {
    districtCode?: string | undefined;
    stage?: InquiryStage | "ALL" | undefined;
    query?: string | undefined;
    /** "me" = claimed by the caller, "unassigned" = nobody has taken it. */
    assigned?: "me" | "unassigned" | undefined;
  } = {},
): Promise<SellerRecord[]> {
  if (!remoteConfigured()) return [];
  const rows = await remote.get<SellerRecord[]>("/seller-inquiries", {
    query: {
      district: filter.districtCode,
      stage: filter.stage === "ALL" ? undefined : filter.stage,
      q: filter.query,
      assigned: filter.assigned,
    },
  });
  return rows.map((row) => toCamel(row));
}

/**
 * Claim (`assigned: true`) or release the call-back on an enquiry. The owner is always the caller —
 * the API cannot hand an enquiry to another admin. A 409 means someone else claimed it first.
 */
export async function assignSellerInquiry(sellerId: string, assigned: boolean): Promise<SellerRecord> {
  const row = await remote.post<SellerRecord>(
    `/seller-inquiries/${encodeURIComponent(sellerId)}/assign`,
    { assigned: assigned ? "me" : "" },
  );
  audit({
    action: "SELLER_INQUIRY_ASSIGN",
    entity: "sellers.sellers",
    entityId: sellerId,
    after: { assignedTo: row.inquiryAssignedTo ?? "" },
  });
  return toCamel(row);
}

/**
 * Move one enquiry's follow-up stage and/or make the lifecycle decision.
 *
 * `stage` tracks the call-back (NEW → CONTACTED → APPROVED | REJECTED). `status` is the real decision:
 * PENDING_REVIEW (the merchant is proceeding and will complete KYC in the app) or REJECTED (with a
 * reason the merchant can read). INQUIRY → ACTIVE is refused server-side — an enquiry has no KYC.
 */
export async function updateSellerInquiry(
  sellerId: string,
  patch: { stage?: InquiryStage | undefined; status?: "PENDING_REVIEW" | "REJECTED" | undefined; reason?: string | undefined },
): Promise<SellerDetail> {
  const row = await remote.patch<SellerDetail>(`/seller-inquiries/${encodeURIComponent(sellerId)}`, {
    stage: patch.stage,
    status: patch.status,
    reason: patch.reason?.trim(),
  });
  audit({
    action: "SELLER_INQUIRY_UPDATE",
    entity: "sellers.sellers",
    entityId: sellerId,
    after: { stage: patch.stage, status: patch.status },
  });
  return toCamel(row);
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

export interface AnalyticsRank {
  id: string;
  gmvPaisa: number;
  orders: number;
}

export interface AnalyticsRanks {
  sellers: AnalyticsRank[];
  states: AnalyticsRank[];
  products: AnalyticsRank[];
}

export type AnalyticsScope = "global" | "seller" | "state" | "product";

/** Live IST-day GMV/orders buckets from `GET /analytics/series` (checkout.orders is the source). */
export async function fetchAnalyticsSeries(
  scope: AnalyticsScope,
  id: string,
  days = 30,
): Promise<import("@/data/types").DailyPoint[]> {
  if (!remoteConfigured()) return [];
  const qs = new URLSearchParams({ scope, days: String(days) });
  if (id) qs.set("id", id);
  return remote.get<import("@/data/types").DailyPoint[]>(`/analytics/series?${qs.toString()}`);
}

/** Live seller/state/product totals from `GET /analytics/ranks` (checkout ledger, not seeded). */
export async function fetchAnalyticsRanks(days = 30): Promise<AnalyticsRanks> {
  if (!remoteConfigured()) {
    return { sellers: [], states: [], products: [] };
  }
  return remote.get<AnalyticsRanks>(`/analytics/ranks?days=${days}`);
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

export interface CustomersFilter {
  stateCode?: string | undefined;
  districtCode?: string | undefined;
  query?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

/** One page of the directory plus the totals for the whole filtered set. */
export interface CustomersPage {
  items: CustomerRecord[];
  total: number;
  totalOrders: number;
  totalSpendPaisa: number;
  limit: number;
  offset: number;
}

export interface CustomersState {
  data: CustomerRecord[];
  total: number;
  totalOrders: number;
  totalSpendPaisa: number;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/** Maps a `GET /customers` row (the checkout.users_admin projection) to the portal CustomerRecord. */
export function mapCustomerRow(raw: Raw): CustomerRecord {
  return {
    userId: toStr(raw["userId"]),
    name: toStr(raw["name"]),
    stateCode: optStr(raw["stateCode"]),
    districtCode: optStr(raw["districtCode"]),
    pincode: optStr(raw["pincode"]),
    customerCode: optStr(raw["customerCode"]),
    phone: optStr(raw["phone"]),
    ordersCount: Number(raw["ordersCount"] ?? 0) || 0,
    spendPaisa: Math.round((Number(raw["spend"] ?? 0) || 0) * 100),
    lastOrderAt: optStr(raw["lastOrderAt"]),
    createdAt: toStr(raw["createdAt"]),
  };
}

/**
 * Live server-filtered, paginated read of the admin customer directory (`GET /customers`). `q`
 * matches name, phone, user id, customer code and pincode server-side, so a customer with no spend
 * (sorted last) is still findable. State/district narrow the result; the server also returns totals
 * for the filtered set so the page can show accurate KPIs without loading every row.
 */
export async function fetchCustomers(filter: CustomersFilter = {}): Promise<CustomersPage> {
  if (!remoteConfigured()) {
    return { items: [], total: 0, totalOrders: 0, totalSpendPaisa: 0, limit: filter.limit ?? 50, offset: filter.offset ?? 0 };
  }
  const raw = await remote.get<Raw>("/customers", {
    query: {
      state: filter.stateCode,
      district: filter.districtCode,
      q: filter.query,
      limit: filter.limit,
      offset: filter.offset,
    },
  });
  const body = toCamel(raw) as Raw;
  const items = Array.isArray(body?.["items"]) ? (body["items"] as Raw[]) : [];
  return {
    items: items.map(mapCustomerRow),
    total: Number(body?.["total"] ?? 0) || 0,
    totalOrders: Number(body?.["totalOrders"] ?? 0) || 0,
    totalSpendPaisa: Number(body?.["totalSpendPaisa"] ?? 0) || 0,
    limit: Number(body?.["limit"] ?? filter.limit ?? 50) || 50,
    offset: Number(body?.["offset"] ?? filter.offset ?? 0) || 0,
  };
}

/* ---------------------------------- menus -------------------------------- */

export function listMenus(
  filter: {
    sellerId?: string | undefined;
    venueId?: string | undefined;
    status?: ProductStatus | "ALL" | undefined;
    sectionId?: string | undefined;
    subCategoryId?: string | undefined;
  } = {},
): MenuItemRecord[] {
  return state().menus.filter((m) => {
    if (filter.sellerId && m.sellerId !== filter.sellerId) return false;
    if (filter.venueId && m.venueId !== filter.venueId) return false;
    if (filter.status && filter.status !== "ALL" && m.status !== filter.status) return false;
    if (filter.sectionId && m.sectionId !== filter.sectionId) return false;
    if (filter.subCategoryId && m.subCategoryId !== filter.subCategoryId) return false;
    return true;
  });
}

/**
 * The corrected dish form's payload. The seller never types a venue or dish id: the venue comes from
 * the active shop scope and the gateway derives the dish id from the name. Money is whole rupees.
 */
export interface MenuDto {
  /** The shop the dish belongs to (from `useSellerScope().storeId`, never typed). */
  venueId: string;
  /** Present only when editing an existing dish; omitted on create so the gateway generates one. */
  dishId?: string | undefined;
  name: string;
  /** Tamil display copy (0108). Empty/absent → the customer app falls back to the English copy. */
  nameTa?: string | undefined;
  /** English description */
  description?: string | undefined;
  descriptionTa?: string | undefined;
  /** Section header (parent category) — resolved from the leaf's parent when omitted. */
  sectionId?: string | undefined;
  /** Leaf sub-category identifier — mandatory; the only selectable taxonomy level. */
  subCategoryId: string;
  /** Dietary classification */
  dietaryType?: "VEG" | "NON_VEG" | "EGG" | undefined;
  /** Price in rupees */
  price: number;
  /** List price (MRP) for the strike-through; must be ≥ price. Omit for no offer. */
  mrp?: number | undefined;
  isVeg?: boolean | undefined;
  cuisine?: string | undefined;
  rating?: number | undefined;
  /** An already-uploaded `r2:<key>` image reference (kept when editing without re-picking a photo). */
  imageKey?: string | undefined;
  /** A freshly picked photo; uploaded via the media registry before the write. */
  imageFile?: File | undefined;
  /** Explicit publish intent: ACTIVE publishes the dish, DRAFT saves it unpublished. */
  status?: Extract<ProductStatus, "ACTIVE" | "DRAFT"> | undefined;
  sellerId?: string | undefined;
  /**
   * Optional facet tags (superadmin-defined attribute options) applied to the dish, e.g. Patty:
   * Chicken, Bun: Brioche. Absent leaves an existing dish's tags unchanged; [] clears them.
   */
  attributeOptionIds?: string[] | undefined;
}

/**
 * Creates or updates a dish through the gateway. The dish id is server-owned on create; on edit the
 * existing `dishId` is reused. A freshly picked photo is uploaded to the media registry first, so the
 * write only ever carries an `r2:<key>` reference — never a raw URL or a data URL.
 *
 * Awaited so the caller can show success only once the server has accepted the write; the optimistic
 * row is rolled back and the promise rejects when the gateway refuses it.
 */
export async function upsertMenu(dto: MenuDto): Promise<MenuItemRecord> {
  const venueId = dto.venueId.trim();
  if (!venueId) throw new Error("No active shop selected.");
  const existing = dto.dishId
    ? state().menus.find((m) => m.venueId === venueId && m.dishId === dto.dishId)
    : undefined;

  // Upload a picked photo first (r2:<key> → bare key for the gateway's imageKey field).
  let imageKey = dto.imageKey?.startsWith("r2:") ? dto.imageKey.slice(3) : dto.imageKey;
  if (dto.imageFile) {
    const stored = await uploadMenuImage(dto.imageFile);
    imageKey = stored.startsWith("r2:") ? stored.slice(3) : stored;
  }

  const body = {
    venueId,
    ...(dto.dishId ? { dishId: dto.dishId } : {}),
    name: dto.name.trim(),
    ...(dto.nameTa?.trim() ? { nameTa: dto.nameTa.trim() } : {}),
    ...(dto.description?.trim() ? { description: dto.description.trim() } : {}),
    ...(dto.descriptionTa?.trim() ? { descriptionTa: dto.descriptionTa.trim() } : {}),
    ...(dto.sectionId ? { sectionId: dto.sectionId } : {}),
    subCategoryId: dto.subCategoryId,
    ...(dto.dietaryType ? { dietaryType: dto.dietaryType } : {}),
    price: dto.price,
    ...(dto.mrp != null ? { mrp: dto.mrp } : {}),
    ...(dto.isVeg !== undefined ? { isVeg: dto.isVeg } : {}),
    ...(dto.cuisine?.trim() ? { cuisine: dto.cuisine.trim() } : {}),
    ...(dto.rating != null ? { rating: dto.rating } : {}),
    ...(imageKey ? { imageKey } : {}),
    ...(dto.attributeOptionIds !== undefined
      ? { attributeOptionIds: dto.attributeOptionIds }
      : {}),
  };

  const saved = remoteConfigured()
    ? toCamel(
        await remote.post<Record<string, unknown>>(
          dto.dishId
            ? `/seller/menus/${encodeURIComponent(venueId)}/${encodeURIComponent(dto.dishId)}`
            : "/seller/menus",
          body,
        ),
      )
    : undefined;

  // Reconcile the local store with the server-owned identity + derived display names.
  const serverId = (saved?.["dishId"] as string | undefined) ?? dto.dishId ?? "";
  const record: MenuItemRecord = {
    venueId,
    dishId: serverId,
    name: dto.name.trim(),
    ...(dto.nameTa?.trim() ? { nameTa: dto.nameTa.trim() } : {}),
    ...(dto.description?.trim() ? { description: dto.description.trim() } : {}),
    ...(dto.descriptionTa?.trim() ? { descriptionTa: dto.descriptionTa.trim() } : {}),
    ...(dto.sectionId ? { sectionId: dto.sectionId } : {}),
    subCategoryId: dto.subCategoryId,
    ...(dto.dietaryType ? { dietaryType: dto.dietaryType } : {}),
    pricePaisa: Math.round(dto.price * 100),
    ...(dto.mrp != null ? { mrpPaisa: Math.round(dto.mrp * 100) } : {}),
    ...(dto.isVeg !== undefined ? { isVeg: dto.isVeg } : {}),
    ...(dto.cuisine?.trim() ? { cuisine: dto.cuisine.trim() } : {}),
    ...(dto.rating != null ? { rating: dto.rating } : {}),
    ...(imageKey ? { imageKey } : {}),
    attributeOptionIds: dto.attributeOptionIds ?? existing?.attributeOptionIds,
    sellerId: dto.sellerId ?? existing?.sellerId,
    status: (saved?.["status"] as ProductStatus | undefined) ?? existing?.status ?? dto.status ?? "DRAFT",
  };
  state().set((s) => ({
    menus: existing
      ? s.menus.map((m) => (m.venueId === venueId && m.dishId === serverId ? record : m))
      : [record, ...s.menus],
  }));
  audit({
    action: existing ? "MENU_UPDATE" : "MENU_CREATE",
    entity: "directory.menus",
    entityId: `${venueId}:${serverId}`,
    before: existing,
    after: record,
  });
  return record;
}

/**
 * Uploads a dish photo through the media registry (compressed JPEG → `r2:<key>`), reusing the shared
 * product-image pipeline so the owner type is `MENU` and local dev still falls back to a data URL.
 */
export async function uploadMenuImage(file: File): Promise<string> {
  const { uploadProductImage } = await import("@/lib/media/productImages");
  return uploadProductImage(file, "MENU");
}


export async function setMenuStatus(
  venueId: string,
  dishId: string,
  status: ProductStatus,
): Promise<void> {
  const before = state().menus.find((m) => m.venueId === venueId && m.dishId === dishId);
  state().set((s) => ({
    menus: s.menus.map((m) =>
      m.venueId === venueId && m.dishId === dishId ? { ...m, status } : m,
    ),
  }));
  try {
    if (remoteConfigured()) {
      await writeAwaited("put", `/seller/menus/${encodeURIComponent(venueId)}/${encodeURIComponent(dishId)}/status`, { status });
    }
  } catch (err) {
    if (before) {
      state().set((s) => ({
        menus: s.menus.map((m) => (m.venueId === venueId && m.dishId === dishId ? before : m)),
      }));
    }
    throw err;
  }
  audit({ action: `MENU_${status}`, entity: "directory.menus", entityId: `${venueId}:${dishId}`, after: { status } });
}

export async function deleteMenu(venueId: string, dishId: string): Promise<void> {
  const before = state().menus.find((m) => m.venueId === venueId && m.dishId === dishId);
  state().set((s) => ({ menus: s.menus.filter((m) => !(m.venueId === venueId && m.dishId === dishId)) }));
  try {
    if (remoteConfigured()) {
      await writeAwaited("delete", `/seller/menus/${encodeURIComponent(venueId)}/${encodeURIComponent(dishId)}`);
    }
  } catch (err) {
    if (before) {
      state().set((s) => ({ menus: [before, ...s.menus] }));
    }
    throw err;
  }
  audit({ action: "MENU_DELETE", entity: "directory.menus", entityId: `${venueId}:${dishId}`, before });
}

/* --------------------------------- add-ons ------------------------------- */

/** Server-scoped add-on list. DRAFT/PENDING_REVIEW rows are seller/admin-only. */
export async function listAddons(
  filter: { venueId?: string | undefined; status?: ProductStatus | "ALL" | undefined } = {},
): Promise<AddonRecord[]> {
  const query: Record<string, string | undefined> = {};
  if (filter.venueId) query["venueId"] = filter.venueId;
  if (filter.status && filter.status !== "ALL") query["status"] = filter.status;
  return remote.get<AddonRecord[]>("/seller/addons", { query });
}

export async function fetchAddon(addonId: string): Promise<AddonRecord> {
  return remote.get<AddonRecord>(`/seller/addons/${encodeURIComponent(addonId)}`);
}

export interface AddonDto {
  venueId: string;
  name: string;
  groupName: string;
  /** Tamil display copy (0108). Empty/absent → the customer app falls back to the English copy. */
  nameTa?: string | undefined;
  groupNameTa?: string | undefined;
  pricePaisa: number;
  isVeg: boolean;
}

export async function createAddon(dto: AddonDto): Promise<AddonRecord> {
  return remote.post<AddonRecord>("/seller/addons", {
    venueId: dto.venueId,
    name: dto.name,
    groupName: dto.groupName,
    ...(dto.nameTa ? { nameTa: dto.nameTa } : {}),
    ...(dto.groupNameTa ? { groupNameTa: dto.groupNameTa } : {}),
    price: toRupees(dto.pricePaisa),
    isVeg: dto.isVeg,
  });
}

export async function updateAddon(
  addonId: string,
  dto: {
    name: string;
    groupName: string;
    nameTa?: string | undefined;
    groupNameTa?: string | undefined;
    pricePaisa: number;
    isVeg: boolean;
  },
): Promise<AddonRecord> {
  return remote.put<AddonRecord>(`/seller/addons/${encodeURIComponent(addonId)}`, {
    name: dto.name,
    groupName: dto.groupName,
    ...(dto.nameTa ? { nameTa: dto.nameTa } : {}),
    ...(dto.groupNameTa ? { groupNameTa: dto.groupNameTa } : {}),
    price: toRupees(dto.pricePaisa),
    isVeg: dto.isVeg,
  });
}

export async function submitAddonForReview(addonId: string): Promise<AddonRecord> {
  return remote.post<AddonRecord>(`/seller/addons/${encodeURIComponent(addonId)}/submit-for-review`);
}

export async function delistAddon(addonId: string): Promise<AddonRecord> {
  return remote.delete<AddonRecord>(`/seller/addons/${encodeURIComponent(addonId)}`);
}

/** Admin moderation: approve a pending add-on. */
export async function approveAddon(addonId: string): Promise<AddonRecord> {
  return remote.post<AddonRecord>(`/seller/addons/${encodeURIComponent(addonId)}/approve`);
}

/** Admin moderation: return a pending add-on to DRAFT with a required note. */
export async function rejectAddon(addonId: string, reason: string): Promise<AddonRecord> {
  return remote.post<AddonRecord>(`/seller/addons/${encodeURIComponent(addonId)}/reject`, { reason });
}

/** Dish ↔ add-on links for one dish (dishId omitted = the whole venue). */
export async function listMenuAddons(venueId: string, dishId?: string): Promise<MenuAddonRecord[]> {
  const query: Record<string, string> = { venueId };
  if (dishId) query["dishId"] = dishId;
  return remote.get<MenuAddonRecord[]>("/seller/menu-addons", { query });
}

export async function linkAddonToDish(venueId: string, dishId: string, addonId: string): Promise<void> {
  await remote.post<{ ok: boolean }>("/seller/menu-addons", { venueId, dishId, addonId });
}

export async function unlinkAddonFromDish(venueId: string, dishId: string, addonId: string): Promise<void> {
  await remote.delete<{ ok: boolean }>(
    `/seller/menu-addons/${encodeURIComponent(venueId)}/${encodeURIComponent(dishId)}/${encodeURIComponent(addonId)}`,
  );
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
