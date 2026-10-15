"use client";
// Reactive read hooks over the service layer. Pages use these instead of src/data/**.
import { useEffect, useMemo, useState } from "react";
import { usePortalStore } from "@/lib/api/store";
import * as api from "@/lib/api";
import type { OrderStatus, Role, SellerStatus } from "@/data/types";

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
  filter: { stateCode?: string | undefined; status?: SellerStatus | "ALL" | undefined } = {},
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

export function useStateAdmins(stateCode?: string) {
  const admins = usePortalStore((s) => s.stateAdmins);
  return useMemo(() => api.listStateAdmins(stateCode), [admins, stateCode]);
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

export function useBookings(
  filter: { sellerId?: string | undefined; stateCode?: string | undefined; status?: import("@/data/types").BookingStatus | "ALL" | undefined } = {},
) {
  const bookings = usePortalStore((s) => s.bookings);
  const key = JSON.stringify(filter);
  return useMemo(() => api.listBookings(filter), [bookings, key]);
}

export function useBloodRequests(
  filter: { stateCode?: string | undefined; city?: string | undefined; bloodGroup?: string | undefined } = {},
) {
  const bloodRequests = usePortalStore((s) => s.bloodRequests);
  const key = JSON.stringify(filter);
  return useMemo(() => api.listBloodRequests(filter), [bloodRequests, key]);
}

export function useSduiLayouts(
  filter: { layoutId?: string | undefined; status?: import("@/data/types").SduiLayoutStatus | "ALL" | undefined } = {},
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
