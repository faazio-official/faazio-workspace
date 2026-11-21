"use client";
// Shop geo pin for the seller console. Delivery-fee quoting, auto-dispatch and the nearby-shopper
// feed all read `directory.stores.latitude/longitude` (0041); a shop with no pin silently quotes the
// base fee and can never be auto-assigned a rider. So the pin is a first-class onboarding field, not
// a nicety.
//
// Keyless by design: the portal ships no Maps SDK and no API key, so this is the device geolocation
// API plus manual entry, with an OpenStreetMap embed for confirmation (same pattern as
// DeliveryReviewBoard). Coordinates are never invented — an unavailable/denied geolocation leaves the
// field empty and the seller types the pair instead.
import { useState } from "react";
import { Crosshair, MapPin, X } from "lucide-react";
import { Card, TextField } from "@/components/sellers/kit";

export interface PinValue {
  latitude?: number | undefined;
  longitude?: number | undefined;
}

/** Both-or-neither: a half pin is rejected by the gateway, so it must never leave this component. */
export function normalizePin(value: PinValue): PinValue {
  const { latitude, longitude } = value;
  if (typeof latitude === "number" && typeof longitude === "number") {
    return { latitude, longitude };
  }
  return {};
}

function parseCoordinate(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

function rangeError(pin: PinValue): string | null {
  const { latitude, longitude } = pin;
  if (latitude === undefined && longitude === undefined) return null;
  if (latitude === undefined || longitude === undefined) {
    return "Enter both latitude and longitude, or clear both.";
  }
  if (latitude < -90 || latitude > 90) return "Latitude must be between -90 and 90.";
  if (longitude < -180 || longitude > 180) return "Longitude must be between -180 and 180.";
  return null;
}

export function StorePinPicker({
  value,
  onChange,
  disabled,
  allowClear = true,
  hint = "Used to route riders and quote the delivery fee. Set it once, from the shop itself.",
}: {
  value: PinValue;
  onChange: (pin: PinValue) => void;
  disabled?: boolean;
  /** Offer a "Clear pin" action. Off where clearing cannot be persisted (the gateway keeps the old pin). */
  allowClear?: boolean;
  hint?: string;
}) {
  const [latText, setLatText] = useState(
    value.latitude === undefined ? "" : String(value.latitude),
  );
  const [lngText, setLngText] = useState(
    value.longitude === undefined ? "" : String(value.longitude),
  );
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const pin = normalizePin({
    latitude: parseCoordinate(latText),
    longitude: parseCoordinate(lngText),
  });
  const error = rangeError({
    latitude: parseCoordinate(latText),
    longitude: parseCoordinate(lngText),
  });

  function commit(next: PinValue, lat: string, lng: string) {
    setLatText(lat);
    setLngText(lng);
    onChange(normalizePin(next));
  }

  function useCurrentLocation() {
    if (disabled || locating) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocateError("This browser cannot read your location — type the coordinates instead.");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        commit({ latitude: lat, longitude: lng }, String(lat), String(lng));
        setLocating(false);
      },
      (err) => {
        setLocateError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — allow it in the browser, or type the coordinates."
            : "Could not read your location — type the coordinates instead.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  }

  function clear() {
    setLocateError(null);
    commit({}, "", "");
  }

  const hasPin = pin.latitude !== undefined && pin.longitude !== undefined;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold">Shop location</p>
          <p className="text-[10px] text-muted-foreground">{hint}</p>
        </div>
        {hasPin ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">
            <MapPin className="h-3 w-3" strokeWidth={1.5} />
            Pinned
          </span>
        ) : null}
      </div>

      <button
        type="button"
        disabled={disabled || locating}
        onClick={useCurrentLocation}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-semibold disabled:opacity-50"
      >
        <Crosshair className="h-4 w-4" strokeWidth={1.5} />
        {locating ? "Reading location…" : hasPin ? "Update from this device" : "Use this device's location"}
      </button>

      {locateError ? (
        <p className="mt-2 text-[11px] text-destructive">{locateError}</p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <TextField
          label="Latitude"
          value={latText}
          {...(disabled !== undefined ? { disabled } : {})}
          placeholder="10.925400"
          onChange={(v) => commit({ latitude: parseCoordinate(v), longitude: parseCoordinate(lngText) }, v, lngText)}
        />
        <TextField
          label="Longitude"
          value={lngText}
          {...(disabled !== undefined ? { disabled } : {})}
          placeholder="79.838000"
          onChange={(v) => commit({ latitude: parseCoordinate(latText), longitude: parseCoordinate(v) }, latText, v)}
        />
      </div>

      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}

      {hasPin ? (
        <>
          <iframe
            title="Shop location map"
            className="mt-2 h-48 w-full rounded-lg border border-border"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${
              pin.longitude! - 0.004
            },${pin.latitude! - 0.004},${pin.longitude! + 0.004},${
              pin.latitude! + 0.004
            }&layer=mapnik&marker=${pin.latitude},${pin.longitude}`}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <a
              className="text-[11px] font-medium text-primary hover:underline"
              href={`https://www.openstreetmap.org/?mlat=${pin.latitude}&mlon=${pin.longitude}#map=17/${pin.latitude}/${pin.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              Open larger map
            </a>
            {allowClear ? (
              <button
                type="button"
                disabled={disabled}
                onClick={clear}
                className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <X className="h-3 w-3" strokeWidth={1.5} />
                Clear pin
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <p className="mt-2 text-[11px] text-muted-foreground">
          No pin yet — this shop cannot be auto-assigned to a rider until it is pinned.
        </p>
      )}
    </Card>
  );
}
