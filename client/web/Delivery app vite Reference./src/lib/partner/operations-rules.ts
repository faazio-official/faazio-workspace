import { shiftSlots, gigSlots, type Referral } from '@/mocks';
export function toggleBooking(bookings: string[], id: string) {
  if (![...shiftSlots, ...gigSlots].some(slot => slot.id === id)) return bookings;
  return bookings.includes(id) ? bookings.filter(value => value !== id) : [...bookings, id];
}
export function referralError(referrals: Referral[], name: string, phone: string, city: string, cities: string[]): string | null {
  if (name.trim().length < 2) return 'Enter the partner’s full name.';
  if (!/^[6-9]\d{9}$/.test(phone)) return 'Enter a valid 10-digit Indian mobile number.';
  if (!cities.includes(city)) return 'Choose an available city.';
  if (referrals.some(referral => referral.phone === phone)) return 'This phone number has already been invited.';
  return null;
}
