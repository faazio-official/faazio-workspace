import { gigSlots, vouchers } from '@/mocks';
export function gigSelection(ids: string[]) {
  const slots = gigSlots.filter(slot => ids.includes(slot.id));
  return { count: slots.length, hours: slots.reduce((sum, slot) => sum + slot.end - slot.start, 0), min: slots.reduce((sum, slot) => sum + slot.payoutMin, 0), max: slots.reduce((sum, slot) => sum + slot.payoutMax, 0) };
}
export function bookGigSelection(bookings: string[], ids: string[]): string[] | null {
  if (!ids.length || ids.some(id => !gigSlots.some(slot => slot.id === id))) return null;
  return [...new Set([...bookings, ...ids])];
}
export function voucherTotal(cart: string[]) { return cart.reduce((sum, id) => sum + (vouchers.find(voucher => voucher.id === id)?.price ?? 0), 0); }
export function checkoutError(cart: string[], balance: number): string | null {
  if (!cart.length) return 'Your cart is empty.';
  if (cart.some(id => !vouchers.some(voucher => voucher.id === id))) return 'A voucher is unavailable.';
  if (voucherTotal(cart) > balance) return 'Not enough wallet balance. Remove a voucher to continue.';
  return null;
}