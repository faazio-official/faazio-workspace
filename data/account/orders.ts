/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 */
import type { MyOrder, MyOrdersTabItem, PastOrder } from '../types';

export const pastOrders: PastOrder[] = [
  { id: 'ORD-001', item: 'Truffle Mushroom Burger', store: 'Hungry Minds Cafe', price: 320, date: '12 Jul 2026', status: 'Delivered', app: 'FOOD' },
  { id: 'ORD-002', item: 'AC Jet Cleaning Service', store: 'HomeServ Pro', price: 2499, date: '08 Jul 2026', status: 'Completed', app: 'MART' },
];

/** Status tabs for the My Orders screen. Counts mirror `orderStatusCounts`. */
export const myOrdersTabs: MyOrdersTabItem[] = [
  { name: 'All Orders', count: 24 },
  { name: 'Processing', count: 3 },
  { name: 'Shipped', count: 2 },
  { name: 'Delivered', count: 18 },
  { name: 'Cancelled', count: 1 },
];

export const myOrders: MyOrder[] = [
  {
    id: '1',
    orderNumber: '#ORD123456789',
    orderDateTime: '06 May 2025 • 11:30 AM',
    productName: 'Coca-Cola Diet Coke Can',
    variant: '300 ml • Pack of 4',
    qty: 1,
    price: 155,
    status: 'Delivered',
    statusDate: '08 May 2025',
    emoji: '🥤',
  },
  {
    id: '2',
    orderNumber: '#ORD123456788',
    orderDateTime: '06 May 2025 • 10:15 AM',
    productName: 'Cornitos Cheese and Herbs Nacho Crisps',
    variant: '55 gm',
    qty: 2,
    price: 68,
    status: 'Delivered',
    statusDate: '07 May 2025',
    emoji: '🍟',
  },
  {
    id: '3',
    orderNumber: '#ORD123456787',
    orderDateTime: '05 May 2025 • 09:45 PM',
    productName: 'Imported Daily Apple (Sebu)',
    variant: '2 pieces',
    qty: 1,
    price: 91,
    status: 'Delivered',
    statusDate: '06 May 2025',
    emoji: '🍎',
  },
  {
    id: '4',
    orderNumber: '#ORD123456786',
    orderDateTime: '05 May 2025 • 08:40 PM',
    productName: 'Sunpure Refined Sunflower Oil',
    variant: '1 L',
    qty: 1,
    price: 149,
    status: 'Shipped',
    statusDate: '06 May 2025',
    emoji: '🛢️',
  },
  {
    id: '5',
    orderNumber: '#ORD123456785',
    orderDateTime: '05 May 2025 • 07:20 PM',
    productName: 'Dettol Original Soap',
    variant: '125 gm • Pack of 4',
    qty: 1,
    price: 89,
    status: 'Processing',
    statusDate: 'Estimated delivery by\n09 May 2025',
    emoji: '🧼',
  },
];
