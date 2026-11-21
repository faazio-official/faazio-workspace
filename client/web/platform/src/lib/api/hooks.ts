"use client";
// Reactive read hooks over the service layer. Pages use these instead of src/data/**.
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePortalStore } from "@/lib/api/store";
import { remote } from "@/lib/api/http";
import { remoteConfigured } from "@/lib/config";
import * as api from "@/lib/api";
import type {
  BankAccount,
  CustomerRecord,
  FeeChangeRequest,
  NotificationPreferences,
  OrderRecord,
  OrderStatus,
  Role,
  SellerLead,
  SellerStatus,
  SubUser,
} from "@/data/types";

/** One ID-only behaviour event (`GET /admin/user-trail`); never carries a raw user id or PII. */
export interface UserTrailEvent {
  event: string;
  productId: string;
  at: string;
}

/**
 * Admin-only user behaviour trail. Fetched on demand (per selected customer) rather than hydrated
 * into the store — it is a live monitoring read, not a control-plane slice.
 */
export function useUserTrail(userId: string | null): { events: UserTrailEvent[]; loading: boolean } {
  const [events, setEvents] = useState<UserTrailEvent[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!userId || !remoteConfigured()) {
      setEvents([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    remote
      .get<Record<string, unknown>[]>("/admin/user-trail", { query: { userId, limit: 100 } })
      .then((rows) => {
        if (cancelled) return;
        setEvents(
          rows.map((r) => ({
            event: String(r["event"] ?? ""),
            productId: String(r["productId"] ?? ""),
            at: String(r["at"] ?? ""),
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  return { events, loading };
}

/**
 * Real portal loading state: true while the first gateway hydration pass is in flight (or before
 * it starts). Replaces the retired fabricated `useMockLoading` timer — no artificial delay.
 */
export function usePortalLoading(): boolean {
  return usePortalStore((s) => !s.hydrated);
}

export function useProducts(filter: api.ProductFilter = {}) {
  const products = usePortalStore((s) => s.products);
  const stores = usePortalStore((s) => s.stores);
  const key = JSON.stringify(filter);
  return useMemo(() => api.listProducts(filter), [products, stores, key]);
}

export function useStock(sellerId?: string, storeId?: string) {
  const stock = usePortalStore((s) => s.stock);
  const products = usePortalStore((s) => s.products);
  return useMemo(() => api.listStock(sellerId, storeId), [stock, products, sellerId, storeId]);
}

export function useOrders(
  filter: { sellerId?: string | undefined; storeId?: string | undefined; stateCode?: string | undefined; status?: OrderStatus | "ALL" | undefined } = {},
) {
  const orders = usePortalStore((s) => s.orders);
  const key = JSON.stringify(filter);
  return useMemo(() => api.listOrders(filter), [orders, key]);
}

export interface AdminOrdersState {
  data: OrderRecord[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * SUPER_ADMIN "All orders" board (`GET /admin/orders`). A live server-filtered read (not the
 * hydrated `orders` slice), so status/state/search filters apply across every district instantly.
 */
export function useAdminOrders(filter: api.AdminOrdersFilter = {}): AdminOrdersState {
  return useAdminOrdersSource(filter, api.fetchAdminOrders);
}

/** DISTRICT_ADMIN board (`GET /admin/district/orders`), scoped server-side to the caller's district. */
export function useDistrictAdminOrders(filter: api.AdminOrdersFilter = {}): AdminOrdersState {
  return useAdminOrdersSource(filter, api.fetchDistrictAdminOrders);
}

function useAdminOrdersSource(
  filter: api.AdminOrdersFilter,
  fetcher: (f: api.AdminOrdersFilter) => Promise<OrderRecord[]>,
): AdminOrdersState {
  const key = JSON.stringify(filter);
  const [data, setData] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    if (!remoteConfigured()) {
      setData([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetcher(JSON.parse(key) as api.AdminOrdersFilter)
      .then((rows) => {
        if (cancelled) return;
        setData(rows);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setData([]);
        setError("Could not load orders");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher, key, version]);
  return { data, loading, error, refresh };
}

export function useSellers(
  filter: {
    stateCode?: string | undefined;
    districtCode?: string | undefined;
    status?: SellerStatus | "ALL" | undefined;
  } = {},
) {
  const sellers = usePortalStore((s) => s.sellers);
  const key = JSON.stringify(filter);
  return useMemo(() => api.listSellers(filter), [sellers, key]);
}

export function useStores(filter: { sellerId?: string | undefined; stateCode?: string | undefined } = {}) {
  const stores = usePortalStore((s) => s.stores);
  const key = JSON.stringify(filter);
  return useMemo(() => api.listStores(filter), [stores, key]);
}

/**
 * Live seller-lead queue read (`GET /seller-leads`). Fetched on demand rather than hydrated into the
 * store: leads are PII and change as admins work them, so a stale store copy would be worse than a
 * request. `version` lets a caller force a refresh after a mutation.
 */
export function useSellerLeads(
  filter: { status?: string | undefined; assigned?: "me" | "unassigned" | undefined } = {},
  version = 0,
): { leads: SellerLead[]; loading: boolean } {
  const [leads, setLeads] = useState<SellerLead[]>([]);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify(filter);

  useEffect(() => {
    if (!remoteConfigured()) {
      setLeads([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .listSellerLeads(JSON.parse(key) as Parameters<typeof api.listSellerLeads>[0])
      .then((rows) => {
        if (!cancelled) setLeads(rows);
      })
      .catch(() => {
        if (!cancelled) setLeads([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key, version]);

  return { leads, loading };
}

/**
 * The caller's real vendors (`GET /seller/stores`) — the data source for the seller console switcher
 * and for scoping seller pages to one shop. Empty when the gateway is unconfigured (local dev).
 */
export function useSellerStores(): {
  stores: api.SellerStoreSummary[];
  loading: boolean;
  reload: () => void;
} {
  const [stores, setStores] = useState<api.SellerStoreSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    if (!remoteConfigured()) {
      setStores([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .fetchSellerStores()
      .then((rows) => {
        if (!cancelled) setStores(rows);
      })
      .catch(() => {
        if (!cancelled) setStores([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);
  return { stores, loading, reload };
}

/**
 * The signed-in seller's own platform-fee change requests (`GET /sellers/{id}/platform-fee-requests`).
 * The gateway scopes the read to the caller, so no client-side seller filter is needed.
 */
export function useSellerFeeChangeRequests(sellerId: string): {
  requests: FeeChangeRequest[];
  loading: boolean;
  reload: () => void;
} {
  const [requests, setRequests] = useState<FeeChangeRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    if (!sellerId || !remoteConfigured()) {
      setRequests([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .listSellerFeeChangeRequests(sellerId)
      .then((rows) => {
        if (!cancelled) setRequests(rows);
      })
      .catch(() => {
        if (!cancelled) setRequests([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sellerId, version]);
  return { requests, loading, reload };
}

/**
 * The signed-in portal user's notification inbox (`GET /notifications`, notifications.outbox).
 * Read state persists through `POST /notifications/{id}/read` and `/notifications/read-all`.
 */
export function useNotifications(): {
  items: api.PortalNotification[];
  loading: boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
  reload: () => void;
} {
  const [items, setItems] = useState<api.PortalNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!remoteConfigured()) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .fetchNotifications()
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const markRead = useCallback((id: string) => {
    setItems((current) =>
      current.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    api.markNotificationRead(id).catch(() => {
      /* keep the optimistic row; the next reload reconciles with the server */
    });
  }, []);

  const markAllRead = useCallback(() => {
    setItems((current) =>
      current.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })),
    );
    api.markAllNotificationsRead().catch(() => {
      /* keep the optimistic rows; the next reload reconciles with the server */
    });
  }, []);

  return { items, loading, markRead, markAllRead, reload };
}

/** States/UTs from `admins.states` (the DB is the authority). */
export function useStates(): api.StateSummary[] {
  const [items, setItems] = useState<api.StateSummary[]>([]);
  useEffect(() => {
    if (!remoteConfigured()) return;
    let cancelled = false;
    api
      .fetchStates()
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return items;
}

/** Districts from `admins.district_master` via GET /geo/districts (the DB is the authority). */
export function useDistricts(): api.DistrictInfo[] {
  const [items, setItems] = useState<api.DistrictInfo[]>([]);
  useEffect(() => {
    if (!remoteConfigured()) return;
    let cancelled = false;
    api
      .fetchDistricts()
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return items;
}

/** Every district (including deactivated) for the SUPER_ADMIN coverage page. Unlike `useDistricts`
 * this is a controllable fetch (reload after a write) and asks the admin API for all rows. */
export function useAdminDistricts(stateCode?: string) {
  const [items, setItems] = useState<api.AdminDistrictRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!remoteConfigured()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api
      .listAdminDistricts(stateCode)
      .then((rows) => {
        setItems(rows);
        setError(null);
      })
      .catch((err: unknown) => {
        setItems([]);
        setError(err instanceof Error ? err.message : "Could not load the district master.");
      })
      .finally(() => setLoading(false));
  }, [stateCode]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { items, loading, error, reload };
}

/** Ad placements from `ads.placements` via GET /ads/placements (the DB is the authority). */
export function usePlacements(): api.PlacementSummary[] {
  const [items, setItems] = useState<api.PlacementSummary[]>([]);
  useEffect(() => {
    if (!remoteConfigured()) return;
    let cancelled = false;
    api
      .fetchPlacements()
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return items;
}

/** Active top-level categories of one app from `GET /categories?app=` (taxonomy is the authority). */
export function useCategories(app: import("@/data/types").Sector): api.CategoryRow[] {
  const [items, setItems] = useState<api.CategoryRow[]>([]);
  useEffect(() => {
    if (!remoteConfigured()) return;
    let cancelled = false;
    api
      .fetchCategories(app)
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [app]);
  return items;
}

/** Full active category tree of one app (`GET /categories?app=`), for seller product creation. */
export function useCategoryTree(app: import("@/data/types").Sector): api.CategoryRow[] {
  const [items, setItems] = useState<api.CategoryRow[]>([]);
  useEffect(() => {
    if (!remoteConfigured()) return;
    let cancelled = false;
    api
      .fetchCategoryTree(app)
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [app]);
  return items;
}

/**
 * GST rate pick-list (`GET /admin/tax/gst-rate-categories`). `reload` re-fetches after a portal write
 * so the categories sheet and the GST rates page never show a stale slab.
 */
export function useGSTRateCategories() {
  const [items, setItems] = useState<api.GSTRateCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!remoteConfigured()) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .listGSTRateCategories()
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load GST rates.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { items, loading, error, reload };
}

/** One IST-day analytics bucket (from checkout.orders via GET /analytics/series). */
type AnalyticsDailyPoint = import("@/data/types").DailyPoint;

/** Live daily GMV/orders for a scope (global | seller | state | product) — the DB is the source. */
export function useAnalyticsSeries(
  scope: api.AnalyticsScope,
  id: string,
  days = 30,
): AnalyticsDailyPoint[] {
  const [items, setItems] = useState<AnalyticsDailyPoint[]>([]);
  useEffect(() => {
    if (!remoteConfigured()) return;
    let cancelled = false;
    api
      .fetchAnalyticsSeries(scope, id, days)
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [scope, id, days]);
  return items;
}

/** Live seller/state/product totals from GET /analytics/ranks (used by the overview rankings). */
export function useAnalyticsRanks(days = 30): api.AnalyticsRanks {
  const [ranks, setRanks] = useState<api.AnalyticsRanks>({ sellers: [], states: [], products: [] });
  useEffect(() => {
    if (!remoteConfigured()) return;
    let cancelled = false;
    api
      .fetchAnalyticsRanks(days)
      .then((rows) => {
        if (!cancelled) setRanks(rows);
      })
      .catch(() => {
        if (!cancelled) setRanks({ sellers: [], states: [], products: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [days]);
  return ranks;
}

/**
 * Resolves the active vendor for the console: the persisted `activeStoreId` when it still exists among
 * the caller's vendors, else the first vendor. Returns the vendor plus a setter.
 *
 * The persisted id can outlive its shop (a vendor was removed, or the seller signed in on another
 * account in the same browser), and the native shell's injected `vendorId` can name a shop this
 * seller does not own. Both cases are reconciled here — falling back to a real shop and persisting
 * the choice — so no store-scoped page is ever left scoped to a vendor that is not in the list.
 */
export function useActiveStore(): {
  stores: api.SellerStoreSummary[];
  loading: boolean;
  activeStore: api.SellerStoreSummary | null;
  storeScopeVersion: number;
  setActiveStoreId: (id: string | null) => void;
} {
  const { stores, loading } = useSellerStores();
  const activeStoreId = usePortalStore((s) => s.activeStoreId);
  const storeScopeVersion = usePortalStore((s) => s.storeScopeVersion);
  const setActiveStoreId = usePortalStore((s) => s.setActiveStoreId);
  useEffect(() => {
    if (stores.length === 0) return;
    const owned = stores.some((s) => s.storeId === activeStoreId);
    if (owned) return;
    // Prefer the vendor the native seller shell had active, then the first shop the seller owns.
    const injected = typeof window !== "undefined" ? window.__faazio?.vendorId : undefined;
    const next = injected && stores.some((s) => s.storeId === injected) ? injected : stores[0]!.storeId;
    setActiveStoreId(next);
  }, [activeStoreId, stores, setActiveStoreId]);
  const activeStore =
    stores.find((s) => s.storeId === activeStoreId) ?? (stores.length > 0 ? stores[0]! : null);
  return { stores, loading, activeStore, storeScopeVersion, setActiveStoreId };
}

/** Seller console scope: the signed-in account plus its active vendor. */
export function useSellerScope(): {
  sellerId: string;
  stores: api.SellerStoreSummary[];
  activeStore: api.SellerStoreSummary | null;
  storeId: string;
  storeScopeVersion: number;
  loading: boolean;
  setActiveStoreId: (id: string | null) => void;
} {
  const sellerId = usePortalStore((s) => s.session?.sellerId ?? "");
  const { stores, activeStore, loading, storeScopeVersion, setActiveStoreId } = useActiveStore();
  return {
    sellerId,
    stores,
    activeStore,
    storeId: activeStore?.storeId ?? "",
    storeScopeVersion,
    loading,
    setActiveStoreId,
  };
}

/** True briefly after the active store changes, so a shell can show a subtle scope-changed cue. */
export function useStoreSwitching(ms = 400): boolean {
  const storeScopeVersion = usePortalStore((s) => s.storeScopeVersion);
  const [switching, setSwitching] = useState(false);
  useEffect(() => {
    if (storeScopeVersion === 0) return;
    setSwitching(true);
    const timer = window.setTimeout(() => setSwitching(false), ms);
    return () => window.clearTimeout(timer);
  }, [storeScopeVersion, ms]);
  return switching;
}

export function useCampaigns(filter: { stateCode?: string | undefined } = {}) {
  const campaigns = usePortalStore((s) => s.campaigns);
  const key = JSON.stringify(filter);
  return useMemo(() => api.listCampaigns(filter), [campaigns, key]);
}

export function useSectorCaps() {
  return usePortalStore((s) => s.sectorCaps);
}

export function useOptins(filter: { sellerId?: string | undefined; campaignId?: string | undefined } = {}) {
  const optins = usePortalStore((s) => s.optins);
  const key = JSON.stringify(filter);
  return useMemo(() => api.listOptins(filter), [optins, key]);
}

export function useCoupons(filter: { stateCode?: string | undefined; scope?: "GLOBAL" | "STATE" } = {}) {
  const coupons = usePortalStore((s) => s.coupons);
  const key = JSON.stringify(filter);
  return useMemo(() => api.listCoupons(filter), [coupons, key]);
}

export function useAdSlots(
  filter: { sellerId?: string | undefined; stateCode?: string | undefined; storeId?: string | undefined } = {},
) {
  const adSlots = usePortalStore((s) => s.adSlots);
  const key = JSON.stringify(filter);
  return useMemo(() => api.listAdSlots(filter), [adSlots, key]);
}

export function useHeroCampaigns(
  filter: { sellerId?: string | undefined; stateCode?: string | undefined; storeId?: string | undefined } = {},
) {
  const heroCampaigns = usePortalStore((s) => s.heroCampaigns);
  const key = JSON.stringify(filter);
  return useMemo(() => api.listHeroCampaigns(filter), [heroCampaigns, key]);
}

/** Live hero fill for a placement context (wizard preview). Fetched on demand; never fabricated. */
export function useHeroAds(
  placement?: string | undefined,
  ctx: { app?: string | undefined; category?: string | undefined; storeId?: string | undefined } = {},
): api.HeroAd[] {
  const [ads, setAds] = useState<api.HeroAd[]>([]);
  const { app, category, storeId } = ctx;
  useEffect(() => {
    let active = true;
    void api.getHeroAds(placement, { app, category, storeId }).then((rows) => {
      if (active) setAds(rows);
    });
    return () => {
      active = false;
    };
  }, [placement, app, category, storeId]);
  return ads;
}

export function useDistrictAdmins(districtCode?: string) {
  const admins = usePortalStore((s) => s.districtAdmins);
  return useMemo(() => api.listDistrictAdmins(districtCode), [admins, districtCode]);
}

export function useReviews(filter: { sellerId?: string | undefined; flaggedOnly?: boolean | undefined } = {}) {
  const reviews = usePortalStore((s) => s.reviews);
  const key = JSON.stringify(filter);
  return useMemo(() => api.listReviews(filter), [reviews, key]);
}

export function useAuditLogs(
  filter: { actorRole?: Role | undefined; entity?: string | undefined; query?: string | undefined } = {},
) {
  const logs = usePortalStore((s) => s.auditLogs);
  const key = JSON.stringify(filter);
  return useMemo(() => api.listAuditLogs(filter), [logs, key]);
}

export function useLedger(sellerId: string) {
  const ledger = usePortalStore((s) => s.ledger);
  return useMemo(() => api.listLedger(sellerId), [ledger, sellerId]);
}

export function usePayouts(sellerId: string) {
  const payouts = usePortalStore((s) => s.payouts);
  return useMemo(() => api.listPayouts(sellerId), [payouts, sellerId]);
}

export function useProduct(productId: string) {
  const products = usePortalStore((s) => s.products);
  return useMemo(() => api.getProduct(productId), [products, productId]);
}

export function useOrder(orderId: string) {
  const orders = usePortalStore((s) => s.orders);
  return useMemo(() => api.getOrder(orderId), [orders, orderId]);
}

/** SUPER_ADMIN single-order drill-in (`GET /admin/orders/{id}`): line items + latest delivery job. */
export function useAdminOrder(orderId: string): {
  order: api.AdminOrderDetail | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [order, setOrder] = useState<api.AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    if (!orderId || !remoteConfigured()) {
      setOrder(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .getAdminOrder(orderId)
      .then((detail) => {
        if (cancelled) return;
        setOrder(detail);
        setError(detail ? null : "Order not found");
      })
      .catch(() => {
        if (cancelled) return;
        setOrder(null);
        setError("Could not load order");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, version]);
  return { order, loading, error, refresh };
}

export function useSeller(sellerId: string) {
  const sellers = usePortalStore((s) => s.sellers);
  return useMemo(() => api.getSeller(sellerId), [sellers, sellerId]);
}

/**
 * The seller's payout account (`GET /sellers/{id}/bank-account`), hydrated on mount. A 404 is an
 * honest empty (no account yet); a transport error leaves the last-known slice in place.
 */
export function useBankAccount(sellerId: string): {
  account: BankAccount | undefined;
  loading: boolean;
  reload: () => void;
} {
  const accounts = usePortalStore((s) => s.bankAccounts);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    if (!sellerId || !remoteConfigured()) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .fetchBankAccount(sellerId)
      .catch(() => {
        /* keep the last-known slice; the gateway is the only source */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sellerId, version]);
  const account = useMemo(() => api.getBankAccount(sellerId), [accounts, sellerId]);
  return { account, loading, reload };
}

/** The seller's staff sub-users (hydrated from `sellers.sub_users`). */
export function useSubUsers(sellerId: string): SubUser[] {
  const subUsers = usePortalStore((s) => s.subUsers);
  return useMemo(() => api.listSubUsers(sellerId), [subUsers, sellerId]);
}

/** The seller's alert preferences (hydrated from `sellers.notification_preferences`). */
export function useNotificationPreferences(): NotificationPreferences {
  const prefs = usePortalStore((s) => s.notificationPreferences);
  return useMemo(() => api.getNotificationPreferences(), [prefs]);
}

export function usePrescriptions(
  filter: { sellerId?: string | undefined; storeId?: string | undefined; status?: import("@/data/types").PrescriptionStatus | "ALL" | undefined } = {},
) {
  const prescriptions = usePortalStore((s) => s.prescriptions);
  const key = JSON.stringify(filter);
  return useMemo(() => api.listPrescriptions(filter), [prescriptions, key]);
}

export function useBloodRequests(
  filter: { stateCode?: string | undefined; city?: string | undefined; bloodGroup?: string | undefined } = {},
) {
  const bloodRequests = usePortalStore((s) => s.bloodRequests);
  const key = JSON.stringify(filter);
  return useMemo(() => api.listBloodRequests(filter), [bloodRequests, key]);
}

export function useSduiLayouts(
  filter: { layoutId?: string | undefined } = {},
) {
  const sduiLayouts = usePortalStore((s) => s.sduiLayouts);
  const key = JSON.stringify(filter);
  return useMemo(() => api.listSduiLayouts(filter), [sduiLayouts, key]);
}

export function useCustomers(filter: api.CustomersFilter = {}): api.CustomersState {
  const key = JSON.stringify(filter);
  const [data, setData] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    if (!remoteConfigured()) {
      setData([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .fetchCustomers(JSON.parse(key) as api.CustomersFilter)
      .then((rows) => {
        if (cancelled) return;
        setData(rows);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setData([]);
        setError("Could not load customers");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key, version]);
  return { data, loading, error, refresh };
}

export function useMenus(
  filter: { sellerId?: string | undefined; venueId?: string | undefined; status?: import("@/data/types").ProductStatus | "ALL" | undefined } = {},
) {
  const menus = usePortalStore((s) => s.menus);
  const key = JSON.stringify(filter);
  return useMemo(() => api.listMenus(filter), [menus, key]);
}

export function useTickets(
  filter: { stateCode?: string | undefined; status?: import("@/data/types").TicketStatus | "ALL" | undefined; query?: string | undefined } = {},
) {
  const tickets = usePortalStore((s) => s.tickets);
  const key = JSON.stringify(filter);
  return useMemo(() => api.listTickets(filter), [tickets, key]);
}

export function useRewardRates() {
  const rate = usePortalStore((s) => s.rewardRates);
  return useMemo(() => api.getRewardRates(), [rate]);
}

export function useRewardLedger() {
  const ledger = usePortalStore((s) => s.rewardLedger);
  return useMemo(() => api.listRewardLedger(), [ledger]);
}
