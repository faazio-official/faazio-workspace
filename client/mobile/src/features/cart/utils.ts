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
  deliveryFee: number;
  tax: number;
  discountAmount: number;
  finalTotal: number;
}

export interface AppliedDiscount {
  code: string;
  amount: number;
}

export type CheckoutStep = 'BAG' | 'PAYMENT' | 'RECEIPT';

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

export function computeTotals(
  items: CartItem[],
  discountAmount: number,
  mode: FulfillmentMode = 'DELIVERY',
): CartTotals {
  const subtotal = items.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
  const deliveryFee = mode === 'PICKUP' ? 0 : subtotal > 499 ? 0 : 49;
  const tax = Math.round(subtotal * 0.05);
  const finalTotal = Math.max(0, subtotal + deliveryFee + tax - discountAmount);
  return { subtotal, deliveryFee, tax, discountAmount, finalTotal };
}
