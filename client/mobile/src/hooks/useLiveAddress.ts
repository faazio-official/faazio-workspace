import { useCallback, useEffect, useState } from 'react';
import { getCurrentAddress } from '@/services/location';

export interface LiveAddress {
  /** 'idle' — not requested yet; 'loading' — fetching; 'ready' — resolved; 'denied' — no permission/fix. */
  status: 'idle' | 'loading' | 'ready' | 'denied';
  lat: number;
  lng: number;
  address: string;
}

const INITIAL: LiveAddress = { status: 'idle', lat: 0, lng: 0, address: '' };

/**
 * Resolves the user's live address (GPS fix + reverse geocode) for delivery
 * checkout. Fetches only when `active` is true so we don't prompt for location
 * until the user actually opts into Delivery. Consent is requested in-UI via
 * `requestLocationPermission`. Coordinates/address are never logged
 * (AGENTS security rule) — they're only held in memory for the order snapshot.
 */
export function useLiveAddress(active: boolean): LiveAddress {
  const [result, setResult] = useState<LiveAddress>(INITIAL);

  const resolve = useCallback(async () => {
    setResult((prev) => ({ ...prev, status: 'loading' }));
    try {
      const resolved = await getCurrentAddress();
      if (!resolved) {
        setResult((prev) => ({ ...prev, status: 'denied' }));
        return;
      }

      const { coordinates, place } = resolved;
      const address = [
        place?.street,
        place?.district,
        place?.city,
        place?.region,
        place?.postalCode,
      ]
        .filter(Boolean)
        .join(', ');

      setResult({
        status: 'ready',
        lat: coordinates.latitude,
        lng: coordinates.longitude,
        address:
          address ||
          `${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}`,
      });
    } catch {
      setResult((prev) => ({ ...prev, status: 'denied' }));
    }
  }, []);

  useEffect(() => {
    if (active && result.status === 'idle') {
      resolve();
    }
  }, [active, result.status, resolve]);

  return result;
}
