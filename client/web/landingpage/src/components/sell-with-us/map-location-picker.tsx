import { useCallback, useEffect, useRef, useState } from "react";
import { HiOutlineMagnifyingGlass, HiOutlineMapPin } from "react-icons/hi2";
import {
  describePlace,
  fetchSuggestions,
  loadGoogleMaps,
  mapsKey,
  newSessionToken,
  resolveSuggestion,
  reverseGeocode,
  type AddressPart,
  type LatLng,
  type MapsApi,
  type PlaceSuggestion,
} from "@/lib/google-maps";

export type PickedLocation = {
  latitude?: number;
  longitude?: number;
  address: string;
  stateName: string;
  districtName: string;
};

type Props = {
  /** Where the map opens when there is no pin yet (Karaikal town centre). */
  centre: LatLng;
  value: PickedLocation | null;
  onChange: (next: PickedLocation) => void;
  onAddressError?: (message: string) => void;
  /** The key is present but Maps refused to initialise — the form hides this panel. */
  onUnavailable?: () => void;
};

/** Keystroke settle time before a suggestion request goes out. */
const DEBOUNCE_MS = 220;

/**
 * Shop-pin picker for the public "Sell with us" page.
 *
 * Mirrors the mobile `SellerLocationPicker`: search a place, drag the pin until it sits on the shop,
 * and read back lat/lng plus a reverse-geocoded address. When no Maps key is configured the picker
 * renders nothing at all — the form's address + district fields carry the enquiry, and **no** pin is
 * ever invented.
 *
 * Address search uses Places API (New) `AutocompleteSuggestion` rather than the retired
 * `places.Autocomplete` widget: suggestions are rendered into this component's own listbox so the
 * field keeps the page's type, palette and focus treatment.
 */
export function MapLocationPicker({
  centre,
  value,
  onChange,
  onAddressError,
  onUnavailable,
}: Props) {
  const hasKey = Boolean(mapsKey());
  const mapEl = useRef<HTMLDivElement | null>(null);
  const searchEl = useRef<HTMLInputElement | null>(null);
  const apiRef = useRef<MapsApi | null>(null);
  const mapRef = useRef<InstanceType<MapsApi["Map"]> | null>(null);
  const markerRef = useRef<InstanceType<MapsApi["Marker"]> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  /** Billing session for the current search; replaced after each selection. */
  const sessionRef = useRef<unknown>(undefined);
  /** Guards against an older request resolving after a newer one. */
  const seqRef = useRef(0);
  const debounceRef = useRef<number | undefined>(undefined);

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    hasKey ? "loading" : "idle",
  );
  const [resolving, setResolving] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);

  const apply = useCallback((point: LatLng, address: AddressPart) => {
    onChangeRef.current({
      latitude: point.lat,
      longitude: point.lng,
      address: address.formattedAddress,
      stateName: address.stateName,
      districtName: address.districtName,
    });
  }, []);

  const resolveAndApply = useCallback(
    (api: MapsApi, point: LatLng) => {
      setResolving(true);
      void reverseGeocode(api, point).then((address) => {
        setResolving(false);
        if (!address.formattedAddress) onAddressError?.("We couldn't read that spot's address.");
        apply(point, address);
      });
    },
    [apply, onAddressError],
  );

  const moveTo = useCallback(
    (point: LatLng, address: AddressPart) => {
      const map = mapRef.current;
      const marker = markerRef.current;
      map?.panTo(point);
      map?.setZoom(16);
      marker?.setPosition(point);
      apply(point, address);
    },
    [apply],
  );

  const closeList = useCallback(() => {
    setOpen(false);
    setActive(-1);
  }, []);

  const choose = useCallback(
    (suggestion: PlaceSuggestion) => {
      const api = apiRef.current;
      if (!api) return;
      closeList();
      setSuggestions([]);
      if (searchEl.current) searchEl.current.value = suggestion.mainText;
      setResolving(true);
      void resolveSuggestion(api, suggestion.placeId).then((resolved) => {
        setResolving(false);
        // A picked suggestion that yields no coordinates is a dead end for the pin, but the typed
        // address still stands — so tell the user and leave the form usable.
        if (!resolved) {
          onAddressError?.("We couldn't place that suggestion. Drag the pin instead.");
          return;
        }
        moveTo(resolved.point, resolved.address);
      });
      sessionRef.current = newSessionToken(api);
    },
    [closeList, moveTo, onAddressError],
  );

  const onQueryChange = useCallback((raw: string) => {
    const api = apiRef.current;
    if (!api) return;
    window.clearTimeout(debounceRef.current);
    const seq = ++seqRef.current;
    debounceRef.current = window.setTimeout(() => {
      if (!sessionRef.current) sessionRef.current = newSessionToken(api);
      void fetchSuggestions(api, raw, sessionRef.current).then((next) => {
        if (seq !== seqRef.current) return;
        setSuggestions(next);
        setActive(-1);
        setOpen(next.length > 0);
      });
    }, DEBOUNCE_MS);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!suggestions.length) return;
      e.preventDefault();
      setOpen(true);
      setActive((i) => {
        const next = e.key === "ArrowDown" ? i + 1 : i - 1;
        if (next < 0) return suggestions.length - 1;
        if (next >= suggestions.length) return 0;
        return next;
      });
      return;
    }
    if (e.key === "Enter" && open && active >= 0) {
      e.preventDefault();
      const picked = suggestions[active];
      if (picked) choose(picked);
      return;
    }
    if (e.key === "Escape") {
      closeList();
    }
  };

  useEffect(() => {
    if (!hasKey) return;
    let cancelled = false;
    loadGoogleMaps()
      .then((api) => {
        if (cancelled || !mapEl.current) return;
        apiRef.current = api;
        const start: LatLng =
          value?.latitude != null && value.longitude != null
            ? { lat: value.latitude, lng: value.longitude }
            : centre;
        const map = new api.Map(mapEl.current, { center: start, zoom: 14, zoomControl: true });
        const marker = new api.Marker({
          map,
          position: start,
          draggable: true,
          title: "Shop location",
        });
        mapRef.current = map;
        markerRef.current = marker;

        api.event.addListener(marker, "dragend", () => {
          const pos = marker.getPosition();
          if (!pos) return;
          resolveAndApply(api, { lat: pos.lat(), lng: pos.lng() });
        });

        setStatus("ready");
        if (value?.latitude != null && value.longitude != null) resolveAndApply(api, start);
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
        // A configured-but-rejected key (referrer/billing/auth) can never draw a map, so the caller
        // collapses the panel instead of leaving a permanent error block on the page.
        onUnavailable?.();
      });
    return () => {
      cancelled = true;
      window.clearTimeout(debounceRef.current);
    };
    // The map is built once; later `value` changes come from this component's own callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasKey]);

  const locateMe = () => {
    const api = apiRef.current;
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!api || !map || !marker) return;
    if (!navigator.geolocation) {
      onAddressError?.("This browser can't share your location.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        map.panTo(point);
        map.setZoom(16);
        marker.setPosition(point);
        resolveAndApply(api, point);
      },
      () => onAddressError?.("We couldn't get your location. Search for your shop instead."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const readout = value?.address
    ? value.address
    : value?.latitude != null && value.longitude != null
      ? `${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)}`
      : "";

  // No key → no map surface at all. A dead panel with a "type it below" apology is worse than the
  // form simply standing on its own two address/district fields.
  if (!hasKey) return null;

  const listId = "shop-search-suggestions";
  const optionId = (i: number) => `shop-search-option-${i}`;

  return (
    <div className="map-picker">
      <div className="map-picker-head">
        <p className="eyebrow">Shop location</p>
        <div className="map-picker-search">
          <div className="map-picker-field">
            <HiOutlineMagnifyingGlass aria-hidden="true" />
            <input
              id="shop-search"
              ref={searchEl}
              type="text"
              placeholder="Search your shop name or street"
              autoComplete="off"
              aria-label="Search for your shop location"
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={onKeyDown}
              onBlur={closeList}
            />
          </div>
          {open && suggestions.length > 0 ? (
            <ul
              className="map-picker-suggestions"
              id={listId}
              role="listbox"
              aria-label="Shop address suggestions"
              // Keep focus in the field so `onBlur` does not close the list before the click lands.
              onMouseDown={(e) => e.preventDefault()}
            >
              {suggestions.map((s, i) => (
                <li
                  key={s.placeId}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  className="map-picker-suggestion"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(s)}
                >
                  <span className="map-picker-suggestion-main">{s.mainText}</span>
                  {s.secondaryText ? (
                    <span className="map-picker-suggestion-secondary">{s.secondaryText}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="map-picker-canvas">
        <div ref={mapEl} className="map-picker-map" aria-hidden="true" />
        {status === "loading" ? <p className="map-picker-note">Loading the map…</p> : null}
        {status === "error" ? (
          <p className="map-picker-note">
            The map didn&apos;t load. Add your shop address and district in the form instead.
          </p>
        ) : null}
      </div>

      <div className="map-picker-actions">
        <button type="button" className="btn btn-outline btn-sm" onClick={locateMe}>
          <HiOutlineMapPin aria-hidden="true" />
          Use my current location
        </button>
        <span className="meta">
          {resolving ? "Reading the address…" : "Drag the pin onto your shop door"}
        </span>
      </div>

      {readout ? (
        <p className="map-picker-readout">
          <HiOutlineMapPin aria-hidden="true" />
          <span>{readout}</span>
        </p>
      ) : null}
    </div>
  );
}
