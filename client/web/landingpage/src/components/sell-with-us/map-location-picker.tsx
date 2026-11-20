import { useCallback, useEffect, useRef, useState } from "react";
import { HiOutlineMagnifyingGlass, HiOutlineMapPin } from "react-icons/hi2";
import {
  describePlace,
  loadGoogleMaps,
  mapsKey,
  reverseGeocode,
  type AddressPart,
  type LatLng,
  type MapsApi,
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

/**
 * Shop-pin picker for the public "Sell with us" page.
 *
 * Mirrors the mobile `SellerLocationPicker`: search a place, drag the pin until it sits on the shop,
 * and read back lat/lng plus a reverse-geocoded address. When no Maps key is configured the picker
 * renders nothing at all — the form's address + district fields carry the enquiry, and **no** pin is
 * ever invented.
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

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    hasKey ? "loading" : "idle",
  );
  const [resolving, setResolving] = useState(false);

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
          resolveAndApply(api, { lat: pos.lat(), lng: pos.lng() });
        });

        if (searchEl.current) {
          const autocomplete = new api.places.Autocomplete(searchEl.current, {
            fields: ["geometry", "formatted_address", "address_components"],
          });
          autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            const loc = place.geometry?.location;
            if (!loc) {
              onAddressError?.("Pick a suggestion from the list so we get the exact spot.");
              return;
            }
            const point = { lat: loc.lat(), lng: loc.lng() };
            map.panTo(loc);
            map.setZoom(16);
            marker.setPosition(loc);
            apply(point, describePlace(place.formatted_address, place.address_components));
          });
        }

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

  return (
    <div className="map-picker">
      <div className="map-picker-head">
        <p className="eyebrow">Shop location</p>
        <div className="map-picker-field">
          <HiOutlineMagnifyingGlass aria-hidden="true" />
          <input
            id="shop-search"
            ref={searchEl}
            type="text"
            placeholder="Search your shop name or street"
            autoComplete="off"
            aria-label="Search for your shop location"
          />
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
