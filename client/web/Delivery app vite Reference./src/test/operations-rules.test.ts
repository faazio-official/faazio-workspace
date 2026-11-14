import { describe, expect, it } from 'vitest';
import { toggleBooking, referralError } from '@/lib/partner/operations-rules';
import { initialReferrals, referralOffer, incentives } from '@/mocks';
describe('Partner operations', () => {
  it('books an available shift and cancels the same booking', () => { expect(toggleBooking([], '0-dinner')).toEqual(['0-dinner']); expect(toggleBooking(['0-dinner'], '0-dinner')).toEqual([]); });
  it('rejects unavailable shift IDs', () => { expect(toggleBooking([], 'missing')).toEqual([]); });
  it('rejects a duplicate referral phone', () => { expect(referralError(initialReferrals, 'Arun', '9000000003', 'Karaikal', referralOffer.cities)).not.toBeNull(); });
  it('validates ten-digit Indian mobile numbers', () => { expect(referralError([], 'Arun', '123', 'Karaikal', referralOffer.cities)).not.toBeNull(); expect(referralError([], 'Arun', '9876543210', 'Karaikal', referralOffer.cities)).toBeNull(); });
  it('rejects unavailable referral cities', () => { expect(referralError([], 'Arun', '9876543210', 'Unknown', referralOffer.cities)).not.toBeNull(); });
  it('keeps illustrative guarantee and milestone values separated', () => { expect(incentives.guarantee).toBe(225); expect(incentives.milestones.map(value => value.reward)).toEqual([50, 90, 120, 220]); });
});
