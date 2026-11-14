export interface GigSlot { id: string; dayOffset: number; group: string; start: number; end: number; payoutMin: number; payoutMax: number; popular: boolean }
export const gigGroups = ['Breakfast Gigs', 'Lunch Gigs', 'Evening Gigs', 'Dinner Gigs'];
export const gigSlots: GigSlot[] = Array.from({ length: 7 }, (_, dayOffset) => [
  [8, 9, 0, 45, 65], [9, 11, 0, 80, 110], [11, 12, 1, 50, 75], [12, 14, 1, 100, 150],
  [17, 19, 2, 90, 130], [19, 21, 3, 95, 140], [21, 22, 3, 55, 80], [22, 23, 3, 45, 70],
].map(([start = 8, end = 9, group = 0, payoutMin = 45, payoutMax = 65]) => ({ id: `gig-${dayOffset}-${start}`, dayOffset, group: gigGroups[group] ?? 'Dinner Gigs', start, end, payoutMin, payoutMax, popular: start === 17 || start === 19 }))).flat();
export const initialGigBookings = ['gig-0-19'];
export const activeGig = { id: 'gig-0-19', label: '7:00pm – 9:00pm', initialLoginMinutes: 92, requiredLoginMinutes: 105, nextId: 'gig-0-22', nextLabel: '10pm – 11pm' };
export const feedSnapshot = { earnings: 408.12, trips: 9, orderMinutes: 82, gigs: 7, perfectOrders: 122, lockedReward: 70, payout: 6964.14 };
export const periodOffer = { title: 'TUESDAY Offer', maximum: 400, period: '27 Oct – 3 Nov', loginWindows: ['12pm – 3pm · 2 hrs', '6pm – 10pm · 3 hrs'], tiers: [{ reward: 70, gigs: 5, orders: 7 }, { reward: 150, gigs: 6, orders: 12 }, { reward: 200, gigs: 7, orders: 15 }, { reward: 300, gigs: 8, orders: 18 }, { reward: 400, gigs: 9, orders: 22 }] };
export const performance = { day: [{ label: 'Perfect orders', value: '9', score: 'Excellent' }, { label: 'Bad orders', value: '1', score: 'Improve' }, { label: 'Customer denials', value: '0', score: 'Excellent' }, { label: 'Delays', value: '0', score: 'Excellent' }], week: [{ label: 'Perfect orders', value: '52', score: 'Excellent' }, { label: 'Bad orders', value: '2', score: 'Improve' }, { label: 'Customer denials', value: '0', score: 'Excellent' }, { label: 'Delays', value: '1', score: 'Good' }] };
export const gigTime = (hour: number) => `${hour % 12 || 12}:00${hour < 12 ? 'am' : 'pm'}`;