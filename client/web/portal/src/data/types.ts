// Provenance: mirrors Faazio DB schema. TS camelCase <-> DB snake_case.
// money = integer paisa, ids = stable slugs, enums UPPERCASE, timestamps ISO.

export type Sector = "MART" | "FOOD" | "PHARMA";
export type Role = "SELLER" | "STATE_ADMIN" | "SUPER_ADMIN";

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
export type AdStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "LIVE";

/** auth.accounts */
export interface AuthUser {
  accountId: string; // account_id
  role: Role;
  name: string;
  email: string;
  password: string; // mock only
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
  status: SellerStatus;
  rating: number;
  createdAt: string;
}

/** sellers.kyc_documents */
export interface KycDocument {
  kycId: string;
  sellerId: string;
  docType: "GSTIN" | "PAN" | "BANK_PROOF" | "SHOP_LICENSE";
  fileUrl: string;
  verified: boolean;
  uploadedAt: string;
}

/** sellers.bank_accounts */
export interface BankAccount {
  bankAccountId: string;
  sellerId: string;
  accountNumberMasked: string;
  ifsc: string;
  beneficiaryName: string;
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
  discountPercent: number;
  isVeg: boolean;
  isPrescription: boolean;
  status: ProductStatus;
  qualityScore: number;
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

/** admins.state_admins */
export interface StateAdmin {
  adminId: string;
  name: string;
  email: string;
  phone: string;
  stateCode: string;
  active: boolean;
  createdAt: string;
  lastActiveAt: string;
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
