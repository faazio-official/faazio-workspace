import { create } from 'zustand';
import { gateway } from '@/services/api/GatewayClient';
import { GOOGLE_PLACES_API_KEY } from '@/lib/config';

/**
 * Central remote config (the "Central Digital Menu"). The app fetches the SUPER_ADMIN-managed
 * `admins.app_config` rows on cold boot and overrides its build-time baked defaults for those keys
 * — a change in the partner portal applies on the next boot with no app-store release.
 *
 * Contract with the bake-time binary (`scripts/configure.js` → `src/lib/config.ts`):
 *  - Baked values are the safe defaults; a remote row overrides its key only when present.
 *  - `GATEWAY_URL` / `USE_GATEWAY` / `APP_VARIANT` / `TRANSPORT` are never overridden (the app
 *    needs the URL to fetch config in the first place — chicken-and-egg).
 *  - Fetch is best-effort and non-blocking: a failure keeps the baked defaults.
 */

/** Any JSONB value carried by an app_config row. */
export type AppConfigValue = string | number | boolean | Record<string, unknown> | unknown[] | null;

export interface RemoteConfigState {
  /** Flat key → value map of the public rows the gateway served (empty = use baked defaults). */
  config: Record<string, AppConfigValue>;
  /** True once the first fetch attempt settled (success or failure) — never blocks startup. */
  isLoaded: boolean;
  lastFetched: number | null;
  error: string | null;
  fetchConfig: () => Promise<void>;
}

export const useRemoteConfigStore = create<RemoteConfigState>()((set) => ({
  config: {},
  isLoaded: false,
  lastFetched: null,
  error: null,
  fetchConfig: async () => {
    try {
      const rows = await gateway.getAppConfig();
      const config: Record<string, AppConfigValue> = {};
      for (const row of rows) {
        config[row.key] = row.value;
      }
      set({ config, isLoaded: true, lastFetched: Date.now(), error: null });
    } catch (error) {
      // Best-effort: on any failure keep the baked build-time defaults and stay usable.
      if (__DEV__) {
        console.warn('[Faazio:remote-config]', error);
      }
      set({ isLoaded: true, error: 'Remote config unavailable.' });
    }
  },
}));

/**
 * The effective Google Places (New) key for location autocomplete: the superadmin-managed remote
 * value when set, otherwise the bake-time `GOOGLE_PLACES_API_KEY`. Consumers subscribe with
 * `useRemoteConfigStore(selectPlacesApiKey)` so an admin edit applies on the next boot.
 */
export const selectPlacesApiKey = (s: RemoteConfigState): string => {
  const remote = s.config['maps.places_api_key'];
  return typeof remote === 'string' && remote.trim() ? remote : GOOGLE_PLACES_API_KEY;
};

/**
 * The effective global maintenance flag (false/absent ⇒ normal operation). Exposed for a future
 * maintenance banner; no screen consumes it yet.
 */
export const selectMaintenanceEnabled = (s: RemoteConfigState): boolean =>
  s.config['maintenance.enabled'] === true;

/** Non-hook read of the effective Places key (for plain async call sites like `resolvePlaceLocation`). */
export function resolvePlacesApiKey(): string {
  return selectPlacesApiKey(useRemoteConfigStore.getState());
}