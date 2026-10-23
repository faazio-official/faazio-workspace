import type { CartItem } from '@/state/cartStore';
import type { FulfillmentMode } from '@data/types';

export interface AppLabel {
  name: string;
  bgColor: string;
  textColor: string;
  border: string;
  icon: string;
}

export interface CartGroup {
  label: AppLabel;
  items: CartItem[];
}

export interface CartTotals {
  subtotal: number;
  /** Customer-visible delivery fee in whole rupees (0 for self-pickup). */
  deliveryFee: number;
  /**
   * Always 0 in the customer view: catalog prices are GST-inclusive, so the
   * product GST is inside `subtotal` and never added as a separate line.
   */
  tax: number;
  discountAmount: number;
  finalTotal: number;
}

export interface AppliedDiscount {
  code: string;
  amount: number;
}

export type CheckoutStep = 'BAG' | 'FULFILLMENT' | 'PAYMENT' | 'RECEIPT';

/**
 * Dynamic delivery fee rate card. The server is the road-distance authority
 * (GET /checkout/delivery-fee); these constants power the honest client-side
 * estimate when the gateway is unreachable.
 */
export const DELIVERY_FEE_BASE_KM = 3;
export const DELIVERY_FEE_BASE_PAISA = 3500;
export const DELIVERY_FEE_PER_EXTRA_KM_PAISA = 900;

/** Base delivery fee (whole rupees) when no distance is known yet. */
export const DEFAULT_DELIVERY_FEE_PAISA = DELIVERY_FEE_BASE_PAISA;

/**
 * Server-authoritative formula (mirrors tax.delivery_fee_settings): ≤3 km → ₹35;
 * beyond that ₹9 per extra full km. Paisa whole-number math.
 */
export function computeDeliveryFeePaisa(distanceKm: number): number {
  const base = Math.max(0, DELIVERY_FEE_BASE_KM);
  const extraKm = Math.floor(Math.max(0, distanceKm || 0) - base);
  if (extraKm <= 0) return DELIVERY_FEE_BASE_PAISA;
  return DELIVERY_FEE_BASE_PAISA + extraKm * DELIVERY_FEE_PER_EXTRA_KM_PAISA;
}

/** Dynamic delivery fee in whole rupees for a straight-line distance. */
export function computeDeliveryFee(distanceKm: number): number {
  return computeDeliveryFeePaisa(distanceKm) / 100;
}

export const getAppLabel = (itemId: string): AppLabel => {
  const id = itemId.toLowerCase();
  if (id.startsWith('ph-') || id.includes('pharma') || id.includes('med')) {
    return { name: 'Pharma', bgColor: '#fff1f2', textColor: '#f43f5e', border: '#ffe4e6', icon: '\u{1F48A}' };
  }
  if (id.startsWith('fm-') || id.startsWith('gr-') || id.includes('mart') || id.includes('grocery') || id.startsWith('cat-mt') || id.startsWith('cat-mf') || id.startsWith('cat-gr') || id.startsWith('cat-fb')) {
    return { name: 'Mart', bgColor: '#eef2ff', textColor: '#4f46e5', border: '#e0e7ff', icon: '\u{1F6CD}' };
  }
  return { name: 'Food', bgColor: '#fffbeb', textColor: '#d97706', border: '#fef3c7', icon: '\u{1F354}' };
};

export function groupCartItems(items: CartItem[]): CartGroup[] {
  const grouped: Record<string, CartGroup> = {};
  for (const item of items) {
    const label = getAppLabel(item.id);
    if (!grouped[label.name]) {
      grouped[label.name] = { label, items: [] };
    }
    grouped[label.name].items.push(item);
  }
  return Object.values(grouped);
}

/**
 * Customer price summary. GST is already inside the GST-inclusive prices, so the
 * customer total is exactly `subtotal + deliveryFee − discount` — the server is the
 * money authority at settlement and the 2-row breakdown mirrors its invoice total.
 *
 * `deliveryFeeOverridePaisa` (server quote or client distance estimate) replaces the
 * default base fee; PICKUP always waives delivery.
 */
export function computeTotals(
  items: CartItem[],
  discountAmount: number,
  mode: FulfillmentMode = 'DELIVERY',
  deliveryFeeOverridePaisa?: number,
): CartTotals {
  const subtotal = items.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
  const deliveryFeePaisa =
    mode === 'PICKUP' ? 0 : deliveryFeeOverridePaisa ?? DEFAULT_DELIVERY_FEE_PAISA;
  const deliveryFee = deliveryFeePaisa / 100;
  const finalTotal = Math.max(0, subtotal + deliveryFee - discountAmount);
  return { subtotal, deliveryFee, tax: 0, discountAmount, finalTotal };
}