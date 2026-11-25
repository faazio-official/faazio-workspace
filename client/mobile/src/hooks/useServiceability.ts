import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '@/state/authStore';
import { useConnectivityStore } from '@/state/connectivityStore';
import { useLocationStore } from '@/state/locationStore';
import { useServiceabilityStore } from '@/state/serviceabilityStore';

/**
 * Keeps the coverage decision in sync with the live origin.
 *
 * Mount once at the app root. The first check runs as soon as an authenticated origin exists — on a
 * cold start that happens under the splash, so the gate is already decided by the time the UI is
 * visible. A moved origin re-checks; a manual origin is never replaced by a GPS fix here (that is
 * `useLiveLocation`'s job), it just carries its own address into the match.
 *
 * On every foreground the check is forced, so a district the super admin activates (or deactivates)
 * in the portal is picked up without restarting or walking around. The check itself throws on a
 * network failure and is recorded as `failed`, never as `unserviceable`.
 *
 * Returning from offline is also a forced re-check: a cold start that happened offline records
 * `failed`, and that must never stand in for a verdict once the network is back — otherwise an
 * out-of-area device could reach the catalogue simply by booting without a connection.
 */
export function useServiceability(enabled = true): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const status = useLocationStore((s) => s.status);
  const latitude = useLocationStore((s) => s.activeLocation?.latitude);
  const longitude = useLocationStore((s) => s.activeLocation?.longitude);
  const address = useLocationStore((s) => s.activeLocation?.address);
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const check = useServiceabilityStore((s) => s.check);
  const reset = useServiceabilityStore((s) => s.reset);
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!enabled || !isAuthenticated) return;
    if (
      status !== 'ready' ||
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      (latitude === 0 && longitude === 0)
    ) {
      return;
    }
    void check();
  }, [enabled, isAuthenticated, status, latitude, longitude, address, check]);

  useEffect(() => {
    if (isAuthenticated) return;
    reset();
  }, [isAuthenticated, reset]);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      if (!useAuthStore.getState().isAuthenticated) return;
      void check(true);
    });
    return () => sub.remove();
  }, [enabled, check]);

  // Connectivity restored after a real offline stretch: force the read that could not happen while
  // offline. Tracked as a transition so an ordinary online start (null → true) does not double-fire.
  useEffect(() => {
    if (!enabled) return;
    if (isOnline === false) {
      wasOffline.current = true;
      return;
    }
    if (isOnline !== true || !wasOffline.current) return;
    wasOffline.current = false;
    if (!useAuthStore.getState().isAuthenticated) return;
    void check(true);
  }, [enabled, isOnline, check]);
}
