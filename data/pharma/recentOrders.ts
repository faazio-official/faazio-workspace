/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 */

/** A pharma "recent order" card shown on the Pharma home History tab. */
export interface PharmaRecentOrder {
  id: string;
  name: string;
  emoji: string;
  qty: string;
  orderId: string;
  date: string;
  amount: number;
  status: 'Delivered' | 'Shipped';
  /** Real `@data` pharma product id this order maps to (drill-in). */
  productId?: string;
}

/** Recent pharmacy orders, mapped to real pharma product ids where they exist. */
export const PHARMA_RECENT_ORDERS: PharmaRecentOrder[] = [
  { id: 'ro-1', name: 'Paracetamol 650', emoji: '💊', qty: '1 strip', orderId: 'ORD-93821', date: '12 Aug 2026', amount: 90, status: 'Delivered', productId: 'ph-f1' },
  { id: 'ro-2', name: 'Vitamin D3 2000 IU', emoji: '💊', qty: '1 bottle', orderId: 'ORD-93754', date: '04 Aug 2026', amount: 450, status: 'Delivered', productId: 'ph-t3' },
  { id: 'ro-3', name: 'Cetirizine 10mg', emoji: '💊', qty: '2 strips', orderId: 'ORD-93610', date: '28 Jul 2026', amount: 76, status: 'Delivered', productId: 'ph-f1' },
  { id: 'ro-4', name: 'ORS Sachets', emoji: '🧪', qty: '1 pack', orderId: 'ORD-93482', date: '19 Jul 2026', amount: 75, status: 'Shipped', productId: 'ph-d1' },
];
