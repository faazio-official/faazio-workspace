/**
 * @mock Simulates a Go + CockroachDB relational checkout microservice. Consolidates
 * account/orders, cart/addresses, account/addresses, cart/coupons into Users /
 * Orders / LineItems / Addresses / Coupons tables. See data/DATA_CONTROL.md.
 */
import type { Coupon, Address, SavedAddress, FulfillmentMode } from '../types';
import { defaultAddresses } from '../cart/addresses';
import { savedAddresses } from '../account/addresses';
import { coupons as legacyCoupons } from '../cart/coupons';
import { myOrders, pastOrders } from '../account/orders';
import { resolveVendorIdByName } from '../directory/vendors';

export interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  defaultAddressId?: string;
}

export const usersTable: UserRow[] = [
  { id: 'user-1', name: 'Rohit Sharma', email: 'rohit.sharma@gmail.com', phone: '+91 98765 43210', defaultAddressId: 'addr_1' },
];

/** The mock fixture tables are single-user: all seeded orders belong to this id. */
export const MOCK_USER_ID = usersTable[0]?.id ?? 'user-1';

export interface AddressRow {
  id: string;
  userId: string;
  label: string;
  tag?: string;
  name?: string;
  phone?: string;
  address: string;
  isDefault?: boolean;
}

function fromCartAddress(a: Address, userId: string): AddressRow {
  return { id: a.id, userId, label: a.label, address: a.address, isDefault: a.isDefault };
}

function fromSavedAddress(a: SavedAddress, userId: string): AddressRow {
  return {
    id: a.id,
    userId,
    label: a.tag,
    tag: a.tag,
    name: a.name,
    phone: a.phone,
    address: a.address,
    isDefault: a.isDefault,
  };
}

export const addressesTable: AddressRow[] = [
  ...defaultAddresses.map((a) => fromCartAddress(a, 'user-1')),
  ...savedAddresses.map((a) => fromSavedAddress(a, 'user-1')),
];

export interface CouponRow {
  code: string;
  discountPercent: number;
  label: string;
  minOrder?: number;
  isFreeDelivery?: boolean;
}

export const couponsTable: CouponRow[] = legacyCoupons.map((c: Coupon) => ({
  code: c.code,
  discountPercent: c.discountPercent,
  label: c.label,
  minOrder: c.minOrder,
  isFreeDelivery: c.isFreeDelivery,
}));

export interface OrderLineItem {
  lineId: string;
  productId?: string;
  name: string;
  variant?: string;
  qty: number;
  unitPrice: number;
  emoji?: string;
}

export interface OrderRow {
  id: string;
  orderNumber: string;
  userId: string;
  addressId: string;
  placedAt: string;
  status: string;
  statusDate?: string;
  lineItems: OrderLineItem[];
  /** Fulfillment mode. Absent = delivery. Mirrors `MyOrder.fulfillment`. */
  fulfillment?: FulfillmentMode;
  /**
   * Vendor identity snapshot — the distinct vendor ids this order resolves to,
   * captured once at placement via `resolveVendorForProduct`. Drives the derived
   * rating-eligibility gate. See `docs/architecture/db-schema.md` §7.7.
   */
  vendorStoreIds: string[];
  /**
   * Self-pickup snapshot persisted at placement (single + per-vendor). Present
   * only when `fulfillment` is `PICKUP`; mirrors the server `checkout.orders`
   * pickup/pickups JSONB. Absent on delivery orders.
   */
  pickup?: { name: string; address: string; hours?: string; phone?: string };
  pickups?: { name: string; address: string; hours?: string; phone?: string }[];
  /**
   * Server-derived money snapshot (paisa) from `checkout.orders`/`tax.tax_invoices`. Present on
   * durable gateway orders; absent on the local fixture rows. The list must show the amount the
   * customer actually paid (delivery fee, coupon, tax), not the line-item subtotal.
   */
  totalChargedPaisa?: number;
  deliveryFeePaisa?: number;
  taxableValuePaisa?: number;
  productTaxPaisa?: number;
  platformFeePaisa?: number;
  platformGstPaisa?: number;
  tcsPaisa?: number;
  tdsPaisa?: number;
}

function fromMyOrder(o: (typeof myOrders)[number], idx: number): OrderRow {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    userId: 'user-1',
    addressId: 'addr_1',
    placedAt: o.orderDateTime,
    status: o.status,
    statusDate: o.statusDate,
    lineItems: [
      {
        lineId: `${o.id}-l1`,
        productId: o.productId,
        name: o.productName,
        variant: o.variant,
        qty: o.qty,
        unitPrice: o.price,
        emoji: o.emoji,
      },
    ],
    fulfillment: o.fulfillment,
    vendorStoreIds: o.storeId ? [o.storeId] : [],
  };
}

function fromPastOrder(o: (typeof pastOrders)[number], idx: number): OrderRow {
  const vendorStoreId = o.storeId ?? resolveVendorIdByName(o.store);
  return {
    id: `past-${idx}`,
    orderNumber: o.id,
    userId: 'user-1',
    addressId: 'addr_1',
    placedAt: o.date,
    status: o.status,
    lineItems: [
      {
        lineId: `past-${idx}-l1`,
        name: o.item,
        qty: 1,
        unitPrice: o.price,
      },
    ],
    vendorStoreIds: vendorStoreId ? [vendorStoreId] : [],
  };
}

export const ordersTable: OrderRow[] = [
  ...myOrders.map(fromMyOrder),
  ...pastOrders.map(fromPastOrder),
];

export function getOrdersByUser(userId: string): OrderRow[] {
  return ordersTable.filter((o) => o.userId === userId);
}

/** Phase-1 gate keeps any **non-cancelled** order (server later tightens to DELIVERED). */
function isRatableStatus(status: string): boolean {
  return status !== 'Cancelled';
}

/**
 * The rating-eligibility gate, derived — never a stored flag: true iff `userId`
 * has an order that resolves to `vendorId` and was not cancelled. Permanently
 * true for that (user, vendor) pair once it exists ("old customer keeps the
 * ability").
 */
export function hasPurchasedFromVendor(userId: string, vendorId: string): boolean {
  return ordersTable.some(
    (order) =>
      order.userId === userId &&
      isRatableStatus(order.status) &&
      order.vendorStoreIds.includes(vendorId),
  );
}

/** Order ids proving a (user, vendor) purchase — verified-purchase provenance. */
export function getVendorOrderIds(userId: string, vendorId: string): string[] {
  return ordersTable
    .filter(
      (order) =>
        order.userId === userId &&
        isRatableStatus(order.status) &&
        order.vendorStoreIds.includes(vendorId),
    )
    .map((order) => order.id);
}
