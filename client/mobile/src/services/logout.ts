import { useAuthStore } from '@/state/authStore';
import { useCartStore } from '@/state/cartStore';
import { useFavoriteStore } from '@/state/favoriteStore';
import { useSearchStore } from '@/state/searchStore';
import { usePharmaStore } from '@/state/pharmaStore';
import { useBloodDonorStore } from '@/state/bloodDonorStore';
import { useBookingStore } from '@/state/bookingStore';
import { useRewardsStore } from '@/state/rewardsStore';
import { useVendorRatingStore } from '@/state/vendorRatingStore';
import { resetProductViews } from './productViews';

/**
 * Clears every piece of per-user local state on explicit logout.
 * Global app config (language) is intentionally preserved.
 */
export async function logoutUser(): Promise<void> {
  useCartStore.getState().clearCart();
  useFavoriteStore.getState().reset();
  useSearchStore.getState().clearRecentSearches();
  usePharmaStore.setState({ prescriptions: [] });
  useBloodDonorStore.getState().reset();
  useBookingStore.setState({ bookings: [] });
  useRewardsStore.getState().reset();
  useVendorRatingStore.getState().reset();
  resetProductViews();

  await useAuthStore.getState().logout();
}
