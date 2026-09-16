import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';

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
 * `requestForegroundPermissionsAsync`. Coordinates/address are never logged
 * (AGENTS security rule) — they're only held in memory for the order snapshot.
 */
export function useLiveAddress(active: boolean): LiveAddress {
  const [result, setResult] = useState<LiveAddress>(INITIAL);

  const resolve = useCallback(async () => {
    setResult((prev) => ({ ...prev, status: 'loading' }));
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setResult((prev) => ({ ...prev, status: 'denied' }));
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = position.coords;
      const [place] = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
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
        lat: latitude,
        lng: longitude,
        address: address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
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
