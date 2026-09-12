/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 */
import type { MyOrder, MyOrdersStatusFilterItem, PastOrder } from '../types';

export const pastOrders: PastOrder[] = [
  { id: 'ORD-001', item: 'Truffle Mushroom Burger', store: 'Hungry Minds Cafe', price: 320, date: '12 Jul 2026', status: 'Delivered', app: 'FOOD' },
  { id: 'ORD-002', item: 'AC Jet Cleaning Service', store: 'HomeServ Pro', price: 2499, date: '08 Jul 2026', status: 'Completed', app: 'MART' },
];

/** Status filters for the My Orders screen (labels only — counts derived at runtime). */
export const myOrdersStatusFilters: MyOrdersStatusFilterItem[] = [
  { name: 'All Orders' },
  { name: 'Processing' },
  { name: 'Shipped' },
  { name: 'Delivered' },
  { name: 'Cancelled' },
];

export const myOrders: MyOrder[] = [
  {
    id: '1',
    orderNumber: '#ORD123456789',
    orderDateTime: '06 May 2025 • 11:30 AM',
    productId: 'gr-p7',
    productName: 'Arabica Coffee Beans Medium',
    variant: '250g',
    qty: 1,
    price: 450,
    status: 'Delivered',
    statusDate: '08 May 2025',
    emoji: '☕',
    app: 'MART',
  },
  {
    id: '2',
    orderNumber: '#ORD123456788',
    orderDateTime: '06 May 2025 • 10:15 AM',
    productId: 'fm-b1',
    productName: 'Organic Hydrating Serum',
    variant: '30 ml',
    qty: 1,
    price: 799,
    status: 'Delivered',
    statusDate: '07 May 2025',
    emoji: '🧴',
    app: 'MART',
  },
  {
    id: '3',
    orderNumber: '#ORD123456787',
    orderDateTime: '05 May 2025 • 09:45 PM',
    productId: 'gr-p1',
    productName: 'Organic Royal Gala Apples',
    variant: '1 kg',
    qty: 2,
    price: 249,
    status: 'Delivered',
    statusDate: '06 May 2025',
    emoji: '🍎',
    app: 'MART',
  },
  {
    id: '4',
    orderNumber: '#ORD123456786',
    orderDateTime: '05 May 2025 • 08:40 PM',
    productId: 'fm-ha2',
    productName: 'Digital Touch Air Fryer 5L',
    variant: '5 L',
    qty: 1,
    price: 5499,
    status: 'Shipped',
    statusDate: '06 May 2025',
    emoji: '🍟',
    app: 'MART',
    fulfillment: 'PICKUP',
  },
  {
    id: '5',
    orderNumber: '#ORD123456785',
    orderDateTime: '05 May 2025 • 07:20 PM',
    productId: 'ph-a1',
    productName: 'Antiseptic Cream 30g',
    variant: '30g',
    qty: 2,
    price: 120,
    status: 'Processing',
    statusDate: 'Estimated delivery by\n09 May 2025',
    emoji: '🧴',
    app: 'PHARMA',
  },
  {
    id: '6',
    orderNumber: '#ORD123456784',
    orderDateTime: '04 May 2025 • 08:05 PM',
    productId: 'sp-11',
    productName: 'Smash Bacon Burger',
    variant: 'Single',
    qty: 1,
    price: 290,
    status: 'Delivered',
    statusDate: '06 May 2025',
    emoji: '🍔',
    app: 'FOOD',
    fulfillment: 'PICKUP',
  },
  {
    id: '7',
    orderNumber: '#ORD123456783',
    orderDateTime: '03 May 2025 • 06:50 PM',
    productId: 'ph-pain2',
    productName: 'Cooling Pain Relief Balm',
    variant: '30g',
    qty: 1,
    price: 135,
    status: 'Cancelled',
    statusDate: '04 May 2025',
    emoji: '🧴',
    app: 'PHARMA',
  },
];

/** Look up a single My Order by id. Returns undefined if not found. */
export function getMyOrderById(id: string): MyOrder | undefined {
  return myOrders.find((o) => o.id === id);
}
