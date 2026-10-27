import { useAuthStore } from '@/state/authStore';
import { useCartStore } from '@/state/cartStore';
import { useFavoriteStore } from '@/state/favoriteStore';
import { useSearchStore } from '@/state/searchStore';
import { usePharmaStore } from '@/state/pharmaStore';
import { useBloodDonorStore } from '@/state/bloodDonorStore';
import { useRewardsStore } from '@/state/rewardsStore';
import { useOrdersStore } from '@/state/ordersStore';
import { useVendorRatingStore } from '@/state/vendorRatingStore';
import { gateway } from './api/GatewayClient';
import { resetProductViews } from './productViews';

/**
 * Clears every piece of per-user local state on explicit logout.
 * Global app config (language) is intentionally preserved.
 */
export async function logoutUser(): Promise<void> {
  // Drop the device caches without deleting the server-authoritative cart/favourites, which must
  // survive sign-out and be re-hydrated for this user on the next login.
  useCartStore.getState().resetLocal();
  useFavoriteStore.getState().reset();
  useOrdersStore.getState().reset();
  useSearchStore.getState().clearRecentSearches();
  usePharmaStore.setState({ prescriptions: [] });
  useBloodDonorStore.getState().reset();
  useRewardsStore.getState().reset();
  useVendorRatingStore.getState().reset();
  resetProductViews();

  // Stop pushes to a signed-out device (best-effort; the token is re-registered on next login).
  await gateway.unregisterPushToken().catch(() => {});
  await useAuthStore.getState().logout();
}
