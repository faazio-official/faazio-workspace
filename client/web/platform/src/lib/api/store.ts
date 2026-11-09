"use client";
// Portal state. Every slice is hydrated from the Go gateway by `hydrateFromGateway`; there are no
// bundled demo rows. Pages never import src/data/** directly — they call src/lib/api/* services.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { config } from "@/lib/config";
import { notifyVendorChange } from "@/lib/appContext";
import type {
  AdSlot,
  AuditLog,
  AuthUser,
  BankAccount,
  BloodRequestRecord,
  CouponRecord,
  CustomerRecord,
  FestivalCampaign,
  HeroCampaign,
  KycDocument,
  LedgerEntry,
  MenuItemRecord,
  NotificationPreferences,
  OrderRecord,
  PayoutRecord,
  PrescriptionRecord,
  ProductRecord,
  ReviewRecord,
  RewardLedgerEntry,
  RewardsRates,
  SduiLayout,
  SectorCap,
  SellerOptin,
  SellerRecord,
  DistrictAdmin,
  StockRecord,
  SubUser,
  StoreRecord,
  TicketRecord,
} from "@/data/types";

/** Tracks the restore lifecycle so gates can distinguish "reconnecting" from "signed out". */
export type SessionStatus = "unknown" | "signed-in" | "reconnecting" | "signed-out";

export interface PortalState {
  session: AuthUser | null;
  sessionStatus: SessionStatus;
  /** True once the first gateway hydration pass has completed (success or failure). Drives the
   *  portal's real loading state instead of a fabricated timer. Never persisted. */
  hydrated: boolean;
  /** The vendor (directory.stores id) the seller console is currently scoped to. Persisted so a
   *  reload keeps the seller on the same shop; null means "not chosen yet" (fall back to the first). */
  activeStoreId: string | null;
  /** Bumped every time `activeStoreId` actually changes so store-scoped data hooks and shells can
   *  react to a shop switch even when their filter value stays empty (e.g. restore, first load). */
  storeScopeVersion: number;
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
  heroCampaigns: HeroCampaign[];
  districtAdmins: DistrictAdmin[];
  auditLogs: AuditLog[];
  reviews: ReviewRecord[];
  prescriptions: PrescriptionRecord[];
  bloodRequests: BloodRequestRecord[];
  sduiLayouts: SduiLayout[];
  customers: CustomerRecord[];
  menus: MenuItemRecord[];
  tickets: TicketRecord[];
  rewardRates: RewardsRates;
  rewardLedger: RewardLedgerEntry[];
  /** Seller staff logins (`sellers.sub_users`, hydrated for SELLER). */
  subUsers: SubUser[];
  /** Per-seller alert preferences (`sellers.notification_preferences`, hydrated for SELLER). */
  notificationPreferences: NotificationPreferences;
  set: (updater: (state: PortalState) => Partial<PortalState>) => void;
  setActiveStoreId: (id: string | null) => void;
}

const emptySeed = {
  session: null as AuthUser | null,
  sessionStatus: "unknown" as SessionStatus,
  hydrated: false,
  activeStoreId: null as string | null,
  storeScopeVersion: 0,
  sellers: [] as SellerRecord[],
  kyc: [] as KycDocument[],
  bankAccounts: [] as BankAccount[],
  stores: [] as StoreRecord[],
  products: [] as ProductRecord[],
  stock: [] as StockRecord[],
  orders: [] as OrderRecord[],
  ledger: [] as LedgerEntry[],
  payouts: [] as PayoutRecord[],
  sectorCaps: [] as SectorCap[],
  campaigns: [] as FestivalCampaign[],
  optins: [] as SellerOptin[],
  coupons: [] as CouponRecord[],
  adSlots: [] as AdSlot[],
  heroCampaigns: [] as HeroCampaign[],
  districtAdmins: [] as DistrictAdmin[],
  auditLogs: [] as AuditLog[],
  reviews: [] as ReviewRecord[],
  prescriptions: [] as PrescriptionRecord[],
  bloodRequests: [] as BloodRequestRecord[],
  sduiLayouts: [] as SduiLayout[],
  customers: [] as CustomerRecord[],
  menus: [] as MenuItemRecord[],
  tickets: [] as TicketRecord[],
  rewardRates: {
    coinEarnRate: 1000,
    coinRedeemRate: 100,
    streakTargetDays: 7,
    discountCardPercent: 10,
    cardValidityDays: 5,
  } as RewardsRates,
  rewardLedger: [] as RewardLedgerEntry[],
  subUsers: [] as SubUser[],
  notificationPreferences: {
    newOrder: true,
    lowStock: true,
    slaBreach: true,
    campaigns: true,
  } as NotificationPreferences,
};

export const usePortalStore = create<PortalState>()(
  persist(
    (setState) => ({
      ...emptySeed,
      set: (updater) => setState((state) => updater(state)),
      setActiveStoreId: (id) =>
        setState((state) => {
          if (state.activeStoreId === id) return state;
          // Re-scope announcement: bump the version for store-scoped hooks/shells and tell the
          // native seller shell, so a cold start reopens the portal on the newly chosen shop.
          notifyVendorChange(id);
          return { activeStoreId: id, storeScopeVersion: state.storeScopeVersion + 1 };
        }),
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
        const {
          set: _set,
          setActiveStoreId: _setActive,
          sessionStatus: _status,
          hydrated: _hydrated,
          ...rest
        } = state;
        // The portal session and hydration flag are never persisted: the session is refreshed from
        // the HttpOnly cookie and hydration always starts fresh on load.
        return { ...rest, session: null };
      },
    },
  ),
);
