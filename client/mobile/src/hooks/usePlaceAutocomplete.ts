import { useEffect, useRef, useState } from 'react';
import { useRemoteConfigStore, selectPlacesApiKey, resolvePlacesApiKey } from '@/state/remoteConfigStore';
import type { Coordinates } from '@/services/location';

/**
 * Google Places API (New) autocomplete. The key is a restricted client key (Places API only,
 * app/package restricted). It is normally injected at build time by `scripts/configure.js`, but a
 * SUPER_ADMIN-set `maps.places_api_key` in the central remote config overrides it at runtime — a
 * new key applies on the next app boot, no app-store release. With no key, callers fall back to
 * their static suggestions — nothing breaks.
 */
export interface PlaceSuggestion {
  placeId: string;
  title: string;
  subtitle: string;
}

export interface ResolvedPlace {
  coordinates: Coordinates;
  address: string;
}

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const PLACE_URL = 'https://places.googleapis.com/v1/places/';
const DEBOUNCE_MS = 300;

interface RawSuggestion {
  placePrediction?: {
    placeId?: string;
    text?: { text?: string };
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
  };
}

export function usePlaceAutocomplete(
  query: string,
  origin: Coordinates | null,
): { suggestions: PlaceSuggestion[]; loading: boolean; enabled: boolean } {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);
  const placesKey = useRemoteConfigStore(selectPlacesApiKey);
  const enabled = Boolean(placesKey);

  useEffect(() => {
    const trimmed = query.trim();
    if (!enabled || trimmed.length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const body: Record<string, unknown> = {
          input: trimmed,
          includedRegionCodes: ['in'],
        };
        if (origin) {
          body.locationBias = {
            circle: {
              center: { latitude: origin.latitude, longitude: origin.longitude },
              radius: 50_000,
            },
          };
        }
        const response = await fetch(AUTOCOMPLETE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': placesKey,
          },
          body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error('places_autocomplete_failed');
        const data = (await response.json()) as { suggestions?: RawSuggestion[] };
        if (id !== requestId.current) return;
        const mapped = (data.suggestions ?? [])
          .map((item) => item.placePrediction)
          .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
          .map((p) => ({
            placeId: String(p.placeId),
            title: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
            subtitle: p.structuredFormat?.secondaryText?.text ?? '',
          }))
          .filter((p) => p.title);
        setSuggestions(mapped);
      } catch {
        if (id === requestId.current) setSuggestions([]);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, origin, placesKey, enabled]);

  return { suggestions, loading, enabled };
}

/** Resolve a selected prediction to coordinates + formatted address. */
export async function resolvePlaceLocation(
  placeId: string,
): Promise<ResolvedPlace | null> {
  const placesKey = resolvePlacesApiKey();
  if (!placesKey || !placeId) return null;
  try {
    const response = await fetch(
      `${PLACE_URL}${encodeURIComponent(placeId)}?fields=location,formattedAddress`,
      { headers: { 'X-Goog-Api-Key': placesKey } },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as {
      location?: { latitude?: number; longitude?: number };
      formattedAddress?: string;
    };
    if (
      typeof data.location?.latitude !== 'number' ||
      typeof data.location?.longitude !== 'number'
    ) {
      return null;
    }
    return {
      coordinates: {
        latitude: data.location.latitude,
        longitude: data.location.longitude,
      },
      address: data.formattedAddress ?? '',
    };
  } catch {
    return null;
  }
}
