import { useAuthStore } from '@/state/authStore';
import { useCartStore } from '@/state/cartStore';
import { useFavoriteStore } from '@/state/favoriteStore';
import { useSearchStore } from '@/state/searchStore';
import { usePharmaStore } from '@/state/pharmaStore';
import { useBloodDonorStore } from '@/state/bloodDonorStore';
import { useRewardsStore } from '@/state/rewardsStore';
import { useOrdersStore } from '@/state/ordersStore';
import { useVendorRatingStore } from '@/state/vendorRatingStore';
import { clearSavedCards } from '@/features/cart/payment/cardStorage';
import { gateway } from './api/GatewayClient';
import { resetProductViews } from './productViews';

/**
 * Clears every piece of per-user local state. Used by sign-out and by account deletion (which must
 * not call the gateway again after the server has already anonymised the account).
 * Global app config (language) is intentionally preserved.
 */
export async function resetLocalUserState(): Promise<void> {
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
  await clearSavedCards();
}

/** Explicit sign-out: local reset, stop pushes, then drop the Keychain session. */
export async function logoutUser(): Promise<void> {
  await resetLocalUserState();

  // Stop pushes to a signed-out device (best-effort; the token is re-registered on next login).
  await gateway.unregisterPushToken().catch(() => {});
  await useAuthStore.getState().logout();
}
