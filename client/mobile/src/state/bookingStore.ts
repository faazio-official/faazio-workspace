import { create } from 'zustand';

export interface Booking {
  id: string;
  restaurantId: string;
  restaurantName: string;
  date: string;
  time: string;
  guests: number;
  status: 'pending' | 'confirmed' | 'cancelled';
}

interface BookingState {
  bookings: Booking[];
  addBooking: (booking: Omit<Booking, 'id' | 'status'>) => void;
  cancelBooking: (bookingId: string) => void;
}

export const useBookingStore = create<BookingState>()((set) => ({
  bookings: [],
  addBooking: (booking) => set((state) => ({
    bookings: [
      ...state.bookings,
      {
        ...booking,
        id: Math.random().toString(36).substring(2, 9),
        status: 'confirmed' as const,
      },
    ],
  })),
  cancelBooking: (bookingId) => set((state) => ({
    bookings: state.bookings.map((b) =>
      b.id === bookingId ? { ...b, status: 'cancelled' as const } : b
    ),
  })),
}));
