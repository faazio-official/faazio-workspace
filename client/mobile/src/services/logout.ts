import { useAuthStore } from '@/state/authStore';
import { useCartStore } from '@/state/cartStore';
import { useFavoriteStore } from '@/state/favoriteStore';
import { useSearchStore } from '@/state/searchStore';
import { usePharmaStore } from '@/state/pharmaStore';
import { useBookingStore } from '@/state/bookingStore';
import { useFoodBookingStore } from '@/state/foodBookingStore';

/**
 * Clears every piece of per-user local state on explicit logout.
 * Global app config (language) is intentionally preserved.
 */
export async function logoutUser(): Promise<void> {
  useCartStore.getState().clearCart();
  useFavoriteStore.setState({ favorites: [] });
  useSearchStore.getState().clearRecentSearches();
  usePharmaStore.setState({ prescriptions: [] });
  useBookingStore.setState({ bookings: [] });
  useFoodBookingStore.setState({ bookings: [] });

  await useAuthStore.getState().logout();
}
