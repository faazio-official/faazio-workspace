interface BookingRecord {
  orderId: string;
  dish: { id: string; name: string; price: string; emoji: string };
  guests: number;
  date: string;
  time: string;
  addedRecommendedIds: string[];
  timestamp: number;
}

let bookings: BookingRecord[] = [];

export function addBooking(record: Omit<BookingRecord, 'orderId' | 'timestamp'>): string {
  const orderId = `BKG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  bookings.push({ ...record, orderId, timestamp: Date.now() });
  return orderId;
}

export function getBookings(): BookingRecord[] {
  return [...bookings];
}
