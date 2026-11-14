import { describe, expect, it } from 'vitest';
import { bookGigSelection, checkoutError, gigSelection, voucherTotal } from '@/lib/partner/commerce-rules';
describe('Gig booking', () => {
  it('calculates two selected gigs as three hours and their payout range', () => { expect(gigSelection(['gig-0-19', 'gig-0-22'])).toEqual({ count: 2, hours: 3, min: 140, max: 210 }); });
  it('rejects unavailable gigs', () => { expect(bookGigSelection([], ['missing'])).toBeNull(); });
  it('deduplicates bookings', () => { expect(bookGigSelection(['gig-0-19'], ['gig-0-19', 'gig-0-22'])).toEqual(['gig-0-19', 'gig-0-22']); });
});
describe('Mock voucher wallet', () => {
  it('charges discounted prices, not face values', () => { expect(voucherTotal(['amazon', 'flipkart'])).toBe(720); });
  it('rejects purchases exceeding the wallet balance', () => { expect(checkoutError(['bata', 'amazon'], 1257.68)).toBeTruthy(); });
  it('accepts affordable valid purchases', () => { expect(checkoutError(['amazon', 'flipkart'], 1257.68)).toBeNull(); });
  it('rejects an empty cart', () => { expect(checkoutError([], 1257.68)).toBeTruthy(); });
  it('rejects unknown vouchers', () => { expect(checkoutError(['unknown'], 1257.68)).toBeTruthy(); });
});