import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';

import { gateway } from '@/services/api/GatewayClient';
import { useAuthStore } from '@/state/authStore';
import { useLocationStore } from '@/state/locationStore';
import { useServiceabilityStore } from '@/state/serviceabilityStore';

/**
 * Reports the customer's serviceable location to the gateway (`PUT /profile/location`) so the admin
 * directory can show a real state/district/pincode and mint the stable `fa<pincode><phone>` customer
 * id. The origin's reverse-geocode supplies the pincode; the serviceability store supplies the
 * state/district it already matched against the active district master.
 *
 * Only fires for a `serviceable` origin with a valid 6-digit pincode, and only when the tuple
 * (user + state + district + pincode) changes from the last successful write. The signature is
 * persisted so a cold start with an unchanged origin does not re-PUT. Failures are silent: the next
 * origin change (or foreground recheck) retries.
 */
const STORAGE_KEY = 'faazio:profile-location:v1';
const DEBOUNCE_MS = 1500;

function normalisePincode(raw: string | null | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  return digits.length === 6 ? digits : '';
}

export function useCustomerLocationSync(enabled = true): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const svcStatus = useServiceabilityStore((s) => s.status);
  const stateCode = useServiceabilityStore((s) => s.stateCode);
  const districtCode = useServiceabilityStore((s) => s.districtCode);
  const pincodeRaw = useLocationStore(
    (s) => s.activeLocation?.place?.postalCode || s.deviceFix?.place?.postalCode || '',
  );
  const lastSynced = useRef<string | null>(null);

  // Hydrate the last-synced signature so a cold start with the same origin stays quiet.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!cancelled && raw && lastSynced.current === null) lastSynced.current = raw;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !isAuthenticated || svcStatus !== 'serviceable') return;
    const pincode = normalisePincode(pincodeRaw);
    if (!pincode || !stateCode || !districtCode) return;
    const signature = `${userId}|${stateCode}|${districtCode}|${pincode}`;
    if (signature === lastSynced.current) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      void gateway
        .updateProfileLocation({ stateCode, districtCode, pincode })
        .then(() => {
          if (cancelled) return;
          lastSynced.current = signature;
          AsyncStorage.setItem(STORAGE_KEY, signature).catch(() => {});
        })
        .catch(() => {
          // Best-effort: the next origin change / foreground recheck retries.
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, isAuthenticated, userId, svcStatus, stateCode, districtCode, pincodeRaw]);
}
