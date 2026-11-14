export interface ShiftSlot { id: string; dayOffset: number; label: string; time: string; demand: 'High demand' | 'Available'; bonus: number }
export const shiftSlots: ShiftSlot[] = Array.from({ length: 7 }, (_, dayOffset) => [
  { id: `${dayOffset}-lunch`, dayOffset, label: 'Lunch', time: '12:00 PM – 3:00 PM', demand: 'Available' as const, bonus: 0 },
  { id: `${dayOffset}-dinner`, dayOffset, label: 'Dinner', time: '7:00 PM – 11:00 PM', demand: 'High demand' as const, bonus: 50 },
  { id: `${dayOffset}-night`, dayOffset, label: 'Late night', time: '11:00 PM – 1:00 AM', demand: 'Available' as const, bonus: 30 },
]).flat();
export const initialBookings = ['0-dinner'];
export interface Referral { id: string; name: string; phone: string; city: string; status: 'Invited' | 'Joined' | 'Reward earned' }
export const initialReferrals: Referral[] = [{ id: 'ref-1', name: 'Arun Kumar', phone: '9000000003', city: 'Karaikal', status: 'Joined' }, { id: 'ref-2', name: 'Farhan Ali', phone: '9000000004', city: 'Karaikal', status: 'Invited' }];
export const referralOffer = { amount: 2500, requiredTrips: 30, cities: ['Karaikal', 'Nagapattinam', 'Puducherry'], winners: ['Arun earned ₹2,500 in Karaikal', 'Priya earned ₹2,500 in Puducherry'] };
export const incentives = { guarantee: 225, requiredTrips: 5, requiredSlot: '0-dinner', maxRejections: 1, milestones: [{ trips: 3, reward: 50 }, { trips: 5, reward: 90 }, { trips: 8, reward: 120 }, { trips: 12, reward: 220 }] };
export const partnerDetails = { id: 'ZIP-27774360', joined: '12 September 2025', tier: 'Hero', insurance: 'Demo accident cover', cover: '₹2,00,000', emergencyNumber: '112' };
export interface InboxMessage { id: string; title: string; body: string; time: string }
export const inboxMessages: InboxMessage[] = [
  { id: 'in-1', title: 'Dinner slots are open', body: 'Book your dinner slot in My Shifts. High-demand slots include a demo ₹50 opportunity.', time: 'Today' },
  { id: 'in-2', title: 'Your weekly statement', body: 'Your earnings statement is available under Earnings. Cash collected is not additional income.', time: 'Today' },
  { id: 'in-3', title: 'Ride safe, arrive safe', body: 'Always wear a helmet, follow traffic rules and stop safely before using your phone.', time: 'Yesterday' },
];
export const serviceContent = {
  club: { title: 'Partner Club', subtitle: 'Your effort. Your rewards.', rows: ['Hero tier • 5.0 partner rating', 'Priority support', 'Monthly recognition'], note: 'Benefits shown are illustrative; no membership purchase or real benefit is activated.' },
  insurance: { title: 'Insurance', subtitle: 'A little more peace of mind.', rows: ['Demo accident cover • ₹2,00,000', 'Status • Illustrative policy', 'Emergency services • 112'], note: 'This mock policy does not provide real insurance coverage.' },
  store: { title: 'Partner Store', subtitle: 'Ready for every ride.', rows: ['Delivery bag • ₹799', 'Reflective jacket • ₹499', 'Rain cover • ₹299'], note: 'Products are illustrative. No payment or purchase is made.' },
};
export const homeStories = [{ title: 'More orders. More possibilities.', body: 'Dinner demand is rising in Karaikal. Check your shifts and plan your next ride.' }, { title: 'Your next milestone awaits.', body: 'Keep an eye on today’s trip goals and your eligible incentive milestones.' }];
