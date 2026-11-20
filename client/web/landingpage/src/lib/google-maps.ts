/**
 * Google Maps JS API loader — the browser key is a referrer-restricted public identifier (not a
 * secret), injected at build time via `VITE_GOOGLE_MAPS_API_KEY`.
 *
 * The key is absent in local devs without a Google Cloud project. In that case the picker degrades
 * to a manual address + district entry: the enquiry is still submittable, but it carries **no**
 * pin — coordinates are never invented.
 *
 * Types are declared locally (only what this page touches) so the landing page keeps no dependency
 * on `@types/google.maps`.
 */

export type LatLng = { lat: number; lng: number };

export type AddressPart = {
  formattedAddress: string;
  stateName: string;
  districtName: string;
  postcode: string;
};

type Component = { long_name: string; short_name: string; types: string[] };

export type MapsLatLng = { lat(): number; lng(): number };

export type Point = LatLng | MapsLatLng;

export type MapsMap = {
  setCenter(p: Point): void;
  setZoom(z: number): void;
  panTo(p: Point): void;
};

export type MapsMarker = {
  setPosition(p: Point): void;
  getPosition(): MapsLatLng;
};

export type MapsAutocomplete = {
  addListener(event: "place_changed", cb: () => void): void;
  getPlace(): {
    geometry?: { location?: MapsLatLng };
    formatted_address?: string;
    address_components?: Component[];
  };
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
    geocode(request: { location: LatLng }): Promise<{
      results: Array<{ formatted_address?: string; address_components?: Component[] }>;
    }>;
  };
  places: {
    Autocomplete: new (input: HTMLInputElement, opts: { fields: string[] }) => MapsAutocomplete;
  };
  event: { addListener(instance: unknown, event: string, cb: () => void): void };
};

declare global {
  interface Window {
    google?: { maps?: MapsApi };
    __faazioMapsReady?: () => void;
    gm_authFailure?: () => void;
  }
}

export function mapsKey(): string | undefined {
  const key = (import.meta.env as Record<string, string | undefined>)["VITE_GOOGLE_MAPS_API_KEY"];
  return key && key.trim() !== "" ? key.trim() : undefined;
}

/** How long to wait for the Maps script before declaring the key unusable. */
const READY_TIMEOUT_MS = 10_000;

export function mapsApiReady(api: MapsApi | undefined): api is MapsApi {
  return Boolean(api && api.Map && api.Marker && api.Geocoder && api.places && api.event);
}

let loading: Promise<MapsApi> | undefined;

export function loadGoogleMaps(): Promise<MapsApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser"));
  }
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (loading) return loading;

  const key = mapsKey();
  if (!key) return Promise.reject(new Error("missing-maps-key"));

  loading = new Promise<MapsApi>((resolve, reject) => {
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
    window.gm_authFailure = () => {
      loading = undefined;
      finish(() => reject(new Error("maps-auth-failed")));
    };
    window.__faazioMapsReady = () => {
      const api = window.google?.maps;
      finish(() => (api && mapsApiReady(api) ? resolve(api) : reject(new Error("maps-not-ready"))));
    };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&loading=async&callback=__faazioMapsReady`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      loading = undefined;
      finish(() => reject(new Error("maps-script-failed")));
    };
    document.head.appendChild(script);
  });
  return loading;
}

function parts(components: Component[] = []) {
  const pick = (type: string) => components.find((c) => c.types.includes(type))?.long_name ?? "";
  return {
    stateName: pick("administrative_area_level_1"),
    districtName:
      pick("administrative_area_level_2") ||
      pick("locality") ||
      pick("administrative_area_level_3"),
    postcode: pick("postal_code"),
  };
}

export function describePlace(
  formattedAddress: string | undefined,
  components?: Component[],
): AddressPart {
  const p = parts(components);
  return {
    formattedAddress: formattedAddress?.trim() ?? "",
    stateName: p.stateName,
    districtName: p.districtName,
    postcode: p.postcode,
  };
}

export function reverseGeocode(api: MapsApi, at: LatLng): Promise<AddressPart> {
  const geocoder = new api.Geocoder();
  return geocoder
    .geocode({ location: at })
    .then((res) => {
      const first = res.results[0];
      return describePlace(first?.formatted_address, first?.address_components);
    })
    .catch(() => ({ formattedAddress: "", stateName: "", districtName: "", postcode: "" }));
}
