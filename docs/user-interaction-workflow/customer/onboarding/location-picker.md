# Location picker (customer)

**App / route:** customer · `Location` (`src/features/auth/LocationScreen.tsx`)
**Status:** Shipped
**Trigger:** After language selection; on an authenticated cold start with no usable origin
(`useLocationStore.status === 'idle'`); any time the user taps the Home location chip / the
"Enter address" action in the Home location nudge; or while browsing as a guest (optional — the
guest can close the screen or pick an area and continue).

## Two locations, deliberately

`useLocationStore` (`src/state/locationStore.ts`) keeps **two separate facts**:

- **`deviceFix`** — what the hardware says. Written only by a real GPS read (`setDeviceFix`). It
  keeps updating in the foreground even after the user picks another address, because the checkout
  distance guardrail needs the truth about where the phone is.
- **`activeLocation`** — where the order goes and which feeds sort from (`useLiveOrigin()`). It is
  the only thing sent to the gateway as the delivery origin, and carries
  `source: 'gps' | 'saved' | 'pinned'`.

Collapsing them into one field makes two real flows impossible: ordering to a saved address in
another city, and warning the user that they are nowhere near it. `overrideActive` records a
deliberate choice; while it is set, proximity auto-select stands down.

## Steps

1. A returning user with `useLocationStore.activeLocation` starts in `manual`; a first-time user
   starts in `request`.
2. **Primer (pre-permission):** the `request` step shows a benefit card ("Find stores delivering
   near you") plus "Allow location access" and "Enter location manually".
   - **Allow:** calls `requestAndRefreshLocation()` in strict order — runtime permission first, then
     the device Location master switch, then a high-accuracy fix + reverse geocode, then
     `adoptDeviceAsActive()` (an explicit "follow me" clears any override) and proximity auto-select.
     - On Android, two native OS dialogs are chained: first `PermissionsAndroid.request(ACCESS_FINE_LOCATION)`
       shows the system "Allow" / "Don't allow" app-permission dialog, then — if the device-wide
       toggle is off — the native `FaazioGeocoder.requestEnableLocation` (Play Services
       `SettingsClient.checkLocationSettings` + `ResolvableApiException.startResolutionForResult`)
       shows the Google-Maps-style "Turn on" / "No thanks" device-location dialog. No custom
       turn-on sheet is used. Accepting either path runs the fix without another tap.
     - On iOS the global switch has no in-app prompt; the screen shows an inline Settings hint and
       the "Open settings" link (`Linking.openSettings()`).
   - **Enter location manually:** skips the OS dialog entirely and goes to `manual`.
   - **Guest:** a close button (top-left) and "Browse without a location" link return to the
     catalogue; location is never required before an account exists.
   - **First denial (Android):** inline error; the manual path stays available and a later tap can
     show the OS dialog again.
   - **Services off after the native prompt:** if the user dismisses the system location dialog, the
     screen shows a short inline hint only (no instructional bottom sheet); the manual path stays
     available.
   - **Blocked (iOS "Don't Allow", Android "Don't ask again"):** the OS will never show the
     permission dialog again. The screen shows a Settings instruction, opens the Settings app via
     `Linking.openSettings()`, and the manual path stays available.
3. **Manual:** `usePlaceAutocomplete` searches places; `resolvePlaceLocation(placeId)` resolves the
   selected suggestion to coordinates + address.
4. Selecting a place or a confirmed fix calls `useLocationStore.setActiveLocation(...)` —
   `source: 'pinned'` for a picked area, `source: 'gps'` for the GPS path — and moves to `loader`.
   A picked place is reverse-geocoded once so the origin carries its `postalCode`/district/region.
5. After a short confirmation dwell, the screen navigates to `MainTabs` only when
   `status === 'ready'` and the origin is not `(0, 0)`. Otherwise it returns to `manual` with an error.
   - **Guest:** after a confirmed origin the screen navigates straight to `MainTabs` and skips the
     authenticated serviceability check (the coverage store returns `unknown` without a session).
   - **Signed in:** the enabled-district check is forced and an `unserviceable` origin is left to the
     app-level `ServiceAreaBlockedPage` — the screen never navigates around that verdict.

## Profile location sync (state/district/pincode)

`useCustomerLocationSync` (mounted in `App.tsx` next to `useLiveLocation`/`useServiceability`) reports
the covered origin to the gateway once it is `serviceable` with a valid 6-digit pincode:

- pincode comes from the origin's reverse geocode (`activeLocation.place` for a pinned origin, else
  `deviceFix.place`);
- state/district come from `useServiceabilityStore` (already matched against the active district
  master);
- `PUT /profile/location` stores `checkout.users.state_code`/`district_code`/`pincode` and mints the
  stable public customer id `fa<pincode><phone>` once (0132).

The last-sent tuple is persisted (`faazio:profile-location:v1`), so an unchanged origin does not
re-PUT on a cold start; a move or a newly-known pincode re-syncs. Failures are silent and retried on
the next change/foreground check. This never blocks the location flow.

## Proximity auto-select

While `overrideActive` is false, every device fix is matched against the caller's saved addresses
(`utils/addressProximity.findNearbySavedAddress`, 200 m radius, using each row's stored
`latitude`/`longitude`). The nearest match becomes `activeLocation` with `source: 'saved'`; with no
match the origin follows the device fix. Unpinned rows are skipped — matching a text address per poll
would need a network call and could match a different point than the user saved.
`useAddressesStore` caches the server list for this.

## Resume-time permission detection

`useLiveLocation` (mounted once in `App.tsx`) re-reads the native state on every `AppState` →
`active`:

- `getLocationAuthorizationStatus()` — the app grant.
- `isLocationServicesEnabled()` — the OS Location Services master switch (native
  `FaazioGeocoder` on iOS/Android).

A user who enabled location in the OS Settings app while Faazio was closed is detected on the next
foreground: the store flips to granted and a silent coarse fix runs, so the nearby feeds re-sort with
no restart and no second OS prompt. A chosen origin (`source: 'saved'` / `'pinned'`) is never
silently replaced by a GPS fix — the grant is adopted, the chosen address stays the origin.

## Blocked / denied users

`denied` and `blocked` are non-fatal: `MainTabs` still opens and `HomeTabScreen` shows a dismissible
banner ("Location following is off") with **Open Settings** (deep link to the OS screen) and
**Enter address** (`Location`) actions. No screen is held behind a location lockout. A chosen origin
stays `ready`, so nearby sorting keeps working from it even with GPS denied.

## State

- `useLocationStore` (`src/state/locationStore.ts`) — `status` (`idle`/`loading`/`ready`/`denied`/
  `blocked`), `deviceFix`, `activeLocation` (`source: 'gps' | 'saved' | 'pinned'`, with the origin's
  reverse-geocoded `place` when known), `overrideActive`, foreground-only fix, permission + services
  flags, persisted under `faazio:location:v2`.
- `useAddressesStore` (`src/state/addressesStore.ts`) — cached saved list for proximity matching.
- `useRemoteConfigStore` — supplies the Places API key via `selectPlacesApiKey`.
- `useCustomerLocationSync` (`src/hooks/useCustomerLocationSync.ts`) — reports the covered origin to
  `PUT /profile/location`; see "Profile location sync" above.

## Data path

- Device location permission + fix (no server write at this step).
- Reverse geocode via native `FaazioGeocoder` (`Geocoder` / `CLGeocoder`).
- Places autocomplete uses the configured Places API key (remote config override or bake-time
  default). No fixture coordinates are used as a live location.
- Once serviceable, `useCustomerLocationSync` calls `PUT /profile/location` with the state/district/
  pincode so the admin directory has the customer's real location and public id (0132).
- The chosen origin later drives `GET /stores/nearby` / `GET /products/nearby` (Haversine +
  bounding box), delivery-fee quotes, and `POST /orders`' `deliveryLocation`.

## Success / error / empty

- **Success:** `MainTabs`.
- **Permission denied / no fix:** inline message, manual entry remains available.
- **Unresolvable place:** inline message; user can retry or use current location.
- **Empty:** no suggestions → the user can still type/select manually.

## Known gaps

- Places availability depends on a valid API key; see `docs/RUNBOOKS/TROUBLESHOOTING.md`.
- Permission and services state are read through the local `FaazioGeocoder` native module
  (`getLocationAuthorizationStatus`, `isLocationServicesEnabled`, `requestEnableLocation`,
  `geocodeAddress`, `reverseGeocode`). On Android, `requestEnableLocation` uses
  `com.google.android.gms:play-services-location` for the system "Turn on location" dialog and falls
  back to `Settings.ACTION_LOCATION_SOURCE_SETTINGS` when an OEM build cannot show that dialog. A
  native rebuild (CI) is required when this module changes.

## Linked docs

- `docs/architecture/mobile-app.md` (live location + nearby reads)
- `docs/architecture/caching-cloudflare-valkey.md` (geo cache keys)
- [`../profile/saved-addresses.md`](../profile/saved-addresses.md)
- `data/DATA_CONTROL.md` (`seedLocation` is `@seed` + `@unused`)
