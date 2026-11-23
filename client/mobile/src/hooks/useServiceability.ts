import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '@/state/authStore';
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
 */
export function useServiceability(enabled = true): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const status = useLocationStore((s) => s.status);
  const latitude = useLocationStore((s) => s.activeLocation?.latitude);
  const longitude = useLocationStore((s) => s.activeLocation?.longitude);
  const address = useLocationStore((s) => s.activeLocation?.address);
  const check = useServiceabilityStore((s) => s.check);
  const reset = useServiceabilityStore((s) => s.reset);

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
}
