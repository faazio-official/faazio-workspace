// 'use client'
// In-memory store seeded from src/data/**, persisted to localStorage.
// Pages never import src/data/** directly — they call src/lib/api/* services.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { config } from "@/lib/config";
import { AUTH_USERS } from "@/data/auth/users";
import { SELLERS, KYC_DOCUMENTS, BANK_ACCOUNTS } from "@/data/sellers/sellers";
import { STORES } from "@/data/stores/stores";
import { PRODUCTS } from "@/data/catalog/products";
import { STOCK } from "@/data/inventory/stock";
import { ORDERS } from "@/data/orders/orders";
import { LEDGER, PAYOUTS } from "@/data/payments/ledger";
import { SECTOR_CAPS } from "@/data/promotions/sectorCaps";
import { FESTIVAL_CAMPAIGNS, SELLER_OPTINS } from "@/data/promotions/festivalCampaigns";
import { COUPONS } from "@/data/promotions/coupons";
import { AD_SLOTS } from "@/data/ads/adSlots";
import { STATE_ADMINS } from "@/data/admins/stateAdmins";
import { AUDIT_LOGS } from "@/data/admins/auditLogs";
import { REVIEWS } from "@/data/reviews/reviews";
import type {
  AdSlot,
  AuditLog,
  AuthUser,
  BankAccount,
  CouponRecord,
  FestivalCampaign,
  KycDocument,
  LedgerEntry,
  OrderRecord,
  PayoutRecord,
  ProductRecord,
  ReviewRecord,
  SectorCap,
  SellerOptin,
  SellerRecord,
  StateAdmin,
  StockRecord,
  StoreRecord,
} from "@/data/types";

export interface PortalState {
  session: AuthUser | null;
  sellers: SellerRecord[];
  kyc: KycDocument[];
  bankAccounts: BankAccount[];
  stores: StoreRecord[];
  products: ProductRecord[];
  stock: StockRecord[];
  orders: OrderRecord[];
  ledger: LedgerEntry[];
  payouts: PayoutRecord[];
  sectorCaps: SectorCap[];
  campaigns: FestivalCampaign[];
  optins: SellerOptin[];
  coupons: CouponRecord[];
  adSlots: AdSlot[];
  stateAdmins: StateAdmin[];
  auditLogs: AuditLog[];
  reviews: ReviewRecord[];
  set: (updater: (state: PortalState) => Partial<PortalState>) => void;
}

const seed = {
  session: null as AuthUser | null,
  sellers: SELLERS,
  kyc: KYC_DOCUMENTS,
  bankAccounts: BANK_ACCOUNTS,
  stores: STORES,
  products: PRODUCTS,
  stock: STOCK,
  orders: ORDERS,
  ledger: LEDGER,
  payouts: PAYOUTS,
  sectorCaps: SECTOR_CAPS,
  campaigns: FESTIVAL_CAMPAIGNS,
  optins: SELLER_OPTINS,
  coupons: COUPONS,
  adSlots: AD_SLOTS,
  stateAdmins: STATE_ADMINS,
  auditLogs: AUDIT_LOGS,
  reviews: REVIEWS,
};

export const usePortalStore = create<PortalState>()(
  persist(
    (setState) => ({
      ...seed,
      set: (updater) => setState((state) => updater(state)),
    }),
    {
      name: config.storageKey,
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? {
              getItem: () => null,
              setItem: () => undefined,
              removeItem: () => undefined,
            }
          : window.localStorage,
      ),
      partialize: (state) => {
        const { set: _set, ...rest } = state;
        return rest;
      },
    },
  ),
);

export const AUTH_DIRECTORY = AUTH_USERS;
