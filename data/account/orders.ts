/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 */
import type { PastOrder } from '../types';

export const pastOrders: PastOrder[] = [
  { id: 'ORD-001', item: 'Truffle Mushroom Burger', store: 'Hungry Minds Cafe', price: 320, date: '12 Jul 2026', status: 'Delivered', app: 'FOOD' },
  { id: 'ORD-002', item: 'AC Jet Cleaning Service', store: 'HomeServ Pro', price: 2499, date: '08 Jul 2026', status: 'Completed', app: 'MART' },
];
