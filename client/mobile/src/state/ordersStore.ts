import { create } from 'zustand';
import type { FulfillmentMode } from '@data/types';

export type PlacedOrderKind = 'items' | 'prescription';

export interface PlacedOrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  emoji: string;
}

export interface PlacedOrder {
  id: string;
  orderId: string;
  kind: PlacedOrderKind;
  status: 'Processing';
  fulfillment: FulfillmentMode;
  vendorName: string;
  pickup?: { name: string; address: string };
  /** Prescription orders only — captured page count. */
  pages?: number;
  /** Prescription orders only — optional pharmacist note. Never PII-logged. */
  note?: string;
  /** Itemised orders only — purchased line items. */
  items?: PlacedOrderItem[];
  total: number;
  placedAt: string;
}

interface PlacedOrderInput {
  orderId: string;
  kind: PlacedOrderKind;
  fulfillment: FulfillmentMode;
  vendorName: string;
  pickup?: { name: string; address: string };
  pages?: number;
  note?: string;
  items?: PlacedOrderItem[];
  total: number;
}

interface OrdersState {
  orders: PlacedOrder[];
  recordOrder: (order: PlacedOrderInput) => void;
  getOrderById: (orderId: string) => PlacedOrder | undefined;
}

export const useOrdersStore = create<OrdersState>()((set, get) => ({
  orders: [],

  recordOrder: (input) => {
    const order: PlacedOrder = {
      id: `placed-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      status: 'Processing',
      placedAt: new Date().toISOString(),
      ...input,
    };
    set((state) => ({ orders: [order, ...state.orders] }));
  },

  getOrderById: (orderId) => get().orders.find((o) => o.orderId === orderId),
}));
