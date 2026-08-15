/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 */
import type { OrderStatusCount } from '../types';

export const orderStatusCounts: OrderStatusCount[] = [
  { key: 'all', label: 'All Orders', count: 24 },
  { key: 'processing', label: 'Processing', count: 3 },
  { key: 'shipped', label: 'Shipped', count: 2 },
  { key: 'delivered', label: 'Delivered', count: 18 },
  { key: 'cancelled', label: 'Cancelled', count: 1 },
];
