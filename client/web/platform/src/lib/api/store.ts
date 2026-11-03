"use client";
// Portal state. Every slice is hydrated from the Go gateway by `hydrateFromGateway`; there are no
// bundled demo rows. Pages never import src/data/** directly — they call src/lib/api/* services.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { config } from "@/lib/config";
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
  StoreRecord,
  TicketRecord,
} from "@/data/types";

/** Tracks the restore lifecycle so gates can distinguish "reconnecting" from "signed out". */
export type SessionStatus = "unknown" | "signed-in" | "reconnecting" | "signed-out";

export interface PortalState {
  session: AuthUser | null;
  sessionStatus: SessionStatus;
  /** The vendor (directory.stores id) the seller console is currently scoped to. Persisted so a
   *  reload keeps the seller on the same shop; null means "not chosen yet" (fall back to the first). */
  activeStoreId: string | null;
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
  set: (updater: (state: PortalState) => Partial<PortalState>) => void;
  setActiveStoreId: (id: string | null) => void;
}

const emptySeed = {
  session: null as AuthUser | null,
  sessionStatus: "unknown" as SessionStatus,
  activeStoreId: null as string | null,
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
};

export const usePortalStore = create<PortalState>()(
  persist(
    (setState) => ({
      ...emptySeed,
      set: (updater) => setState((state) => updater(state)),
      setActiveStoreId: (id) => setState({ activeStoreId: id }),
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
        const { set: _set, setActiveStoreId: _setActive, sessionStatus: _status, ...rest } = state;
        // The portal session is never persisted: it is refreshed from the HttpOnly cookie on load.
        return { ...rest, session: null };
      },
    },
  ),
);
