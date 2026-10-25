"use client";
// Reactive read hooks over the service layer. Pages use these instead of src/data/**.
import { useEffect, useMemo, useState } from "react";
import { usePortalStore } from "@/lib/api/store";
import { remote } from "@/lib/api/http";
import { remoteConfigured } from "@/lib/config";
import * as api from "@/lib/api";
import type { OrderStatus, Role, SellerStatus } from "@/data/types";

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

/** Short mock latency so every page exercises its loading state. */
export function useMockLoading(ms = 320): boolean {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), ms);
    return () => window.clearTimeout(timer);
  }, [ms]);
  return loading;
}

export function useProducts(filter: api.ProductFilter = {}) {
  const products = usePortalStore((s) => s.products);
  const stores = usePortalStore((s) => s.stores);
  const key = JSON.stringify(filter);
  return useMemo(() => api.listProducts(filter), [products, stores, key]);
}

export function useStock(sellerId?: string) {
  const stock = usePortalStore((s) => s.stock);
  const products = usePortalStore((s) => s.products);
  return useMemo(() => api.listStock(sellerId), [stock, products, sellerId]);
}

export function useOrders(
  filter: { sellerId?: string | undefined; stateCode?: string | undefined; status?: OrderStatus | "ALL" | undefined } = {},
) {
  const orders = usePortalStore((s) => s.orders);
  const key = JSON.stringify(filter);
  return useMemo(() => api.listOrders(filter), [orders, key]);
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

export function useCampaigns(filter: { stateCode?: string | undefined } = {}) {
  const campaigns = usePortalStore((s) => s.campaigns);
  const key = JSON.stringify(filter);
  return useMemo(() => api.listCampaigns(filter), [campaigns, key]);
}

export function useSectorCaps() {
  return usePortalStore((s) => s.sectorCaps);
}

/** One SUPER_ADMIN-managed category → GST rate row (`GET /tax/categories`). */
export interface TaxCategory {
  taxRateId: string;
  sector: string;
  category: string;
  gstRatePct: number;
  isActive: boolean;
}

/**
 * Approved category master. Sellers may only list inside these categories; the GST rate shown comes
 * from the same source the gateway uses at checkout. Falls back to the categories already present in
 * the local catalog when the gateway is not configured (seed/demo mode).
 */
export function useTaxCategories(sector?: string) {
  const products = usePortalStore((s) => s.products);
  const [remoteItems, setRemoteItems] = useState<TaxCategory[]>([]);
  useEffect(() => {
    if (!remoteConfigured()) {
      setRemoteItems([]);
      return;
    }
    let cancelled = false;
    remote
      .get<Record<string, unknown>[]>("/tax/categories")
      .then((rows) => {
        if (cancelled) return;
        setRemoteItems(
          rows.map((r) => ({
            taxRateId: String(r["taxRateId"] ?? ""),
            sector: String(r["sector"] ?? ""),
            category: String(r["category"] ?? ""),
            gstRatePct: Number(r["gstRatePct"] ?? 5),
            isActive: Boolean(r["isActive"] ?? true),
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setRemoteItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fallback = useMemo(() => {
    const seen = new Map<string, TaxCategory>();
    for (const p of products) {
      if (!p.category) continue;
      const key = `${p.sector}|${p.category.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.set(key, {
          taxRateId: `local-${key}`,
          sector: p.sector,
          category: p.category,
          gstRatePct: 5,
          isActive: true,
        });
      }
    }
    return [...seen.values()].sort((a, b) => a.category.localeCompare(b.category));
  }, [products]);

  const source = remoteItems.length > 0 ? remoteItems : fallback;
  return useMemo(
    () => (sector ? source.filter((c) => c.sector === sector) : source),
    [source, sector],
  );
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

export function useAdSlots(filter: { sellerId?: string | undefined; stateCode?: string | undefined } = {}) {
  const adSlots = usePortalStore((s) => s.adSlots);
  const key = JSON.stringify(filter);
  return useMemo(() => api.listAdSlots(filter), [adSlots, key]);
}

export function useHeroCampaigns(
  filter: { sellerId?: string | undefined; stateCode?: string | undefined } = {},
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

export function useSeller(sellerId: string) {
  const sellers = usePortalStore((s) => s.sellers);
  return useMemo(() => api.getSeller(sellerId), [sellers, sellerId]);
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

export function useCustomers(
  filter: { stateCode?: string | undefined; query?: string | undefined } = {},
) {
  const customers = usePortalStore((s) => s.customers);
  const key = JSON.stringify(filter);
  return useMemo(() => api.listCustomers(filter), [customers, key]);
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
