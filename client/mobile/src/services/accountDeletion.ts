import { gateway, type DataDeletionCategory } from './api/GatewayClient';
import { resetLocalUserState } from './logout';
import { useAuthStore } from '@/state/authStore';
import { useFavoriteStore } from '@/state/favoriteStore';
import { usePharmaStore } from '@/state/pharmaStore';
import { useSearchStore } from '@/state/searchStore';

/**
 * Delete the account on the server, then delete the Firebase identity, then tear down every local
 * trace.
 *
 * Ordering is deliberate:
 * 1. The gateway call happens FIRST: if it fails (offline/401/500) nothing local is touched, so
 *    the user can retry. After success we must never call an authenticated gateway endpoint again —
 *    the server has already unlinked the auth identity — so this deliberately does not reuse
 *    `logoutUser` (which unregisters the push token over HTTP).
 * 2. Firebase user.delete() removes the phone identity at Firebase (not just the device session).
 *    It runs right after the server erasure and is preceded by the OTP re-auth gate in the delete
 *    screen, which satisfies Firebase's recent-login requirement. It is best-effort: if it fails
 *    (e.g. web-only account w/o phone), the server-side erasure already stands.
 * 3. Local teardown — reset stores, then sign out / expire the session.
 */
export async function deleteAccountEverywhere(): Promise<void> {
  await gateway.deleteAccount();
  await useAuthStore
    .getState()
    .deleteFirebaseIdentity()
    .catch(() => {});
  await resetLocalUserState().catch(() => {});
  await useAuthStore
    .getState()
    .logout()
    .catch(() => useAuthStore.getState().expireSession());
}

/**
 * Erase selected server-owned categories while keeping the account, and clear the matching local
 * caches. Recent searches are device-local, so they are handled here rather than by the gateway.
 */
export async function deleteSelectedUserData(
  categories: DataDeletionCategory[],
  includeSearchHistory: boolean,
): Promise<DataDeletionCategory[]> {
  const deleted = categories.length
    ? await gateway.requestDataDeletion(categories)
    : [];

  if (deleted.includes('favourites')) useFavoriteStore.getState().reset();
  if (deleted.includes('prescriptions')) usePharmaStore.setState({ prescriptions: [] });
  if (includeSearchHistory) useSearchStore.getState().clearRecentSearches();

  return deleted;
}
