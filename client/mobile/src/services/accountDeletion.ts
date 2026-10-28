import { gateway, type DataDeletionCategory } from './api/GatewayClient';
import { resetLocalUserState } from './logout';
import { useAuthStore } from '@/state/authStore';
import { useFavoriteStore } from '@/state/favoriteStore';
import { usePharmaStore } from '@/state/pharmaStore';
import { useSearchStore } from '@/state/searchStore';

/**
 * Delete the account on the server, then tear down every local trace.
 *
 * The server call happens FIRST: if it fails (offline/401/500) nothing local is touched, so the
 * user can retry. After success we must never call an authenticated gateway endpoint again — the
 * server has already unlinked the auth identity — so this deliberately does not reuse `logoutUser`
 * (which unregisters the push token over HTTP).
 */
export async function deleteAccountEverywhere(): Promise<void> {
  await gateway.deleteAccount();
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
