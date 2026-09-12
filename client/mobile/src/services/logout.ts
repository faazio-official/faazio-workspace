import { useAuthStore } from '@/state/authStore';
import { useCartStore } from '@/state/cartStore';
import { useFavoriteStore } from '@/state/favoriteStore';
import { useSearchStore } from '@/state/searchStore';
import { usePharmaStore } from '@/state/pharmaStore';
import { useBloodDonorStore } from '@/state/bloodDonorStore';
import { useBookingStore } from '@/state/bookingStore';
import { useFoodBookingStore } from '@/state/foodBookingStore';
import { useRewardsStore } from '@/state/rewardsStore';

/**
 * Clears every piece of per-user local state on explicit logout.
 * Global app config (language) is intentionally preserved.
 */
export async function logoutUser(): Promise<void> {
  useCartStore.getState().clearCart();
  useFavoriteStore.setState({ favorites: [] });
  useSearchStore.getState().clearRecentSearches();
  usePharmaStore.setState({ prescriptions: [] });
  useBloodDonorStore.getState().reset();
  useBookingStore.setState({ bookings: [] });
  useFoodBookingStore.setState({ bookings: [] });
  useRewardsStore.getState().reset();

  await useAuthStore.getState().logout();
}
