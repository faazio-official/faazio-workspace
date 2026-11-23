/**
 * Google Maps JS API loader — the browser key is a referrer-restricted public identifier (not a
 * secret), injected at build time via `VITE_GOOGLE_MAPS_API_KEY`.
 *
 * **Places API (New) only.** The legacy `places.Autocomplete` widget and the `libraries=places`
 * script parameter are retired for new Google Cloud projects, so this module loads the libraries
 * through `importLibrary` and drives address search with `AutocompleteSuggestion`. That path returns
 * plain suggestions, which lets the picker keep its own input and its own dropdown — Google's
 * `PlaceAutocompleteElement` would replace the styled field with an unstylable web component.
 *
 * The key is absent in local devs without a Google Cloud project. In that case the picker degrades
 * to a manual address + district entry: the enquiry is still submittable, but it carries **no**
 * pin — coordinates are never invented.
 *
 * Types are declared locally (only what this page touches) so the landing page keeps no dependency
 * on `@types/google.maps`.
 */

import { mapsKey as configMapsKey } from "@/lib/config";

export type LatLng = { lat: number; lng: number };

export type AddressPart = {
  formattedAddress: string;
  stateName: string;
  districtName: string;
  /**
   * Google place_id of the district's `administrative_area_level_3` component. This is the durable
   * district identity sent to the gateway — a place_id cannot be misspelled or renamed the way a
   * district name can. It is only populated by the reverse-geocode path (see `reverseDistrict`),
   * because the Geocoder does not attach a place_id to individual address components.
   */
  districtPlaceId: string;
  postcode: string;
};

/**
 * Address components arrive in two shapes: the Geocoder still uses the legacy
 * `long_name`/`short_name` keys, while Places API (New) uses `longText`/`shortText`. Both are read
 * here so one `parts()` serves both call sites.
 */
type Component = {
  long_name?: string;
  short_name?: string;
  longText?: string;
  shortText?: string;
  types?: string[];
};

export type MapsLatLng = { lat(): number; lng(): number };

export type Point = LatLng | MapsLatLng;

export type MapsMap = {
  setCenter(p: Point): void;
  setZoom(z: number): void;
  panTo(p: Point): void;
};

export type MapsMarker = {
  setPosition(p: Point): void;
  getPosition(): MapsLatLng | null;
};

/** One address suggestion from Places API (New), flattened for the picker's own listbox. */
export type PlaceSuggestion = {
  placeId: string;
  mainText: string;
  secondaryText: string;
};

type NewPlacePrediction = {
  placeId?: string;
  text?: { toString(): string };
  mainText?: { toString(): string };
  secondaryText?: { toString(): string };
  toPlace(): NewPlace;
};

type NewPlace = {
  location?: MapsLatLng | null;
  formattedAddress?: string;
  addressComponents?: Component[];
  fetchFields(opts: { fields: string[] }): Promise<unknown>;
};

type AutocompleteSuggestionCtor = {
  fetchAutocompleteSuggestions(request: {
    input: string;
    sessionToken?: unknown;
    includedRegionCodes?: string[];
  }): Promise<{ suggestions?: Array<{ placePrediction?: NewPlacePrediction }> }>;
};

type GoogleMapsNamespace = {
  importLibrary(name: string): Promise<Record<string, unknown>>;
  /** Legacy marker constructor exposed on the core namespace (not by `importLibrary("maps")`). */
  Marker: new (opts: {
    map: MapsMap;
    position: LatLng;
    draggable?: boolean;
    title?: string;
  }) => MapsMarker;
  event?: { addListener(instance: unknown, event: string, cb: () => void): void };
};

export type MapsApi = {
  Map: new (
    el: HTMLElement,
    opts: { center: LatLng; zoom: number; zoomControl?: boolean },
  ) => MapsMap;
  Marker: new (opts: {
    map: MapsMap;
    position: LatLng;
    draggable?: boolean;
    title?: string;
  }) => MapsMarker;
  Geocoder: new () => {
    geocode(request: {
      location?: LatLng;
      // Geocoding-only filter: asks Google to return the administrative_area_level_3 (district) row
      // rather than a street address, so the result's place_id IS the district's.
      result_type?: string;
    }): Promise<{
      results: Array<{
        place_id?: string;
        types?: string[];
        formatted_address?: string;
        address_components?: Component[];
      }>;
    }>;
  };
  AutocompleteSuggestion: AutocompleteSuggestionCtor;
  /** Opaque per-search-session billing token; created fresh for each search session. */
  AutocompleteSessionToken: new () => unknown;
  /** Places API (New) `Place` — constructed by id, then `fetchFields` for the billed details. */
  Place: new (opts: { id: string }) => NewPlace;
  event: { addListener(instance: unknown, event: string, cb: () => void): void };
};

declare global {
  interface Window {
    google?: { maps?: GoogleMapsNamespace };
    __faazioMapsReady?: () => void;
    gm_authFailure?: () => void;
  }
}

export function mapsKey(): string | undefined {
  return configMapsKey();
}

/** How long to wait for the Maps script before declaring the key unusable. */
const READY_TIMEOUT_MS = 10_000;

/** Address search is restricted to India — the only market the marketplace serves. */
const REGION_CODES = ["in"];

/** Shortest input worth a network round-trip; one letter matches half the country. */
export const MIN_SUGGESTION_CHARS = 2;

export function mapsApiReady(api: MapsApi | undefined): api is MapsApi {
  return Boolean(
    api &&
    api.Map &&
    api.Marker &&
    api.Geocoder &&
    api.AutocompleteSuggestion &&
    api.AutocompleteSessionToken &&
    api.Place &&
    api.event,
  );
}

let cached: MapsApi | undefined;
let loading: Promise<MapsApi> | undefined;

/** Injects the bootstrap script once. Resolves when `google.maps.importLibrary` exists. */
function loadScript(key: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      fn();
    };
    // An invalid/restricted key loads the script and then calls `gm_authFailure` instead of the
    // callback; without these guards the page would sit on "Loading the map…" forever.
    const timer = window.setTimeout(
      () => finish(() => reject(new Error("maps-timeout"))),
      READY_TIMEOUT_MS,
    );
    window.gm_authFailure = () => finish(() => reject(new Error("maps-auth-failed")));
    window.__faazioMapsReady = () => {
      const g = window.google?.maps;
      finish(() =>
        g && typeof g.importLibrary === "function"
          ? resolve()
          : reject(new Error("maps-not-ready")),
      );
    };
    const script = document.createElement("script");
    // No `libraries=` parameter: the new API loads libraries on demand via importLibrary.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=__faazioMapsReady`;
    script.async = true;
    script.defer = true;
    script.onerror = () => finish(() => reject(new Error("maps-script-failed")));
    document.head.appendChild(script);
  });
}

/**
 * Loads Maps + Geocoding + Places (New) and returns them as one facade.
 *
 * `importLibrary("maps")` gives `Map`/`Marker`; `"geocoding"` gives `Geocoder`; `"places"` gives
 * `AutocompleteSuggestion` + `AutocompleteSessionToken`. `event` lives on the core namespace.
 */
export function loadGoogleMaps(): Promise<MapsApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser"));
  }
  if (cached && mapsApiReady(cached)) return Promise.resolve(cached);
  if (loading) return loading;

  const key = mapsKey();
  if (!key) return Promise.reject(new Error("missing-maps-key"));

  loading = loadScript(key)
    .then(async () => {
      const g = window.google?.maps;
      if (!g || typeof g.importLibrary !== "function") throw new Error("maps-not-ready");
      const [mapsLib, geocodingLib, placesLib] = await Promise.all([
        g.importLibrary("maps"),
        g.importLibrary("geocoding"),
        g.importLibrary("places"),
      ]);
      const api = {
        Map: mapsLib["Map"],
        // `importLibrary("maps")` does not export `Marker` — the constructor lives on the core
        // namespace (legacy, but still supported and what this picker styles against). Reading it
        // from `mapsLib` left it `undefined`, so `mapsApiReady` failed and the whole picker
        // collapsed on every load.
        Marker: g.Marker,
        event: g.event,
        Geocoder: geocodingLib["Geocoder"],
        AutocompleteSuggestion: placesLib["AutocompleteSuggestion"],
        AutocompleteSessionToken: placesLib["AutocompleteSessionToken"],
        Place: placesLib["Place"],
      } as unknown as MapsApi;
      if (!mapsApiReady(api)) throw new Error("maps-not-ready");
      cached = api;
      return api;
    })
    .catch((err: unknown) => {
      loading = undefined;
      throw err;
    });
  return loading;
}

/** A fresh billing session. Reuse it across keystrokes; discard it after a selection. */
export function newSessionToken(api: MapsApi): unknown {
  return new api.AutocompleteSessionToken();
}

/**
 * Address suggestions for the typed query. Returns `[]` for a query shorter than
 * `MIN_SUGGESTION_CHARS` or when Places returns nothing — never throws, so a failed lookup cannot
 * break typing.
 */
export async function fetchSuggestions(
  api: MapsApi,
  input: string,
  sessionToken?: unknown,
): Promise<PlaceSuggestion[]> {
  const query = input.trim();
  if (query.length < MIN_SUGGESTION_CHARS) return [];
  try {
    const { suggestions } = await api.AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input: query,
      sessionToken,
      includedRegionCodes: REGION_CODES,
    });
    return (suggestions ?? []).flatMap((s) => {
      const p = s.placePrediction;
      if (!p?.placeId) return [];
      return [
        {
          placeId: p.placeId,
          mainText: (p.mainText ?? p.text)?.toString() ?? "",
          secondaryText: p.secondaryText?.toString() ?? "",
        },
      ];
    });
  } catch {
    return [];
  }
}

/**
 * Turns a chosen suggestion into coordinates plus a readable address.
 *
 * `fetchFields` is the billed call, so it happens on selection only — never while typing.
 *
 * `place_id`s are not attached to individual address *components*, so the district's identity is not
 * on this place's components; it is reverse-geocoded from the selected point (the same
 * `administrative_area_level_3` lookup the pin path uses) so a searched shop and a dragged pin yield
 * the same district id.
 */
export async function resolveSuggestion(
  api: MapsApi,
  placeId: string,
): Promise<{ point: LatLng; address: AddressPart } | null> {
  try {
    const place = new api.Place({ id: placeId });
    await place.fetchFields({ fields: ["location", "formattedAddress", "addressComponents"] });
    const loc = place.location;
    if (!loc) return null;
    const point = { lat: loc.lat(), lng: loc.lng() };
    const address = describePlace(place.formattedAddress, place.addressComponents);
    if (!address.districtName) return { point, address };
    const districtPlaceId = await reverseDistrictPlaceId(api, point);
    return { point, address: { ...address, districtPlaceId } };
  } catch {
    return null;
  }
}

function parts(components: Component[] = []) {
  const pick = (type: string) => {
    const c = components.find((x) => x.types?.includes(type));
    return c ? (c.longText ?? c.long_name ?? "") : "";
  };
  return {
    stateName: pick("administrative_area_level_1"),
    // District is the revenue/admin district. In India Google puts the DIVISION in
    // `administrative_area_level_2` ("Bangalore Division", "Mandi Division") and the actual DISTRICT
    // in `administrative_area_level_3` ("Bengaluru Urban", "Bilaspur"). Level 3 is therefore the
    // correct source; level 2 is only a last resort for other countries. `locality` is the city (e.g.
    // Tiruchirappalli) and must never be used as the district.
    districtName: pick("administrative_area_level_3") || pick("administrative_area_level_2"),
    postcode: pick("postal_code"),
  };
}

export function describePlace(
  formattedAddress: string | undefined,
  components?: Component[],
  districtPlaceId = "",
): AddressPart {
  const p = parts(components);
  return {
    formattedAddress: formattedAddress?.trim() ?? "",
    stateName: p.stateName,
    districtName: p.districtName,
    districtPlaceId,
    postcode: p.postcode,
  };
}

/**
 * Resolves a coordinate to the shop address AND the district's place_id.
 *
 * Two calls, deliberately:
 *  1. A normal reverse geocode for the readable address the picker shows and prefills.
 *  2. A reverse geocode filtered to `administrative_area_level_3`, whose result row's `place_id`
 *     IS the district's identity. Google does not attach a place_id to individual address
 *     *components*, so the district id cannot be read off call 1 — and for India the district lives
 *     at level 3 (level 2 is the division).
 *
 * The second call only runs when a district name came back, so a coordinate with no administrative
 * district pays for one request, not two. Failures degrade to an empty place_id (the gateway then
 * falls back to name matching) rather than blocking the enquiry.
 */
export async function reverseGeocode(api: MapsApi, at: LatLng): Promise<AddressPart> {
  const geocoder = new api.Geocoder();
  let base: AddressPart;
  try {
    const res = await geocoder.geocode({ location: at });
    const first = res.results[0];
    base = describePlace(first?.formatted_address, first?.address_components);
  } catch {
    return {
      formattedAddress: "",
      stateName: "",
      districtName: "",
      districtPlaceId: "",
      postcode: "",
    };
  }
  if (!base.districtName) return base;
  const districtPlaceId = await reverseDistrictPlaceId(api, at);
  return { ...base, districtPlaceId };
}

/**
 * The place_id of the `administrative_area_level_3` row at a coordinate, or "" when Google has none
 * (e.g. parts of Jammu & Kashmir and Ladakh return no administrative components at all).
 */
async function reverseDistrictPlaceId(api: MapsApi, at: LatLng): Promise<string> {
  try {
    const geocoder = new api.Geocoder();
    const res = await geocoder.geocode({
      location: at,
      result_type: "administrative_area_level_3",
    });
    return (
      res.results.find((r) => r.types?.includes("administrative_area_level_3"))?.place_id ?? ""
    );
  } catch {
    return "";
  }
}
