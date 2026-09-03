/**
 * @mock Simulates a Go + CockroachDB relational checkout microservice. Consolidates
 * account/orders, cart/addresses, account/addresses, cart/coupons into Users /
 * Orders / LineItems / Addresses / Coupons tables. See data/DATA_CONTROL.md.
 */
import type { Coupon, Address, SavedAddress } from '../types';
import { defaultAddresses } from '../cart/addresses';
import { savedAddresses } from '../account/addresses';
import { coupons as legacyCoupons } from '../cart/coupons';
import { myOrders, pastOrders } from '../account/orders';

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
        name: o.productName,
        variant: o.variant,
        qty: o.qty,
        unitPrice: o.price,
        emoji: o.emoji,
      },
    ],
  };
}

function fromPastOrder(o: (typeof pastOrders)[number], idx: number): OrderRow {
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
  };
}

export const ordersTable: OrderRow[] = [
  ...myOrders.map(fromMyOrder),
  ...pastOrders.map(fromPastOrder),
];

export function getOrdersByUser(userId: string): OrderRow[] {
  return ordersTable.filter((o) => o.userId === userId);
}
