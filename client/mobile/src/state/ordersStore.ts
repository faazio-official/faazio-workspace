import { create } from 'zustand';
import type { OrderLineAddon, OrderRow } from '@data/checkout/orders';
import type { FulfillmentMode, OrderStatus } from '@data/types';
import { orderRowToPlaced, prescriptionToPlaced } from '@/services/orderHistory';
import { gateway } from '@/services/api/GatewayClient';

export type PlacedOrderKind = 'items' | 'prescription';

export interface PlacedOrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  emoji: string;
  /** Selected extras snapshotted on the order line (server-persisted). */
  addons?: OrderLineAddon[];
}

export interface PlacedOrder {
  id: string;
  orderId: string;
  kind: PlacedOrderKind;
  /**
   * Customer-facing lifecycle status. In-session optimistic placements start as
   * `Processing`; server-hydrated history carries the durable status (NEW/PACKED
   * are projected to `Processing` by the gateway). Mirrors `MyOrder.status`.
   */
  status: OrderStatus;
  fulfillment: FulfillmentMode;
  vendorName: string;
  pickup?: { name: string; address: string };
  /** Self-pickup orders — one pickup point per distinct vendor. Present only when fulfillment is PICKUP. */
  pickups?: { name: string; address: string; hours?: string; phone?: string }[];
  /** Delivery orders — optional live GPS fix captured at checkout (not uploaded yet). */
  location?: { lat: number; lng: number };
  /** Prescription orders only — captured page count. */
  pages?: number;
  /** Prescription orders only — the durable pharma status (RECEIVED/QUOTED/READY/…), for the list pill. */
  rxStatus?: string;
  /** Prescription orders only — optional pharmacist note. Never PII-logged. */
  note?: string;
  /** Itemised orders only — purchased line items. */
  items?: PlacedOrderItem[];
  /**
   * Distinct vendor ids this order resolves to, resolved once at placement
   * (vendor identity snapshot). Drives the derived rating-eligibility gate.
   */
  storeIds?: string[];
  total: number;
  placedAt: string;
}

interface PlacedOrderInput {
  orderId: string;
  kind: PlacedOrderKind;
  fulfillment: FulfillmentMode;
  vendorName: string;
  pickup?: { name: string; address: string };
  pickups?: { name: string; address: string; hours?: string; phone?: string }[];
  location?: { lat: number; lng: number };
  pages?: number;
  note?: string;
  items?: PlacedOrderItem[];
  storeIds?: string[];
  total: number;
}

interface OrdersState {
  /** In-session optimistic placements (not persisted; e.g. a prescription draft). */
  orders: PlacedOrder[];
  /**
   * Durable order history pulled from the gateway. Kept separate from `orders`
   * so an empty server slice never clobbers an in-session placement.
   */
  serverOrders: PlacedOrder[];
  /** True once the durable history read has settled (success or empty), remote mode only. */
  ordersHydrated: boolean;
  /** True when the last durable history read failed and there is no cached history to show. */
  ordersError: boolean;
  /** Local transient placement (only for flows that do not yet return a server order row). */
  recordOrder: (order: PlacedOrderInput) => void;
  /** Adopt a server order returned by POST /orders (authoritative id + status). */
  recordServerOrder: (row: OrderRow) => void;
  /** Merge the durable history (server is authoritative for status). */
  hydrateServerOrders: (orders: PlacedOrder[]) => void;
  /** Refetch the caller's durable order history from the gateway. */
  refresh: () => Promise<void>;
  /** Drop per-user history on sign-out. */
  reset: () => void;
  getOrderById: (orderId: string) => PlacedOrder | undefined;
}

export const useOrdersStore = create<OrdersState>()((set, get) => ({
  orders: [],
  serverOrders: [],
  ordersHydrated: false,
  ordersError: false,

  recordOrder: (input) => {
    const order: PlacedOrder = {
      id: `placed-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      status: 'Processing',
      placedAt: new Date().toISOString(),
      ...input,
    };
    set((state) => ({ orders: [order, ...state.orders] }));
  },

  recordServerOrder: (row) => {
    const placed = orderRowToPlaced(row);
    set((state) => ({
      serverOrders: [placed, ...state.serverOrders.filter((o) => o.orderId !== placed.orderId)],
      ordersHydrated: true,
    }));
  },

  hydrateServerOrders: (orders) => set({ serverOrders: orders, ordersHydrated: true }),

  refresh: async () => {
    if (!gateway.remoteEnabled) {
      set({ ordersHydrated: true, ordersError: false });
      return;
    }
    try {
      // Durable history is two sources: item orders (`GET /orders`) and prescriptions
      // (`GET /prescriptions`). The materialised Rx checkout order is hidden server-side, so the Rx
      // is listed from its own row. A prescription read failure must not blank out item history.
      const [rows, prescriptions] = await Promise.all([
        gateway.getOrders(),
        gateway.getPrescriptions().catch(() => []),
      ]);
      const merged = [
        ...rows.map(orderRowToPlaced),
        ...prescriptions.map(prescriptionToPlaced),
      ].sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());
      set({ serverOrders: merged, ordersHydrated: true, ordersError: false });
    } catch {
      // Keep any previous live history (stale-but-honest) instead of showing fixtures, but
      // surface the failure so an empty screen is not mistaken for "no orders".
      set((state) => ({
        ordersHydrated: true,
        ordersError: state.serverOrders.length === 0,
      }));
    }
  },

  reset: () => set({ orders: [], serverOrders: [], ordersHydrated: false, ordersError: false }),

  // Server history wins over a same-id in-session placement (fresh status), but keep
  // in-session placements the server hasn't adopted yet (e.g. a prescription draft).
  getOrderById: (orderId) =>
    get().serverOrders.find((o) => o.orderId === orderId) ??
    get().orders.find((o) => o.orderId === orderId),
}));
