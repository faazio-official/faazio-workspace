/**
 * Project a durable `checkout.orders` row (`OrderRow`, as returned by
 * `GatewayClient.getOrders`) onto the app's `PlacedOrder` view model so the My
 * Orders list and Order Details can render server history with the same shape
 * as an in-session placement. No PII is added — only display fields.
 *
 * See docs/architecture/mobile-app.md (orders) and WORKFLOW_SCRATCHPAD.md §12 (W22).
 */
import type { OrderRow } from '@data/checkout/orders';
import type { OrderStatus } from '@data/types';
import type { PlacedOrder } from '@/state/ordersStore';

/** Gateway projects NEW/PACKED → Processing; RETURNED folds into Cancelled for the customer. */
const STATUS_MAP: Record<string, OrderStatus> = {
  Processing: 'Processing',
  NEW: 'Processing',
  PACKED: 'Processing',
  Shipped: 'Shipped',
  SHIPPED: 'Shipped',
  Delivered: 'Delivered',
  DELIVERED: 'Delivered',
  Cancelled: 'Cancelled',
  CANCELLED: 'Cancelled',
  RETURNED: 'Cancelled',
  REJECTED: 'Cancelled',
};

// The server order row carries vendor ids only (no names), and no bundled store directory is
// consulted, so the card uses a neutral label rather than an invented store name.
function vendorNameFor(_storeIds: string[]): string {
  return 'Order';
}

/** Map one durable order row to the `PlacedOrder` view model. */
export function orderRowToPlaced(row: OrderRow): PlacedOrder {
  const items = row.lineItems.map((li) => ({
    id: li.productId ?? li.lineId,
    name: li.name,
    price: li.unitPrice,
    quantity: li.qty,
    emoji: li.emoji ?? '🛍️',
  }));
  const lineTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  // Prefer the server's charged total: it includes delivery/tax/coupon and matches the invoice.
  const total = row.totalChargedPaisa && row.totalChargedPaisa > 0 ? row.totalChargedPaisa / 100 : lineTotal;
  const fulfillment = row.fulfillment ?? 'DELIVERY';
  return {
    id: `server-${row.id}`,
    orderId: row.id,
    kind: 'items',
    status: STATUS_MAP[row.status] ?? 'Processing',
    fulfillment,
    vendorName: vendorNameFor(row.vendorStoreIds),
    pickup: row.pickup,
    pickups: row.pickups,
    items,
    storeIds: row.vendorStoreIds,
    total,
    placedAt: row.placedAt,
  };
}