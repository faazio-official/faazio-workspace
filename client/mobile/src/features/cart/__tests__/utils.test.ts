import { computeTotals } from '../utils';
import type { CartItem } from '@/state/cartStore';

function item(overrides: Partial<CartItem> = {}): CartItem {
  return { id: 'd1', name: 'Dish', price: 100, quantity: 1, emoji: 'dining', ...overrides };
}

describe('computeTotals with add-ons', () => {
  it('adds the per-unit add-on price to the subtotal', () => {
    const totals = computeTotals([item({ quantity: 2, addonPrice: 20 })], 0, 'PICKUP');
    expect(totals.subtotal).toBe(240);
    expect(totals.finalTotal).toBe(240);
  });

  it('applies a discount after including add-ons', () => {
    const totals = computeTotals([item({ quantity: 2, addonPrice: 20 })], 40, 'PICKUP');
    expect(totals.subtotal).toBe(240);
    expect(totals.finalTotal).toBe(200);
  });

  it('keeps plain lines unchanged', () => {
    const totals = computeTotals([item({ quantity: 3 })], 0, 'PICKUP');
    expect(totals.subtotal).toBe(300);
  });
});
