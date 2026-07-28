import { create } from 'zustand';

// Authentication State
interface AuthState {
  isAuthenticated: boolean;
  user: { id: string; name: string; email: string } | null;
  login: (userData: { id: string; name: string; email: string }) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  isAuthenticated: false,
  user: null,
  login: (userData) => set({ isAuthenticated: true, user: userData }),
  logout: () => set({ isAuthenticated: false, user: null }),
}));

// E-Commerce Cart State
interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

interface CartState {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
}

export const useCartStore = create<CartState>()((set, get) => ({
  cart: [],
  addToCart: (item) => set((state) => {
    const existing = state.cart.find((i) => i.id === item.id);
    if (existing) {
      return {
        cart: state.cart.map((i) => i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i)
      };
    }
    return { cart: [...state.cart, item] };
  }),
  removeFromCart: (itemId) => set((state) => ({
    cart: state.cart.filter((i) => i.id !== itemId)
  })),
  updateQuantity: (itemId, quantity) => set((state) => ({
    cart: state.cart.map((i) => i.id === itemId ? { ...i, quantity } : i)
  })),
  clearCart: () => set({ cart: [] }),
  getCartTotal: () => {
    return get().cart.reduce((total, item) => total + item.price * item.quantity, 0);
  }
}));

// Dinner Booking State
interface Booking {
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
        status: 'confirmed'
      }
    ]
  })),
  cancelBooking: (bookingId) => set((state) => ({
    bookings: state.bookings.map((b) => b.id === bookingId ? { ...b, status: 'cancelled' } : b)
  }))
}));

// Pharma Ordering State
interface Prescription {
  id: string;
  uri: string;
  fileName: string;
  uploadDate: string;
}

interface PharmaState {
  prescriptions: Prescription[];
  uploadPrescription: (uri: string, fileName: string) => void;
  removePrescription: (id: string) => void;
}

export const usePharmaStore = create<PharmaState>()((set) => ({
  prescriptions: [],
  uploadPrescription: (uri, fileName) => set((state) => ({
    prescriptions: [
      ...state.prescriptions,
      {
        id: Math.random().toString(36).substring(2, 9),
        uri,
        fileName,
        uploadDate: new Date().toISOString()
      }
    ]
  })),
  removePrescription: (id) => set((state) => ({
    prescriptions: state.prescriptions.filter((p) => p.id !== id)
  }))
}));
