// Provenance: mirrors Faazio DB schema. TS camelCase <-> DB snake_case.
// money = integer paisa, ids = stable slugs, enums UPPERCASE, timestamps ISO.

export type Sector = "MART" | "FOOD" | "PHARMA";
export type Role = "SELLER" | "DISTRICT_ADMIN" | "SUPER_ADMIN";

export type SellerStatus =
  | "PENDING_REVIEW"
  | "ACTIVE"
  | "SUSPENDED"
  | "REJECTED";
export type ProductStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "ACTIVE"
  | "REJECTED"
  | "DELISTED";
export type OrderStatus =
  | "NEW"
  | "PACKED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED";
export type CampaignStatus = "DRAFT" | "SCHEDULED" | "LIVE" | "ENDED";
export type CampaignScope = "GLOBAL" | "STATE";
/** Ad lifecycle. Self-serve hero campaigns publish straight to `LIVE`; `REJECTED` = taken down for
 * abuse (admin only). `REQUESTED`/`APPROVED` are deprecated (kept for old rows, never created). */
export type AdStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "LIVE";

/** auth.accounts */
export interface AuthUser {
  accountId: string; // account_id
  role: Role;
  name: string;
  email: string;
  /** Portal mode: the gateway requires a password change before normal use. */
  mustChange?: boolean | undefined;
  /** District scope for DISTRICT_ADMIN (3-letter code, e.g. TCH). */
  districtCode?: string | undefined; // district_code
  /** Legacy parent state scope (2-letter code); sellers still use it. */
  stateCode?: string | undefined; // state_code
  sellerId?: string | undefined; // seller_id
}

/** sellers.sellers */
export interface SellerRecord {
  sellerId: string;
  businessName: string;
  ownerName: string;
  category: Sector;
  gstin: string;
  pan: string;
  businessAddress: string;
  contactPhone: string;
  stateCode: string;
  /** 3-letter district code (TN/PY rollout). Optional on legacy rows. */
  districtCode?: string | undefined;
  status: SellerStatus;
  rating: number;
  createdAt: string;
  /** Private onboarding extensions (migration 0039). Optional on legacy seed rows. */
  contactEmail?: string | undefined;
  platformFeePct?: number | undefined;
  razorpayLinkedAccountId?: string | undefined;
  fssaiNumber?: string | undefined;
  otpVerified?: boolean | undefined;
  otpVerifiedAt?: string | undefined;
  rejectionReason?: string | undefined;
  rejectionHistory?: unknown;
}

/** sellers.kyc_documents */
export interface KycDocument {
  kycId: string;
  sellerId: string;
  docType: "GSTIN" | "PAN" | "BANK_PROOF" | "SHOP_LICENSE" | "PASSBOOK" | "FSSAI";
  /** Fixture URL (seed mode). Live rows carry the private R2 key + media asset id instead. */
  fileUrl?: string | undefined;
  fileKey?: string | undefined;
  assetId?: string | undefined;
  verified: boolean;
  uploadedAt: string;
}

/** sellers.bank_accounts */
export interface BankAccount {
  bankAccountId: string;
  sellerId: string;
  bankName?: string | undefined;
  accountNumberMasked: string;
  ifsc: string;
  beneficiaryName: string;
}

/** One manual PAN/GSTIN/FSSAI/passbook verification decision (sellers.kyc_verification_log). */
export interface SellerVerificationLog {
  logId: string;
  sellerId: string;
  docType: string;
  verifiedBy: string;
  verifiedAt: string;
  notes?: string | undefined;
}

/** Admin review projection: seller + payout account + KYC documents + verification log. */
export interface SellerDetail extends SellerRecord {
  bankAccount?: BankAccount | undefined;
  kycDocuments: KycDocument[];
  verificationLog: SellerVerificationLog[];
}

/** directory.stores */
export interface StoreRecord {
  storeId: string;
  sellerId: string;
  name: string;
  sector: Sector;
  addressLine: string;
  city: string;
  stateCode: string;
  deliveryTime: string;
  hours: string;
  isVeg: boolean;
  isLive: boolean;
  rating: number;
}

/** catalog.products */
export interface ProductRecord {
  productId: string;
  sellerId: string;
  storeId: string;
  name: string;
  description: string;
  sector: Sector;
  category: string;
  emoji: string;
  /** Primary photo: seeded placeholder, remote URL, or seller-uploaded data URL. */
  imageUrl: string;
  /** Extra photos shown in the app gallery, after the primary one. */
  galleryUrls?: string[];
  unit: string;
  pricePaisa: number;
  mrpPaisa: number;
  isVeg: boolean;
  isPrescription: boolean;
  status: ProductStatus;
  createdAt: string;
}

/** inventory.stock */
export interface StockRecord {
  productId: string;
  quantity: number;
  lowStockThreshold: number;
  etaMinutes: number;
  updatedAt: string;
}

/** checkout.orders */
export interface OrderRecord {
  orderId: string;
  sellerId: string;
  storeId: string;
  customerName: string;
  city: string;
  stateCode: string;
  sector: Sector;
  itemsCount: number;
  amountPaisa: number;
  status: OrderStatus;
  placedAt: string;
  slaDueAt: string;
}

/** payments.settlement_ledger */
export interface LedgerEntry {
  entryId: string;
  sellerId: string;
  cycle: string;
  orderValuePaisa: number;
  commissionPaisa: number;
  tcsPaisa: number;
  tdsPaisa: number;
  productTaxPaisa: number;
  platformGstPaisa: number;
  netPayoutPaisa: number;
}

/** payments.payouts */
export interface PayoutRecord {
  payoutId: string;
  sellerId: string;
  cycle: string;
  amountPaisa: number;
  status: "SCHEDULED" | "PAID" | "ON_HOLD";
  scheduledFor: string;
}

/** promo.festival_sector_caps */
export interface SectorCap {
  capId: string;
  sector: Sector;
  maxDiscountPercent: number;
  stateCode?: string | undefined; // override
  updatedAt: string;
}

/** promo.festival_campaigns */
export interface FestivalCampaign {
  campaignId: string;
  name: string;
  scope: CampaignScope;
  stateCode?: string | undefined;
  startsAt: string;
  endsAt: string;
  bannerUrl: string;
  status: CampaignStatus;
  createdBy: string;
}

/** promo.festival_optins */
export interface SellerOptin {
  optinId: string;
  campaignId: string;
  sellerId: string;
  productId: string;
  discountPercent: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

/** promo.coupons */
export interface CouponRecord {
  couponId: string;
  code: string;
  scope: "GLOBAL" | "STATE";
  stateCode?: string | undefined;
  sector?: Sector | undefined;
  valuePercent: number;
  maxDiscountPaisa: number;
  validTill: string;
  active: boolean;
}

/** ads.sponsored_slots */
export interface AdSlot {
  slotId: string;
  sellerId: string;
  productId: string;
  placement: "HOME_TOP" | "SPONSORED_SHOWCASE" | "SECTOR_RAIL";
  stateCode?: string | undefined;
  status: AdStatus;
  impressions: number;
  clicks: number;
  ordersAttributed: number;
  requestedAt: string;
}

/** ads.campaigns (0027) — the hero creative placements a seller can buy (poster + deep-link). */
export type HeroPlacement =
  | "HOME_HERO"
  | "MART_HERO"
  | "PHARMA_HERO"
  | "FOOD_HERO"
  | "CATEGORY_TOP"
  | "STORE_TOP";

/** ads.campaigns.target_type — what a hero click opens (an item the seller owns). */
export type AdTargetType = "PRODUCT" | "DISH" | "STORE" | "VENUE";

/**
 * ads.campaigns (0027) — one row per (campaign, placement). The seller owns the target + creative;
 * admins moderate each placement independently. `imageUrl` is a bounded, already-resolved URL
 * (mirrors the SDUI banner leaf) rendered by the app as-is.
 */
export interface HeroCampaign {
  placementId: string;
  campaignId: string;
  sellerId: string;
  creativeType: "RAIL" | "HERO";
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
  stateCode?: string | undefined;
  status: AdStatus;
  /** User "Report ad" taps; surfaced in the admin live monitor (no reporter PII). */
  reports?: number | undefined;
  takedownReason?: string | undefined;
  impressions: number;
  clicks: number;
  ordersAttributed: number;
  startsAt: string;
  endsAt: string;
  requestedAt: string;
}

/** admins.district_admins */
export interface DistrictAdmin {
  adminId: string;
  name: string;
  email: string;
  phone: string;
  /** 3-letter district scope (authoritative). */
  districtCode: string;
  /** Legacy parent state (kept for older rows / sorting). */
  stateCode?: string | undefined;
  active: boolean;
  createdAt: string;
  lastActiveAt: string;
}

/** admins.portal_users — a portal login issued by a superadmin (never carries the hash). */
export interface PortalCredential {
  id: string;
  email: string;
  name: string;
  role: Role;
  sellerId?: string | undefined;
  districtCode?: string | undefined;
  stateCode?: string | undefined;
  active: boolean;
  mustChange: boolean;
  lastLoginAt?: string | undefined;
  createdAt?: string | undefined;
}

/** sellers.seller_fee_change_requests */
export interface FeeChangeRequest {
  requestId: string;
  sellerId: string;
  businessName?: string | undefined;
  districtCode?: string | undefined;
  currentFeePct: number;
  requestedFeePct: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | string;
  adminNote?: string | undefined;
  requestedAt: string;
  reviewedBy?: string | undefined;
  reviewedAt?: string | undefined;
  reviewReason?: string | undefined;
}

/** admins.audit_logs */
export interface AuditLog {
  logId: string;
  actorId: string;
  actorRole: Role;
  action: string;
  entity: string;
  entityId: string;
  before: string | null;
  after: string | null;
  createdAt: string;
}

/** reviews.reviews */
export interface ReviewRecord {
  reviewId: string;
  productId: string;
  sellerId: string;
  customerName: string;
  rating: number;
  body: string;
  flagged: boolean;
  sellerReply: string | null;
  createdAt: string;
}

export interface DailyPoint {
  date: string;
  gmvPaisa: number;
  orders: number;
  views: number;
  carts: number;
}

export interface StateInfo {
  stateCode: string;
  name: string;
}

export type PrescriptionStatus =
  | "RECEIVED"
  | "PROCESSING"
  | "QUOTED"
  | "READY"
  | "FULFILLED"
  | "CANCELLED";
export type PrescriptionFulfillment = "DELIVERY" | "PICKUP";

/** pharma.quote_items — one seller-entered quote line (money in integer paisa on the web). */
export interface QuoteItemRecord {
  name: string;
  qty: number;
  mrpPaisa: number;
  pricePaisa: number;
  discountPaisa: number;
}

/** pharma.status_history — one append-only Rx transition. */
export interface PrescriptionHistoryEntry {
  fromStatus?: string | undefined;
  toStatus: string;
  actorId: string;
  actorRole: string;
  createdAt: string;
}

/** pharma.prescriptions (image paths are Storage object keys, never URLs). */
export interface PrescriptionRecord {
  prescriptionId: string;
  /** Present only for admin/derived views; the seller projection is name-only until READY. */
  userId?: string | undefined;
  sellerId: string;
  storeId: string;
  vendorName: string;
  /** Seller-safe display name (no phone/address until READY/FULFILLED). */
  customerName?: string | undefined;
  customerPhone?: string | undefined;
  customerAddress?: string | undefined;
  pages: number;
  note: string;
  fulfillment: PrescriptionFulfillment;
  status: PrescriptionStatus;
  /** Storage object keys (private bucket) — resolve with fetchPrescriptionImages. */
  imagePaths?: string[] | undefined;
  quote?: QuoteItemRecord[] | undefined;
  quotedTotalPaisa?: number | undefined;
  revealedAt?: string | undefined;
  history?: PrescriptionHistoryEntry[] | undefined;
  createdAt: string;
  updatedAt: string;
}

export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "O+" | "O-" | "AB+" | "AB-";

/** blood.requests */
export interface BloodRequestRecord {
  requestId: string;
  hospital: string;
  city: string;
  stateCode: string;
  bloodGroup: BloodGroup;
  unitsRequired: number;
  urgency: "normal" | "urgent" | "critical";
  patientContext: string;
  contact: string;
  postedAt: string;
  expiresAt: string;
}

/** MongoDB sdui_layouts (ID-only refs; the gateway joins the content). Mirrors the gateway
 * contracts.SduiSection/SduiChip so a published layout round-trips without remapping. */
export interface SduiChip {
  id: string;
  label: string;
  accent: string;
  productIds: string[];
}

/** One editorial hero banner (image + copy). Never money — prices are always joined from the catalog. */
export interface SduiBanner {
  id: string;
  title: string;
  subtitle?: string | undefined;
  accent?: string | undefined;
  imageUrl?: string | undefined;
}

export interface SduiSection {
  id: string;
  title: string;
  subtitle?: string | undefined;
  accent: string;
  productIds: string[];
  storeIds?: string[] | undefined;
  chips?: SduiChip[] | undefined;
  banners?: SduiBanner[] | undefined;
  campaigns?: SduiCampaign[] | undefined;
}

/** One editorial vendor campaign (ID-only: a directory store + its catalog products). Mirrors
 * contracts.SduiCampaign; compiled by the gateway into `GET /home/campaigns(/{id})`. */
export interface SduiCampaign {
  id: string;
  storeId: string;
  productIds: string[];
  carousel: 1 | 2;
}

export interface SduiLayout {
  layoutId: string;
  locale: string;
  version: number;
  sections: SduiSection[];
  updatedAt: string;
}

/** checkout.users_admin — PII-redacted customer projection (no phone/address/email). */
export interface CustomerRecord {
  userId: string;
  name: string;
  stateCode?: string | undefined;
  ordersCount: number;
  spendPaisa: number;
  lastOrderAt?: string | undefined;
  createdAt: string;
}

/** directory.menus — seller-scoped, state-moderated vendor menu item. */
export interface MenuItemRecord {
  venueId: string;
  dishId: string;
  name: string;
  pricePaisa: number;
  /** List price (MRP) in paisa for the strike-through. Absent = no offer; never below pricePaisa. */
  mrpPaisa?: number | undefined;
  isVeg?: boolean | undefined;
  cuisine?: string | undefined;
  rating?: number | undefined;
  image?: string | undefined;
  sellerId?: string | undefined;
  status: ProductStatus;
}

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

/** support.tickets */
export interface TicketRecord {
  ticketId: string;
  userId?: string | undefined;
  sellerId?: string | undefined;
  stateCode?: string | undefined;
  subject: string;
  body: string;
  status: TicketStatus;
  createdAt: string;
}

/** rewards.rates — the single admin-tunable rewards program row. */
export interface RewardsRates {
  coinEarnRate: number;
  coinRedeemRate: number;
  streakTargetDays: number;
  discountCardPercent: number;
  cardValidityDays: number;
  updatedAt?: string | undefined;
}

/** rewards.ledger — append-only coin ledger (server is the only writer; userId stays off the wire). */
export interface RewardLedgerEntry {
  entryId: string;
  type: "EARN" | "REDEEM" | "STREAK";
  coins: number;
  rupees: number;
  orderId?: string | undefined;
  at: string;
}
