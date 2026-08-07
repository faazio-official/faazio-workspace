import { create } from 'zustand';

export interface FoodBookingRecord {
  orderId: string;
  dish: { id: string; name: string; price: string; emoji: string };
  guests: number;
  date: string;
  time: string;
  addedRecommendedIds: string[];
  timestamp: number;
}

interface FoodBookingState {
  bookings: FoodBookingRecord[];
  addBooking: (record: Omit<FoodBookingRecord, 'orderId' | 'timestamp'>) => string;
  getBookings: () => FoodBookingRecord[];
}

export const useFoodBookingStore = create<FoodBookingState>()((set, get) => ({
  bookings: [],
  addBooking: (record) => {
    const orderId = `BKG-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;
    set((state) => ({
      bookings: [...state.bookings, { ...record, orderId, timestamp: Date.now() }],
    }));
    return orderId;
  },
  getBookings: () => [...get().bookings],
}));
